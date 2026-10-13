// Public website copy for the audience pages and Help Centre.
// Every statement describes how the app works today (docs/PRODUCT_SCOPE.md, DECISIONS 13, 18 and 21).
// No fees, ratings, arrival times, refunds or legal commitments are stated here.

export const navLinks = [
  {label: 'Services', href: '/services'},
  {label: 'For workers', href: '/for-workers'},
  {label: 'For hirers', href: '/for-hirers'},
  {label: 'Our story', href: '/our-story'},
  {label: 'Help', href: '/help'},
] as const;

export type Tone = 'trust' | 'care' | 'courage' | 'warmth' | 'sun' | 'calm';

export const workerSteps = [
  {h: 'Look around first', p: 'Open the app and browse open jobs near Dehradun without an account. Sign up only when you want to say you are available.'},
  {h: 'Build your profile', p: 'Short steps, each saved as you go: photo, skills, experience, languages, preferred areas and availability. Stop any time and continue later.'},
  {h: 'Get verified', p: 'Upload your identity document. Our team checks it by hand. Some household services also ask for police verification, and drivers add a driving licence. If something needs fixing, you see the reason and can send it again.'},
  {h: 'Go online and say you are available', p: 'Once verified, go online and tap I am available on a job that suits you. The employer can now see you are interested.'},
  {h: 'Accept the offer', p: 'If the employer chooses you, an offer appears in your Offers tab. Read the work, time and wage, then accept or decline.'},
  {h: 'Talk directly and go to work', p: 'When you are chosen, the employer’s WhatsApp number and map link unlock for you. On the day, mark your arrival in the app. Completed shifts appear in Earnings.'},
] as const;

export const workerFilters = [
  {h: 'Distance', p: 'Jobs within 2, 5, 10 or 20 km of you.'},
  {h: 'Skill', p: 'Only work in the services you chose for your profile.'},
  {h: 'Today only', p: 'Show work that starts today when you need it now.'},
  {h: 'Minimum daily wage', p: 'Hide jobs that pay less than the amount you set.'},
  {h: 'Daily or permanent', p: 'Pick one-day work or a regular monthly job.'},
] as const;

export const jobCardFields = ['Service', 'Area of Dehradun', 'Start day and time', 'Daily wage per worker', 'Openings left', 'Daily or permanent'] as const;

export const hirerSteps = [
  {h: 'Post in one screen', p: 'Choose the service, today or tomorrow, start time, hours, how many workers and the daily wage per worker. Add your area and, if you like, a Google Maps link.'},
  {h: 'Nearby workers see it', p: 'Verified workers who hold that skill and are online nearby see the job with the wage up front. Those who want it tap I am available.'},
  {h: 'Review who is interested', p: 'See each interested worker with their skills, experience, area and reviews from completed work, when they have any.'},
  {h: 'Choose and send an offer', p: 'Pick the worker you want. They receive an offer and accept it in their app.'},
  {h: 'Talk on WhatsApp', p: 'Your WhatsApp number and map link go only to the worker you chose. Settle the details together and follow the work in the app.'},
] as const;

export const postFields = [
  {h: 'Service', p: 'From the live list of services, in English or Hindi.'},
  {h: 'Day and start time', p: 'Today or tomorrow, with a clear start time.'},
  {h: 'Hours of work', p: 'So workers know how long the day is.'},
  {h: 'Workers needed', p: 'One person or a small team.'},
  {h: 'Daily wage', p: 'Shown to workers before they say they are available.'},
  {h: 'Area and map link', p: 'Your locality, plus an optional Google Maps link shared only after you choose.'},
] as const;

export const contactPrivacy = [
  'Your WhatsApp number and map link never appear in public listings or the job feed.',
  'They unlock only for the worker you choose, once that worker has an offer from you.',
  'You do not share your phone’s GPS. The map link you add is the location we use.',
] as const;

export type HelpItem = {q: string; a: string};
export type HelpTopic = {id: string; title: string; tone: Tone; summary: string; items: HelpItem[]};

