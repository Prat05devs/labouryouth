"""Read a map pin from a Google Maps link that a hirer pastes, instead of asking for device GPS (Decision 21).

Only Google Maps hosts are ever contacted. Short links are followed hop by hop and every hop is re-checked
against the allowlist, so a pasted link cannot make the server fetch arbitrary addresses (SSRF).
"""

import re
from urllib.parse import parse_qs, unquote, urlsplit

import httpx

SHORT_HOSTS = {"maps.app.goo.gl", "goo.gl"}
MAP_HOSTS = {
    "google.com",
    "www.google.com",
    "maps.google.com",
    "google.co.in",
    "www.google.co.in",
    "maps.google.co.in",
}
MAX_HOPS = 5
TIMEOUT_S = 5.0

_PAIR = r"(-?\d{1,2}(?:\.\d+)?)\s*,\s*\+?(-?\d{1,3}(?:\.\d+)?)"
_PATTERNS = [
    re.compile(r"!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)"),  # exact place pin inside data=
    re.compile(r"@" + _PAIR),  # map viewport centre
    re.compile(r"/(?:place|search|dir)/" + _PAIR),
]


def _valid(lat, lng):
    return -90 <= lat <= 90 and -180 <= lng <= 180 and not (lat == 0 and lng == 0)


def coords_from_text(text):
    """Coordinates from a typed 'lat, lng' pair or a full Google Maps URL; None when none are present."""
    text = unquote((text or "").strip())
    bare = re.fullmatch(_PAIR, text)
    if bare:
        lat, lng = float(bare.group(1)), float(bare.group(2))
        return (lat, lng) if _valid(lat, lng) else None
    parts = urlsplit(text)
    query = parse_qs(parts.query)
    for key in ("q", "query", "ll", "destination", "center"):
        for value in query.get(key, []):
            m = re.match(_PAIR, value.strip())
            if m and _valid(float(m.group(1)), float(m.group(2))):
                return float(m.group(1)), float(m.group(2))
    for pattern in _PATTERNS:
        m = pattern.search(text)
        if m and _valid(float(m.group(1)), float(m.group(2))):
            return float(m.group(1)), float(m.group(2))
    return None


def is_maps_link(url):
    parts = urlsplit((url or "").strip())
    host = (parts.hostname or "").lower()
    if parts.scheme not in ("http", "https"):
        return False
    if host in SHORT_HOSTS:
        return host != "goo.gl" or parts.path.startswith("/maps")
    return host in MAP_HOSTS and (host.startswith("maps.") or parts.path.startswith("/maps"))


async def resolve(link, client=None):
    """Return (lat, lng) or None. Network failures and unknown formats return None so callers fall back."""
    link = (link or "").strip()
    direct = coords_from_text(link)
    if direct or not is_maps_link(link):
        return direct
    own = client is None
    client = client or httpx.AsyncClient(timeout=TIMEOUT_S, follow_redirects=False)
    try:
        url = link
        for _ in range(MAX_HOPS):
            if not is_maps_link(url):
                return None
            found = coords_from_text(url)
            if found:
                return found
            r = await client.get(url, headers={"User-Agent": "LabourYouth/1.0"})
            if r.is_redirect and r.headers.get("location"):
                url = str(httpx.URL(url).join(r.headers["location"]))
                continue
            return coords_from_text(str(r.url))
        return None
    except httpx.HTTPError:
        return None
    finally:
        if own:
            await client.aclose()


async def pin_for(db, area, maps_url, latitude=None, longitude=None, inside=True):
    """Point for a hirer's place: explicit coordinates, else the map link's pin, else the service-area centre.

    Returns (ewkt, lat, lng, precision). A link that is neither a Google Maps link nor coordinates is rejected;
    a real Maps link whose pin cannot be read (network, unknown format) falls back to AREA precision.
    """
    from sqlalchemy import func, select

    from .errors import require

    if latitude is not None and longitude is not None:
        coords = (latitude, longitude)
    elif maps_url:
        require(is_maps_link(maps_url) or coords_from_text(maps_url), "MAPS_LINK_INVALID", 422)
        coords = await resolve(maps_url)
    else:
        coords = None
    if coords:
        lat, lng = coords
        point = f"SRID=4326;POINT({lng} {lat})"
        if inside:
            require(
                await db.scalar(
                    select(func.ST_DWithin(func.ST_GeogFromText(point), area.center, area.radius_m))
                ),
                "OUTSIDE_SERVICE_AREA",
                422,
            )
        return point, lat, lng, "PIN"
    ewkt = await db.scalar(select(func.ST_AsEWKT(area.center)))
    m = re.search(r"POINT\((-?[\d.]+) (-?[\d.]+)\)", ewkt)
    return ewkt, float(m.group(2)), float(m.group(1)), "AREA"


def contact_links(whatsapp, maps_url, precision, lat=None, lng=None):
    digits = re.sub(r"\D", "", whatsapp or "")
    if not maps_url and precision == "PIN" and lat is not None:
        maps_url = f"https://www.google.com/maps/search/?api=1&query={lat},{lng}"
    return {
        "whatsapp": whatsapp,
        "whatsapp_url": f"https://wa.me/{digits}" if digits else None,
        "call_url": f"tel:{whatsapp}" if whatsapp else None,
        "maps_url": maps_url,
        "location_precision": precision,
    }
