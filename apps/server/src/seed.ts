import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {poolConfig, transaction} from './db.ts';

// Port of apps/api/app/seed.py: the Dehradun service area, the service catalog and locality names.
// Idempotent (keyed on slug); it creates no users and no listings.
const CATEGORIES: [string, string, string, string][] = [
  ['House Maid', 'घरेलू सहायक', 'house-maid', 'home'],
  ['Driver', 'ड्राइवर', 'driver', 'car'],
  ['Security Guard', 'सुरक्षा गार्ड', 'security-guard', 'shield'],
  ['Babysitter', 'बच्चों की देखभाल', 'babysitter', 'heart'],
  ['Patient Care', 'मरीज़ की देखभाल', 'patient-care', 'medical'],
  ['Event Staff', 'कार्यक्रम कर्मचारी', 'event-staff', 'people'],
  ['Mason', 'राजमिस्त्री', 'mason', 'construct'],
  ['Carpenter', 'बढ़ई', 'carpenter', 'hammer'],
  ['Painter', 'पेंटर', 'painter', 'brush'],
  ['Electrician', 'इलेक्ट्रीशियन', 'electrician', 'flash'],
  ['Plumber', 'प्लंबर', 'plumber', 'water'],
  ['Welder', 'वेल्डर', 'welder', 'flame'],
  ['Helper', 'हेल्पर', 'helper', 'people'],
  ['Cook', 'रसोइया', 'cook', 'restaurant'],
  ['Waiter', 'वेटर', 'waiter', 'cafe'],
  ['Housekeeping', 'हाउसकीपिंग', 'housekeeping', 'sparkles'],
  ['Delivery Worker', 'डिलीवरी', 'delivery', 'bicycle'],
  ['AC and Refrigerator Technician', 'एसी और फ्रिज टेक्नीशियन', 'ac-technician', 'snow'],
  ['Beautician', 'ब्यूटीशियन', 'beautician', 'flower'],
  ['Mechanic', 'मैकेनिक', 'mechanic', 'build'],
  ['Construction Supervisor', 'निर्माण सुपरवाइज़र', 'construction-supervisor', 'clipboard'],
  ['Hotel and Resort Staff', 'होटल और रिज़ॉर्ट स्टाफ', 'hotel-staff', 'bed'],
  ['Other', 'अन्य', 'other', 'grid'],
];
// Owner-configurable: the original household categories need identity and police checks; the trade categories
// default to identity only so daily work can start. Change per service in the database.
const STRICT = new Set(['house-maid', 'driver', 'security-guard', 'babysitter', 'patient-care', 'event-staff', 'other']);
// Names only. Coordinates stay NULL until the owner supplies verified points (no invented geodata).
const LOCALITIES: [string, string, string][] = [
  ['ISBT', 'आईएसबीटी', 'isbt'],
  ['Patel Nagar', 'पटेल नगर', 'patel-nagar'],
  ['Sahastradhara', 'सहस्रधारा', 'sahastradhara'],
  ['Raipur', 'रायपुर', 'raipur'],
  ['Clement Town', 'क्लेमेंट टाउन', 'clement-town'],
  ['Prem Nagar', 'प्रेम नगर', 'prem-nagar'],
  ['Selaqui', 'सेलाकुई', 'selaqui'],
  ['Vikasnagar', 'विकासनगर', 'vikasnagar'],
  ['Doiwala', 'डोईवाला', 'doiwala'],
];
const REQUIREMENTS = {
  type: 'object',
  properties: {experience_years: {type: 'integer', minimum: 0, maximum: 60}, language: {type: 'string', enum: ['hi', 'en']}},
  additionalProperties: false,
};

export async function seed(pool: pg.Pool) {
  await transaction(pool, async tx => {
    await tx.query(
      `INSERT INTO cities (id, name, state, country, slug, timezone, active) VALUES ($1, 'Dehradun', 'Uttarakhand', 'IN', 'dehradun', 'Asia/Kolkata', true)
       ON CONFLICT (slug) DO NOTHING`,
      [randomUUID()],
    );
    const city = (await tx.value<string>(`SELECT id FROM cities WHERE slug = 'dehradun'`))!;
    await tx.query(
      `INSERT INTO service_areas (id, city_id, name, slug, center, radius_m, active)
       VALUES ($1, $2, 'Dehradun', 'dehradun-central', ST_GeogFromText('SRID=4326;POINT(78.0322 30.3165)'), 20000, true)
       ON CONFLICT (slug) DO NOTHING`,
      [randomUUID(), city],
    );
    for (const [order, [name, hi, slug, icon]] of CATEGORIES.entries()) {
      const checks = [...(STRICT.has(slug) ? ['IDENTITY', 'POLICE'] : ['IDENTITY']), ...(slug === 'driver' ? ['DRIVING_LICENSE'] : [])];
      await tx.query(
        `INSERT INTO service_categories (id, name, name_hi, slug, icon, active, sort_order, requirement_schema, verification_types)
         VALUES ($1, $2, $3, $4, $5, true, $6, $7, $8) ON CONFLICT (slug) DO NOTHING`,
        [randomUUID(), name, hi, slug, icon, order, REQUIREMENTS, JSON.stringify(checks)],
      );
    }
    for (const [order, [name, hi, slug]] of LOCALITIES.entries()) {
      await tx.query(
        `INSERT INTO localities (id, city_id, name, name_hi, slug, active, sort_order) VALUES ($1, $2, $3, $4, $5, true, $6) ON CONFLICT (slug) DO NOTHING`,
        [randomUUID(), city, name, hi, slug, order],
      );
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const pool = new pg.Pool(poolConfig());
  try {
    await seed(pool);
    console.log('Seed complete.');
  } finally {
    await pool.end();
  }
}
