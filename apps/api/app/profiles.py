import hashlib
import uuid
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from sqlalchemy import delete, select

from .config import settings
from .dependencies import DB, Actor, permit
from .domain import worker_for
from .errors import require
from .models import *
from .repository import get, listing, public
from .schemas import AddressInput, AvailabilityInput, ClientInput, VerificationInput

router = APIRouter()


@router.get("/services")
async def catalog(db: DB):
    return await listing(
        db, select(ServiceCategory).where(ServiceCategory.active).order_by(ServiceCategory.sort_order)
    )


@router.get("/locations")
async def locations(db: DB):
    return {
        "cities": (await listing(db, select(City).where(City.active)))["items"],
        "service_areas": (await listing(db, select(ServiceArea).where(ServiceArea.active)))["items"],
    }


@router.get("/addresses")
async def addresses(db: DB, user: Actor):
    return await listing(db, select(Address).where(Address.owner_id == user.id))


@router.post("/addresses", status_code=201)
async def address(data: AddressInput, db: DB, user: Actor):
    city = await get(db, City, data.city_id)
    require(city.active, "OUTSIDE_SERVICE_AREA", 422)
    d = data.model_dump()
    d["latitude"] = str(data.latitude)
    d["longitude"] = str(data.longitude)
    row = Address(owner_id=user.id, point=f"SRID=4326;POINT({data.longitude} {data.latitude})", **d)
    db.add(row)
    await db.flush()
    return public(row)


@router.put("/addresses/{id}")
async def edit_address(id: uuid.UUID, data: AddressInput, db: DB, user: Actor):
    row = await get(db, Address, id)
    require(row.owner_id == user.id, "NOT_FOUND", 404)
    await get(db, City, data.city_id)
    for k, v in data.model_dump().items():
        setattr(row, k, str(v) if k in ("latitude", "longitude") else v)
    row.point = f"SRID=4326;POINT({data.longitude} {data.latitude})"
    await db.flush()
    return public(row)


@router.get("/client/profile")
async def client_get(db: DB, user: Actor):
    row = await db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id))
    require(row, "NOT_FOUND", 404)
    return public(row)


@router.put("/client/profile")
async def client_save(data: ClientInput, request: Request, db: DB, user: Actor):
    permit(request, "CLIENT")
    row = await db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id))
    require(row, "NOT_FOUND", 404)
    address = await get(db, Address, data.primary_address_id)
    require(address.owner_id == user.id, "NOT_FOUND", 404)
    row.client_type = data.client_type
    row.primary_address_id = address.id
    row.onboarding_complete = True
    user.full_name = data.full_name
    return public(row)


@router.get("/worker/profile")
async def worker_get(db: DB, user: Actor):
    w = await worker_for(db, user.id)
    return {
        **public(w),
        "services": list(
            await db.scalars(select(WorkerService.service_id).where(WorkerService.worker_id == w.id))
        ),
        "languages": list(
            await db.scalars(select(WorkerLanguage.language_code).where(WorkerLanguage.worker_id == w.id))
        ),
    }


class StepInput(BaseModel):
    data: dict = Field(default_factory=dict)


STEPS = [
    "basic",
    "photo",
    "services",
    "experience",
    "languages",
    "locations",
    "availability",
    "identity",
    "police",
    "payout",
]


@router.put("/worker/onboarding/{step}")
async def save_step(step: str, body: StepInput, db: DB, user: Actor):
    require(step in STEPS, "VALIDATION_ERROR", 422)
    w = await worker_for(db, user.id, True)
    require(w.onboarding_status in ("NOT_STARTED", "IN_PROGRESS"))
    d = body.data
    require(len(str(d)) <= 10000, "VALIDATION_ERROR", 422)
    if step == "basic":
        require(
            set(d) <= {"full_name", "bio"} and 2 <= len(d.get("full_name", "")) <= 160,
            "VALIDATION_ERROR",
            422,
        )
        user.full_name = d["full_name"]
    elif step == "photo":
        doc = await get(db, Document, uuid.UUID(d.get("document_id", "")))
        require(doc.owner_id == user.id and doc.purpose == "PHOTO", "NOT_FOUND", 404)
    elif step == "services":
        ids = [uuid.UUID(x) for x in d.get("service_ids", [])]
        require(0 < len(ids) <= 20, "VALIDATION_ERROR", 422)
        for id in ids:
            require((await get(db, ServiceCategory, id)).active, "VALIDATION_ERROR", 422)
        await db.execute(delete(WorkerService).where(WorkerService.worker_id == w.id))
        for id in set(ids):
            db.add(WorkerService(worker_id=w.id, service_id=id))
    elif step == "experience":
        years = d.get("years")
        require(isinstance(years, int) and 0 <= years <= 60, "VALIDATION_ERROR", 422)
        w.experience_years = years
    elif step == "languages":
        codes = d.get("codes", [])
        require(
            0 < len(codes) <= 10 and all(isinstance(x, str) and 2 <= len(x) <= 10 for x in codes),
            "VALIDATION_ERROR",
            422,
        )
        await db.execute(delete(WorkerLanguage).where(WorkerLanguage.worker_id == w.id))
        for code in set(codes):
            db.add(WorkerLanguage(worker_id=w.id, language_code=code))
    elif step == "locations":
        ids = d.get("service_area_ids", [])
        require(0 < len(ids) <= 10, "VALIDATION_ERROR", 422)
        for id in ids:
            require((await get(db, ServiceArea, uuid.UUID(id))).active, "OUTSIDE_SERVICE_AREA", 422)
    elif step == "availability":
        require(
            await db.scalar(select(WorkerAvailability.id).where(WorkerAvailability.worker_id == w.id)),
            "VALIDATION_ERROR",
            422,
        )
    elif step in ("identity", "police"):
        require(
            await db.scalar(
                select(WorkerVerification.id).where(
                    WorkerVerification.worker_id == w.id,
                    WorkerVerification.type == step.upper(),
                    WorkerVerification.status.in_(["PENDING", "APPROVED"]),
                )
            ),
            "DOCUMENT_REQUIRED",
            422,
        )
    elif step == "payout":
        d = {"deferred": True}
    w.progress = {**w.progress, step: d}
    w.onboarding_status = "IN_PROGRESS"
    await db.flush()
    return public(w)


