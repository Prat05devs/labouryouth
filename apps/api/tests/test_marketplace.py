# ruff: noqa: F811, RUF059
# The `system` fixture is shared from test_operating_loop (same PostgreSQL/PostGIS schema-per-test setup).
import asyncio
from datetime import timedelta

from app.security import now
from tests.test_operating_loop import bootstrap, call, headers, system, user, worker  # noqa: F401

HERE = {"latitude": 30.3165, "longitude": 78.0322}
FAR = {"latitude": 30.43, "longitude": 78.0322}  # about 12.6 km north


async def quick(c, ids, client, **over):
    body = {
        "service_id": ids["service"],
        "service_area_id": ids["area"],
        **HERE,
        "locality": "Patel Nagar",
        "start_at": (now() + timedelta(hours=3)).isoformat(),
        "hours": 8,
        "headcount": 1,
        "wage_per_day_paise": 90000,
    }
    body.update(over)
    return await call(c, "/jobs/quick", body, client, status=201)


async def feed(c, u, **params):
    query = "&".join(f"{k}={v}" for k, v in params.items())
    return (await call(c, "/worker/jobs/nearby?" + query, u=u, method="GET"))["items"]


async def test_quick_post_notifies_and_feed_filters_by_distance(system):
    c, f, ids = system
    client, admin, _ = await bootstrap(c, f, ids)
    u, w, _ = await worker(c, ids, admin, 3)
    j = await quick(c, ids, client)
    assert j["status"] == "MATCHING" and j["notified_workers"] == 1
    note = await call(c, "/notifications", u=u, method="GET")
    assert any(n["kind"] == "NewJobNearby" for n in note["items"])
    assert [x["id"] for x in await feed(c, u, radius_km=2)] == [j["id"]]
    assert await feed(c, u, radius_km=2, latitude=FAR["latitude"], longitude=FAR["longitude"]) == []
    assert [
        x["id"] for x in await feed(c, u, radius_km=20, latitude=FAR["latitude"], longitude=FAR["longitude"])
    ] == [j["id"]]
    assert await feed(c, u, min_wage_paise=100000) == []
    assert len(await feed(c, u, today="false", min_wage_paise=90000)) == 1


async def test_client_cannot_use_worker_feed_and_worker_cannot_post(system):
    c, f, ids = system
    client, admin, _ = await bootstrap(c, f, ids)
    u, w, _ = await worker(c, ids, admin, 3)
    await call(c, "/worker/jobs/nearby", u=client, method="GET", status=403)
    body = {
        "service_id": ids["service"],
        "service_area_id": ids["area"],
        **HERE,
        "start_at": (now() + timedelta(hours=2)).isoformat(),
        "headcount": 1,
        "wage_per_day_paise": 50000,
    }
    await call(c, "/jobs/quick", body, u, status=403)


async def test_interest_is_idempotent_and_selection_is_owner_only(system):
    c, f, ids = system
    client, admin, _ = await bootstrap(c, f, ids)
    u, w, _ = await worker(c, ids, admin, 3)
    other, _, _ = await worker(c, ids, admin, 4)
    j = await quick(c, ids, client)
    first = await call(c, f"/jobs/{j['id']}/interest", {}, u, status=201)
    again = await call(c, f"/jobs/{j['id']}/interest", {}, u, status=201)
    assert first["id"] == again["id"]
    listing = await call(c, f"/jobs/{j['id']}/interests", u=client, method="GET")
    assert len(listing["items"]) == 1 and listing["items"][0]["worker_name"].startswith("Person")
    await call(c, f"/jobs/{j['id']}/interests", u=other, method="GET", status=404)
    await call(c, f"/jobs/{j['id']}/interests/{first['id']}/select", {}, other, status=404)
    await call(c, f"/jobs/{j['id']}/interest/withdraw", {}, u)
    assert (await call(c, f"/jobs/{j['id']}/interests", u=client, method="GET"))["items"] == []
    await call(c, f"/jobs/{j['id']}/interest", {}, u, status=201)


async def test_selection_creates_offer_worker_accepts_and_capacity_holds(system):
    c, f, ids = system
    client, admin, _ = await bootstrap(c, f, ids)
    u1, w1, _ = await worker(c, ids, admin, 3)
    u2, w2, _ = await worker(c, ids, admin, 4)
    j = await quick(c, ids, client, headcount=1)
    i1 = await call(c, f"/jobs/{j['id']}/interest", {}, u1, status=201)
    i2 = await call(c, f"/jobs/{j['id']}/interest", {}, u2, status=201)
    offer = await call(c, f"/jobs/{j['id']}/interests/{i1['id']}/select", {}, client, status=201)
    assert offer["agreed_worker_amount_paise"] == 90000 and offer["status"] == "PENDING"
    blocked = await call(c, f"/jobs/{j['id']}/interests/{i2['id']}/select", {}, client, status=409)
    assert blocked["error"]["code"] == "JOB_ALREADY_ASSIGNED"
    accepted = await call(c, f"/offers/{offer['id']}/accept", {}, u1, key="accept-market")
    assert (
        accepted["status"] in ("ACCEPTED", "ASSIGNED", "CONFIRMED", "SCHEDULED")
        or accepted["job_id"] == j["id"]
    )
    assert await feed(c, u2) == []  # full jobs leave the feed


async def test_concurrent_selection_never_overfills(system):
    c, f, ids = system
    client, admin, _ = await bootstrap(c, f, ids)
    u1, _, _ = await worker(c, ids, admin, 3)
    u2, _, _ = await worker(c, ids, admin, 4)
    j = await quick(c, ids, client, headcount=1)
    rows = [await call(c, f"/jobs/{j['id']}/interest", {}, u, status=201) for u in (u1, u2)]
    results = await asyncio.gather(
        *[
            c.post(f"/api/v1/jobs/{j['id']}/interests/{r['id']}/select", headers=headers(client), json={})
            for r in rows
        ]
    )
    assert sorted(r.status_code for r in results) == [201, 409]


async def test_wage_benchmark_is_hidden_until_enough_real_samples(system):
    c, f, ids = system
    client, admin, _ = await bootstrap(c, f, ids)
    await quick(c, ids, client)
    thin = await call(c, f"/wages/benchmark?service_id={ids['service']}", u=client, method="GET")
    assert thin["sample_size"] == 1 and thin["median_paise"] is None
    for wage in (80000, 85000, 95000, 100000):
        await quick(c, ids, client, wage_per_day_paise=wage)
    full = await call(c, f"/wages/benchmark?service_id={ids['service']}", u=client, method="GET")
    assert full["sample_size"] == 5 and full["median_paise"] == 90000 and full["min_paise"] == 80000
