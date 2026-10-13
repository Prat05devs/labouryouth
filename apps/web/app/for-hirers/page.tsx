import type {Metadata} from 'next';
import {BadgeCheck,Eye,Lock,LockOpen,MessageCircle,UserRoundCheck} from 'lucide-react';
import {AppButton,CtaBand,FaqList,PageHero,SectionHead,SitePage,TextLink,toneCycle,tones} from '@/components/site/blocks';
import {registration} from '@/content/home';
import {contactPrivacy,helpTopics,hirerSteps,postFields} from '@/content/site';

export const metadata:Metadata={title:'For hirers | Labour Youth',description:'Post work in Dehradun in one screen, review verified workers who are available, choose who you hire and talk directly on WhatsApp.'};

const stages=[
  {icon:Eye,h:'Your job is posted',p:'Workers see the service, area, start time, wage and openings left.',locked:true},
  {icon:UserRoundCheck,h:'Workers say they are available',p:'You see who is interested, with skills, experience and reviews.',locked:true},
  {icon:MessageCircle,h:'You choose one',p:'Only that worker gets your WhatsApp number and map link.',locked:false},
] as const;

export default function ForHirers(){
  const faq=helpTopics.find(t=>t.id==='hiring')!.items;
  return <SitePage>
    <PageHero tone="trust" title="Help for today, without the runaround." lead="Post what you need in one screen. Verified workers nearby say they are available, you choose who to hire, and you talk directly on WhatsApp." crumbs={[{label:'Home',href:'/'},{label:'For hirers'}]} image="/img/work-home.webp" imageAlt="AI-generated scene of an Indian household professional planning a task with a homeowner." imageNote="AI-generated scene for illustration. The people shown are not Labour Youth users.">
      <AppButton label="Post work in the app"/><TextLink href="#how" tone="trust">How hiring works</TextLink>
    </PageHero>

    <section id="how" className="shell section-y scroll-mt-24" aria-labelledby="how-title">
      <SectionHead tone="trust" id="how-title" title="From a post to a person at your door." lead="Availability depends on your location, schedule and the wage you offer."/>
      <ol className="grid-fit mt-12 gap-4 [--min:13.5rem]">
        {hirerSteps.map((s,i)=>{const t=tones[toneCycle[i%toneCycle.length]];return <li key={s.h} className={'flex flex-col rounded-[1.5rem] p-6 '+t.soft}>
          <span className={'font-display text-4xl '+t.ink}>{String(i+1).padStart(2,'0')}</span>
          <h3 className="mt-3 font-sans text-lg font-semibold text-onyx">{s.h}</h3><p className="mt-2 text-carbon">{s.p}</p>
        </li>;})}
      </ol>
    </section>

    <section className="bg-white section-y" aria-labelledby="post-title">
      <div className="shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-32">
          <SectionHead tone="courage" id="post-title" title="Six details. About a minute." lead="When enough real daily jobs for a service were posted in the last 60 days, the post screen also shows the recent local rate, so you can set a fair wage."/>
          <div className="mt-8"><TextLink href="/services" tone="courage">See every service</TextLink></div>
        </div>
        <ul className="grid-fit gap-4 [--min:15rem]">{postFields.map(f=><li key={f.h} className="rounded-2xl border bg-paper p-6"><BadgeCheck className="size-6 text-courage-ink" aria-hidden="true"/><h3 className="mt-3 font-sans text-lg font-semibold text-onyx">{f.h}</h3><p className="mt-1 text-charcoal">{f.p}</p></li>)}</ul>
      </div>
    </section>

    <section className="bg-trust-soft section-y" aria-labelledby="privacy-title">
      <div className="shell">
        <SectionHead tone="trust" id="privacy-title" title="Your number stays yours until you choose." lead="You decide who gets your contact details, and only one step unlocks them."/>
        <ol className="mt-12 grid gap-4 md:grid-cols-3">
          {stages.map(({icon:Icon,h,p,locked},i)=><li key={h} className={'relative rounded-[1.5rem] p-6 '+(locked?'bg-white':'bg-trust text-white shadow-xl')}>
            <div className="flex items-center justify-between"><span className={'grid size-12 place-items-center rounded-xl '+(locked?'bg-trust-soft text-trust-ink':'bg-white/15')}><Icon className="size-6" aria-hidden="true"/></span>
              <span className={'inline-flex items-center gap-1.5 text-sm font-semibold '+(locked?'text-charcoal':'text-sun')}>{locked?<Lock className="size-3.5" aria-hidden="true"/>:<LockOpen className="size-3.5" aria-hidden="true"/>}{locked?'Number hidden':'Number shared'}</span></div>
            <p className={'mt-5 text-sm font-semibold '+(locked?'text-trust-ink':'text-white/80')}>Step {i+1}</p>
            <h3 className="mt-1 font-sans text-xl font-semibold">{h}</h3><p className={'mt-2 '+(locked?'text-charcoal':'text-white/90')}>{p}</p>
          </li>)}
        </ol>
        <ul className="mt-8 grid gap-2">{contactPrivacy.map(t=><li key={t} className="flex gap-2 text-carbon"><Lock className="mt-1 size-4 shrink-0 text-trust-ink" aria-hidden="true"/>{t}</li>)}</ul>
      </div>
    </section>

    <section className="shell section-y" aria-labelledby="join-title">
      <div className="grid gap-12 lg:grid-cols-2 lg:items-center">
        <SectionHead tone="care" id="join-title" title="Four boxes, then one setup screen." lead="Look around first: open jobs and verified workers are visible in the app without an account."/>
        <div className="grid-fit gap-4 [--min:15rem]">
          {([['Everyone',registration.everyone,'trust'],['Then, for hirers',registration.hirer,'courage']] as const).map(([h,items,tone])=><div key={h} className={'rounded-2xl p-6 '+tones[tone].soft}><h3 className={'font-sans text-lg font-semibold '+tones[tone].ink}>{h}</h3><ul className="mt-3 grid gap-2">{items.map(t=><li key={t} className="flex gap-2 text-carbon"><BadgeCheck className={'mt-0.5 size-4 shrink-0 '+tones[tone].ink} aria-hidden="true"/>{t}</li>)}</ul></div>)}
        </div>
      </div>
    </section>

    <section className="bg-white section-y" aria-labelledby="hirer-faq">
      <div className="shell grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div><SectionHead tone="courage" id="hirer-faq" title="Hirers often ask"/><div className="mt-6"><TextLink href="/help#hiring" tone="courage">All answers in the Help Centre</TextLink></div></div>
        <FaqList items={faq} tone="courage"/>
      </div>
    </section>

    <div className="pt-[var(--section-y)]"><CtaBand title="Need someone today?" body="Open Labour Youth, post the work and see who nearby is available."/></div>
  </SitePage>;
}
