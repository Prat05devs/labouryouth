/**
 * Read a map pin from a Google Maps link that a hirer pastes, instead of asking for device GPS (Decision 21).
 *
 * Only Google Maps hosts are ever contacted. Short links are followed hop by hop and every hop is re-checked
 * against the allowlist, so a pasted link cannot make the server fetch arbitrary addresses (SSRF).
 */
import type {Row, Tx} from './db.ts';
import {require} from './errors.ts';

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl']);
const MAP_HOSTS = new Set(['google.com', 'www.google.com', 'maps.google.com', 'google.co.in', 'www.google.co.in', 'maps.google.co.in']);
const MAX_HOPS = 5;
const TIMEOUT_MS = 5000;
// The whole lookup runs inside a request's database transaction, so all hops together get one short budget.
const TOTAL_MS = 8000;

const PAIR = String.raw`(-?\d{1,2}(?:\.\d+)?)\s*,\s*\+?(-?\d{1,3}(?:\.\d+)?)`;
const BARE = new RegExp(`^${PAIR}$`);
const LEADING = new RegExp(`^${PAIR}`);
const PATTERNS = [
  /!3d(-?\d+(?:\.\d+)?)!4d(-?\d+(?:\.\d+)?)/, // exact place pin inside data=
  new RegExp('@' + PAIR), // map viewport centre
  new RegExp('/(?:place|search|dir)/' + PAIR),
];

export type Coords = [number, number];

const valid = (lat: number, lng: number) => lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180 && !(lat === 0 && lng === 0);

function unquote(text: string) {
  try {
    return decodeURIComponent(text);
  } catch {
    return text;
  }
}

/** Coordinates from a typed 'lat, lng' pair or a full Google Maps URL; null when none are present. */
export function coordsFromText(input: string | null | undefined): Coords | null {
  const text = unquote((input ?? '').trim());
  const bare = BARE.exec(text);
  if (bare) {
    const [lat, lng] = [Number(bare[1]), Number(bare[2])];
    return valid(lat, lng) ? [lat, lng] : null;
  }
  const query = text.includes('?') ? text.slice(text.indexOf('?') + 1).split('#')[0] : '';
  const params = new URLSearchParams(query);
  for (const key of ['q', 'query', 'll', 'destination', 'center']) {
    for (const value of params.getAll(key)) {
      const m = LEADING.exec(value.trim());
      if (m && valid(Number(m[1]), Number(m[2]))) return [Number(m[1]), Number(m[2])];
    }
  }
  for (const pattern of PATTERNS) {
    const m = pattern.exec(text);
    if (m && valid(Number(m[1]), Number(m[2]))) return [Number(m[1]), Number(m[2])];
  }
  return null;
}

export function isMapsLink(url: string | null | undefined) {
  let parts: URL;
  try {
    parts = new URL((url ?? '').trim());
  } catch {
    return false;
  }
  const host = parts.hostname.toLowerCase();
  if (parts.protocol !== 'http:' && parts.protocol !== 'https:') return false;
  if (SHORT_HOSTS.has(host)) return host !== 'goo.gl' || parts.pathname.startsWith('/maps');
  return MAP_HOSTS.has(host) && (host.startsWith('maps.') || parts.pathname.startsWith('/maps'));
}

/** Returns [lat, lng] or null. Network failures and unknown formats return null so callers fall back. */
export async function resolveLink(input: string | null | undefined, fetcher: typeof fetch = fetch): Promise<Coords | null> {
  const link = (input ?? '').trim();
  const direct = coordsFromText(link);
  if (direct || !isMapsLink(link)) return direct;
  const deadline = AbortSignal.timeout(TOTAL_MS);
  try {
    let url = link;
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      if (!isMapsLink(url)) return null;
      const found = coordsFromText(url);
      if (found) return found;
      const r = await fetcher(url, {redirect: 'manual', headers: {'User-Agent': 'LabourYouth/1.0'}, signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), deadline])});
      await r.body?.cancel();
      const location = r.headers.get('location');
      if (r.status >= 300 && r.status < 400 && location) {
        url = new URL(location, url).toString();
        continue;
      }
      return coordsFromText(url);
    }
    return null;
  } catch {
    return null;
  }
}

/** Python's str(float), so stored latitude/longitude text matches what the FastAPI backend wrote. */
const pyFloat = (n: number) => (Number.isInteger(n) ? n.toFixed(1) : String(n));

export type Pin = {point: string; lat: number; lng: number; latitude: string; longitude: string; precision: 'PIN' | 'AREA'};

/**
 * Point for a hirer's place: explicit coordinates, else the map link's pin, else the service-area centre.
 * A link that is neither a Google Maps link nor coordinates is rejected; a real Maps link whose pin cannot be
 * read (network, unknown format) falls back to AREA precision. `point` is EWKT for ST_GeogFromText.
 */
export async function pinFor(
  tx: Tx,
  area: Row,
  mapsUrl: string | null | undefined,
  latitude?: number | null,
  longitude?: number | null,
  inside = true,
  fetcher: typeof fetch = fetch,
): Promise<Pin> {
  let coords: Coords | null = null;
  if (latitude != null && longitude != null) coords = [latitude, longitude];
  else if (mapsUrl) {
    require(isMapsLink(mapsUrl) || coordsFromText(mapsUrl), 'MAPS_LINK_INVALID', 422);
    coords = await resolveLink(mapsUrl, fetcher);
  }
  if (coords) {
    const [lat, lng] = coords;
    const point = `SRID=4326;POINT(${pyFloat(lng)} ${pyFloat(lat)})`;
    if (inside) {
      const ok = await tx.value<boolean>('SELECT ST_DWithin(ST_GeogFromText($1), center, radius_m) FROM service_areas WHERE id = $2', [point, area.id]);
      require(ok, 'OUTSIDE_SERVICE_AREA', 422);
    }
    return {point, lat, lng, latitude: pyFloat(lat), longitude: pyFloat(lng), precision: 'PIN'};
  }
  const row = await tx.one('SELECT ST_AsEWKT(center) AS point, ST_Y(center::geometry) AS lat, ST_X(center::geometry) AS lng FROM service_areas WHERE id = $1', [area.id]);
  return {point: row!.point, lat: row!.lat, lng: row!.lng, latitude: pyFloat(row!.lat), longitude: pyFloat(row!.lng), precision: 'AREA'};
}

export function contactLinks(whatsapp: string | null, mapsUrl: string | null, precision: string, lat?: number | string | null, lng?: number | string | null) {
  const digits = (whatsapp ?? '').replace(/\D/g, '');
  if (!mapsUrl && precision === 'PIN' && lat != null) mapsUrl = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
  return {
    whatsapp,
    whatsapp_url: digits ? `https://wa.me/${digits}` : null,
    call_url: whatsapp ? `tel:${whatsapp}` : null,
    maps_url: mapsUrl,
    location_precision: precision,
  };
}
