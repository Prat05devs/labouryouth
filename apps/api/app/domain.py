import hashlib
import json
from datetime import datetime, timedelta

from sqlalchemy import func, select, text, update

from .config import settings
from .errors import DomainError, require
from .events import emit
from .models import *
from .repository import get, public
from .security import now

LIVE = ("PENDING", "ACCEPTED", "EN_ROUTE", "ARRIVED", "IN_PROGRESS")


async def worker_for(db, user_id, lock=False):
    q = select(WorkerProfile).where(WorkerProfile.user_id == user_id)
    worker = await db.scalar(q.with_for_update() if lock else q)
    require(worker, "NOT_FOUND", 404)
    return worker


async def visible_assignment(db, id, user, admin=False):
    a = await get(db, Assignment, id)
    w = await get(db, WorkerProfile, a.worker_id)
    j = await get(db, JobRequest, a.job_id)
    require(admin or j.client_id == user.id or w.user_id == user.id, "NOT_FOUND", 404)
    return a, w, j


async def idempotent(db, user, operation, key, payload, action):
    require(key and 8 <= len(key) <= 120, "IDEMPOTENCY_KEY_REQUIRED", 422)
    hashed = hashlib.sha256(json.dumps(payload, sort_keys=True, default=str).encode()).hexdigest()
    lock = int.from_bytes(
        hashlib.sha256(f"{user.id}:{operation}:{key}".encode()).digest()[:8], "big", signed=True
    )
    await db.execute(text("SELECT pg_advisory_xact_lock(:key)"), {"key": lock})
    old = await db.scalar(
        select(IdempotencyRecord).where(
            IdempotencyRecord.actor_id == user.id,
            IdempotencyRecord.operation == operation,
            IdempotencyRecord.key == key,
        )
    )
    if old:
        require(old.request_hash == hashed, "IDEMPOTENCY_CONFLICT")
        return old.response
    result = await action()
    db.add(
        IdempotencyRecord(
            actor_id=user.id, operation=operation, key=key, request_hash=hashed, response=result
        )
    )
    await db.flush()
    return result


class PricingService:
    @staticmethod
    def quote(job):
        return {
            "status": "QUOTE_REQUIRED",
            "currency": job.currency,
            "budget_min": job.budget_min,
            "budget_max": job.budget_max,
        }


class MatchingService:
    @staticmethod
    async def eligibility(db, job, worker, windows=None, amount=None):
        require(
            worker.worker_status == "ACTIVE" and worker.onboarding_status == "COMPLETE", "WORKER_NOT_VERIFIED"
        )
        require(
            await db.scalar(
                select(WorkerService.id).where(
                    WorkerService.worker_id == worker.id, WorkerService.service_id == job.service_id
                )
            ),
            "SERVICE_MISMATCH",
        )
        service = await get(db, ServiceCategory, job.service_id)
        approved = set(
            await db.scalars(
                select(WorkerVerification.type).where(
                    WorkerVerification.worker_id == worker.id,
                    WorkerVerification.status == "APPROVED",
                    (WorkerVerification.expires_at.is_(None)) | (WorkerVerification.expires_at > now()),
                )
            )
        )
        require(set(service.verification_types) <= approved, "WORKER_NOT_VERIFIED")
        avail = await db.scalar(select(WorkerAvailability).where(WorkerAvailability.worker_id == worker.id))
        require(
            avail
            and avail.online
            and avail.point is not None
            and avail.service_area_id == job.service_area_id,
            "WORKER_UNAVAILABLE",
        )
        require(job.engagement_type in worker.engagement_types, "ENGAGEMENT_MISMATCH")
        distance = await db.scalar(
            select(
                func.ST_Distance(
                    WorkerAvailability.point,
                    select(JobRequest.point).where(JobRequest.id == job.id).scalar_subquery(),
                )
            ).where(WorkerAvailability.id == avail.id)
        )
        require(distance is not None and distance <= avail.radius_m, "OUTSIDE_SERVICE_AREA")
        require(
            amount is None or worker.rate_min_paise is None or amount >= worker.rate_min_paise,
            "RATE_MISMATCH",
        )
        for window in windows or job.schedule:
            start = datetime.fromisoformat(window["start_at"])
            end = datetime.fromisoformat(window["end_at"])
            q = (
                select(Shift.id)
                .join(Assignment, Shift.assignment_id == Assignment.id)
                .where(
                    Assignment.worker_id == worker.id,
                    Assignment.status.in_(LIVE),
                    Shift.status.in_(["SCHEDULED", "IN_PROGRESS"]),
                    Shift.scheduled_start < end,
                    Shift.scheduled_end > start,
                )
            )
            require(not await db.scalar(q.limit(1)), "SCHEDULE_CONFLICT")
        return int(distance)

    @staticmethod
    async def generate(db, job):
        require(job.status in ("SUBMITTED", "MATCHING", "OFFERING", "ASSIGNED", "ACTIVE"))
        if job.status == "SUBMITTED":
            job.status = "MATCHING"
        await db.execute(update(CandidateMatch).where(CandidateMatch.job_id == job.id).values(status="STALE"))
        results = []
        for worker in await db.scalars(select(WorkerProfile).where(WorkerProfile.worker_status == "ACTIVE")):
            try:
                distance = await MatchingService.eligibility(db, job, worker, amount=job.budget_max)
            except DomainError:
                continue
            row = await db.scalar(
                select(CandidateMatch).where(
                    CandidateMatch.job_id == job.id, CandidateMatch.worker_id == worker.id
                )
            )
            if not row:
                row = CandidateMatch(job_id=job.id, worker_id=worker.id)
                db.add(row)
            row.distance_m = distance
            row.final_score = max(0, 100 - int(distance / 500))
            row.metadata_ = {"version": 1, "eligibility": "passed"}
            row.status = "ELIGIBLE"
            row.generated_at = now()
            await db.flush()
            results.append(public(row))
        return {
            "items": sorted(results, key=lambda x: (-x["final_score"], x["worker_id"])),
            "next_cursor": None,
        }


