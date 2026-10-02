import asyncio
import secrets
import smtplib
from datetime import timedelta
from email.message import EmailMessage

from fastapi import APIRouter, Request
from sqlalchemy import select, update

from .dependencies import DB, Actor
from .events import audit
from .models import *
from .repository import public
from .schemas import DeleteInput, EmailInput, Login, Preferences, Refresh, Register, Reset, RoleInput
from .security import *

router = APIRouter()
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


async def me(db, user):
    data = public(user)
    data["roles"] = await roles(db, user.id)
    c = await db.scalar(select(ClientProfile).where(ClientProfile.user_id == user.id))
    w = await db.scalar(select(WorkerProfile).where(WorkerProfile.user_id == user.id))
    data["client_profile"] = public(c) if c else None
    data["worker_profile"] = public(w) if w else None
    return data


@router.post("/auth/register", status_code=201)
async def register(data: Register, request: Request, db: DB):
    await throttle(db, "register:" + (request.client.host if request.client else "unknown"), 5)
    email = normalize_email(data.email)
    phone = normalize_phone(data.phone_number)
    require(not await db.scalar(select(User.id).where(User.email == email)), "EMAIL_ALREADY_REGISTERED", 409)
    require(
        not await db.scalar(select(User.id).where(User.phone_number == phone)),
        "PHONE_ALREADY_REGISTERED",
        409,
    )
    u = User(
        full_name=data.full_name,
        email=email,
        phone_number=phone,
        password_hash=await asyncio.to_thread(hasher.hash, data.password),
    )
    db.add(u)
    await db.flush()
    return {**await issue(db, u), "user": await me(db, u)}


@router.post("/auth/login")
async def login(data: Login, request: Request, db: DB):
    email = normalize_email(data.email)
    await throttle(db, "login:" + email, 10)
    await throttle(db, "login-ip:" + (request.client.host if request.client else "unknown"), 30)
    u = await db.scalar(select(User).where(User.email == email))
    valid = await asyncio.to_thread(password_ok, data.password, u.password_hash if u else DUMMY_HASH)
    require(u and valid and u.status == "ACTIVE", "INVALID_CREDENTIALS", 401)
    require(not settings().email_verification_required or u.email_verified_at, "EMAIL_NOT_VERIFIED", 403)
    return {**await issue(db, u), "user": await me(db, u)}


@router.post("/auth/refresh")
async def refresh_route(data: Refresh, db: DB):
    return await refresh(db, data.refresh_token)


@router.post("/auth/logout", status_code=204)
async def logout(request: Request, db: DB, user: Actor):
    s = await db.get(Session, request.state.session_id)
    await db.execute(update(Session).where(Session.family_id == s.family_id).values(revoked_at=now()))


@router.get("/me")
async def profile(db: DB, user: Actor):
    return await me(db, user)


@router.post("/me/roles")
async def add_role(data: RoleInput, db: DB, user: Actor):
    await db.refresh(user, with_for_update=True)
    if data.role not in await roles(db, user.id):
        db.add(UserRole(user_id=user.id, role=data.role))
        db.add(ClientProfile(user_id=user.id) if data.role == "CLIENT" else WorkerProfile(user_id=user.id))
    await db.flush()
    return await me(db, user)


@router.put("/me/preferences")
async def preferences(data: Preferences, db: DB, user: Actor):
    require(data.last_active_mode in await roles(db, user.id), "FORBIDDEN", 403)
    user.preferences = data.model_dump()
    return public(user)


@router.post("/me/deletion-request", status_code=202)
async def deletion(data: DeleteInput, request: Request, db: DB, user: Actor):
    require(
        await asyncio.to_thread(password_ok, data.password, user.password_hash), "INVALID_CREDENTIALS", 401
    )
    user.status = "DELETION_REQUESTED"
    db.add(AccountDeletionRequest(user_id=user.id))
    await db.execute(update(Session).where(Session.user_id == user.id).values(revoked_at=now()))
    audit(db, user, "account.deletion_requested", user.id, request.state.request_id)
    return {"status": "REQUESTED"}


def send_reset(recipient, raw):
    cfg = settings()
    m = EmailMessage()
    m["Subject"] = "Reset your Labour Youth password"
    m["From"] = cfg.email_from
    m["To"] = recipient
    m.set_content(
        f"Reset your password: {cfg.password_reset_url}?token={raw}\nThis link expires in {cfg.reset_token_minutes} minutes."
    )
    with smtplib.SMTP(cfg.smtp_host, cfg.smtp_port, timeout=15) as smtp:
        smtp.starttls()
        if cfg.smtp_user:
            smtp.login(cfg.smtp_user, cfg.smtp_password)
        smtp.send_message(m)


@router.post("/auth/forgot-password", status_code=202)
async def forgot(data: EmailInput, request: Request, db: DB):
    email = normalize_email(data.email)
    await throttle(db, "reset:" + email, 3)
    await throttle(db, "reset-ip:" + (request.client.host if request.client else "unknown"), 10)
    cfg = settings()
    require(cfg.smtp_host and cfg.email_from and cfg.password_reset_url, "EMAIL_UNAVAILABLE", 503)
    u = await db.scalar(select(User).where(User.email == email, User.status == "ACTIVE"))
    if u:
        raw = secrets.token_urlsafe(48)
        db.add(
            PasswordReset(
                user_id=u.id,
                token_hash=digest(raw),
                expires_at=now() + timedelta(minutes=cfg.reset_token_minutes),
            )
        )
        await db.commit()
        try:
            await asyncio.to_thread(send_reset, email, raw)
        except (OSError, smtplib.SMTPException):
            pass
    return {"status": "IF_ACCOUNT_EXISTS_EMAIL_SENT"}


@router.post("/auth/reset-password", status_code=204)
async def reset_password(data: Reset, db: DB):
    token = await db.scalar(
        select(PasswordReset).where(PasswordReset.token_hash == digest(data.token)).with_for_update()
    )
    require(token and not token.consumed_at and token.expires_at > now(), "RESET_TOKEN_INVALID", 400)
    u = await db.get(User, token.user_id)
    require(u.status == "ACTIVE", "RESET_TOKEN_INVALID", 400)
    token.consumed_at = now()
    u.password_hash = await asyncio.to_thread(hasher.hash, data.password)
    await db.execute(update(Session).where(Session.user_id == u.id).values(revoked_at=now()))