export const helpTopics: HelpTopic[] = [
  {id: 'getting-started', title: 'Getting started', tone: 'trust', summary: 'Browsing, signing up and languages.', items: [
    {q: 'Can I look around before signing up?', a: 'Yes. Open the app to browse open jobs and listed workers without an account. You sign up only when you want to say you are available or hire.'},
    {q: 'What do I need to create an account?', a: 'Your full name, email address, mobile number and a password of 12 or more characters. Then choose whether you want work, want to hire, or both.'},
    {q: 'Can one account both hire and find work?', a: 'Yes. One account can hold both roles. Switch between them from Account in the app.'},
    {q: 'Which languages does the app support?', a: 'English and Hindi. You can switch at any time, even before signing up.'},
    {q: 'Where does Labour Youth work?', a: 'Dehradun, Uttarakhand. More areas will be added later.'},
  ]},
  {id: 'hiring', title: 'Hiring', tone: 'courage', summary: 'Posting work and choosing a worker.', items: [
    {q: 'How do I post work?', a: 'Choose to hire, then fill one screen: service, today or tomorrow, start time, hours, workers needed and daily wage. Add your area and an optional Google Maps link.'},
    {q: 'Who can see my job?', a: 'Verified workers who hold that skill and are online near the job. The public browse shows the service, area, start time, wage and openings left, never your name or number.'},
    {q: 'How do I choose a worker?', a: 'Open your job to see interested workers with their skills, experience, area and reviews, if any. Choose one and they receive an offer to accept.'},
    {q: 'What if nobody says they are available?', a: 'Your job stays visible to nearby verified workers with that skill. Availability depends on your location, schedule and wage.'},
    {q: 'Can I hire for longer than a day?', a: 'Yes. Besides daily work you can post contract work over a set number of days or a permanent monthly job.'},
    {q: 'What is the recent local daily rate?', a: 'When enough real daily jobs for a service have been posted in the last 60 days, the post screen shows the recent range to help you set a fair wage. With too few posts, nothing is shown.'},
  ]},
  {id: 'finding-work', title: 'Finding work', tone: 'care', summary: 'Jobs near you and what happens next.', items: [
    {q: 'How do I find work?', a: 'Create an account, choose Find work and complete your profile. Once our team verifies you, go online and tap I am available on jobs that suit you.'},
    {q: 'Why can’t I tap I am available?', a: 'You need a verified profile and you need to be online. Go online from the Home tab.'},
    {q: 'What happens after I say I am available?', a: 'The employer can see you. If they choose you, an offer appears in your Offers tab. Accept it to take the work, or decline.'},
    {q: 'How do I contact the employer?', a: 'Their WhatsApp number and map link unlock when they choose you. You can call or message them from the app.'},
    {q: 'Is it free for workers?', a: 'Yes. Workers do not pay to browse jobs, say they are available or get hired.'},
    {q: 'Where do I see my earnings?', a: 'Completed shifts appear in the Earnings tab. Entries are never edited silently; corrections appear as new entries.'},
  ]},
  {id: 'verification', title: 'Verification and safety', tone: 'calm', summary: 'How workers are checked.', items: [
    {q: 'How are workers verified?', a: 'Our team reviews each worker’s identity document by hand before they are listed. Some household services also need police verification, and drivers need a driving licence.'},
    {q: 'Why is my profile under review?', a: 'Documents are checked by a person, not automatically. You can see progress in the app, and a reason if something needs fixing.'},
    {q: 'Who can see my documents?', a: 'Documents are stored privately and are available only to authorised Labour Youth reviewers.'},
    {q: 'How do I report a problem with work?', a: 'Signed-in users can report an incident or ask for a replacement from the job in the app, so our team can follow up.'},
  ]},
  {id: 'privacy', title: 'Contact and privacy', tone: 'warmth', summary: 'Phone numbers and location.', items: [
    {q: 'Who sees my phone number?', a: 'Only the worker you choose. Your WhatsApp number and map link never appear in public listings or the job feed.'},
    {q: 'Why does the app ask for my location?', a: 'Workers are asked for location only when going online or checking in for a shift. The app does not track you in the background. Hirers share a Google Maps link instead of device location.'},
  ]},
  {id: 'account', title: 'Your account', tone: 'sun', summary: 'Passwords and deletion.', items: [
    {q: 'I forgot my password.', a: 'Use Forgot password? on the sign-in screen to get a reset link by email.'},
    {q: 'How do I delete my account?', a: 'In the app, open Account, tap Delete account, enter your password and confirm. See the Delete your account page for what happens next.'},
  ]},
];

// Short selections for the homepage and audience pages, taken from the Help Centre so answers stay in one place.
export const pickHelp = (ids: string[]) => helpTopics.flatMap(t => t.items).filter(i => ids.includes(i.q));
