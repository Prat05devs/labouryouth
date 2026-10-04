import logging
import uuid

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError
from starlette.exceptions import HTTPException

from . import admin, auth, marketplace, profiles, public, workflows
from .config import settings
from .dependencies import DB
from .errors import DomainError

_prod = settings().app_env == "production"
# The interactive docs and schema map every route; they stay off in production.
app = FastAPI(
    title="Labour Youth API",
    version="0.1.0",
    docs_url=None if _prod else "/docs",
    redoc_url=None if _prod else "/redoc",
    openapi_url=None if _prod else "/openapi.json",
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings().allowed_origins.split(","),
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT"],
    allow_headers=["Authorization", "Content-Type", "Idempotency-Key", "X-Request-ID"],
)


@app.middleware("http")
async def request_id(request: Request, call_next):
    request.state.request_id = str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request.state.request_id
    response.headers["Cache-Control"] = "no-store"
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "no-referrer"
    if _prod:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    return response


def error(request, code, status, details=None):
    return JSONResponse(
        status_code=status,
        content={
            "error": {
                "code": code,
                "message": code.replace("_", " ").capitalize(),
                "details": details or {},
                "requestId": getattr(request.state, "request_id", str(uuid.uuid4())),
            }
        },
    )


@app.exception_handler(DomainError)
async def domain_error(request, exc):
    return error(request, exc.code, exc.status, exc.details)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    return error(
        request,
        "VALIDATION_ERROR",
        422,
        {"fields": [{"path": ".".join(map(str, e["loc"])), "type": e["type"]} for e in exc.errors()]},
    )


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return error(request, "NOT_FOUND" if exc.status_code == 404 else "HTTP_ERROR", exc.status_code)


@app.exception_handler(IntegrityError)
async def integrity_error(request, exc):
    return error(request, "CONFLICT", 409)


@app.exception_handler(Exception)
async def unexpected(request, exc):
    logging.getLogger("labour_youth").error(
        "Unhandled error type=%s request_id=%s", type(exc).__name__, getattr(request.state, "request_id", "")
    )
    return error(request, "INTERNAL_ERROR", 500)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.get("/ready")
async def ready(db: DB):
    await db.execute(text("SELECT PostGIS_Version()"))
    return {"status": "ready"}


for router in (
    auth.router,
    profiles.router,
    workflows.router,
    marketplace.router,
    public.router,
    admin.router,
):
    app.include_router(router, prefix="/api/v1")
