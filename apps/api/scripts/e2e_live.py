"""Live end-to-end flow run and security probes against a running API and its real database.

Usage (development or staging only, never production):
    .venv/bin/python -m scripts.e2e_live [http://127.0.0.1:8000]

It creates its own throwaway accounts (e2e+<run>@example.com), an operator with SUPER_ADMIN written directly
to the database (the same path as app.bootstrap_admin), and walks every Phase 1 flow over HTTP. Attendance,
ledger and audit rows are append-only by design, so the run's records stay in the database it targets.
"""

import asyncio
import base64
import secrets
import sys
from datetime import timedelta

import httpx
from sqlalchemy import select, text

from app.config import settings
from app.db import SessionLocal
from app.models import ServiceArea, ServiceCategory, User, UserRole
from app.security import hasher, now

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:8000").rstrip("/")
API = BASE + "/api/v1"
RUN = secrets.token_hex(3)
PASSWORD = "E2e-" + secrets.token_urlsafe(12)
PNG = base64.b64decode(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII="
)
results = []


def check(name, ok, detail=""):
    results.append((name, bool(ok), detail))
    print(("PASS " if ok else "FAIL ") + name + ("" if ok else f"  [{detail}]"))


def h(token=None, key=None):
    out = {}
    if token:
        out["Authorization"] = "Bearer " + token
    if key:
        out["Idempotency-Key"] = key
    return out


async def call(c, method, path, token=None, json=None, key=None, **kw):
    r = await c.request(method, API + path, headers=h(token, key), json=json, **kw)
    if r.status_code == 429 and path == "/auth/register":  # registration is limited to 5 per minute per IP
        await asyncio.sleep(61)
        r = await c.request(method, API + path, headers=h(token, key), json=json, **kw)
    return r


def phone(n):
    return "98" + RUN.encode().hex()[:4].replace("a", "1").replace("b", "2").replace("c", "3").replace(
        "d", "4"
    ).replace("e", "5").replace("f", "6") + f"{n:04d}"


async def register(c, n, name):
    r = await call(
        c,
        "POST",
        "/auth/register",
        json={
            "full_name": name,
            "email": f"e2e+{RUN}{n}@example.com",
            "phone_number": phone(n),
            "password": PASSWORD,
            "confirm_password": PASSWORD,
        },
    )
    assert r.status_code == 201, r.text
    return r.json()


async def make_admin():
    async with SessionLocal.begin() as db:
        u = User(
            email=f"e2e+{RUN}admin@example.com",
            phone_number="+91" + phone(9999),
            full_name="E2E Operator",
            password_hash=hasher.hash(PASSWORD),
        )
        db.add(u)
        await db.flush()
        db.add(UserRole(user_id=u.id, role="SUPER_ADMIN"))


async def fixtures():
    async with SessionLocal() as db:
        area = await db.scalar(select(ServiceArea).where(ServiceArea.active).limit(1))
        lat, lng = (
            await db.execute(text("SELECT ST_Y(center::geometry), ST_X(center::geometry) FROM service_areas WHERE id=:i"), {"i": area.id})
        ).one()
        service = await db.scalar(select(ServiceCategory).where(ServiceCategory.slug == "helper"))
        city_id = area.city_id
    return {"area": str(area.id), "city": str(city_id), "service": str(service.id), "lat": lat, "lng": lng}


