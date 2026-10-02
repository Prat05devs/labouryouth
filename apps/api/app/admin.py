from uuid import UUID as UUIDType

from fastapi import APIRouter, Header, Request
from sqlalchemy import func, select

from .dependencies import DB, Actor, permit
from .domain import LIVE, MatchingService, idempotent
from .errors import require
from .events import audit, emit
from .models import *
from .repository import get, listing, public
from .schemas import OfferInput, PaymentCreate, PaymentReconcile, ReasonInput
from .security import now

router = APIRouter(prefix="/admin")
READS = {
    "workers": (WorkerProfile, "OPERATIONS"),
    "clients": (ClientProfile, "OPERATIONS"),
    "jobs": (JobRequest, "OPERATIONS"),
    "assignments": (Assignment, "OPERATIONS"),
    "replacements": (ReplacementRequest, "OPERATIONS"),
    "attendance": (AttendanceEvent, "OPERATIONS"),
    "payments": (Payment, "FINANCE"),
    "ledger": (WorkerLedgerEntry, "FINANCE"),
    "incidents": (Incident, "SUPPORT"),
    "verifications": (WorkerVerification, "VERIFICATION"),
}


@router.get("/overview")
async def overview(request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    return {
        "open_jobs": await db.scalar(
            select(func.count())
            .select_from(JobRequest)
            .where(JobRequest.status.in_(["SUBMITTED", "MATCHING", "OFFERING"]))
        ),
        "pending_verifications": await db.scalar(
            select(func.count()).select_from(WorkerVerification).where(WorkerVerification.status == "PENDING")
        ),
        "active_assignments": await db.scalar(
            select(func.count()).select_from(Assignment).where(Assignment.status.in_(LIVE))
        ),
        "open_replacements": await db.scalar(
            select(func.count())
            .select_from(ReplacementRequest)
            .where(ReplacementRequest.status.not_in(["RESOLVED", "REJECTED", "CANCELLED"]))
        ),
    }


@router.get("/{section}")
async def rows(section: str, request: Request, db: DB, user: Actor):
    require(section in READS, "NOT_FOUND", 404)
    model, role = READS[section]
    permit(request, role)
    return await listing(db, select(model).order_by(model.created_at.desc()))


@router.get("/workers/{id}")
async def worker(id: UUIDType, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS", "VERIFICATION")
    w = await get(db, WorkerProfile, id)
    u = await get(db, User, w.user_id)
    return {
        **public(w),
        "full_name": u.full_name,
        "phone_number": u.phone_number,
        "verifications": (
            await listing(db, select(WorkerVerification).where(WorkerVerification.worker_id == id))
        )["items"],
    }


async def verify(id, data, request, db, user, target):
    permit(request, "VERIFICATION")
    v = await get(db, WorkerVerification, id, True)
    require(v.status == "PENDING")
    v.status = target
    v.reason = data.reason
    v.reviewer_id = user.id
    v.reviewed_at = now()
    w = await get(db, WorkerProfile, v.worker_id, True)
    if target == "REJECTED":
        w.onboarding_status = "IN_PROGRESS"
    audit(db, user, "verification." + target.lower(), v.id, request.state.request_id, {"reason": data.reason})
    if target == "APPROVED":
        await emit(db, "VerificationApproved", v.id, [w.user_id], "/worker/profile")
    return public(v)


@router.post("/verifications/{id}/approve")
async def approve(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    return await verify(id, data, request, db, user, "APPROVED")


@router.post("/verifications/{id}/reject")
async def reject(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    return await verify(id, data, request, db, user, "REJECTED")


@router.post("/workers/{id}/activate")
async def activate(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    permit(request, "VERIFICATION")
    w = await get(db, WorkerProfile, id, True)
    require(w.onboarding_status == "SUBMITTED")
    services = list(
        await db.scalars(
            select(ServiceCategory)
            .join(WorkerService, WorkerService.service_id == ServiceCategory.id)
            .where(WorkerService.worker_id == id)
        )
    )
    required = {t for s in services for t in s.verification_types}
    approved = set(
        await db.scalars(
            select(WorkerVerification.type).where(
                WorkerVerification.worker_id == id,
                WorkerVerification.status == "APPROVED",
                (WorkerVerification.expires_at.is_(None)) | (WorkerVerification.expires_at > now()),
            )
        )
    )
    require(services and required <= approved, "WORKER_NOT_VERIFIED")
    w.worker_status = "ACTIVE"
    w.onboarding_status = "COMPLETE"
    audit(db, user, "worker.activate", id, request.state.request_id, {"reason": data.reason})
    return public(w)


@router.post("/jobs/{id}/generate-matches")
async def generate(id: UUIDType, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    j = await get(db, JobRequest, id, True)
    result = await MatchingService.generate(db, j)
    audit(db, user, "matches.generate", id, request.state.request_id)
    return result


@router.post("/jobs/{id}/offers", status_code=201)
async def offer(id: UUIDType, data: OfferInput, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    j = await get(db, JobRequest, id, True)
    w = await get(db, WorkerProfile, data.worker_id, True)
    require(j.status in ("MATCHING", "OFFERING", "ASSIGNED", "ACTIVE"))
    require(now() < data.expires_at <= j.end_at, "OFFER_EXPIRY_INVALID", 422)
    require(data.agreed_worker_amount_paise > 0, "QUOTE_REQUIRED", 422)
    await MatchingService.eligibility(db, j, w, amount=data.agreed_worker_amount_paise)
    if data.replacement_request_id:
        replacement = await get(db, ReplacementRequest, data.replacement_request_id, True)
        require(replacement.job_id == id and replacement.status in ("MATCHING", "OFFERING"))
        replacement.status = "OFFERING"
    else:
        count = await db.scalar(
            select(func.count())
            .select_from(Assignment)
            .where(Assignment.job_id == id, Assignment.status.not_in(["CANCELLED", "REPLACED", "NO_SHOW"]))
        )
        require(count < j.headcount, "JOB_ALREADY_ASSIGNED")
    o = JobOffer(job_id=id, **data.model_dump())
    db.add(o)
    await db.flush()
    if j.status in ("MATCHING", "OFFERING"):
        j.status = "OFFERING"
    await emit(db, "OfferCreated", o.id, [w.user_id], "/worker/offers")
    audit(db, user, "offer.create", o.id, request.state.request_id)
    return public(o)


@router.post("/replacements/{id}/rematch")
async def rematch(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    r = await get(db, ReplacementRequest, id)
    j = await get(db, JobRequest, r.job_id, True)
    await db.refresh(r, with_for_update=True)
    require(r.status in ("REQUESTED", "UNDER_REVIEW", "MATCHING", "OFFERING"))
    r.status = "MATCHING"
    result = await MatchingService.generate(db, j)
    original = await get(db, Assignment, r.original_assignment_id)
    result["items"] = [x for x in result["items"] if x["worker_id"] != str(original.worker_id)]
    audit(db, user, "replacement.rematch", id, request.state.request_id, {"reason": data.reason})
    return result


@router.post("/attendance/{id}/approve")
async def attendance_approve(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    e = await get(db, AttendanceEvent, id)
    s = await get(db, Shift, e.shift_id)
    a = await get(db, Assignment, s.assignment_id)
    j = await get(db, JobRequest, a.job_id, True)
    w = await get(db, WorkerProfile, e.worker_id, True)
    await db.refresh(a, with_for_update=True)
    await db.refresh(s, with_for_update=True)
    require(e.type == "MANUAL_REQUEST" and s.status == "SCHEDULED" and a.status == "ARRIVED")
    require(w.worker_status == "ACTIVE", "WORKER_NOT_VERIFIED")
    require(j.status not in ("CANCELLED", "ON_HOLD", "EXPIRED"))
    require(
        not await db.scalar(
            select(AuditLog.id).where(
                AuditLog.entity_id == id, AuditLog.action.in_(["attendance.approve", "attendance.reject"])
            )
        )
    )
    s.status = "IN_PROGRESS"
    a.status = "IN_PROGRESS"
    a.started_at = a.started_at or now()
    j.status = "ACTIVE"
    db.add(
        AttendanceEvent(
            worker_id=w.id,
            shift_id=s.id,
            actor_id=user.id,
            type="MANUAL_CHECK_IN",
            reason=data.reason,
            observation={"request_event_id": str(id)},
        )
    )
    audit(db, user, "attendance.approve", id, request.state.request_id, {"reason": data.reason})
    await emit(db, "WorkerCheckedIn", s.id, [j.client_id, w.user_id], f"/shared/assignment/{a.id}")
    return public(s)


@router.post("/attendance/{id}/reject")
async def attendance_reject(id: UUIDType, data: ReasonInput, request: Request, db: DB, user: Actor):
    permit(request, "OPERATIONS")
    e = await get(db, AttendanceEvent, id, True)
    require(e.type == "MANUAL_REQUEST")
    require(
        not await db.scalar(
            select(AuditLog.id).where(
                AuditLog.entity_id == id, AuditLog.action.in_(["attendance.approve", "attendance.reject"])
            )
        )
    )
    audit(db, user, "attendance.reject", id, request.state.request_id, {"reason": data.reason})
    return {"status": "REJECTED"}


@router.post("/payments", status_code=201)
async def create_payment(
    data: PaymentCreate,
    request: Request,
    db: DB,
    user: Actor,
    idempotency_key: str | None = Header(default=None),
):
    permit(request, "FINANCE")

    async def action():
        job = await get(db, JobRequest, data.job_id, True)
        require(job.status not in ("DRAFT", "CANCELLED", "EXPIRED"), "INVALID_STATE_TRANSITION")
        payment = Payment(
            job_id=job.id,
            payer_id=job.client_id,
            method=data.method,
            amount_paise=data.amount_paise,
            currency=job.currency,
            status="PENDING",
        )
        db.add(payment)
        await db.flush()
        audit(db, user, "payment.create", payment.id, request.state.request_id, {"method": data.method})
        return public(payment)

    return await idempotent(db, user, "payment:create", idempotency_key, data.model_dump(mode="json"), action)


@router.post("/payments/{id}/reconcile")
async def reconcile_payment(
    id: UUIDType,
    data: PaymentReconcile,
    request: Request,
    db: DB,
    user: Actor,
    idempotency_key: str | None = Header(default=None),
):
    permit(request, "FINANCE")

    async def action():
        payment = await get(db, Payment, id, True)
        require(payment.status == "PENDING", "INVALID_STATE_TRANSITION")
        require(data.amount_paise == payment.amount_paise, "VALIDATION_ERROR", 422)
        require(payment.method in ("CASH", "MANUAL_UPI"), "INVALID_STATE_TRANSITION")
        payment.status = "CAPTURED"
        payment.provider_reference = data.reference
        await emit(db, "PaymentCaptured", payment.id, [payment.payer_id], f"/shared/job/{payment.job_id}")
        audit(
            db,
            user,
            "payment.reconcile",
            payment.id,
            request.state.request_id,
            {"reference_suffix": data.reference[-4:]},
        )
        return public(payment)

    return await idempotent(db, user, f"payment:{id}:reconcile", idempotency_key, data.model_dump(), action)
