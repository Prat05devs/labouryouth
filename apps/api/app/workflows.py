from uuid import UUID as UUIDType

from fastapi import APIRouter, Header, Request
from jsonschema import ValidationError, validate
from sqlalchemy import func, select, update

from .dependencies import DB, Actor, permit
from .domain import *
from .events import emit
from .models import *
from .repository import get, listing, public
from .schemas import *

router = APIRouter()


def operations(request):
    return bool(set(request.state.roles) & {"SUPER_ADMIN", "OPERATIONS"})


async def job_visible(db, id, user, request):
    j = await get(db, JobRequest, id)
    if j.client_id != user.id and not operations(request):
        w = await worker_for(db, user.id)
        require(
            await db.scalar(select(JobOffer.id).where(JobOffer.job_id == id, JobOffer.worker_id == w.id)),
            "NOT_FOUND",
            404,
        )
    return j


@router.post("/jobs", status_code=201)
async def create_job(data: JobInput, request: Request, db: DB, user: Actor):
    permit(request, "CLIENT")
    profile = await db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id))
    require(profile and profile.onboarding_complete, "ONBOARDING_INCOMPLETE", 422)
    service = await get(db, ServiceCategory, data.service_id)
    area = await get(db, ServiceArea, data.service_area_id)
    address = await get(db, Address, data.address_id)
    require(address.owner_id == user.id, "NOT_FOUND", 404)
    require(service.active and area.active, "OUTSIDE_SERVICE_AREA", 422)
    require(data.schedule[0].start_at > now(), "SCHEDULE_INVALID", 422)
    require(
        await db.scalar(
            select(func.ST_DWithin(Address.point, ServiceArea.center, ServiceArea.radius_m)).where(
                Address.id == address.id, ServiceArea.id == area.id
            )
        ),
        "OUTSIDE_SERVICE_AREA",
        422,
    )
    try:
        validate(data.requirements, service.requirement_schema)
    except ValidationError:
        raise DomainError("INVALID_REQUIREMENTS", 422)
    payload = data.model_dump(exclude={"address_id", "requirements"})
    payload["schedule"] = [w.model_dump(mode="json") for w in data.schedule]
    j = JobRequest(
        client_id=user.id,
        location_snapshot=public(address),
        point=address.point,
        start_at=data.schedule[0].start_at,
        end_at=data.schedule[-1].end_at,
        **payload,
    )
    db.add(j)
    await db.flush()
    for key, value in data.requirements.items():
        db.add(JobRequirement(job_id=j.id, key=key, value=value))
    return {**public(j), "pricing": PricingService.quote(j)}


@router.get("/jobs")
async def jobs(request: Request, db: DB, user: Actor):
    return await listing(
        db, select(JobRequest).where(JobRequest.client_id == user.id).order_by(JobRequest.created_at.desc())
    )


@router.get("/jobs/{id}")
async def job_detail(id: UUIDType, request: Request, db: DB, user: Actor):
    j = await job_visible(db, id, user, request)
    assignments = list(await db.scalars(select(Assignment).where(Assignment.job_id == id)))
    offer_ids = list(await db.scalars(select(JobOffer.id).where(JobOffer.job_id == id)))
    shift_ids = list(
        await db.scalars(
            select(Shift.id)
            .join(Assignment, Shift.assignment_id == Assignment.id)
            .where(Assignment.job_id == id)
        )
    )
    timeline_ids = [id] + [a.id for a in assignments] + offer_ids + shift_ids
    return {
        **public(j),
        "assignments": [public(a) for a in assignments],
        "timeline": [
            public(e)
            for e in await db.scalars(
                select(DomainEvent)
                .where(DomainEvent.aggregate_id.in_(timeline_ids))
                .order_by(DomainEvent.created_at)
            )
        ],
    }


@router.post("/jobs/{id}/submit")
async def submit(id: UUIDType, db: DB, user: Actor):
    j = await get(db, JobRequest, id, True)
    require(j.client_id == user.id, "NOT_FOUND", 404)
    require(j.status == "DRAFT")
    require(j.start_at > now(), "SCHEDULE_INVALID", 422)
    j.status = "SUBMITTED"
    j.submitted_at = now()
    await emit(db, "JobSubmitted", j.id, [user.id], f"/shared/job/{j.id}")
    return public(j)


