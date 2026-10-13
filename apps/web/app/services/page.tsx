import Link from 'next/link';
import type {Metadata} from 'next';
import {ArrowUpRight,BadgeCheck,Bed,Bike,Brush,Car,ChefHat,ClipboardList,Coffee,Construction,Flame,Flower2,Hammer,Heart,House,LayoutGrid,Shield,Snowflake,Sparkles,Stethoscope,Users,Wrench,Zap,Droplets,CalendarDays,Clock3,Briefcase} from 'lucide-react';
import {AppButton,CtaBand,PageHero,SectionHead,SitePage,TextLink,toneCycle,tones} from '@/components/site/blocks';
import {catalog} from '@/lib/catalog';
import {offerings} from '@/content/home';
import {postFields} from '@/content/site';

export const dynamic='force-dynamic';
export const metadata:Metadata={title:'Services | Labour Youth',description:'Household, skilled trade, event and hospitality work in Dehradun, listed in English and Hindi.'};

// Keyed by the icon name stored on each service row in the database; unknown names fall back to a grid icon.
const icons:Record<string,typeof House>={home:House,car:Car,shield:Shield,heart:Heart,medical:Stethoscope,people:Users,construct:Construction,hammer:Hammer,brush:Brush,flash:Zap,water:Droplets,flame:Flame,restaurant:ChefHat,cafe:Coffee,sparkles:Sparkles,bicycle:Bike,snow:Snowflake,flower:Flower2,build:Wrench,clipboard:ClipboardList,bed:Bed,grid:LayoutGrid};
const checks:Record<string,string>={IDENTITY:'ID check',POLICE:'Police verification',DRIVING_LICENSE:'Driving licence'};
const offeringIcons={daily:Clock3,contract:CalendarDays,permanent:Briefcase} as const;
const offeringTones={daily:'courage',contract:'care',permanent:'trust'} as const;

const kinds=[
  {h:'Home and care',p:'Help around the house, cooking, childcare and looking after someone who is unwell.',tone:'warmth',photos:[{src:'/img/care.jpg',alt:'Stock photo of a caregiver handing medicine to an older woman resting in bed.'},{src:'/img/sweep.jpg',alt:'Stock photo of a woman in a red sari sweeping a garden path.'}]},
  {h:'Skilled trades',p:'Electrical, plumbing, carpentry, masonry, painting and repair work for homes, shops and sites.',tone:'trust',photos:[{src:'/img/electrician.jpg',alt:'Stock photo of an electrician working on a distribution board.'},{src:'/img/work-craft.webp',alt:'AI-generated scene of two Indian carpenters measuring a timber frame.'}]},
  {h:'Events and hospitality',p:'Event staff, waiters, cooks and hotel and resort teams for a day, a season or the long term.',tone:'courage',photos:[{src:'/img/work-events.webp',alt:'AI-generated scene of Indian event staff preparing an outdoor table.'},{src:'/img/cook.jpg',alt:'Stock photo of a woman making rotis in a home kitchen.'}]},
] as const;

