from datetime import timedelta
from typing import Literal
from uuid import UUID as UUIDType
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Query, Request
from sqlalchemy import func, select

from .dependencies import DB, Actor, permit
from .domain import LIVE, MatchingService
from .errors import require
from .events import audit, emit
from .maps import contact_links, pin_for
from .models import (
    Address,
    Assignment,
    City,
    ClientProfile,
    JobInterest,
    JobOffer,
    JobRequest,
    Locality,
    Review,
    ServiceArea,
    ServiceCategory,
    User,
    WorkerAvailability,
    WorkerProfile,
    WorkerService,
)
from .repository import get, listing, public
from .schemas import QuickJobInput
from .security import now
from .workflows import operations, worker_for

router = APIRouter()
OPEN = ("SUBMITTED", "MATCHING", "OFFERING")
IST = ZoneInfo("Asia/Kolkata")
BENCHMARK_MIN_SAMPLES = 5


async def trust(db, user_id):
    """Average rating and counts from real reviews only; nothing is shown until reviews exist."""
    avg, count = (
        await db.execute(
            select(func.avg(Review.rating), func.count(Review.id)).where(Review.reviewee_id == user_id)
        )
    ).one()
    return {"average": round(float(avg), 1) if avg is not None else None, "reviews": count}


async def filled(db, job_id):
    live = await db.scalar(
        select(func.count())
        .select_from(Assignment)
        .where(Assignment.job_id == job_id, Assignment.status.in_(LIVE))
    )
    pending = await db.scalar(
        select(func.count())
        .select_from(JobOffer)
        .where(JobOffer.job_id == job_id, JobOffer.status == "PENDING", JobOffer.expires_at > now())
    )
    return live + pending


@router.get("/localities")
async def localities(db: DB):
    return await listing(db, select(Locality).where(Locality.active).order_by(Locality.sort_order))


@router.post("/jobs/quick", status_code=201)
async def quick_job(data: QuickJobInput, request: Request, db: DB, user: Actor):
    """Employer posts a one-day requirement in a single step; it opens for nearby workers immediately."""
    permit(request, "CLIENT")
    profile = await db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id))
    require(profile and profile.onboarding_complete, "ONBOARDING_INCOMPLETE", 422)
    service = await get(db, ServiceCategory, data.service_id)
    area = await get(db, ServiceArea, data.service_area_id)
    require(service.active and area.active, "OUTSIDE_SERVICE_AREA", 422)
    require(now() < data.start_at <= now() + timedelta(days=14), "SCHEDULE_INVALID", 422)
    point, lat, lng, precision = await pin_for(db, area, data.maps_url, data.latitude, data.longitude)
    city = await get(db, City, area.city_id)
    address = Address(
        owner_id=user.id,
        city_id=city.id,
        label=data.locality or "Job site",
        line1=data.locality or "Pinned location",
        locality=data.locality,
        state=city.state,
        postal_code="",
        latitude=str(lat),
        longitude=str(lng),
        point=point,
        maps_url=data.maps_url,
        location_precision=precision,
    )
    db.add(address)
    await db.flush()
    end_at = data.start_at + timedelta(hours=data.hours)
    job = JobRequest(
        client_id=user.id,
        service_id=service.id,
        service_area_id=area.id,
        engagement_type="DAILY",
        location_snapshot=public(address),
        point=point,
        location_precision=precision,
        maps_url=data.maps_url,
        contact_whatsapp=profile.whatsapp_number or user.phone_number,
        start_at=data.start_at,
        end_at=end_at,
        schedule=[{"start_at": data.start_at.isoformat(), "end_at": end_at.isoformat()}],
        headcount=data.headcount,
        budget_min=data.wage_per_day_paise,
        budget_max=data.wage_per_day_paise,
        notes=data.notes,
        status="SUBMITTED",
        submitted_at=now(),
    )
    db.add(job)
    await db.flush()
    await emit(db, "JobSubmitted", job.id, [user.id], f"/shared/job/{job.id}")
    matches = await MatchingService.generate(db, job)
    workers = list(
        await db.scalars(
            select(WorkerProfile.user_id).where(
                WorkerProfile.id.in_([m["worker_id"] for m in matches["items"]])
            )
        )
    )
    await emit(db, "NewJobNearby", job.id, workers, "/worker/jobs")
    audit(db, user, "job.quick_post", job.id, request.state.request_id)
    return {**public(job), "notified_workers": len(workers)}


