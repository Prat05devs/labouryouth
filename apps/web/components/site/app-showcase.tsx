'use client';

import {useState} from 'react';
import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';

export function AppShowcase(){
  const [language,setLanguage]=useState<'en'|'hi'>('en');
  return <section id="app-preview" className="scroll-mt-24 bg-white section-y" aria-labelledby="app-preview-title">
    <div className="shell grid items-center gap-12 md:grid-cols-[1.15fr_1fr] lg:gap-24">
      <div>
        
        <h2 id="app-preview-title" className="t-h2">Explore first.<br/>Join when you’re ready.</h2>
        <p className="t-lead mt-6 max-w-lg text-charcoal">A local connection starts with a look around. Open the app to explore work and workers, in the language you feel at home in.</p>
        <ol className="my-8 divide-y border-y">
          {[
            ['Look around freely','Browse open jobs and listed workers without creating an account.'],
            ['Find what fits','Filter by service and review the location, schedule and stated pay on job listings.'],
            ['Take your next step','Sign up when you’re ready to apply or hire.'],
          ].map(([title,body],index)=><li key={title} className="flex gap-5 py-5"><span className={"grid size-10 shrink-0 place-items-center rounded-full font-display text-lg "+["bg-trust text-white","bg-care text-white","bg-courage text-onyx"][index]} aria-hidden="true">{index+1}</span><div><h3 className="font-sans text-base font-semibold">{title}</h3><p className="mt-1 text-sm text-muted-foreground">{body}</p></div></li>)}
        </ol>
        <Link href="/app" className="hero-open inline-flex">Open the app <ArrowUpRight size={18} aria-hidden="true"/></Link>
      </div>
      <div className="relative isolate flex flex-col items-center gap-5"><div aria-hidden="true" className="absolute left-1/2 top-1/2 -z-10 aspect-square w-[min(90%,26rem)] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[conic-gradient(from_200deg,var(--trust-mid),var(--care-mid),var(--sun),var(--warmth-mid),var(--calm-mid),var(--trust-mid))] opacity-70 blur-2xl"/>
        <div className="flex gap-1 rounded-full border bg-paper p-1" role="group" aria-label="Preview language">
          {(['en','hi'] as const).map(lang=><button key={lang} type="button" lang={lang} onClick={()=>setLanguage(lang)} aria-pressed={language===lang} className={'min-h-11 rounded-full px-6 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-4 '+(language===lang?'bg-calm text-white':'text-charcoal hover:bg-calm-soft')}>{lang==='en'?'English':'हिन्दी'}</button>)}
        </div>
        <figure className="w-full max-w-[clamp(240px,22vw,320px)]">
          <div className="overflow-hidden rounded-[2rem] border-[6px] border-trust-deep bg-background shadow-xl">
            <img src={`/img/app-preview-${language}.webp`} width={880} height={1912} loading="lazy" alt={language==='en'?'Actual English guest home with work photos, work and hire controls, and sign-in options.':'Actual Hindi guest home with translated copy, work and hire controls, and sign-in options.'} className="block h-auto w-full"/>
          </div>
          <figcaption className="mt-4 text-center text-xs leading-relaxed text-muted-foreground">Actual app screen, captured from the web preview.</figcaption>
        </figure>
      </div>
    </div>
  </section>;
}
