import asyncio
import base64
import uuid
from datetime import timedelta

import pytest
import pytest_asyncio
from httpx import ASGITransport, AsyncClient
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from app.config import settings
from app.db import db_session
from app.main import app
from app.models import (
    Assignment,
    AttendanceEvent,
    Base,
    City,
    ServiceArea,
    ServiceCategory,
    Session,
    User,
    UserRole,
)
from app.security import now


@pytest_asyncio.fixture
async def system():
    schema = "test_" + uuid.uuid4().hex
    admin = create_async_engine(settings().database_url)
    async with admin.begin() as con:
        await con.execute(text(f'CREATE SCHEMA "{schema}"'))
    engine = create_async_engine(
        settings().database_url, connect_args={"server_settings": {"search_path": f"{schema},public"}}
    )
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with engine.begin() as con:
        await con.run_sync(lambda connection: Base.metadata.create_all(connection, checkfirst=False))
        await con.execute(
            text(
                "CREATE FUNCTION prevent_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'immutable'; END; $$"
            )
        )
        for table in ["worker_ledger_entries", "attendance_events", "audit_logs", "cancellations"]:
            await con.execute(
                text(
                    f"CREATE TRIGGER protect_{table} BEFORE UPDATE OR DELETE ON {table} FOR EACH ROW EXECUTE FUNCTION prevent_mutation()"
                )
            )
    async with factory.begin() as db:
        city = City(name="Test City", state="Test State", slug="test-city")
        db.add(city)
        await db.flush()
        area = ServiceArea(
            city_id=city.id,
            name="Test Area",
            slug="test-area",
            center="SRID=4326;POINT(78.0322 30.3165)",
            radius_m=20000,
        )
        db.add(area)
        service = ServiceCategory(
            name="Test Service",
            name_hi="सेवा",
            slug="test-service",
            icon="home",
            verification_types=["IDENTITY", "POLICE"],
            requirement_schema={"type": "object", "properties": {}, "additionalProperties": False},
        )
        db.add(service)
        await db.flush()
        ids = {"city": str(city.id), "area": str(area.id), "service": str(service.id)}

    async def override():
        async with factory() as db:
            try:
                yield db
                await db.commit()
            except BaseException:
                await db.rollback()
                raise

    app.dependency_overrides[db_session] = override
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as c:
        yield c, factory, ids
    app.dependency_overrides.clear()
    await engine.dispose()
    async with admin.begin() as con:
        await con.execute(text(f'DROP SCHEMA "{schema}" CASCADE'))
    await admin.dispose()


def headers(u):
    return {"Authorization": "Bearer " + u["access_token"]}


async def call(c, path, body=None, u=None, method="POST", key=None, status=200):
    h = headers(u) if u else {}
    if key:
        h["Idempotency-Key"] = key
    r = await c.request(method, "/api/v1" + path, json=body, headers=h)
    assert r.status_code == status, (path, r.status_code, r.text)
    return r.json() if r.content else None


async def user(c, n):
    return await call(
        c,
        "/auth/register",
        {
            "full_name": f"Person {n}",
            "email": f"person{n}@example.com",
            "phone_number": f"+9198765{n:05d}",
            "password": "A long test password!",
            "confirm_password": "A long test password!",
        },
        status=201,
    )


async def bootstrap(c, f, ids):
    client = await user(c, 1)
    admin = await user(c, 2)
    async with f.begin() as db:
        db.add(UserRole(user_id=uuid.UUID(admin["user"]["id"]), role="SUPER_ADMIN"))
    await call(c, "/me/roles", {"role": "CLIENT"}, client)
    a = await call(
        c,
        "/addresses",
        {
            "city_id": ids["city"],
            "label": "Home",
            "line1": "Test road 1",
            "locality": "Centre",
            "state": "Test State",
            "postal_code": "248001",
            "latitude": 30.3165,
            "longitude": 78.0322,
        },
        client,
        status=201,
    )
    await call(
        c,
        "/client/profile",
        {"full_name": "Client", "client_type": "INDIVIDUAL", "primary_address_id": a["id"]},
        client,
        method="PUT",
    )
    return client, admin, a


