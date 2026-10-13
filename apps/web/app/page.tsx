import Link from 'next/link';
import '@/components/site/hero.css';
import {ArrowUpRight,Briefcase,CheckCircle2,ClipboardList,MessageCircle,UserCheck,Users} from 'lucide-react';
import {AppShowcase} from '@/components/site/app-showcase';
import {Hero} from '@/components/site/hero';
import {CtaBand,FaqList,SectionHead,SitePage,TextLink,toneCycle,tones} from '@/components/site/blocks';
import {PopularJobs,Stories} from '@/components/site/stories';
import {catalog} from '@/lib/catalog';
import {pickHelp} from '@/content/site';

export const dynamic='force-dynamic';

const steps=[
  {icon:ClipboardList,tone:'courage',h:'Post what you need',p:'Pick the work, the day, how many people and the wage. Add a Google Maps link to the place.'},
  {icon:UserCheck,tone:'care',h:'Verified workers say they are available',p:'Workers nearby see the job with the wage up front. Only workers our team has verified are listed.'},
  {icon:MessageCircle,tone:'trust',h:'Choose and talk directly',p:'Pick the worker you want. They get your WhatsApp number and location, and you settle the details together.'},
] as const;
const faq=pickHelp(['Can I look around before signing up?','Who sees my phone number?','How are workers verified?','Is it free for workers?']);
const SERVICE_PREVIEW=8;

export default async function Home(){
  const services=await catalog();
  return <SitePage>
    <Hero/>
    <AppShowcase/>
    <PopularJobs/>

    <section id="services" className="scroll-mt-24 bg-white section-y" aria-labelledby="services-title">
      <div className="shell">
        <SectionHead tone="courage" id="services-title" title="What do you need?" lead="Homes, shops, sites and hotels across Dehradun." action={<TextLink href="/services" tone="courage">{services.length?`All ${services.length} services`:'All services'}</TextLink>}/>
        {services.length?<div className="@container mt-10"><ul className="grid gap-3 @md:grid-cols-2 @4xl:grid-cols-4">
          {services.slice(0,SERVICE_PREVIEW).map((s,i)=>{const t=tones[toneCycle[i%toneCycle.length]];return <li key={s.id}><Link href="/app" className="group flex h-full items-center justify-between gap-3 rounded-2xl border bg-paper p-5 transition-[border-color,box-shadow] hover:border-transparent hover:shadow-md">
            <span className="flex items-center gap-3"><span className={'size-2.5 shrink-0 rounded-full '+t.fill.split(' ')[0]} aria-hidden="true"/><span><span className="block font-semibold text-onyx">{s.name}</span><span lang="hi" className="text-sm text-dimgrey">{s.name_hi}</span></span></span>
            <ArrowUpRight className="size-4 shrink-0 text-dimgrey transition-colors group-hover:text-trust-ink" aria-hidden="true"/></Link></li>;})}
        </ul></div>:<p className="mt-6 text-charcoal">Our service list is temporarily unavailable. Please try again shortly.</p>}
      </div>
    </section>

    <section id="how" className="shell section-y scroll-mt-24" aria-labelledby="how-title">
      <SectionHead tone="trust" id="how-title" title="Tell us what you need." lead="Share your requirement, review interested workers and choose who to contact. Availability depends on your location and schedule."/>
      <ol className="grid-fit mt-12 gap-5 [--min:17rem]">
        {steps.map(({icon:Icon,tone,h,p},i)=><li key={h} className={'flex flex-col rounded-[1.75rem] p-7 '+tones[tone].soft}>
          <div className="flex items-center justify-between"><span className={'font-display text-5xl '+tones[tone].ink}>{i+1}</span><span className={'grid size-12 place-items-center rounded-2xl '+tones[tone].fill}><Icon className="size-6" aria-hidden="true"/></span></div>
          <h3 className="mt-6 font-sans text-xl font-semibold text-onyx">{h}</h3><p className="mt-2 text-carbon">{p}</p>
        </li>)}
      </ol>
    </section>

    <section id="audience" className="shell scroll-mt-24 pb-[var(--section-y)]" aria-label="For hirers and workers">
      <div className="grid-fit gap-5 [--min:20rem]">
        <article className="@container flex flex-col overflow-hidden rounded-[2rem] bg-trust-soft">
          <img src="/img/work-home.webp" alt="AI-generated scene of an Indian household professional and homeowner planning work" width={1200} height={800} loading="lazy" className="aspect-[16/9] w-full object-cover"/>
          <div className="flex flex-1 flex-col p-[clamp(1.5rem,1rem+2vw,2.5rem)]"><p className="flex items-center gap-2 text-sm font-semibold text-trust-ink"><Users className="size-4" aria-hidden="true"/>For hirers</p><h2 className="t-h3 mt-3">Help for today, without the runaround.</h2>
            <ul className="mt-5 grid flex-1 gap-2.5">{['Post in one screen: work, day, people, wage','Your number goes only to the worker you choose','Every listed worker has been checked by our team'].map(t=><li key={t} className="flex gap-3 text-carbon"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-trust-ink" aria-hidden="true"/>{t}</li>)}</ul>
            <div className="mt-6"><TextLink href="/for-hirers">How hiring works</TextLink></div></div>
        </article>
        <article className="@container flex flex-col overflow-hidden rounded-[2rem] bg-care-soft">
          <img src="/img/work-craft.webp" alt="AI-generated scene of two Indian carpenters measuring a timber frame" width={1200} height={800} loading="lazy" className="aspect-[16/9] w-full object-cover"/>
          <div className="flex flex-1 flex-col p-[clamp(1.5rem,1rem+2vw,2.5rem)]"><p className="flex items-center gap-2 text-sm font-semibold text-care-ink"><Briefcase className="size-4" aria-hidden="true"/>For workers</p><h2 className="t-h3 mt-3">Work near you. Wage shown up front.</h2>
            <ul className="mt-5 grid flex-1 gap-2.5">{['Jobs within 2, 5, 10 or 20 km of you','Tap I am available, no long forms per job','Free for workers'].map(t=><li key={t} className="flex gap-3 text-carbon"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-care-ink" aria-hidden="true"/>{t}</li>)}</ul>
            <div className="mt-6"><TextLink href="/for-workers" tone="care">How finding work works</TextLink></div></div>
        </article>
      </div>
    </section>

    <Stories/>

    <section id="faq" className="shell section-y scroll-mt-24" aria-labelledby="faq-title">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div><SectionHead tone="calm" id="faq-title" title="Quick answers"/><div className="mt-6"><TextLink href="/help" tone="calm">Visit the Help Centre</TextLink></div></div>
        <FaqList items={faq} tone="calm"/>
      </div>
    </section>

    <CtaBand title="Good work starts here." body="Open Labour Youth to hire for today or find work near you. In Hindi or English."/>
  </SitePage>;
}
