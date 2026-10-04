// Homepage content. Every number here is a published figure with its source; nothing is estimated by us.
// Stories render only when real, consented entries are added below (no invented case studies or testimonials).

export const INSTAGRAM_URL = 'https://www.instagram.com/labour.youth/';

export type Stat = {value: string; label: string; source: string; url: string};
export const marketStats: Stat[] = [
  {value: '30.68 crore', label: 'unorganised workers registered on the government e-Shram portal', source: 'Ministry of Labour and Employment, Lok Sabha reply, March 2025', url: 'https://newsonair.gov.in/over-30-crore-unorganised-workers-registered-on-e-shram-portal'},
  {value: '53%', label: 'of those registered workers are women', source: 'Ministry of Labour and Employment, Lok Sabha reply, March 2025', url: 'https://newsonair.gov.in/over-30-crore-unorganised-workers-registered-on-e-shram-portal'},
  {value: '~30 crore', label: 'people in India work in blue-collar jobs', source: 'Deloitte India, Blue-Collar Workforce Trends 2025', url: 'https://www.deloitte.com/in/en/about/press-room/blue-collar-wages-rise-5-6-percent-annually.html'},
  {value: '+10%', label: 'rise in hiring intent for blue-collar roles in 2025', source: 'Deloitte India, Blue-Collar Workforce Trends 2025', url: 'https://www.deloitte.com/in/en/about/press-room/blue-collar-wages-rise-5-6-percent-annually.html'},
  {value: '5 to 6%', label: 'yearly growth in blue-collar wages', source: 'Deloitte India, Blue-Collar Workforce Trends 2025', url: 'https://www.deloitte.com/in/en/about/press-room/blue-collar-wages-rise-5-6-percent-annually.html'},
  {value: '77 lakh → 2.35 crore', label: 'gig and platform workers, from 2020-21 to the 2029-30 projection', source: 'NITI Aayog, India’s Booming Gig and Platform Economy, June 2022', url: 'https://www.governancenow.com/news/regular-story/gig-workforce-expected-to-expand-to-235-crore-by-202930'},
];

export const offerings = [
  {key: 'daily', title: 'Daily work', hindi: 'रोज़ का काम', body: 'One day, one wage. Helpers, masons, painters, cooks, event staff and more for today or tomorrow. The daily wage is on the job card before anyone applies.', example: 'A painter for one room, tomorrow from 9 am, ₹900 for the day.'},
  {key: 'contract', title: 'Contract work', hindi: 'ठेके का काम', body: 'A fixed stretch of days or weeks with a clear schedule: a renovation, a wedding season, a stock count. Every shift is recorded, so both sides see what was agreed and what was done.', example: 'Two helpers for a 12-day site job, 8 am to 5 pm.'},
  {key: 'permanent', title: 'Permanent job', hindi: 'पक्की नौकरी', body: 'A regular monthly role: house help, driver, security guard, cook, hotel staff. Hirers state the work and pay; workers filter for permanent jobs only.', example: 'A full-time driver for a family in Rajpur Road, monthly.'},
] as const;

export const journey = [
  {year: '2023', title: 'Started on Instagram', body: 'Labour Youth began on Instagram in September 2023, helping families find household staff, starting with nanny services.'},
  {year: '2024', title: 'Household staff, one post at a time', body: 'Through 2023 and 2024 we shared household staff and nanny services through Instagram posts and reels.'},
  {year: '2026', title: 'The Labour Youth app', body: 'We built the app to make hiring and finding work easier: wages shown up front, workers verified by our team, and direct WhatsApp contact once you choose. Dehradun first.'},
] as const;

export type Story = {name: string; role: 'Hirer' | 'Worker'; place: string; quote: string; consent: true};
// Add real stories only, with the person's written consent. The section stays hidden while this is empty.
export const stories: Story[] = [];

export const registration = {
  everyone: ['Full name', 'Email address', 'Mobile number', 'Password (12 or more characters, with a live counter)'],
  hirer: ['WhatsApp number (filled in from your mobile)', 'Address and area', 'Google Maps link (optional, one tap to open Maps)'],
  worker: ['10 short steps, each saved as you go', 'Photo, skills, experience, languages, areas', 'ID upload for verification by our team'],
};

export const languagePairs = [
  ['I want work', 'मुझे काम चाहिए'],
  ['I want to hire', 'मुझे कामगार चाहिए'],
  ['Wage shown up front', 'काम के पैसे पहले से दिखते हैं'],
  ['Chat on WhatsApp', 'व्हाट्सऐप पर बात करें'],
] as const;
