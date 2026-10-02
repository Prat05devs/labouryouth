import hashlib
import secrets
from datetime import UTC, datetime, timedelta

import jwt
import phonenumbers
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from sqlalchemy import select, update

from .config import settings
from .errors import DomainError, require
from .models import AuthAttempt, Session, User, UserRole

hasher = PasswordHasher()


def now():
    return datetime.now(UTC)


def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()


def normalize_email(value):
    return str(value).strip().lower()


def normalize_phone(value):
    try:
        number = phonenumbers.parse(value, "IN")
        require(phonenumbers.is_valid_number(number), "VALIDATION_ERROR", 422, {"field": "phone_number"})
        return phonenumbers.format_number(number, phonenumbers.PhoneNumberFormat.E164)
    except phonenumbers.NumberParseException:
        raise DomainError("VALIDATION_ERROR", 422, {"field": "phone_number"})


def password_ok(raw, encoded):
    try:
        return hasher.verify(encoded, raw)
    except (VerificationError, InvalidHashError):
        return False


async def roles(db, user_id):
    return list(await db.scalars(select(UserRole.role).where(UserRole.user_id == user_id)))


async def issue(db, user, family_id=None, device=None):
    import uuid

    cfg = settings()
    raw = secrets.token_urlsafe(48)
    session = Session(
        user_id=user.id,
        family_id=family_id or uuid.uuid4(),
        refresh_hash=digest(raw),
        expires_at=now() + timedelta(days=cfg.refresh_token_days),
        device=device or {},
    )
    db.add(session)
    await db.flush()
    access = jwt.encode(
        {
            "sub": str(user.id),
            "sid": str(session.id),
            "iss": cfg.jwt_issuer,
            "aud": cfg.jwt_audience,
            "iat": now(),
            "exp": now() + timedelta(minutes=cfg.access_token_minutes),
        },
        cfg.jwt_secret,
        algorithm="HS256",
    )
    return {
        "access_token": access,
        "refresh_token": raw,
        "token_type": "bearer",
        "expires_in": cfg.access_token_minutes * 60,
    }


async def authenticate(db, token):
    import uuid

    cfg = settings()
    try:
        payload = jwt.decode(
            token,
            cfg.jwt_secret,
            algorithms=["HS256"],
            issuer=cfg.jwt_issuer,
            audience=cfg.jwt_audience,
            options={"require": ["exp", "iat", "sub", "sid"]},
        )
        uid, sid = uuid.UUID(payload["sub"]), uuid.UUID(payload["sid"])
    except (jwt.PyJWTError, ValueError, KeyError):
        raise DomainError("SESSION_EXPIRED", 401)
    session = await db.get(Session, sid)
    user = await db.get(User, uid)
    require(
        session
        and user
        and session.user_id == uid
        and session.revoked_at is None
        and session.expires_at > now()
        and user.status == "ACTIVE",
        "SESSION_EXPIRED",
        401,
    )
    return user, session


async def refresh(db, raw):
    session = await db.scalar(select(Session).where(Session.refresh_hash == digest(raw)).with_for_update())
    require(session is not None, "SESSION_EXPIRED", 401)
    if session.consumed_at or session.revoked_at:
        await db.execute(
            update(Session).where(Session.family_id == session.family_id).values(revoked_at=now())
        )
        await db.commit()  # Replay revocation must survive error response rollback.
        raise DomainError("SESSION_EXPIRED", 401)
    require(session.expires_at > now(), "SESSION_EXPIRED", 401)
    user = await db.get(User, session.user_id)
    require(user and user.status == "ACTIVE", "SESSION_EXPIRED", 401)
    session.consumed_at = now()
    return await issue(db, user, session.family_id, session.device)


async def throttle(db, key, limit=10):
    from sqlalchemy.dialects.postgresql import insert

    window = now().replace(second=0, microsecond=0)
    stmt = insert(AuthAttempt).values(bucket=digest(key), window_start=window, count=1)
    stmt = stmt.on_conflict_do_update(
        index_elements=[AuthAttempt.bucket, AuthAttempt.window_start], set_={"count": AuthAttempt.count + 1}
    ).returning(AuthAttempt.count)
    count = await db.scalar(stmt)
    await db.commit()  # Persist abuse counter even on rejected credentials.
    require(count <= limit, "RATE_LIMITED", 429)
