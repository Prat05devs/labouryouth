import type {Metadata} from 'next';
import {Camera,HandHeart,MapPinned,Scale} from 'lucide-react';
import {CtaBand,PageHero,SectionHead,SitePage,tones} from '@/components/site/blocks';
import {Stories} from '@/components/site/stories';
import {INSTAGRAM_URL,journey,marketStats} from '@/content/home';

export const metadata:Metadata={title:'Our story | Labour Youth',description:'Labour Youth began on Instagram in September 2023, helping Dehradun families find household staff. The app makes local work fair, visible and close to home.'};

const values=[
  {icon:Scale,tone:'trust',h:'Pay you can see',p:'Every worker should know the wage before they walk in.'},
  {icon:HandHeart,tone:'care',h:'People you can trust',p:'Every family should know who is walking in. Our team checks each worker by hand.'},
  {icon:MapPinned,tone:'courage',h:'Work close to home',p:'We start in Dehradun, one neighbourhood at a time, so daily, contract and permanent work stays near.'},
] as const;

export default function OurStory(){
  const sources=[...new Map(marketStats.map(s=>[s.url,s])).values()];
  const instagram=process.env.INSTAGRAM_URL||INSTAGRAM_URL;
  return <SitePage>
    <PageHero tone="warmth" title="Started on Instagram. Built for Dehradun." lead="Since September 2023 we have been helping families in Dehradun find household help and nanny services. The Labour Youth app makes that easier for everyone." crumbs={[{label:'Home',href:'/'},{label:'Our story'}]} image="/img/valley.jpg" imageAlt="Stock photo of a green Uttarakhand valley with hills and a blue sky." imageNote="Stock photograph of the Uttarakhand hills, for illustration.">
      <a href={instagram} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-warmth px-6 font-semibold text-white transition-colors hover:bg-warmth-ink"><Camera className="size-5" aria-hidden="true"/>Follow @labour.youth</a>
    </PageHero>

    <section className="shell section-y" aria-labelledby="journey-title">
      <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
        <SectionHead tone="warmth" id="journey-title" title="Working on this since 2023."/>
        <ol className="relative grid gap-6 before:absolute before:bottom-4 before:left-[1.4rem] before:top-4 before:w-0.5 before:bg-gradient-to-b before:from-warmth before:via-courage before:to-trust">
          {journey.map((j,i)=>{const t=tones[(['warmth','courage','trust'] as const)[i%3]];return <li key={j.year} className="relative grid grid-cols-[3rem_1fr] gap-5">
            <span className={'relative z-10 grid size-12 place-items-center rounded-full font-display text-sm '+t.fill}>{j.year.slice(2)}</span>
            <div className="rounded-[1.5rem] border bg-white p-6"><p className={'font-display text-3xl '+t.ink}>{j.year}</p><h3 className="mt-1 font-sans text-xl font-semibold text-onyx">{j.title}</h3><p className="mt-2 text-charcoal">{j.body}</p></div>
          </li>;})}
        </ol>
      </div>
    </section>

    <section className="bg-white section-y" aria-labelledby="vision-title">
      <div className="shell">
        <div className="relative isolate overflow-hidden rounded-[2rem] bg-sun-soft px-[clamp(1.5rem,1rem+3vw,4.5rem)] py-[clamp(2.5rem,2rem+3vw,5rem)]">
          <div aria-hidden="true" className="absolute -right-20 -top-20 -z-10 size-72 rounded-full bg-sun opacity-50 blur-3xl"/>
          <p id="vision-title" className="t-h2 max-w-4xl font-display text-onyx">Every worker should know the wage before they walk in. Every family should know who is walking in.</p>
        </div>
        <ul className="grid-fit mt-6 gap-4 [--min:16rem]">{values.map(({icon:Icon,tone,h,p})=><li key={h} className={'rounded-[1.5rem] p-6 '+tones[tone].soft}><Icon className={'size-7 '+tones[tone].ink} aria-hidden="true"/><h3 className="mt-4 font-sans text-lg font-semibold text-onyx">{h}</h3><p className="mt-1 text-carbon">{p}</p></li>)}</ul>
      </div>
    </section>

    <section className="bg-trust-deep section-y text-white" aria-labelledby="market-title">
      <div className="shell">
        <div className="grid gap-6 lg:grid-cols-[1fr_1.2fr] lg:items-end">
          <div><h2 id="market-title" className="t-h2">The biggest workforce in the country is the hardest to reach.</h2></div>
          <p className="t-lead text-white/80 lg:justify-self-end">Crores of people find work by word of mouth, at a labour chowk at dawn, or through a middleman. Demand for their skills is rising. The way they get hired has not changed.</p>
        </div>
        <dl className="grid-fit mt-12 gap-px overflow-hidden rounded-[1.5rem] bg-white/10 [--min:17rem]">
          {marketStats.map((s,i)=><div key={s.label} className="flex flex-col justify-between gap-6 bg-trust-deep p-7">
            <dd className={'font-display text-[clamp(2.5rem,2rem+2vw,3.75rem)] leading-none '+['text-sun','text-care-mid','text-warmth-mid','text-trust-mid','text-courage-mid','text-calm-mid'][i%6]}>{s.value}</dd>
            <div><dt className="text-white/90">{s.label}</dt><p className="mt-2 text-xs text-white/60"><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{s.source}</a><sup className="ml-0.5">{sources.findIndex(x=>x.url===s.url)+1}</sup></p></div>
          </div>)}
        </dl>
        <p className="mt-6 text-xs text-white/60">Published figures from the sources below; Labour Youth does not produce these numbers.</p>
        <ol className="mt-4 list-decimal space-y-1 pl-5 text-xs text-white/60">{sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{s.source}</a></li>)}</ol>
      </div>
    </section>

    <Stories/>

    <div className="pt-[var(--section-y)]"><CtaBand title="Be part of the next chapter." body="Open Labour Youth to hire for today or find work near you, in Hindi or English."/></div>
  </SitePage>;
}