export default async function Services(){
  const services=await catalog();
  return <SitePage>
    <PageHero tone="courage" title="Work for homes, shops, sites and events." lead="Hire for a day, a contract or a permanent role across Dehradun. Every service is listed in English and Hindi, and the wage is on the job before anyone applies." crumbs={[{label:'Home',href:'/'},{label:'Services'}]} image="/img/electrician.jpg" imageAlt="Stock photo of an electrician working on a distribution board." imageNote="Stock photography for illustration. The people shown are not Labour Youth users.">
      <AppButton label="Post or find work in the app"/><TextLink href="#all-services" tone="courage">See every service</TextLink>
    </PageHero>

    <section className="shell section-y" aria-labelledby="kinds-title">
      <SectionHead tone="warmth" id="kinds-title" title="Three worlds of work, one app." lead="From a single day of help at home to a full team for an event."/>
      <div className="grid-fit mt-12 gap-6 [--min:19rem]">
        {kinds.map(k=><article key={k.h} className={'@container flex flex-col overflow-hidden rounded-[1.75rem] '+tones[k.tone].soft}>
          <div className="grid grid-cols-2 gap-1.5 p-1.5">{k.photos.map(ph=><img key={ph.src} src={ph.src} alt={ph.alt} width={700} height={525} loading="lazy" decoding="async" className="aspect-[4/3] h-full w-full rounded-[1.4rem] object-cover"/>)}</div>
          <div className="flex flex-1 flex-col p-6 @md:p-8"><h3 className={'t-h3 '+tones[k.tone].ink}>{k.h}</h3><p className="mt-3 text-carbon">{k.p}</p></div>
        </article>)}
      </div>
      <p className="mt-5 text-xs text-charcoal">Stock photographs and AI-generated scenes used for illustration. The people shown are not Labour Youth users.</p>
    </section>

    <section id="all-services" className="scroll-mt-24 bg-white section-y" aria-labelledby="all-title">
      <div className="shell">
        <SectionHead tone="courage" id="all-title" title={<>What do you need?<span lang="hi" className="mt-2 block font-sans text-[0.45em] font-semibold text-charcoal">आपको किस काम के लिए मदद चाहिए?</span></>} lead="The live list from our service catalog. The checks show what our team verifies before a worker in that service is listed."/>
        {services.length?<ul className="grid-fill mt-12 gap-4 [--min:15.5rem]">
          {services.map((s,i)=>{const Icon=icons[s.icon]||LayoutGrid;const t=tones[toneCycle[i%toneCycle.length]];return <li key={s.id}><Link href="/app" className="group flex h-full flex-col gap-4 rounded-2xl border bg-paper p-5 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-transparent hover:shadow-lg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust">
            <div className="flex items-start justify-between gap-3"><span className={'grid size-12 place-items-center rounded-xl '+t.soft+' '+t.ink}><Icon className="size-6" aria-hidden="true"/></span><ArrowUpRight className="size-5 text-dimgrey transition-colors group-hover:text-trust-ink" aria-hidden="true"/></div>
            <div><p className="text-lg font-semibold leading-snug text-onyx">{s.name}</p><p lang="hi" className="text-sm text-dimgrey">{s.name_hi}</p></div>
            {!!s.verification_types?.length&&<p className="mt-auto flex items-start gap-1.5 text-sm text-charcoal"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-care-ink" aria-hidden="true"/><span><span className="sr-only">Checks before listing: </span>{s.verification_types.map(v=>checks[v]||v).join(', ')}</span></p>}
          </Link></li>;})}
        </ul>:<p className="mt-10 rounded-2xl border border-dashed bg-paper p-6 text-charcoal">Our service list is temporarily unavailable. Please try again shortly, or open the app to see it.</p>}
      </div>
    </section>

    <section className="shell section-y" aria-labelledby="ways-title">
      <SectionHead tone="trust" id="ways-title" title="One day, one contract, or a job for good." lead="Three kinds of work in one app, with the pay and the schedule clear from the start."/>
      <div className="grid-fit mt-12 gap-5 [--min:18rem]">
        {offerings.map(o=>{const Icon=offeringIcons[o.key];const t=tones[offeringTones[o.key]];return <article key={o.key} className="flex flex-col rounded-[1.75rem] border bg-white p-7">
          <div className="flex items-center justify-between gap-3"><span className={'grid size-14 place-items-center rounded-2xl '+t.fill}><Icon className="size-7" aria-hidden="true"/></span><span lang="hi" className={'text-sm font-semibold '+t.ink}>{o.hindi}</span></div>
          <h3 className="t-h3 mt-6 text-onyx">{o.title}</h3><p className="mt-3 flex-1 text-charcoal">{o.body}</p>
          <p className={'mt-6 rounded-xl px-4 py-3 text-sm text-carbon '+t.soft}><span className={'font-semibold '+t.ink}>For example: </span>{o.example}</p>
        </article>;})}
      </div>
    </section>

    <section className="bg-sun-soft section-y" aria-labelledby="post-title">
      <div className="shell grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:items-start">
        <div className="lg:sticky lg:top-32"><SectionHead tone="sun" id="post-title" title="Every task, explained the same way." lead="A worker sees the same six details on every job, so jobs are easy to compare before saying I am available."/><div className="mt-8"><TextLink href="/for-hirers" tone="courage">How hiring works</TextLink></div></div>
        <ol className="grid-fit gap-4 [--min:15rem]">{postFields.map((f,i)=><li key={f.h} className="rounded-2xl bg-white p-6 shadow-sm"><span className="font-display text-3xl text-courage-ink">{String(i+1).padStart(2,'0')}</span><h3 className="mt-2 font-sans text-lg font-semibold text-onyx">{f.h}</h3><p className="mt-1 text-charcoal">{f.p}</p></li>)}</ol>
      </div>
    </section>

    <div className="pt-[var(--section-y)]"><CtaBand title="Find the right person for the work." body="Open Labour Youth to post work or look for work near you, in Hindi or English."/></div>
  </SitePage>;
}