@router.get("/worker/jobs/nearby")
async def nearby(
    request: Request,
    db: DB,
    user: Actor,
    radius_km: int = Query(default=10),
    service_id: UUIDType | None = None,
    today: bool = False,
    engagement: Literal["DAILY", "PERMANENT"] | None = None,
    min_wage_paise: int | None = Query(default=None, ge=0, le=100000000),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
):
    permit(request, "WORKER")
    require(radius_km in (2, 5, 10, 20), "VALIDATION_ERROR", 422)
    worker = await worker_for(db, user.id)
    if latitude is not None and longitude is not None:
        origin = func.ST_GeogFromText(f"SRID=4326;POINT({longitude} {latitude})")
    else:
        avail = await db.scalar(select(WorkerAvailability).where(WorkerAvailability.worker_id == worker.id))
        require(avail and avail.point is not None, "LOCATION_REQUIRED", 422)
        origin = avail.point
    skills = select(WorkerService.service_id).where(WorkerService.worker_id == worker.id)
    distance = func.ST_Distance(JobRequest.point, origin)
    q = (
        select(JobRequest, distance.label("distance_m"))
        .where(
            JobRequest.status.in_(OPEN),
            JobRequest.end_at > now(),
            JobRequest.client_id != user.id,
            JobRequest.service_id.in_(skills),
            func.ST_DWithin(JobRequest.point, origin, radius_km * 1000),
        )
        .order_by(distance)
        .limit(100)
    )
    if service_id:
        q = q.where(JobRequest.service_id == service_id)
    if min_wage_paise is not None:
        q = q.where(JobRequest.budget_max >= min_wage_paise)
    if today:
        q = q.where(
            JobRequest.start_at
            < (now().astimezone(IST) + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
        )
    if engagement == "PERMANENT":
        q = q.where(JobRequest.engagement_type.in_(["MONTHLY", "FIXED_TERM"]))
    elif engagement == "DAILY":
        q = q.where(JobRequest.engagement_type.in_(["DAILY", "HOURLY"]))
    items = []
    for job, metres in (await db.execute(q)).all():
        taken = await filled(db, job.id)
        if taken >= job.headcount:
            continue
        service = await get(db, ServiceCategory, job.service_id)
        client = await get(db, User, job.client_id)
        mine = await db.scalar(
            select(JobInterest.status).where(JobInterest.job_id == job.id, JobInterest.worker_id == worker.id)
        )
        items.append(
            {
                **public(job, exclude={"location_snapshot", "recurring_metadata", "schedule"}),
                "service_name": service.name,
                "service_name_hi": service.name_hi,
                "locality": job.location_snapshot.get("locality", ""),
                "distance_m": int(metres),
                "approximate": job.location_precision == "AREA",
                "slots_left": job.headcount - taken,
                "employer_first_name": client.full_name.split()[0],
                "employer_trust": await trust(db, client.id),
                "my_interest": mine,
            }
        )
    return {"items": items, "next_cursor": None}


@router.get("/jobs/{id}/contact")
async def hirer_contact(id: UUIDType, request: Request, db: DB, user: Actor):
    """Hirer's WhatsApp number and map link, unlocked only for a worker the hirer has selected (Decision 21)."""
    permit(request, "WORKER")
    worker = await worker_for(db, user.id)
    job = await get(db, JobRequest, id)
    selected = await db.scalar(
        select(JobOffer.id).where(
            JobOffer.job_id == job.id,
            JobOffer.worker_id == worker.id,
            JobOffer.status.in_(["PENDING", "ACCEPTED"]),
        )
    ) or await db.scalar(
        select(Assignment.id).where(
            Assignment.job_id == job.id, Assignment.worker_id == worker.id, Assignment.status.in_(LIVE)
        )
    )
    require(selected, "NOT_FOUND", 404)
    snap = job.location_snapshot or {}
    client = await get(db, User, job.client_id)
    return {
        "employer_first_name": client.full_name.split()[0],
        "locality": snap.get("locality", ""),
        "address_line": snap.get("line1", ""),
        **contact_links(
            job.contact_whatsapp,
            job.maps_url,
            job.location_precision,
            snap.get("latitude"),
            snap.get("longitude"),
        ),
    }


@router.post("/jobs/{id}/interest", status_code=201)
async def express_interest(id: UUIDType, request: Request, db: DB, user: Actor):
    permit(request, "WORKER")
    worker = await worker_for(db, user.id, True)
    job = await get(db, JobRequest, id, True)
    require(job.client_id != user.id, "NOT_FOUND", 404)
    require(job.status in OPEN and job.end_at > now(), "JOB_NOT_OPEN")
    existing = await db.scalar(
        select(JobInterest)
        .where(JobInterest.job_id == id, JobInterest.worker_id == worker.id)
        .with_for_update()
    )
    if existing and existing.status == "EXPRESSED":
        return public(existing)
    require(not existing or existing.status != "SELECTED", "ALREADY_SELECTED")
    require(await filled(db, id) < job.headcount, "JOB_ALREADY_ASSIGNED")
    distance = await MatchingService.eligibility(db, job, worker, amount=job.budget_max)
    if existing:
        existing.status, existing.distance_m = "EXPRESSED", distance
        row = existing
    else:
        row = JobInterest(job_id=id, worker_id=worker.id, distance_m=distance)
        db.add(row)
        await db.flush()
    await emit(db, "WorkerInterested", row.id, [job.client_id], f"/shared/job/{id}")
    return public(row)


@router.post("/jobs/{id}/interest/withdraw")
async def withdraw_interest(id: UUIDType, db: DB, user: Actor):
    worker = await worker_for(db, user.id)
    row = await db.scalar(
        select(JobInterest)
        .where(JobInterest.job_id == id, JobInterest.worker_id == worker.id)
        .with_for_update()
    )
    require(row, "NOT_FOUND", 404)
    require(row.status == "EXPRESSED", "INVALID_STATE")
    row.status = "WITHDRAWN"
    return public(row)


@router.get("/jobs/{id}/interests")
async def interests(id: UUIDType, request: Request, db: DB, user: Actor):
    job = await get(db, JobRequest, id)
    require(job.client_id == user.id or operations(request), "NOT_FOUND", 404)
    rows = await db.scalars(
        select(JobInterest)
        .where(JobInterest.job_id == id, JobInterest.status != "WITHDRAWN")
        .order_by(JobInterest.distance_m)
        .limit(100)
    )
    items = []
    for row in rows:
        worker = await get(db, WorkerProfile, row.worker_id)
        person = await get(db, User, worker.user_id)
        names = await db.scalars(
            select(ServiceCategory.name_hi)
            .join(WorkerService, WorkerService.service_id == ServiceCategory.id)
            .where(WorkerService.worker_id == worker.id)
        )
        done = await db.scalar(
            select(func.count())
            .select_from(Assignment)
            .where(Assignment.worker_id == worker.id, Assignment.status == "COMPLETED")
        )
        items.append(
            {
                **public(row),
                "worker_name": person.full_name,
                "skills": list(names),
                "experience_years": worker.experience_years,
                "completed_jobs": done,
                "trust": await trust(db, person.id),
            }
        )
    return {"items": items, "next_cursor": None}


@router.post("/jobs/{id}/interests/{interest_id}/select", status_code=201)
async def select_worker(id: UUIDType, interest_id: UUIDType, request: Request, db: DB, user: Actor):
    """Employer picks an interested worker. This creates a normal JobOffer; the worker still accepts it."""
    job = await get(db, JobRequest, id, True)
    require(job.client_id == user.id, "NOT_FOUND", 404)
    require(job.status in OPEN + ("ASSIGNED",) and job.end_at > now(), "JOB_NOT_OPEN")
    row = await get(db, JobInterest, interest_id, True)
    require(row.job_id == id, "NOT_FOUND", 404)
    require(row.status == "EXPRESSED", "INVALID_STATE")
    require(await filled(db, id) < job.headcount, "JOB_ALREADY_ASSIGNED")
    worker = await get(db, WorkerProfile, row.worker_id, True)
    await MatchingService.eligibility(db, job, worker, amount=job.budget_max)
    offer = JobOffer(
        job_id=id,
        worker_id=worker.id,
        expires_at=min(now() + timedelta(hours=4), job.end_at),
        agreed_worker_amount_paise=job.budget_max,
    )
    db.add(offer)
    await db.flush()
    row.status, row.offer_id = "SELECTED", offer.id
    if job.status in ("SUBMITTED", "MATCHING"):
        job.status = "OFFERING"
    await emit(db, "OfferCreated", offer.id, [worker.user_id], "/worker/offers")
    audit(db, user, "interest.select", row.id, request.state.request_id)
    return public(offer)


@router.get("/wages/benchmark")
async def wage_benchmark(
    service_id: UUIDType, db: DB, user: Actor, days: int = Query(default=60, ge=7, le=180)
):
    """Daily-wage comparison computed from real postings only. Hidden until enough samples exist."""
    since = now() - timedelta(days=days)
    q = select(JobRequest.budget_max).where(
        JobRequest.service_id == service_id,
        JobRequest.engagement_type == "DAILY",
        JobRequest.status != "DRAFT",
        JobRequest.budget_max.is_not(None),
        JobRequest.created_at >= since,
    )
    samples = sorted(r for r in await db.scalars(q))
    if len(samples) < BENCHMARK_MIN_SAMPLES:
        return {"sample_size": len(samples), "min_paise": None, "median_paise": None, "max_paise": None}
    return {
        "sample_size": len(samples),
        "min_paise": samples[0],
        "median_paise": samples[len(samples) // 2],
        "max_paise": samples[-1],
    }
