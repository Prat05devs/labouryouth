import Link from 'next/link';
import {ArrowUpRight,Camera} from 'lucide-react';
import {INSTAGRAM_URL} from '@/content/home';
import {Logo} from '@/components/site/logo';

const columns=[
  {h:'Explore',links:[['Services','/services'],['For workers','/for-workers'],['For hirers','/for-hirers'],['Our story','/our-story']]},
  {h:'Help',links:[['Help Centre','/help'],['Contact','/information/contact'],['Delete account','/information/delete-account'],['All information','/information']]},
  {h:'Policies',links:[['Privacy','/information/privacy'],['Terms of use','/information/terms'],['Worker policy','/information/worker-policy']]},
] as const;

export function SiteFooter(){
  const instagram=process.env.INSTAGRAM_URL||INSTAGRAM_URL;
  return <footer className="mt-auto">
    <div className="bg-raised">
      <div className="shell grid-fit gap-x-8 gap-y-10 py-14 [--min:11rem] md:py-16">
        {columns.map(c=><nav key={c.h} aria-label={c.h}>
          <h2 className="font-sans text-sm font-bold tracking-wide text-onyx">{c.h}</h2>
          <ul className="mt-4 grid gap-1">{c.links.map(([t,h])=><li key={h}><Link href={h} className="inline-flex min-h-10 items-center text-[0.95rem] text-charcoal transition-colors hover:text-trust-ink hover:underline hover:underline-offset-4">{t}</Link></li>)}</ul>
        </nav>)}
      </div>
    </div>
    <div className="bg-trust-deep text-white">
      <div className="shell flex flex-col gap-8 py-12 md:flex-row md:items-center md:justify-between">
        <div className="flex items-center gap-5">
          <Logo variant="white" className="h-14 md:h-16"/>
          <div><p className="font-display text-2xl leading-tight">Good work, close to home.</p><p className="mt-1 text-sm text-white/75">Dehradun, Uttarakhand. In Hindi and English.</p></div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/30 px-5 text-sm font-semibold transition-colors hover:bg-white/10"><Camera className="size-4" aria-hidden="true"/>@labour.youth</a>
          <Link href="/app" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-sun px-5 text-sm font-semibold text-onyx transition-colors hover:bg-courage">Open the app <ArrowUpRight className="size-4" aria-hidden="true"/></Link>
        </div>
      </div>
      <div className="shell flex flex-col gap-2 border-t border-white/15 py-6 text-xs text-white/70 sm:flex-row sm:items-center sm:justify-between">
        <p>Labour Youth</p>
        <Link href="/admin" className="inline-flex min-h-10 items-center hover:text-white">Operations login</Link>
      </div>
    </div>
  </footer>;
}
