import Link from 'next/link';
import {ArrowUpRight,ChevronRight} from 'lucide-react';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {SiteMotion} from '@/components/site/motion';
import {SiteNav} from '@/components/site/nav';
import {SiteFooter} from '@/components/site/footer';
import type {HelpItem,Tone} from '@/content/site';

// Literal class names per tone so Tailwind can see every one of them.
export const tones:Record<Tone,{soft:string;ink:string;fill:string;mid:string;ring:string;open:string;blob:string}>={
  trust:{soft:'bg-trust-soft',ink:'text-trust-ink',fill:'bg-trust text-white',mid:'bg-trust-mid',ring:'border-trust-mid',open:'data-[state=open]:border-trust-mid data-[state=open]:shadow-sm',blob:'var(--trust-mid)'},
  care:{soft:'bg-care-soft',ink:'text-care-ink',fill:'bg-care text-white',mid:'bg-care-mid',ring:'border-care-mid',open:'data-[state=open]:border-care-mid data-[state=open]:shadow-sm',blob:'var(--care-mid)'},
  courage:{soft:'bg-courage-soft',ink:'text-courage-ink',fill:'bg-courage text-onyx',mid:'bg-courage-mid',ring:'border-courage-mid',open:'data-[state=open]:border-courage-mid data-[state=open]:shadow-sm',blob:'var(--courage-mid)'},
  warmth:{soft:'bg-warmth-soft',ink:'text-warmth-ink',fill:'bg-warmth text-white',mid:'bg-warmth-mid',ring:'border-warmth-mid',open:'data-[state=open]:border-warmth-mid data-[state=open]:shadow-sm',blob:'var(--warmth-mid)'},
  sun:{soft:'bg-sun-soft',ink:'text-sun-ink',fill:'bg-sun text-onyx',mid:'bg-sun',ring:'border-sun',open:'data-[state=open]:border-sun data-[state=open]:shadow-sm',blob:'var(--sun)'},
  calm:{soft:'bg-calm-soft',ink:'text-calm-ink',fill:'bg-calm text-white',mid:'bg-calm-mid',ring:'border-calm-mid',open:'data-[state=open]:border-calm-mid data-[state=open]:shadow-sm',blob:'var(--calm-mid)'},
};
export const toneCycle:Tone[]=['trust','care','courage','warmth','calm','sun'];

export function SitePage({children}:{children:React.ReactNode}){
  return <SiteMotion><div className="flex min-h-dvh flex-col"><SiteNav/><main id="main" className="flex-1">{children}</main><SiteFooter/></div></SiteMotion>;
}

export function SectionHead({title,lead,id,action}:{tone?:Tone;title:React.ReactNode;lead?:React.ReactNode;id?:string;action?:React.ReactNode}){
  return <div className="flex flex-wrap items-end justify-between gap-x-10 gap-y-5">
    <div className="max-w-3xl"><h2 id={id} className="t-h2">{title}</h2>{lead&&<p className="t-lead mt-4 max-w-2xl text-charcoal">{lead}</p>}</div>
    {action}
  </div>;
}

export function TextLink({href,children,tone='trust'}:{href:string;children:React.ReactNode;tone?:Tone}){
  return <Link href={href} className={'group inline-flex min-h-11 items-center gap-1.5 font-semibold underline-offset-4 hover:underline '+tones[tone].ink}>{children}<ChevronRight className="size-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true"/></Link>;
}

export function AppButton({label='Open the app',dark=false}:{label?:string;dark?:boolean}){
  return <Link href="/app" className={'inline-flex min-h-12 items-center gap-3 rounded-full px-6 text-base font-semibold shadow-sm transition-[background-color,transform] hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-4 '+(dark?'bg-sun text-onyx hover:bg-courage focus-visible:outline-white':'bg-trust text-white hover:bg-trust-ink focus-visible:outline-trust')}>{label}<ArrowUpRight className="size-5" aria-hidden="true"/></Link>;
}