class OfferService:
    @staticmethod
    async def accept(db, user, id):
        offer = await get(db, JobOffer, id)
        job = await get(db, JobRequest, offer.job_id, True)
        worker = await worker_for(db, user.id, True)
        require(offer.worker_id == worker.id, "NOT_FOUND", 404)
        await db.refresh(offer, with_for_update=True)
        require(offer.status == "PENDING", "JOB_ALREADY_ASSIGNED")
        require(offer.expires_at > now(), "OFFER_EXPIRED")
        require(job.status in ("OFFERING", "MATCHING", "ASSIGNED", "ACTIVE"), "JOB_ALREADY_ASSIGNED")
        replacement = None
        original = None
        windows = job.schedule
        if offer.replacement_request_id:
            replacement = await get(db, ReplacementRequest, offer.replacement_request_id, True)
            require(replacement.status in ("MATCHING", "OFFERING"), "JOB_ALREADY_ASSIGNED")
            original = await get(db, Assignment, replacement.original_assignment_id, True)
            require(
                original.worker_id != worker.id and original.status in LIVE + ("NO_SHOW",),
                "INVALID_REPLACEMENT",
            )
            require(
                not await db.scalar(
                    select(Shift.id).where(Shift.assignment_id == original.id, Shift.status == "IN_PROGRESS")
                ),
                "SHIFT_NOT_ACTIVE",
            )
            remaining = list(
                await db.scalars(
                    select(Shift)
                    .where(Shift.assignment_id == original.id, Shift.status == "SCHEDULED")
                    .order_by(Shift.scheduled_start)
                )
            )
            require(remaining, "NO_REMAINING_SHIFTS")
            windows = [
                {"start_at": s.scheduled_start.isoformat(), "end_at": s.scheduled_end.isoformat()}
                for s in remaining
            ]
            slot = original.slot_number
        else:
            occupied = set(
                await db.scalars(
                    select(Assignment.slot_number).where(
                        Assignment.job_id == job.id,
                        Assignment.status.not_in(["CANCELLED", "REPLACED", "NO_SHOW"]),
                    )
                )
            )
            free = [i for i in range(1, job.headcount + 1) if i not in occupied]
            require(free, "JOB_ALREADY_ASSIGNED")
            slot = free[0]
        await MatchingService.eligibility(db, job, worker, windows, offer.agreed_worker_amount_paise)
        if original:
            original.status = "REPLACED"
            for s in remaining:
                s.status = "CANCELLED"
            await db.flush()
        offer.status = "ACCEPTED"
        offer.responded_at = now()
        a = Assignment(
            job_id=job.id,
            worker_id=worker.id,
            offer_id=offer.id,
            slot_number=slot,
            replacement_of_id=original.id if original else None,
        )
        db.add(a)
        await db.flush()
        rate, remainder = divmod(offer.agreed_worker_amount_paise, len(windows))
        for i, w in enumerate(windows):
            db.add(
                Shift(
                    assignment_id=a.id,
                    scheduled_start=datetime.fromisoformat(w["start_at"]),
                    scheduled_end=datetime.fromisoformat(w["end_at"]),
                    agreed_earning_paise=rate + (1 if i < remainder else 0),
                )
            )
        count = await db.scalar(
            select(func.count())
            .select_from(Assignment)
            .where(
                Assignment.job_id == job.id, Assignment.status.not_in(["CANCELLED", "REPLACED", "NO_SHOW"])
            )
        )
        if count >= job.headcount:
            if job.status != "ACTIVE":
                job.status = "ASSIGNED"
            await db.execute(
                update(JobOffer)
                .where(
                    JobOffer.job_id == job.id,
                    JobOffer.status == "PENDING",
                    JobOffer.replacement_request_id.is_(None),
                )
                .values(status="WITHDRAWN")
            )
        if replacement:
            replacement.status = "RESOLVED"
            replacement.replacement_assignment_id = a.id
            replacement.resolved_at = now()
            await db.execute(
                update(JobOffer)
                .where(JobOffer.replacement_request_id == replacement.id, JobOffer.status == "PENDING")
                .values(status="WITHDRAWN")
            )
            await emit(
                db,
                "ReplacementAssigned",
                replacement.id,
                [job.client_id, user.id],
                f"/shared/assignment/{a.id}",
            )
        await emit(db, "OfferAccepted", offer.id, [user.id, job.client_id], f"/shared/assignment/{a.id}")
        await emit(db, "AssignmentCreated", a.id, [user.id, job.client_id], f"/shared/assignment/{a.id}")
        return public(a)


