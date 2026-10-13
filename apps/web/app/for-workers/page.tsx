import type {Metadata} from 'next';
import {BadgeCheck,Briefcase,CalendarClock,Clock3,FileCheck2,IndianRupee,Languages,MapPin,ShieldCheck,SlidersHorizontal,Users} from 'lucide-react';
import {AppButton,CtaBand,FaqList,PageHero,SectionHead,SitePage,TextLink,toneCycle,tones} from '@/components/site/blocks';
import {languagePairs,registration} from '@/content/home';
import {helpTopics,jobCardFields,workerFilters,workerSteps} from '@/content/site';

export const metadata:Metadata={title:'For workers | Labour Youth',description:'Find daily, contract and permanent work near you in Dehradun, with the wage shown before you say you are available. Free for workers.'};

export default function ForWorkers(){
  const faq=helpTopics.find(t=>t.id==='finding-work')!.items;
  return <SitePage>
    <PageHero tone="care" title="Work near you. Wage shown up front." lead="See jobs around Dehradun with the day, the time and the daily wage before you decide. Say you are available with one tap. It is free for workers." crumbs={[{label:'Home',href:'/'},{label:'For workers'}]} image="/img/pipes.jpg" imageAlt="Stock photo of a tradesman working with metal rods outside a workshop." imageNote="Stock photography for illustration. The person shown is not a Labour Youth user.">
      <AppButton label="Find work in the app"/><TextLink href="#steps" tone="care">How it works</TextLink>
    </PageHero>

    <section id="steps" className="shell section-y scroll-mt-24" aria-labelledby="steps-title">
      <SectionHead tone="care" id="steps-title" title="Six steps, at your pace." lead="Your profile saves after every step, so you can stop and continue later."/>
      <ol className="grid-fit mt-12 gap-5 [--min:19rem]">
        {workerSteps.map((s,i)=>{const t=tones[toneCycle[i%toneCycle.length]];return <li key={s.h} className="relative flex flex-col rounded-[1.75rem] border bg-white p-7">
          <span className={'grid size-12 place-items-center rounded-full font-display text-2xl '+t.fill}>{i+1}</span>
          <h3 className="mt-5 font-sans text-xl font-semibold text-onyx">{s.h}</h3><p className="mt-2 text-charcoal">{s.p}</p>
        </li>;})}
      </ol>
    </section>

    <section className="bg-care-soft section-y" aria-labelledby="compare-title">
      <div className="shell @container">
        <div className="grid items-center gap-12 @4xl:grid-cols-[1fr_0.9fr]">
          <div>
            <SectionHead tone="care" id="compare-title" title="Location, schedule and pay, side by side." lead="Filter the job list to the work that makes sense for you."/>
            <ul className="grid-fit mt-10 gap-3 [--min:14rem]">{workerFilters.map(f=><li key={f.h} className="flex gap-3 rounded-2xl bg-white p-5"><SlidersHorizontal className="mt-0.5 size-5 shrink-0 text-care-ink" aria-hidden="true"/><div><p className="font-semibold text-onyx">{f.h}</p><p className="text-sm text-charcoal">{f.p}</p></div></li>)}</ul>
          </div>
          {/* A labelled outline of a job card, not a sample listing: it names the fields, it does not invent values. */}
          <figure className="mx-auto w-full max-w-md">
            <div className="rounded-[2rem] bg-white p-6 shadow-xl ring-1 ring-care-mid">
              <p className="text-xs font-bold tracking-widest text-care-ink">EVERY JOB SHOWS</p>
              <ul className="mt-4 grid gap-2.5">{jobCardFields.map((f,i)=>{const Icon=[Briefcase,MapPin,CalendarClock,IndianRupee,Users,Clock3][i];return <li key={f} className="flex items-center gap-3 rounded-xl bg-paper px-4 py-3"><Icon className="size-5 shrink-0 text-care-ink" aria-hidden="true"/><span className="font-semibold text-carbon">{f}</span></li>;})}</ul>
              <p className="mt-5 rounded-full bg-care px-5 py-3 text-center font-semibold text-white">I am available</p>
            </div>
            <figcaption className="mt-4 text-center text-sm text-charcoal">The details on every job card in the app.</figcaption>
          </figure>
        </div>
      </div>
    </section>

    <section className="shell section-y" aria-labelledby="verify-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-start">
        <SectionHead tone="calm" id="verify-title" title="Checked by a person, once." lead="Hirers see that every listed worker has been reviewed by our team. That is why verification comes before you can say you are available."/>
        <ul className="grid gap-4">
          {[
            {icon:FileCheck2,h:'Upload your ID',p:'Our team checks it by hand. Documents are stored privately and seen only by authorised reviewers.'},
            {icon:ShieldCheck,h:'Some services ask for more',p:'Some household services also need police verification, and drivers add a driving licence. The Services page shows the checks for each service.'},
            {icon:BadgeCheck,h:'Clear reasons',p:'If something needs fixing, you see why and can send it again. Your other steps stay saved.'},
          ].map(({icon:Icon,h,p})=><li key={h} className="flex gap-4 rounded-2xl border bg-white p-6"><span className="grid size-11 shrink-0 place-items-center rounded-xl bg-calm-soft text-calm-ink"><Icon className="size-5" aria-hidden="true"/></span><div><h3 className="font-sans text-lg font-semibold text-onyx">{h}</h3><p className="mt-1 text-charcoal">{p}</p></div></li>)}
        </ul>
      </div>
    </section>

    <section className="bg-white section-y" aria-labelledby="join-title">
      <div className="shell grid gap-12 lg:grid-cols-2">
        <div>
          <SectionHead tone="trust" id="join-title" title="Sign-up a first-time phone user can finish." lead="Short forms, plain words, and a clear message under the exact box that needs fixing."/>
          <div className="grid-fit mt-10 gap-4 [--min:15rem]">
            {([['Everyone',registration.everyone,'trust'],['Then, for workers',registration.worker,'care']] as const).map(([h,items,tone])=><div key={h} className={'rounded-2xl p-6 '+tones[tone].soft}><h3 className={'font-sans text-lg font-semibold '+tones[tone].ink}>{h}</h3><ul className="mt-3 grid gap-2">{items.map(t=><li key={t} className="flex gap-2 text-carbon"><BadgeCheck className={'mt-0.5 size-4 shrink-0 '+tones[tone].ink} aria-hidden="true"/>{t}</li>)}</ul></div>)}
          </div>
        </div>
        <div>
          <SectionHead tone="warmth" title="In the language you think in." lead="Switch with one tap, even before you sign up."/>
          <div className="mt-10 overflow-hidden rounded-2xl border">
            <div className="grid grid-cols-2 bg-warmth-soft text-sm font-semibold text-warmth-ink"><div className="px-5 py-3">English</div><div className="px-5 py-3" lang="hi">हिन्दी</div></div>
            {languagePairs.map(([en,hi])=><div key={en} className="grid grid-cols-2 border-t"><div className="px-5 py-4 text-onyx">{en}</div><div lang="hi" className="border-l px-5 py-4 text-onyx">{hi}</div></div>)}
          </div>
          <p className="mt-4 flex items-center gap-2 text-sm text-charcoal"><Languages className="size-4 text-warmth-ink" aria-hidden="true"/>Service names, buttons, errors and help text are all translated.</p>
        </div>
      </div>
    </section>

    <section className="shell section-y" aria-labelledby="worker-faq">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div><SectionHead tone="care" id="worker-faq" title="Workers often ask"/><div className="mt-6"><TextLink href="/help#finding-work" tone="care">All answers in the Help Centre</TextLink></div></div>
        <FaqList items={faq} tone="care"/>
      </div>
    </section>

    <CtaBand title="Your next job could be nearby." body="Open Labour Youth, look around without an account, and sign up when you find work you want."/>
  </SitePage>;
}