type Crumb={label:string;href?:string};
export function PageHero({tone,title,lead,image,imageAlt,imageNote,crumbs,children}:{tone:Tone;title:React.ReactNode;lead:React.ReactNode;image?:string;imageAlt?:string;imageNote?:string;crumbs?:Crumb[];children?:React.ReactNode}){
  const t=tones[tone];
  return <section className={'relative isolate overflow-hidden '+t.soft} aria-labelledby="page-title">
    {/* Soft colour fields; decorative only. */}
    <div aria-hidden="true" className="pointer-events-none absolute -right-[10%] -top-[30%] -z-10 aspect-square w-[min(70vw,46rem)] rounded-full opacity-70 blur-3xl" style={{background:t.blob}}/>
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-[40%] -left-[15%] -z-10 aspect-square w-[min(60vw,34rem)] rounded-full bg-white/70 blur-3xl"/>
    <div className="shell @container py-[clamp(2.5rem,1.5rem+4vw,6rem)]">
      {crumbs&&<nav aria-label="Breadcrumb" className="mb-6"><ol className="flex flex-wrap items-center gap-1 text-sm text-charcoal">{crumbs.map((c,i)=><li key={c.label} className="flex items-center gap-1">{i>0&&<ChevronRight className="size-3.5" aria-hidden="true"/>}{c.href?<Link href={c.href} className="hover:underline">{c.label}</Link>:<span aria-current="page" className="font-semibold text-onyx">{c.label}</span>}</li>)}</ol></nav>}
      <div className={'grid items-center gap-10 '+(image?'@4xl:grid-cols-[1.05fr_1fr] @4xl:gap-14':'')}>
        <div className="min-w-0">
          <h1 id="page-title" className="t-h1 max-w-[16ch] text-onyx">{title}</h1>
          <p className="t-lead mt-5 max-w-xl text-carbon">{lead}</p>
          {children&&<div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">{children}</div>}
        </div>
        {image&&<figure className="relative min-w-0">
          <div aria-hidden="true" className={'absolute inset-0 translate-x-3 translate-y-3 rounded-[1.75rem] '+t.mid}/>
          <img src={image} alt={imageAlt||''} width={1400} height={933} fetchPriority="high" className="relative aspect-[16/10] w-full rounded-[1.75rem] object-cover shadow-xl @4xl:aspect-[4/3]"/>
          {imageNote&&<figcaption className="relative mt-6 text-xs text-charcoal">{imageNote}</figcaption>}
        </figure>}
      </div>
    </div>
  </section>;
}

export function FaqList({items,tone='trust',defaultOpen=true}:{items:HelpItem[];tone?:Tone;defaultOpen?:boolean}){
  return <Accordion type="single" collapsible defaultValue={defaultOpen?items[0]?.q:undefined} className="grid gap-3 [&_h3]:font-sans [&_h3]:tracking-normal">
    {items.map(i=><AccordionItem key={i.q} value={i.q} className={'rounded-2xl border bg-white px-5 last:border-b '+tones[tone].open}>
      <AccordionTrigger className="min-h-14 py-4 text-left text-[1.05rem] font-semibold text-onyx hover:no-underline">{i.q}</AccordionTrigger>
      <AccordionContent className="pb-5 text-base leading-relaxed text-charcoal">{i.a}</AccordionContent>
    </AccordionItem>)}
  </Accordion>;
}

export function CtaBand({title,body}:{title:string;body:string}){
  return <section className="shell pb-[var(--section-y)]">
    <div className="relative isolate overflow-hidden rounded-[2rem] bg-trust-deep px-[clamp(1.5rem,1rem+3vw,4rem)] py-[clamp(3rem,2rem+4vw,5.5rem)] text-white">
      <div aria-hidden="true" className="absolute -right-24 -top-24 -z-10 size-80 rounded-full bg-trust opacity-60 blur-3xl"/>
      <div aria-hidden="true" className="absolute -bottom-28 left-1/3 -z-10 size-72 rounded-full bg-warmth opacity-40 blur-3xl"/>
      <div className="flex flex-wrap items-end justify-between gap-8">
        <div className="max-w-2xl"><h2 className="t-h2">{title}</h2><p className="t-lead mt-4 text-white/85">{body}</p></div>
        <AppButton dark/>
      </div>
    </div>
  </section>;
}