class ShiftService:
    @staticmethod
    async def context(db, user, id):
        s = await get(db, Shift, id)
        a = await get(db, Assignment, s.assignment_id)
        j = await get(db, JobRequest, a.job_id, True)
        w = await get(db, WorkerProfile, a.worker_id, True)
        require(w.user_id == user.id, "NOT_FOUND", 404)
        await db.refresh(a, with_for_update=True)
        await db.refresh(s, with_for_update=True)
        require(w.worker_status == "ACTIVE", "WORKER_NOT_VERIFIED")
        require(j.status not in ("CANCELLED", "EXPIRED", "ON_HOLD"), "SHIFT_NOT_ACTIVE")
        return s, a, w, j

    @staticmethod
    async def check_in(db, user, id, data):
        s, a, w, j = await ShiftService.context(db, user, id)
        require(a.status == "ARRIVED" and s.status == "SCHEDULED", "SHIFT_NOT_ACTIVE")
        cfg = settings()
        instant = now()
        error = None
        if (
            not s.scheduled_start - timedelta(minutes=cfg.check_in_early_minutes)
            <= instant
            <= min(s.scheduled_start + timedelta(minutes=cfg.check_in_late_minutes), s.scheduled_end)
        ):
            error = "CHECK_IN_WINDOW_CLOSED"
        elif data.accuracy_m > cfg.max_location_accuracy_meters:
            error = "LOCATION_INACCURATE"
        elif abs((instant - data.device_timestamp).total_seconds()) > cfg.max_location_age_seconds:
            error = "LOCATION_STALE"
        elif not await db.scalar(
            select(
                func.ST_DWithin(
                    JobRequest.point,
                    func.ST_GeogFromText(f"SRID=4326;POINT({data.longitude} {data.latitude})"),
                    # Without a map pin the job point is the area centre, so only presence in the area is checked.
                    cfg.geofence_radius_meters
                    if j.location_precision == "PIN"
                    else select(ServiceArea.radius_m)
                    .where(ServiceArea.id == j.service_area_id)
                    .scalar_subquery(),
                )
            ).where(JobRequest.id == j.id)
        ):
            error = "OUTSIDE_GEOFENCE"
        db.add(
            AttendanceEvent(
                worker_id=w.id,
                shift_id=s.id,
                actor_id=user.id,
                type="REJECTED" if error else "CHECK_IN",
                observation=data.model_dump(mode="json"),
                device_timestamp=data.device_timestamp,
                reason=error,
            )
        )
        if error:
            await db.commit()
            raise DomainError(error, 409, {"retryable": True})
        s.status = "IN_PROGRESS"
        a.status = "IN_PROGRESS"
        a.started_at = a.started_at or instant
        j.status = "ACTIVE"
        await emit(db, "WorkerCheckedIn", s.id, [j.client_id, user.id], f"/shared/assignment/{a.id}")
        await db.flush()
        return public(s)

    @staticmethod
    async def complete(db, user, id):
        s, a, w, j = await ShiftService.context(db, user, id)
        require(s.status == "IN_PROGRESS" and a.status == "IN_PROGRESS", "SHIFT_NOT_ACTIVE")
        s.status = "COMPLETED"
        db.add(AttendanceEvent(worker_id=w.id, shift_id=s.id, actor_id=user.id, type="CHECK_OUT"))
        db.add(
            WorkerLedgerEntry(
                worker_id=w.id,
                type="EARNING",
                amount_paise=s.agreed_earning_paise,
                shift_id=s.id,
                source_key=f"shift:{s.id}:earning",
            )
        )
        await db.flush()
        if not await db.scalar(
            select(func.count())
            .select_from(Shift)
            .where(Shift.assignment_id == a.id, Shift.status.not_in(["COMPLETED", "CANCELLED"]))
        ):
            a.status = "COMPLETED"
            a.completed_at = now()
            await db.flush()
            if (
                await db.scalar(
                    select(func.count())
                    .select_from(Assignment)
                    .where(Assignment.job_id == j.id, Assignment.status == "COMPLETED")
                )
                >= j.headcount
            ):
                j.status = "COMPLETED"
        await emit(db, "ShiftCompleted", s.id, [j.client_id, user.id], f"/shared/assignment/{a.id}")
        return public(s)