async def worker(c, ids, admin, n):
    u = await user(c, n)
    me = await call(c, "/me/roles", {"role": "WORKER"}, u)
    w = me["worker_profile"]
    docs = {}
    png = base64.b64decode(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
    )
    for purpose in ["PHOTO", "IDENTITY", "POLICE"]:
        r = await c.post(
            "/api/v1/documents",
            headers=headers(u),
            data={"purpose": purpose},
            files={"file": ("evidence.png", png, "image/png")},
        )
        assert r.status_code == 201, r.text
        docs[purpose] = r.json()["id"]
        if purpose != "PHOTO":
            v = await call(
                c, "/worker/verifications", {"type": purpose, "document_id": docs[purpose]}, u, status=201
            )
            await call(
                c, "/admin/verifications/" + v["id"] + "/approve", {"reason": "Evidence reviewed"}, admin
            )
    await call(
        c,
        "/worker/availability",
        {
            "online": True,
            "service_area_id": ids["area"],
            "latitude": 30.3165,
            "longitude": 78.0322,
            "radius_m": 10000,
        },
        u,
        method="PUT",
    )
    steps = {
        "basic": {"full_name": f"Worker {n}"},
        "photo": {"document_id": docs["PHOTO"]},
        "services": {"service_ids": [ids["service"]]},
        "experience": {"years": 2},
        "languages": {"codes": ["hi"]},
        "locations": {"service_area_ids": [ids["area"]]},
        "availability": {},
        "identity": {},
        "police": {},
        "payout": {},
    }
    for step, data in steps.items():
        await call(c, "/worker/onboarding/" + step, {"data": data}, u, method="PUT")
    await call(c, "/worker/onboarding/submit", {}, u)
    await call(c, "/admin/workers/" + w["id"] + "/activate", {"reason": "All evidence approved"}, admin)
    return u, w, docs


async def job(c, ids, client, address, multi=False):
    start = now() + timedelta(minutes=5)
    windows = [
        {
            "start_at": (start + timedelta(days=i)).isoformat(),
            "end_at": (start + timedelta(days=i, hours=2)).isoformat(),
        }
        for i in range(2 if multi else 1)
    ]
    j = await call(
        c,
        "/jobs",
        {
            "service_id": ids["service"],
            "service_area_id": ids["area"],
            "address_id": address["id"],
            "engagement_type": "MONTHLY" if multi else "HOURLY",
            "schedule": windows,
            "headcount": 1,
            "requirements": {},
        },
        client,
        status=201,
    )
    await call(c, "/jobs/" + j["id"] + "/submit", {}, client)
    return j


async def offer(c, j, w, admin):
    return await call(
        c,
        "/admin/jobs/" + j["id"] + "/offers",
        {
            "worker_id": w["id"],
            "expires_at": (now() + timedelta(minutes=20)).isoformat(),
            "agreed_worker_amount_paise": 20000,
        },
        admin,
        status=201,
    )


async def test_full_loop_concurrent_accept_and_immutable_earnings(system):
    c, f, ids = system
    client, admin, address = await bootstrap(c, f, ids)
    u1, w1, _ = await worker(c, ids, admin, 3)
    u2, w2, _ = await worker(c, ids, admin, 4)
    j = await job(c, ids, client, address)
    matches = await call(c, "/admin/jobs/" + j["id"] + "/generate-matches", {}, admin)
    assert len(matches["items"]) == 2
    o1 = await offer(c, j, w1, admin)
    o2 = await offer(c, j, w2, admin)

    async def accept_one(o, u):
        return await c.post(
            "/api/v1/offers/" + o["id"] + "/accept",
            headers={**headers(u), "Idempotency-Key": "accept-" + o["id"]},
            json={},
        )

    responses = await asyncio.gather(accept_one(o1, u1), accept_one(o2, u2))
    assert sorted(r.status_code for r in responses) == [200, 409]
    win = 0 if responses[0].status_code == 200 else 1
    u = [u1, u2][win]
    o = [o1, o2][win]
    a = responses[win].json()
    assert responses[1 - win].json()["error"]["code"] == "JOB_ALREADY_ASSIGNED"
    assert (await accept_one(o, u)).json()["id"] == a["id"]
    await call(c, "/assignments/" + a["id"], u=[u1, u2][1 - win], method="GET", status=404)
    d = await call(c, "/assignments/" + a["id"], u=u, method="GET")
    s = d["shifts"][0]
    await call(c, "/assignments/" + a["id"] + "/en-route", {}, u)
    await call(c, "/assignments/" + a["id"] + "/arrived", {}, u)
    observation = {
        "latitude": 30.32,
        "longitude": 78.2,
        "accuracy_m": 10,
        "device_timestamp": now().isoformat(),
    }
    bad = await call(
        c, "/shifts/" + s["id"] + "/check-in", observation, u, key="outside-geofence", status=409
    )
    assert bad["error"]["code"] == "OUTSIDE_GEOFENCE"
    observation.update(latitude=30.3165, longitude=78.0322)
    await call(c, "/shifts/" + s["id"] + "/check-in", observation, u, key="correct-location")
    for _ in range(2):
        await call(c, "/shifts/" + s["id"] + "/complete", {}, u, key="complete-shift")
    e = await call(c, "/worker/earnings", u=u, method="GET")
    assert e["balance_paise"] == 20000 and len(e["items"]) == 1
    assert (await call(c, "/jobs/" + j["id"], u=client, method="GET"))["status"] == "COMPLETED"
    await call(
        c,
        "/reviews",
        {"assignment_id": a["id"], "rating": 5, "comment": "Great", "tags": []},
        client,
        status=201,
    )
    async with f() as db:
        assert await db.scalar(select(func.count()).select_from(Assignment)) == 1
        assert (
            await db.scalar(
                select(func.count()).select_from(AttendanceEvent).where(AttendanceEvent.type == "REJECTED")
            )
            == 1
        )
        with pytest.raises(DBAPIError):
            await db.execute(text("UPDATE worker_ledger_entries SET amount_paise=0"))
        await db.rollback()


