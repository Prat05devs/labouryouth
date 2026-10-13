"""Unauthenticated, read-only browse endpoints for guests.

Only safe marketplace fields leave this module. Opaque resource IDs support detail navigation,
but user IDs, contact details, exact coordinates, free-text notes and employer identity stay private.
Workers appear only when operations has activated them.
"""

from uuid import UUID as UUIDType

from fastapi import APIRouter, Query, Request
from sqlalchemy import func, select

from .dependencies import DB
from .errors import require
from .marketplace import OPEN, filled, trust
from .models import (
    Assignment,
    JobRequest,
    ServiceArea,
    ServiceCategory,
    User,
    WorkerAvailability,
    WorkerLanguage,
    WorkerProfile,
    WorkerService,
)
from .security import now, throttle

router = APIRouter(prefix="/public")
PER_MINUTE = 60


async def guard(db, request: Request):
    await throttle(db, "public:" + (request.client.host if request.client else "unknown"), PER_MINUTE)


async def job_payload(db, job: JobRequest, service: ServiceCategory):
    left = job.headcount - await filled(db, job.id)
    return {
        "id": str(job.id),
        "service_id": str(service.id),
        "service_name": service.name,
        "service_name_hi": service.name_hi,
        "locality": (job.location_snapshot or {}).get("locality", ""),
        "approximate_location": job.location_precision == "AREA",
        "engagement_type": job.engagement_type,
        "start_at": job.start_at.isoformat(),
        "end_at": job.end_at.isoformat(),
        "wage_min_paise": job.budget_min,
        "wage_paise": job.budget_max,
        "headcount": job.headcount,
        "slots_left": left,
    }


async def worker_payload(db, profile: WorkerProfile, user: User):
    services = (
        await db.execute(
            select(ServiceCategory.name, ServiceCategory.name_hi, ServiceCategory.id)
            .join(WorkerService, WorkerService.service_id == ServiceCategory.id)
            .where(WorkerService.worker_id == profile.id)
            .order_by(ServiceCategory.sort_order)
        )
    ).all()
    availability = await db.scalar(
        select(WorkerAvailability).where(WorkerAvailability.worker_id == profile.id)
    )
    area = None
    if availability and availability.service_area_id:
        area = await db.scalar(
            select(ServiceArea.name).where(ServiceArea.id == availability.service_area_id)
        )
    languages = list(
        await db.scalars(
            select(WorkerLanguage.language_code).where(WorkerLanguage.worker_id == profile.id)
        )
    )
    completed = await db.scalar(
        select(func.count())
        .select_from(Assignment)
        .where(Assignment.worker_id == profile.id, Assignment.status == "COMPLETED")
    )
    return {
        "id": str(profile.id),
        "first_name": user.full_name.split()[0],
        "skills": [row.name for row in services],
        "skills_hi": [row.name_hi for row in services],
        "service_ids": [str(row.id) for row in services],
        "experience_years": profile.experience_years,
        "engagement_types": profile.engagement_types,
        "rate_min_paise": profile.rate_min_paise,
        "area": area,
        "online": bool(availability and availability.online),
        "availability_kind": availability.kind if availability else None,
        "languages": languages,
        "completed_jobs": completed or 0,
        "verified": True,
        "trust": await trust(db, user.id),
    }


@router.get("/jobs")
async def jobs(
    request: Request,
    db: DB,
    service_id: UUIDType | None = None,
    limit: int = Query(default=30, ge=1, le=50),
):
    await guard(db, request)
    q = (
        select(JobRequest, ServiceCategory)
        .join(ServiceCategory, ServiceCategory.id == JobRequest.service_id)
        .where(JobRequest.status.in_(OPEN), JobRequest.end_at > now())
        .order_by(JobRequest.created_at.desc())
        .limit(limit)
    )
    if service_id:
        q = q.where(JobRequest.service_id == service_id)
    items = []
    for job, service in (await db.execute(q)).all():
        item = await job_payload(db, job, service)
        if item["slots_left"] <= 0:
            continue
        items.append(item)
    return {"items": items, "next_cursor": None}


@router.get("/jobs/{id}")
async def job_detail(id: UUIDType, request: Request, db: DB):
    await guard(db, request)
    row = (
        await db.execute(
            select(JobRequest, ServiceCategory)
            .join(ServiceCategory, ServiceCategory.id == JobRequest.service_id)
            .where(JobRequest.id == id, JobRequest.status.in_(OPEN), JobRequest.end_at > now())
        )
    ).one_or_none()
    require(row, "NOT_FOUND", 404)
    item = await job_payload(db, row[0], row[1])
    require(item["slots_left"] > 0, "NOT_FOUND", 404)
    return item


@router.get("/workers")
async def workers(
    request: Request,
    db: DB,
    service_id: UUIDType | None = None,
    limit: int = Query(default=30, ge=1, le=50),
):
    await guard(db, request)
    q = (
        select(WorkerProfile, User)
        .join(User, User.id == WorkerProfile.user_id)
        .where(WorkerProfile.worker_status == "ACTIVE", WorkerProfile.onboarding_status == "COMPLETE")
        .order_by(WorkerProfile.created_at.desc())
        .limit(limit)
    )
    if service_id:
        q = q.where(
            WorkerProfile.id.in_(
                select(WorkerService.worker_id).where(WorkerService.service_id == service_id)
            )
        )
    items = [await worker_payload(db, profile, user) for profile, user in (await db.execute(q)).all()]
    return {"items": items, "next_cursor": None}


@router.get("/workers/{id}")
async def worker_detail(id: UUIDType, request: Request, db: DB):
    await guard(db, request)
    row = (
        await db.execute(
            select(WorkerProfile, User)
            .join(User, User.id == WorkerProfile.user_id)
            .where(
                WorkerProfile.id == id,
                WorkerProfile.worker_status == "ACTIVE",
                WorkerProfile.onboarding_status == "COMPLETE",
            )
        )
    ).one_or_none()
    require(row, "NOT_FOUND", 404)
    return await worker_payload(db, row[0], row[1])
