import {Mail} from 'lucide-react';

// Support email comes from configuration only; no address is invented while it is unset.
export function ContactCard(){
  const email=process.env.SUPPORT_EMAIL;
  return <div className="rounded-[1.5rem] border bg-white p-6">
    <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-trust-soft text-trust-ink"><Mail className="size-5" aria-hidden="true"/></span><h3 className="font-sans text-lg font-semibold text-onyx">Email us</h3></div>
    <p className="mt-3 text-charcoal">Include the email address on your account so we can help quickly.</p>
    {email?<a href={'mailto:'+email} className="mt-4 inline-flex min-h-11 items-center rounded-full bg-trust px-5 font-semibold text-white hover:bg-trust-ink">{email}</a>:<p className="mt-3 text-sm text-dimgrey">Our support email is being set up and will appear here. Until then, you can reach the team from inside the app once you are signed in.</p>}
  </div>;
}