async def test_private_evidence_and_recurring_shifts(system):
    c, f, ids = system
    client, admin, address = await bootstrap(c, f, ids)
    u, w, docs = await worker(c, ids, admin, 3)
    await call(c, "/documents/" + docs["IDENTITY"], u=client, method="GET", status=404)
    await call(c, "/admin/workers", u=u, method="GET", status=403)
    assert (await call(c, "/me/roles", {"role": "SUPER_ADMIN"}, u, status=422))["error"][
        "code"
    ] == "VALIDATION_ERROR"
    j = await job(c, ids, client, address, True)
    await call(c, "/admin/jobs/" + j["id"] + "/generate-matches", {}, admin)
    o = await offer(c, j, w, admin)
    a = await call(c, "/offers/" + o["id"] + "/accept", {}, u, key="accept-recurring")
    d = await call(c, "/assignments/" + a["id"], u=u, method="GET")
    assert len(d["shifts"]) == 2
    await call(c, "/assignments/" + a["id"] + "/en-route", {}, u)
    await call(c, "/assignments/" + a["id"] + "/arrived", {}, u)
    s = d["shifts"][0]
    await call(
        c,
        "/shifts/" + s["id"] + "/check-in",
        {"latitude": 30.3165, "longitude": 78.0322, "accuracy_m": 10, "device_timestamp": now().isoformat()},
        u,
        key="check-recurring",
    )
    await call(c, "/shifts/" + s["id"] + "/complete", {}, u, key="complete-recurring")
    d = await call(c, "/assignments/" + a["id"], u=u, method="GET")
    assert d["status"] == "IN_PROGRESS"
    assert d["shifts"][1]["status"] == "SCHEDULED"
    await call(c, "/assignments/" + a["id"] + "/prepare-next-shift", {}, u)
    r = await call(
        c,
        "/replacements",
        {"assignment_id": a["id"], "reason": "CLIENT_REQUEST", "details": "Need a replacement"},
        client,
        status=201,
    )
    assert r["status"] == "REQUESTED"


async def test_refresh_replay_and_normalization(system):
    c, f, _ = system
    u = await user(c, 1)
    d = await call(
        c,
        "/auth/register",
        {
            "full_name": "Another",
            "email": "PERSON1@example.com",
            "phone_number": "+919876500009",
            "password": "A long test password!",
            "confirm_password": "A long test password!",
        },
        status=409,
    )
    assert d["error"]["code"] == "EMAIL_ALREADY_REGISTERED"
    fresh = await call(c, "/auth/refresh", {"refresh_token": u["refresh_token"]})
    await call(c, "/auth/refresh", {"refresh_token": u["refresh_token"]}, status=401)
    await call(c, "/me", u=fresh, method="GET", status=401)
    async with f() as db:
        person = await db.scalar(select(User))
        assert person.password_hash.startswith("$argon2id$")
        for s in await db.scalars(select(Session)):
            assert s.refresh_hash not in [u["refresh_token"], fresh["refresh_token"]]