async def main():
    assert settings().app_env != "production", "Refusing to run against a production configuration"
    ids = await fixtures()
    await make_admin()
    async with httpx.AsyncClient(timeout=30) as c:
        # Guest
        for p in ("/public/jobs", "/public/workers", "/services", "/locations", "/localities"):
            r = await call(c, "GET", p)
            check(f"guest GET {p}", r.status_code == 200, r.status_code)

        # Sign up and sign in
        r = await call(c, "POST", "/auth/register", json={"full_name": "Short", "email": "x@example.com", "phone_number": phone(1), "password": "123456789", "confirm_password": "123456789"})
        check("register rejects 9-char password with field detail", r.status_code == 422 and "body.password" in r.text, r.text[:120])
        hirer = await register(c, 1, "E2E Hirer")
        check("register hirer", bool(hirer["access_token"]))
        r = await call(c, "POST", "/auth/register", json={"full_name": "Dup", "email": f"E2E+{RUN}1@EXAMPLE.com ", "phone_number": phone(2), "password": PASSWORD, "confirm_password": PASSWORD})
        check("duplicate email (case/space variant) rejected", r.status_code == 409, r.status_code)
        r = await call(c, "POST", "/auth/register", json={"full_name": "Dup", "email": f"e2e+{RUN}x@example.com", "phone_number": "+91" + phone(1), "password": PASSWORD, "confirm_password": PASSWORD})
        check("duplicate phone (+91 variant) rejected", r.status_code == 409, r.status_code)
        r = await call(c, "POST", "/auth/login", json={"email": f"e2e+{RUN}1@example.com", "password": PASSWORD + "x"})
        check("wrong password rejected", r.status_code == 401, r.status_code)
        r = await call(c, "POST", "/auth/login", json={"email": f"e2e+{RUN}1@example.com", "password": PASSWORD})
        check("sign in", r.status_code == 200, r.status_code)
        ht = r.json()["access_token"]
        admin = (await call(c, "POST", "/auth/login", json={"email": f"e2e+{RUN}admin@example.com", "password": PASSWORD})).json()["access_token"]

        # Hirer setup with WhatsApp and a Maps link
        r = await call(c, "POST", "/me/roles", ht, {"role": "CLIENT"})
        check("choose purpose: hire", r.status_code == 200, r.text[:100])
        link = f"https://www.google.com/maps/search/?api=1&query={ids['lat']},{ids['lng']}"
        r = await call(c, "POST", "/addresses", ht, {"city_id": ids["city"], "label": "Home", "line1": "E2E road 1", "locality": "Patel Nagar", "state": "Uttarakhand", "postal_code": "248001", "maps_url": link})
        check("address from Maps link is PIN precision", r.status_code == 201 and r.json()["location_precision"] == "PIN", r.text[:150])
        addr = r.json()
        check("address response hides maps_url", "maps_url" not in addr)
        r = await call(c, "PUT", "/client/profile", ht, {"full_name": "E2E Hirer", "client_type": "INDIVIDUAL", "primary_address_id": addr["id"], "whatsapp_number": phone(1)})
        check("hirer setup with WhatsApp", r.status_code == 200, r.text[:120])
        r = await call(c, "POST", "/addresses", ht, {"city_id": ids["city"], "label": "X", "line1": "E2E road 2", "locality": "ISBT", "state": "Uttarakhand", "postal_code": "248001", "maps_url": "http://169.254.169.254/latest"})
        check("non-Maps link rejected (SSRF guard)", r.status_code == 422 and "MAPS_LINK_INVALID" in r.text, r.text[:120])

        # Worker onboarding and verification
        worker = await register(c, 2, "E2E Worker")
        wt = worker["access_token"]
        me = (await call(c, "POST", "/me/roles", wt, {"role": "WORKER"})).json()
        wid = me["worker_profile"]["id"]
        docs = {}
        for purpose in ("PHOTO", "IDENTITY", "POLICE"):
            r = await c.post(API + "/documents", headers=h(wt), data={"purpose": purpose}, files={"file": ("e.png", PNG, "image/png")})
            check(f"upload {purpose}", r.status_code == 201, r.text[:100])
            docs[purpose] = r.json()["id"]
            if purpose != "PHOTO":
                v = (await call(c, "POST", "/worker/verifications", wt, {"type": purpose, "document_id": docs[purpose]})).json()
                r = await call(c, "POST", f"/admin/verifications/{v['id']}/approve", admin, {"reason": "E2E evidence reviewed"})
                check(f"operator approves {purpose}", r.status_code == 200, r.text[:100])
        r = await call(c, "PUT", "/worker/availability", wt, {"online": True, "service_area_id": ids["area"], "latitude": ids["lat"], "longitude": ids["lng"], "radius_m": 10000})
        check("worker goes online", r.status_code == 200, r.text[:100])
        steps = {"basic": {"full_name": "E2E Worker"}, "photo": {"document_id": docs["PHOTO"]}, "services": {"service_ids": [ids["service"]]}, "experience": {"years": 3}, "languages": {"codes": ["hi"]}, "locations": {"service_area_ids": [ids["area"]]}, "availability": {}, "identity": {}, "police": {}, "payout": {}}
        ok = True
        for step, data in steps.items():
            ok &= (await call(c, "PUT", "/worker/onboarding/" + step, wt, {"data": data})).status_code == 200
        check("worker onboarding 10 steps saved", ok)
        check("worker submit", (await call(c, "POST", "/worker/onboarding/submit", wt, {})).status_code == 200)
        r = await call(c, "POST", f"/admin/workers/{wid}/activate", wt, {"reason": "self"})
        check("worker cannot activate self", r.status_code == 403, r.status_code)
        r = await call(c, "POST", f"/admin/workers/{wid}/activate", admin, {"reason": "E2E all evidence approved"})
        check("operator activates worker", r.status_code == 200, r.text[:100])
        r = await call(c, "GET", "/public/workers")
        check("activated worker appears in guest browse", any(w["first_name"] == "E2E" for w in r.json()["items"]))
        check("guest worker list has no ids/phones", wid not in r.text and phone(2) not in r.text)

        # Quick post, feed, interest, selection, contact
        start = now() + timedelta(minutes=10)
        r = await call(c, "POST", "/jobs/quick", ht, {"service_id": ids["service"], "service_area_id": ids["area"], "maps_url": link, "locality": "Patel Nagar", "start_at": start.isoformat(), "hours": 2, "headcount": 1, "wage_per_day_paise": 80000, "notes": "Call 9999999999"})
        check("quick post", r.status_code == 201 and r.json()["location_precision"] == "PIN", r.text[:150])
        job = r.json()
        r = await call(c, "GET", "/public/jobs")
        check("guest sees job without notes/phone/id", r.status_code == 200 and job["id"] not in r.text and "9999999999" not in r.text and phone(1) not in r.text)
        r = await call(c, "GET", "/worker/jobs/nearby?radius_km=2", wt)
        feed = r.json()["items"] if r.status_code == 200 else []
        check("job in worker nearby feed (2 km)", any(x["id"] == job["id"] for x in feed), r.text[:120])
        check("feed has no WhatsApp", phone(1) not in r.text)
        r = await call(c, "GET", f"/jobs/{job['id']}/contact", wt)
        check("contact locked before selection", r.status_code == 404, r.status_code)
        r = await call(c, "POST", f"/jobs/{job['id']}/interest", wt, {})
        check("worker: I am available", r.status_code == 201, r.text[:100])
        interest = r.json()
        r = await call(c, "GET", f"/jobs/{job['id']}/interests", ht)
        check("hirer sees interested worker", r.status_code == 200 and len(r.json()["items"]) == 1)
        r = await call(c, "POST", f"/jobs/{job['id']}/interests/{interest['id']}/select", ht, {})
        check("hirer chooses worker (offer)", r.status_code == 201, r.text[:100])
        offer = r.json()
        r = await call(c, "GET", f"/jobs/{job['id']}/contact", wt)
        check("contact unlocked after selection", r.status_code == 200 and r.json()["whatsapp_url"].startswith("https://wa.me/91") and r.json()["maps_url"] == link, r.text[:150])
        r = await call(c, "POST", f"/offers/{offer['id']}/accept", wt, {}, key="e2e-accept-" + RUN)
        check("worker accepts offer", r.status_code == 200, r.text[:100])
        assignment = r.json()
        r2 = await call(c, "POST", f"/offers/{offer['id']}/accept", wt, {}, key="e2e-accept-" + RUN)
        check("accept replay returns same result", r2.status_code == 200 and r2.json()["id"] == assignment["id"], r2.text[:100])

        # Work day
        aid = assignment["id"]
        check("start journey", (await call(c, "POST", f"/assignments/{aid}/en-route", wt, {})).status_code == 200)
        check("arrived", (await call(c, "POST", f"/assignments/{aid}/arrived", wt, {})).status_code == 200)
        detail = (await call(c, "GET", f"/assignments/{aid}", wt)).json()
        shift = detail["shifts"][0]["id"]
        far = {"latitude": ids["lat"] + 0.05, "longitude": ids["lng"], "accuracy_m": 10, "device_timestamp": now().isoformat()}
        r = await call(c, "POST", f"/shifts/{shift}/check-in", wt, far, key="e2e-far-" + RUN)
        check("check-in 5 km away rejected (geofence)", r.status_code == 409 and "OUTSIDE_GEOFENCE" in r.text, r.text[:120])
        r = await call(c, "POST", f"/shifts/{shift}/check-in", ht, {**far, "latitude": ids["lat"]}, key="e2e-wrong-" + RUN)
        check("hirer cannot check in as worker", r.status_code in (403, 404), r.status_code)
        r = await call(c, "POST", f"/shifts/{shift}/check-in", wt, {**far, "latitude": ids["lat"]}, key="e2e-in-" + RUN)
        check("check-in on site", r.status_code == 200, r.text[:120])
        r = await call(c, "POST", f"/shifts/{shift}/complete", wt, {}, key="e2e-done-" + RUN)
        check("complete shift", r.status_code == 200, r.text[:120])
        r = await call(c, "POST", f"/shifts/{shift}/complete", wt, {}, key="e2e-done-" + RUN)
        check("complete replay is idempotent", r.status_code == 200, r.text[:100])
        r = await call(c, "GET", "/worker/earnings", wt)
        earn = r.json()
        check("exactly one earning of Rs 800", r.status_code == 200 and str(80000) in r.text and len(earn.get("items", earn.get("entries", []))) == 1, r.text[:200])
        r = await call(c, "POST", "/reviews", ht, {"assignment_id": aid, "rating": 5, "comment": "E2E good work"})
        check("hirer reviews worker", r.status_code in (200, 201), r.text[:120])
        r = await call(c, "POST", "/reviews", ht, {"assignment_id": aid, "rating": 1})
        check("second review rejected", r.status_code == 409, r.status_code)
        r = await call(c, "GET", "/notifications", wt)
        check("worker received notifications", r.status_code == 200 and len(r.json()["items"]) > 0)

        # Authorization probes (cross-user, forged roles, admin)
        stranger = await register(c, 3, "E2E Stranger")
        st = stranger["access_token"]
        await call(c, "POST", "/me/roles", st, {"role": "CLIENT"})
        for m, p, body in (("GET", f"/jobs/{job['id']}", None), ("GET", f"/jobs/{job['id']}/interests", None), ("PUT", f"/addresses/{addr['id']}", {"city_id": ids["city"], "label": "Hacked", "line1": "Hack road", "locality": "X", "state": "Uttarakhand", "postal_code": "248001"}), ("GET", f"/documents/{docs['IDENTITY']}", None), ("GET", f"/assignments/{aid}", None), ("POST", f"/jobs/{job['id']}/cancel", {"reason": "hostile"})):
            r = await call(c, m, p, st, body)
            check(f"stranger blocked: {m} {p.split('/')[1]}", r.status_code in (403, 404), r.status_code)
        r = await call(c, "GET", f"/jobs/{job['id']}/contact", st)
        check("stranger cannot read hirer contact", r.status_code in (403, 404), r.status_code)
        for p in ("/admin/overview", "/admin/users", "/admin/workers/" + wid):
            r = await call(c, "GET", p, wt)
            check(f"worker blocked from {p}", r.status_code == 403, r.status_code)
        r = await call(c, "POST", "/me/roles", st, {"role": "SUPER_ADMIN"})
        check("cannot self-grant SUPER_ADMIN", r.status_code == 422, r.status_code)
        r = await call(c, "POST", "/auth/register", json={"full_name": "Mass", "email": f"e2e+{RUN}m@example.com", "phone_number": phone(4), "password": PASSWORD, "confirm_password": PASSWORD, "roles": ["SUPER_ADMIN"]})
        check("mass assignment of roles on register rejected", r.status_code == 422, r.status_code)
        r = await call(c, "PUT", "/client/profile", st, {"full_name": "X Y", "primary_address_id": addr["id"]})
        check("cannot attach another user's address", r.status_code == 404, r.status_code)

        # Token attacks
        r = await call(c, "GET", "/me")
        check("no token: 401", r.status_code == 401)
        head, body, sig = ht.split(".")
        r = await call(c, "GET", "/me", head + "." + body + "." + sig[::-1])
        check("tampered signature: 401", r.status_code == 401)
        none = base64.urlsafe_b64encode(b'{"alg":"none","typ":"JWT"}').rstrip(b"=").decode()
        r = await call(c, "GET", "/me", none + "." + body + ".")
        check("alg=none token: 401", r.status_code == 401)
        rt = stranger["refresh_token"]
        r1 = await call(c, "POST", "/auth/refresh", json={"refresh_token": rt})
        r2 = await call(c, "POST", "/auth/refresh", json={"refresh_token": rt})
        r3 = await call(c, "POST", "/auth/refresh", json={"refresh_token": r1.json()["refresh_token"]})
        check("refresh rotates; replay rejected and revokes family", r1.status_code == 200 and r2.status_code == 401 and r3.status_code == 401, (r1.status_code, r2.status_code, r3.status_code))
        lo = (await call(c, "POST", "/auth/login", json={"email": f"e2e+{RUN}3@example.com", "password": PASSWORD})).json()["access_token"]
        await call(c, "POST", "/auth/logout", lo)
        check("logged-out token rejected", (await call(c, "GET", "/me", lo)).status_code == 401)

        # Input attacks
        r = await call(c, "GET", "/public/jobs?service_id=1%27%20OR%201%3D1--")
        check("SQL injection in query param rejected", r.status_code == 422, r.status_code)
        r = await c.post(API + "/documents", headers=h(wt), data={"purpose": "IDENTITY"}, files={"file": ("x.png", b"MZ\x90\x00 not an image", "image/png")})
        check("disguised executable upload rejected", r.status_code == 422, r.status_code)
        r = await c.post(API + "/documents", headers=h(wt), data={"purpose": "IDENTITY"}, files={"file": ("x.html", b"<script>alert(1)</script>", "text/html")})
        check("HTML upload rejected", r.status_code == 422, r.status_code)
        r = await c.post(API + "/documents", headers=h(wt), data={"purpose": "IDENTITY"}, files={"file": ("big.png", PNG + b"0" * (settings().max_upload_bytes + 1), "image/png")})
        check("oversized upload rejected", r.status_code in (413, 422), r.status_code)
        r = await c.options(API + "/me", headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"})
        check("CORS refuses foreign origin", r.headers.get("access-control-allow-origin") not in ("*", "https://evil.example"), dict(r.headers).get("access-control-allow-origin"))
        r = await call(c, "GET", "/jobs/not-a-uuid", ht)
        check("errors never leak stack traces", "Traceback" not in r.text and "File \"" not in r.text)
        r = await call(c, "POST", "/auth/forgot-password", json={"email": "nobody-" + RUN + "@example.com"})
        r2 = await call(c, "POST", "/auth/forgot-password", json={"email": f"e2e+{RUN}1@example.com"})
        check("forgot password does not reveal account existence", r.status_code == r2.status_code and r.text.split('requestId')[0] == r2.text.split('requestId')[0], (r.status_code, r2.status_code))
        check("password reset email is configured", r2.status_code == 202, "SMTP not configured in this environment" if r2.status_code == 503 else r2.status_code)
        fresh = (await call(c, "POST", "/auth/login", json={"email": f"e2e+{RUN}3@example.com", "password": PASSWORD})).json()["access_token"]
        r = await call(c, "POST", "/me/deletion-request", fresh, {"password": PASSWORD, "confirm": True})
        check("account deletion request", r.status_code == 202, r.text[:100])
        codes = [(await call(c, "POST", "/auth/login", json={"email": f"e2e+{RUN}2@example.com", "password": "wrong-password-x"})).status_code for _ in range(11)]
        check("login brute force throttled", 429 in codes, codes)

    failed = [r for r in results if not r[1]]
    print(f"\n{len(results) - len(failed)} passed, {len(failed)} failed (run {RUN})")
    sys.exit(1 if failed else 0)


if __name__ == "__main__":
    asyncio.run(main())
