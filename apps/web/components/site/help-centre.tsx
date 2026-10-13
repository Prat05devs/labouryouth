'use client';

import {useMemo,useState} from 'react';
import {Search,X} from 'lucide-react';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import type {HelpTopic} from '@/content/site';

// Literal per-tone classes (Tailwind scans source text).
const chip:Record<string,string>={trust:'bg-trust-soft text-trust-ink',care:'bg-care-soft text-care-ink',courage:'bg-courage-soft text-courage-ink',warmth:'bg-warmth-soft text-warmth-ink',sun:'bg-sun-soft text-sun-ink',calm:'bg-calm-soft text-calm-ink'};
const dot:Record<string,string>={trust:'bg-trust',care:'bg-care',courage:'bg-courage',warmth:'bg-warmth',sun:'bg-sun',calm:'bg-calm'};

export function HelpCentre({topics}:{topics:HelpTopic[]}){
  const [query,setQuery]=useState('');
  const q=query.trim().toLowerCase();
  const shown=useMemo(()=>topics.map(t=>({...t,items:q?t.items.filter(i=>(i.q+' '+i.a).toLowerCase().includes(q)):t.items})).filter(t=>t.items.length),[topics,q]);
  const count=shown.reduce((n,t)=>n+t.items.length,0);
  return <div className="@container">
    <div className="relative mx-auto max-w-2xl">
      <label htmlFor="help-search" className="sr-only">Search help</label>
      <Search className="pointer-events-none absolute left-5 top-1/2 size-5 -translate-y-1/2 text-dimgrey" aria-hidden="true"/>
      <input id="help-search" type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search, for example: phone number, verification, wage" autoComplete="off" className="h-14 w-full rounded-full border bg-white pl-14 pr-14 text-base shadow-sm outline-none transition-shadow placeholder:text-dimgrey focus:border-calm focus:ring-4 focus:ring-calm-mid"/>
      {query&&<button type="button" onClick={()=>setQuery('')} aria-label="Clear search" className="absolute right-3 top-1/2 grid size-10 -translate-y-1/2 place-items-center rounded-full hover:bg-raised"><X className="size-4"/></button>}
    </div>
    <p className="mt-3 text-center text-sm text-charcoal" aria-live="polite">{q?`${count} ${count===1?'answer':'answers'} found`:`${count} answers in ${topics.length} topics`}</p>

    <div className="mt-12 grid gap-10 @4xl:grid-cols-[15rem_1fr] @4xl:gap-14">
      {/* Topic list: a scrollable chip row on narrow widths, a sticky sidebar once there is room. */}
      <nav aria-label="Help topics" className="-mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] @4xl:mx-0 @4xl:overflow-visible @4xl:px-0">
        <ul className="flex gap-2 pb-2 @4xl:sticky @4xl:top-32 @4xl:flex-col @4xl:pb-0">
          {topics.map(t=><li key={t.id} className="shrink-0"><a href={'#'+t.id} className={'flex min-h-11 items-center gap-2.5 whitespace-nowrap rounded-full px-4 text-sm font-semibold transition-opacity hover:opacity-80 @4xl:rounded-xl @4xl:py-2.5 '+chip[t.tone]}><span className={'size-2 rounded-full '+dot[t.tone]} aria-hidden="true"/>{t.title}</a></li>)}
        </ul>
      </nav>
      <div className="grid min-w-0 gap-12">
        {shown.map(t=><section key={t.id} id={t.id} className="scroll-mt-28" aria-labelledby={t.id+'-h'}>
          <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 id={t.id+'-h'} className="t-h3 text-onyx">{t.title}</h2><p className="text-sm text-charcoal">{t.summary}</p></div>
          <Accordion type="multiple" defaultValue={q?t.items.map(i=>i.q):[]} key={q} className="mt-5 grid gap-3 [&_h3]:font-sans [&_h3]:tracking-normal">
            {t.items.map(i=><AccordionItem key={i.q} value={i.q} className="rounded-2xl border bg-white px-5 last:border-b">
              <AccordionTrigger className="min-h-14 py-4 text-left text-[1.05rem] font-semibold text-onyx hover:no-underline">{i.q}</AccordionTrigger>
              <AccordionContent className="pb-5 text-base leading-relaxed text-charcoal">{i.a}</AccordionContent>
            </AccordionItem>)}
          </Accordion>
        </section>)}
        {!shown.length&&<p className="rounded-2xl border border-dashed bg-white p-8 text-center text-charcoal">No answers match “{query}”. Try a shorter word, or contact us below.</p>}
      </div>
    </div>
  </div>;
}
