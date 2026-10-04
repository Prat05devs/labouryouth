from fastapi.encoders import jsonable_encoder
from sqlalchemy import inspect, select

from .errors import require


async def get(db, model, id, lock=False):
    q = select(model).where(model.id == id)
    obj = await db.scalar(q.with_for_update() if lock else q)
    require(obj is not None, "NOT_FOUND", 404)
    return obj


def public(obj, exclude=()):
    hidden = {
        "password_hash",
        "refresh_hash",
        "token_hash",
        "storage_key",
        "point",
        "center",
        "maps_url",
        "contact_whatsapp",
    } | set(exclude)
    return jsonable_encoder(
        {p.key: getattr(obj, p.key) for p in inspect(type(obj)).column_attrs if p.key not in hidden}
    )


async def listing(db, q):
    return {"items": [public(x) for x in await db.scalars(q.limit(100))], "next_cursor": None}