@router.post("/worker/onboarding/submit")
async def submit_worker(db: DB, user: Actor):
    w = await worker_for(db, user.id, True)
    require(set(STEPS) <= set(w.progress), "ONBOARDING_INCOMPLETE", 422)
    require(w.onboarding_status == "IN_PROGRESS")
    w.onboarding_status = "SUBMITTED"
    return public(w)


@router.get("/worker/availability")
async def availability_get(db: DB, user: Actor):
    w = await worker_for(db, user.id)
    a = await db.scalar(select(WorkerAvailability).where(WorkerAvailability.worker_id == w.id))
    return public(a) if a else None


@router.put("/worker/availability")
async def availability_save(data: AvailabilityInput, db: DB, user: Actor):
    w = await worker_for(db, user.id)
    area = await get(db, ServiceArea, data.service_area_id)
    require(area.active, "OUTSIDE_SERVICE_AREA", 422)
    a = await db.scalar(select(WorkerAvailability).where(WorkerAvailability.worker_id == w.id))
    if not a:
        a = WorkerAvailability(worker_id=w.id)
        db.add(a)
    a.online = data.online
    a.service_area_id = data.service_area_id
    a.radius_m = data.radius_m
    if data.latitude is not None and data.longitude is not None:
        a.point = f"SRID=4326;POINT({data.longitude} {data.latitude})"
    await db.flush()
    return public(a)


@router.post("/documents", status_code=201)
async def upload(db: DB, user: Actor, file: Annotated[UploadFile, File()], purpose: Annotated[str, Form()]):
    require(
        purpose
        in (
            "PHOTO",
            "IDENTITY",
            "POLICE",
            "DRIVING_LICENSE",
            "BANK",
            "ADDRESS",
            "SKILL_CERTIFICATE",
            "REFERENCE",
        ),
        "VALIDATION_ERROR",
        422,
    )
    cfg = settings()
    content = await file.read(cfg.max_upload_bytes + 1)
    require(0 < len(content) <= cfg.max_upload_bytes, "UPLOAD_TOO_LARGE", 422)
    signatures = {
        "image/jpeg": content.startswith(b"\xff\xd8\xff"),
        "image/png": content.startswith(b"\x89PNG\r\n\x1a\n"),
        "application/pdf": content.startswith(b"%PDF-"),
    }
    require(signatures.get(file.content_type, False), "UNSUPPORTED_FILE_TYPE", 422)
    if purpose == "PHOTO":
        require(file.content_type.startswith("image/"), "UNSUPPORTED_FILE_TYPE", 422)
    key = str(uuid.uuid4())
    directory = Path(cfg.private_storage_path)
    directory.mkdir(parents=True, exist_ok=True, mode=0o700)
    path = directory / key
    path.write_bytes(content)
    path.chmod(0o600)
    row = Document(
        owner_id=user.id,
        storage_key=key,
        purpose=purpose,
        mime_type=file.content_type,
        size_bytes=len(content),
        checksum=hashlib.sha256(content).hexdigest(),
    )
    db.add(row)
    await db.flush()
    return public(row)


@router.get("/documents/{id}")
async def document(id: uuid.UUID, request: Request, db: DB, user: Actor):
    doc = await get(db, Document, id)
    can_view_photo = False
    if doc.purpose == "PHOTO" and "CLIENT" in request.state.roles:
        worker = await db.scalar(select(WorkerProfile).where(WorkerProfile.user_id == doc.owner_id))
        if worker and worker.progress.get("photo", {}).get("document_id") == str(doc.id):
            can_view_photo = bool(
                await db.scalar(
                    select(Assignment.id)
                    .join(JobRequest, Assignment.job_id == JobRequest.id)
                    .where(Assignment.worker_id == worker.id, JobRequest.client_id == user.id)
                    .limit(1)
                )
            )
    require(
        doc.owner_id == user.id
        or can_view_photo
        or bool(set(request.state.roles) & {"SUPER_ADMIN", "VERIFICATION"}),
        "NOT_FOUND",
        404,
    )
    path = Path(settings().private_storage_path) / doc.storage_key
    require(path.is_file(), "NOT_FOUND", 404)
    return FileResponse(
        path,
        media_type=doc.mime_type,
        headers={
            "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Disposition": "inline" if doc.purpose == "PHOTO" else "attachment",
        },
    )


@router.get("/worker/verifications")
async def verification_get(db: DB, user: Actor):
    w = await worker_for(db, user.id)
    return await listing(
        db,
        select(WorkerVerification)
        .where(WorkerVerification.worker_id == w.id)
        .order_by(WorkerVerification.created_at.desc()),
    )


@router.post("/worker/verifications", status_code=201)
async def verification_save(data: VerificationInput, db: DB, user: Actor):
    w = await worker_for(db, user.id)
    doc = await get(db, Document, data.document_id)
    require(doc.owner_id == user.id and doc.purpose == data.type, "NOT_FOUND", 404)
    row = WorkerVerification(worker_id=w.id, type=data.type, document_id=doc.id)
    db.add(row)
    await db.flush()
    return public(row)
