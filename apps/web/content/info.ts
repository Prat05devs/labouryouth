export type Section={h:string;p?:string[];list?:string[]};
export type InfoPage={slug:string;title:string;summary:string;sections:Section[];pending?:string[];legal?:boolean};

/* Content describes what the product does today (see docs/PRODUCT_SCOPE.md). Legal commitments (
   retention periods, company identity, grievance contact, governing law) are NOT invented here:
   they are listed under `pending` until the owner supplies reviewed text. */
export const infoPages:InfoPage[]=[
  {slug:'about',title:'About Labour Youth',summary:'Local staffing, coordinated by a real team. We are starting in Dehradun.',sections:[
    {h:'What we do',p:['Labour Youth helps households find verified local workers, and helps workers find fair, nearby work. Our operations team reviews worker profiles, matches requirements to suitable workers and follows each job through to completion.']},
    {h:'Services',p:['We start with House Maid, Driver, Security Guard, Babysitter, Patient Care, Event Staff and other local roles. The live list is always shown on the home page.']},
    {h:'How the app works',list:['Households describe a requirement: service, schedule, location and headcount.','Workers build a profile, submit documents for review and choose when they are available.','Our team matches, sends offers and coordinates arrival, attendance and completion.','Payment is arranged directly (pay later, cash or UPI) and recorded by our team. The app does not process card payments.']},
    {h:'Where we operate',p:['Dehradun, Uttarakhand, India. More areas will be added later.']}]},
  {slug:'privacy',title:'Privacy',legal:true,summary:'What information the Labour Youth app handles, and why.',sections:[
    {h:'Information you give us',list:['Account: full name, email address and mobile number, and your password (stored only as a one-way hash).','Households: your primary location and the details of each requirement you create.','Workers: profile details, services, experience, languages, preferred areas and availability, plus a photo, identity and police-verification documents you choose to upload.','Reviews and support messages you send.']},
    {h:'Location',p:['The app asks for your location while it is open and only for specific steps: choosing a service location, going online as a worker, and checking in to a shift. We compare a check-in against the job location to confirm arrival. The app does not track your location in the background.']},
    {h:'Documents',p:['Worker documents are stored privately, not in a public folder, and are available only to authorised Labour Youth reviewers for verification.']},
    {h:'How information is used',list:['To create and secure your account.','To match requirements with suitable workers and coordinate work.','To record attendance, completion, reviews and earnings.','To resolve incidents, replacements and support requests.']},
    {h:'Your choices',list:['Switch language between English and Hindi in the app.','Turn location permission off in your phone settings. You can still use manual options where offered.','Request account deletion from inside the app. See “Delete your account”.']}],
    pending:['Name and registered address of the company operating Labour Youth','Retention periods for accounts, documents and attendance records','Grievance officer name and contact (as required under Indian law)','Who we share information with (hosting, email provider) and where it is stored','Policy effective date and update process']},
  {slug:'terms',title:'Terms of use',legal:true,summary:'The rules for using the Labour Youth app.',sections:[
    {h:'What the service is',p:['Labour Youth is a coordination service. We help households and workers find each other and manage the work, and our team stays involved in matching, scheduling and exceptions.']},
    {h:'Accounts',list:['You need an account with a valid email address and mobile number.','Keep your password private. Tell us if you think someone else has used your account.','One account can hold both a household and a worker role.']},
    {h:'Work and payment',list:['Requirements, offers and assignments are recorded in the app.','Payment is pay later, cash or manual UPI as agreed for the job. The app records it but does not collect card payments.']},
    {h:'Respectful conduct',p:['Everyone using Labour Youth is expected to treat others with respect. Our team can pause or close accounts that put people at risk.']}],
    pending:['Operating entity, jurisdiction and governing law','Liability, dispute and cancellation terms','Fees, commissions and refund position','Effective date and change-notice process']},
  {slug:'worker-policy',title:'Worker policy',legal:true,summary:'How worker verification, offers and conduct work.',sections:[
    {h:'Getting verified',list:['Complete your profile step by step. Progress is saved so you can continue later.','Upload your photo and required identity documents. Our team reviews them manually.','If something is rejected, you will see the reason and can resubmit.']},
    {h:'Taking work',list:['Go online when you are available. You can go offline at any time.','Review an offer before accepting. You can decline.','On the day, check in at the job location using the app.']},
    {h:'Earnings',p:['Completed shifts create earning entries that you can see in the Earnings tab. Entries are never edited silently; corrections appear as new entries.']},
    {h:'Replacements and incidents',p:['If plans change, the household or our team can request a replacement. Report any incident through the app so our team can follow up.']}],
    pending:['Eligibility and required document list as approved by the owner','Conduct rules, suspension and appeal process','Payout timing and any deductions','Effective date']},
  {slug:'support',title:'Support',summary:'Help with your account, work or the app.',sections:[]},
  {slug:'contact',title:'Contact',summary:'How to reach the Labour Youth team.',sections:[]},
  {slug:'delete-account',title:'Delete your account',summary:'How to ask us to delete your Labour Youth account and data.',sections:[
    {h:'In the app',list:['Open Labour Youth and sign in.','Go to Account (Settings).','Tap “Delete account”, enter your password and confirm “Request deletion”.']},
    {h:'What happens next',p:['Your request signs you out immediately. Our team resolves any active work and then deletes or anonymises your data, keeping only records we are required to keep.']},
    {h:'Cannot sign in?',p:['Contact support from the Support page and include the email address on your account. We will verify it is you before acting.']}],
    pending:['Exact retention period for records kept after deletion','Target time to complete a deletion request']},
];
export const faq=[
  ['How do I hire someone?','Open the app, choose “Hire staff”, pick a service and tell us the schedule and location. Our team matches a verified worker and keeps you updated.'],
  ['How do I find work?','Choose “Find work”, complete your profile and upload your documents. Once verified, set yourself online to receive offers.'],
  ['Why is my profile under review?','Our team checks each worker’s documents by hand before any work starts. You will see progress in the app, and a reason if something needs fixing.'],
  ['The app asks for my location. Why?','Only to choose a service area and to check in to a shift. We do not track you in the background.'],
  ['Can I use the app in Hindi?','Yes. Open Account and switch between English and हिन्दी.'],
  ['I forgot my password.','Use “Forgot password?” on the sign-in screen to get a reset link by email.'],
  ['How is payment handled?','Payment is arranged for each job (pay later, cash or UPI) and recorded by our team. The app does not take card payments.'],
] as const;
export const bySlug=(s:string)=>infoPages.find(p=>p.slug===s);
