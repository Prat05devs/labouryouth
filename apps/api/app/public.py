"""Unauthenticated, read-only browse endpoints for guests.

Only coarse, non-sensitive fields leave this module: no ids, contact details, exact coordinates,
free-text notes or employer identity. Workers appear only when operations has activated them.
"""

from uuid import UUID as UUIDType

from fastapi import APIRouter, Query, Request
from sqlalchemy import func, select

from .dependencies import DB
from .marketplace import OPEN, filled, trust
from .models import (
    JobRequest,
    ServiceArea,
    ServiceCategory,
    User,
    WorkerAvailability,
    WorkerProfile,
    WorkerService,
)
from .security import now, throttle

router = APIRouter(prefix="/public")
PER_MINUTE = 60


async def guard(db, request: Request):
    await throttle(db, "public:" + (request.client.host if request.client else "unknown"), PER_MINUTE)


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
        left = job.headcount - await filled(db, job.id)
        if left <= 0:
            continue
        items.append(
            {
                "service_name": service.name,
                "service_name_hi": service.name_hi,
                "locality": (job.location_snapshot or {}).get("locality", ""),
                "engagement_type": job.engagement_type,
                "start_at": job.start_at.isoformat(),
                "wage_paise": job.budget_max,
                "slots_left": left,
            }
        )
    return {"items": items}


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
    items = []
    for profile, user in (await db.execute(q)).all():
        skills = (
            await db.scalars(
                select(ServiceCategory.name)
                .join(WorkerService, WorkerService.service_id == ServiceCategory.id)
                .where(WorkerService.worker_id == profile.id)
            )
        ).all()
        skills_hi = (
            await db.scalars(
                select(ServiceCategory.name_hi)
                .join(WorkerService, WorkerService.service_id == ServiceCategory.id)
                .where(WorkerService.worker_id == profile.id)
            )
        ).all()
        area = await db.scalar(
            select(ServiceArea.name)
            .join(WorkerAvailability, WorkerAvailability.service_area_id == ServiceArea.id)
            .where(WorkerAvailability.worker_id == profile.id)
        )
        online = await db.scalar(
            select(func.coalesce(WorkerAvailability.online, False)).where(
                WorkerAvailability.worker_id == profile.id
            )
        )
        items.append(
            {
                "first_name": user.full_name.split()[0],
                "skills": list(skills),
                "skills_hi": list(skills_hi),
                "experience_years": profile.experience_years,
                "area": area,
                "online": bool(online),
                "trust": await trust(db, user.id),
            }
        )
    return {"items": items}