@router.post("/jobs/{id}/cancel")
async def cancel(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    j = await get(db, JobRequest, id, True)
    require(j.client_id == user.id or operations(request), "NOT_FOUND", 404)
    require(j.status not in ("COMPLETED", "CANCELLED", "EXPIRED"))
    assignments = list(await db.scalars(select(Assignment).where(Assignment.job_id == id)))
    ids = [a.id for a in assignments]
    require(
        not await db.scalar(
            select(Shift.id).where(Shift.assignment_id.in_(ids), Shift.status == "IN_PROGRESS")
        ),
        "ACTIVE_SHIFT_REQUIRES_SUPPORT",
    )
    j.status = "CANCELLED"
    db.add(Cancellation(job_id=id, actor_id=user.id, reason=data.reason))
    for a in assignments:
        if a.status in LIVE:
            a.status = "CANCELLED"
    await db.execute(
        update(Shift)
        .where(Shift.assignment_id.in_(ids), Shift.status == "SCHEDULED")
        .values(status="CANCELLED")
    )
    await db.execute(
        update(JobOffer).where(JobOffer.job_id == id, JobOffer.status == "PENDING").values(status="WITHDRAWN")
    )
    return public(j)


@router.get("/jobs/{id}/matches")
async def matches(id: UUIDType, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    return await listing(
        db,
        select(CandidateMatch)
        .where(CandidateMatch.job_id == id, CandidateMatch.status == "ELIGIBLE")
        .order_by(CandidateMatch.final_score.desc()),
    )


@router.get("/offers")
async def offers(db: DB, user: Actor):
    w = await worker_for(db, user.id)
    return await listing(
        db, select(JobOffer).where(JobOffer.worker_id == w.id).order_by(JobOffer.created_at.desc())
    )


@router.post("/offers/{id}/accept")
async def accept(id: UUIDType, db: DB, user: Actor, idempotency_key: str | None = Header(default=None)):
    return await idempotent(
        db, user, f"offer:{id}:accept", idempotency_key, {}, lambda: OfferService.accept(db, user, id)
    )


@router.post("/offers/{id}/decline")
async def decline(id: UUIDType, db: DB, user: Actor):
    o = await get(db, JobOffer, id, True)
    w = await worker_for(db, user.id)
    require(o.worker_id == w.id, "NOT_FOUND", 404)
    require(o.status == "PENDING")
    o.status = "DECLINED"
    o.responded_at = now()
    return public(o)


@router.get("/assignments")
async def assignments(db: DB, user: Actor):
    w = await worker_for(db, user.id)
    return await listing(
        db, select(Assignment).where(Assignment.worker_id == w.id).order_by(Assignment.created_at.desc())
    )


@router.get("/assignments/{id}")
async def assignment(id: UUIDType, request: Request, db: DB, user: Actor):
    a, w, j = await visible_assignment(db, id, user, operations(request))
    u = await get(db, User, w.user_id)
    return {
        **public(a),
        "job": public(j),
        "worker": {
            "id": str(w.id),
            "full_name": u.full_name,
            "experience_years": w.experience_years,
            "worker_status": w.worker_status,
            "photo_document_id": w.progress.get("photo", {}).get("document_id"),
        },
        "shifts": (
            await listing(db, select(Shift).where(Shift.assignment_id == id).order_by(Shift.scheduled_start))
        )["items"],
    }


async def move(db, user, id, target, source):
    a = await get(db, Assignment, id, True)
    w = await worker_for(db, user.id)
    require(a.worker_id == w.id, "NOT_FOUND", 404)
    require(w.worker_status == "ACTIVE", "WORKER_NOT_VERIFIED")
    require(a.status == source)
    j = await get(db, JobRequest, a.job_id)
    require(j.status not in ("CANCELLED", "ON_HOLD", "EXPIRED"))
    a.status = target
    await emit(
        db,
        "WorkerEnRoute" if target == "EN_ROUTE" else "WorkerArrived",
        a.id,
        [j.client_id, user.id],
        f"/shared/assignment/{id}",
    )
    return public(a)


@router.post("/assignments/{id}/en-route")
async def en_route(id: UUIDType, db: DB, user: Actor):
    return await move(db, user, id, "EN_ROUTE", "ACCEPTED")


@router.post("/assignments/{id}/arrived")
async def arrived(id: UUIDType, db: DB, user: Actor):
    return await move(db, user, id, "ARRIVED", "EN_ROUTE")


@router.post("/assignments/{id}/prepare-next-shift")
async def next_shift(id: UUIDType, db: DB, user: Actor):
    a = await get(db, Assignment, id, True)
    w = await worker_for(db, user.id)
    require(a.worker_id == w.id, "NOT_FOUND", 404)
    require(a.status == "IN_PROGRESS")
    require(
        not await db.scalar(select(Shift.id).where(Shift.assignment_id == id, Shift.status == "IN_PROGRESS"))
    )
    require(await db.scalar(select(Shift.id).where(Shift.assignment_id == id, Shift.status == "SCHEDULED")))
    a.status = "ACCEPTED"
    return public(a)


@router.post("/shifts/{id}/check-in")
async def check_in(
    id: UUIDType, data: CheckInInput, db: DB, user: Actor, idempotency_key: str | None = Header(default=None)
):
    return await idempotent(
        db,
        user,
        f"shift:{id}:check-in",
        idempotency_key,
        data.model_dump(mode="json"),
        lambda: ShiftService.check_in(db, user, id, data),
    )


@router.post("/shifts/{id}/complete")
async def complete(id: UUIDType, db: DB, user: Actor, idempotency_key: str | None = Header(default=None)):
    return await idempotent(
        db, user, f"shift:{id}:complete", idempotency_key, {}, lambda: ShiftService.complete(db, user, id)
    )


@router.post("/shifts/{id}/manual-check-in-request")
async def manual(id: UUIDType, data: ReasonInput, db: DB, user: Actor):
    s, a, w, _ = await ShiftService.context(db, user, id)
    require(s.status == "SCHEDULED" and a.status == "ARRIVED")
    e = AttendanceEvent(
        worker_id=w.id, shift_id=id, actor_id=user.id, type="MANUAL_REQUEST", reason=data.reason
    )
    db.add(e)
    await db.flush()
    return public(e)


@router.post("/replacements", status_code=201)
async def replacement(data: ReplacementInput, request: Request, db: DB, user: Actor):
    a, w, j = await visible_assignment(db, data.assignment_id, user, operations(request))
    require(a.status in LIVE + ("NO_SHOW",))
    row = ReplacementRequest(
        job_id=j.id,
        original_assignment_id=a.id,
        requester_id=user.id,
        reason=data.reason,
        details=data.details,
    )
    db.add(row)
    await db.flush()
    await emit(db, "ReplacementRequested", row.id, [j.client_id, w.user_id], f"/shared/assignment/{a.id}")
    return public(row)


@router.get("/replacements")
async def replacement_list(db: DB, user: Actor):
    return await listing(
        db,
        select(ReplacementRequest)
        .where(ReplacementRequest.requester_id == user.id)
        .order_by(ReplacementRequest.created_at.desc()),
    )


@router.post("/incidents", status_code=201)
async def incident(data: IncidentInput, request: Request, db: DB, user: Actor):
    await visible_assignment(db, data.assignment_id, user, operations(request))
    row = Incident(reporter_id=user.id, **data.model_dump())
    db.add(row)
    await db.flush()
    return public(row)


@router.post("/reviews", status_code=201)
async def review(data: ReviewInput, db: DB, user: Actor):
    a, w, j = await visible_assignment(db, data.assignment_id, user)
    require(j.client_id == user.id, "FORBIDDEN", 403)
    require(a.status == "COMPLETED")
    row = Review(reviewer_id=user.id, reviewee_id=w.user_id, **data.model_dump())
    db.add(row)
    await db.flush()
    return public(row)


@router.get("/worker/earnings")
async def earnings(db: DB, user: Actor):
    w = await worker_for(db, user.id)
    rows = await listing(
        db,
        select(WorkerLedgerEntry)
        .where(WorkerLedgerEntry.worker_id == w.id)
        .order_by(WorkerLedgerEntry.created_at.desc()),
    )
    return {
        **rows,
        "currency": "INR",
        "balance_paise": await db.scalar(
            select(func.coalesce(func.sum(WorkerLedgerEntry.amount_paise), 0)).where(
                WorkerLedgerEntry.worker_id == w.id
            )
        ),
    }


@router.get("/notifications")
async def notifications(db: DB, user: Actor):
    return await listing(
        db,
        select(Notification)
        .where(Notification.recipient_id == user.id)
        .order_by(Notification.created_at.desc()),
    )


@router.post("/notifications/{id}/read")
async def mark_read(id: UUIDType, db: DB, user: Actor):
    n = await get(db, Notification, id)
    require(n.recipient_id == user.id, "NOT_FOUND", 404)
    n.read_at = now()
    return public(n)
