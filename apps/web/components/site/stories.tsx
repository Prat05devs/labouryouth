import Link from 'next/link';
import {ArrowUpRight,Camera,Car,Droplets,Quote} from 'lucide-react';
import {SectionHead,tones} from '@/components/site/blocks';
import {INSTAGRAM_URL,exampleJobs,popularJobs,stories} from '@/content/home';

const tileIcons:Record<string,typeof Car>={plumber:Droplets,driver:Car};

export function PopularJobs({id='popular'}:{id?:string}){
  return <section id={id} className="shell section-y scroll-mt-24" aria-labelledby={id+'-title'}>
    <SectionHead tone="warmth" id={id+'-title'} title="The work families and shops ask us for most." lead="House help, baby care, trades and drivers. Post any of them for a day, a trip or the long term."/>
    {/* Narrow: a swipe row with the next card peeking. Wider: 2 or 3 even columns. */}
    <div className="@container mt-12"><ul aria-label="Most requested work" className="-mx-[var(--gutter)] flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-4 overflow-x-auto px-[var(--gutter)] pb-3 [scrollbar-width:none] @xl:mx-0 @xl:grid @xl:grid-cols-2 @xl:overflow-visible @xl:px-0 @xl:pb-0 @4xl:grid-cols-3">
      {popularJobs.map(j=>{const t=tones[j.tone];const Icon=tileIcons[j.key];return <li key={j.key} className="w-[82%] shrink-0 snap-start @xl:w-auto">
        <Link href="/app" className={'group relative isolate flex h-full min-h-[clamp(16rem,12rem+8vw,22rem)] flex-col justify-end overflow-hidden rounded-[1.75rem] p-6 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-trust '+(j.photo?'text-white':t.soft)}>
          {j.photo?<><img src={j.photo.src} alt={j.photo.alt} width={700} height={525} loading="lazy" decoding="async" className="absolute inset-0 -z-20 size-full object-cover transition-transform duration-500 group-hover:scale-105"/><div aria-hidden="true" className="absolute inset-0 -z-10 bg-gradient-to-t from-black/80 via-black/35 to-transparent"/></>
            :<span className={'mb-auto grid size-16 place-items-center rounded-2xl '+t.fill}>{Icon&&<Icon className="size-8" aria-hidden="true"/>}</span>}
          <p lang="hi" className={'text-sm font-semibold '+(j.photo?'text-white/85':t.ink)}>{j.hindi}</p>
          <h3 className={'mt-1 font-sans text-2xl font-bold leading-tight '+(j.photo?'':'text-onyx')}>{j.title}</h3>
          <p className={'mt-2 '+(j.photo?'text-white/90':'text-carbon')}>{j.line}</p>
          <ArrowUpRight className={'absolute right-5 top-5 size-6 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 '+(j.photo?'':t.ink)} aria-hidden="true"/>
        </Link>
      </li>;})}
    </ul></div>
    <p className="mt-5 text-xs text-charcoal">Photos are stock photography or AI-generated scenes for illustration. The people shown are not Labour Youth users.</p>
  </section>;
}

export function Stories(){
  return <section id="stories" className="bg-warmth-soft section-y scroll-mt-24" aria-labelledby="stories-title">
    <div className="shell">
      {stories.length?<>
        <SectionHead tone="warmth" id="stories-title" title="From the people who use it."/>
        <ul className="grid-fit mt-12 gap-5 [--min:19rem]">{stories.map(s=><li key={s.name+s.quote} className="flex flex-col rounded-[1.75rem] bg-white p-7 shadow-sm">
          <Quote className="size-8 text-warmth" aria-hidden="true"/>
          <blockquote className="mt-4 flex-1 text-lg leading-relaxed text-onyx">{s.quote}</blockquote>
          <p className="mt-6 font-semibold text-onyx">{s.name}</p><p className="text-sm text-charcoal">{s.role}{s.work?' · '+s.work:''} · {s.place}</p>
        </li>)}</ul>
      </>:<>
        <SectionHead tone="warmth" id="stories-title" title="Real stories are on their way." lead="Our team is collecting stories from families and workers they have already connected, with their permission. Until then, here is the kind of work people post."/>
        <div className="@container mt-12"><ul aria-label="Example jobs" className="-mx-[var(--gutter)] flex snap-x snap-mandatory scroll-px-[var(--gutter)] gap-4 overflow-x-auto px-[var(--gutter)] pb-3 [scrollbar-width:none] @2xl:mx-0 @2xl:grid @2xl:grid-cols-3 @2xl:overflow-visible @2xl:px-0 @2xl:pb-0">{exampleJobs.map(e=>{const t=tones[e.tone];return <li key={e.title} className="flex w-[82%] shrink-0 snap-start flex-col @2xl:w-auto rounded-[1.75rem] bg-white p-7 shadow-sm">
          <p className={'text-sm font-semibold '+t.ink}>Example job</p>
          <h3 className="mt-2 font-sans text-xl font-semibold text-onyx">{e.title}</h3><p className="mt-2 flex-1 text-charcoal">{e.body}</p>
        </li>;})}</ul></div>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3"><a href={process.env.INSTAGRAM_URL||INSTAGRAM_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-12 items-center gap-2 rounded-full bg-warmth px-6 font-semibold text-white transition-colors hover:bg-warmth-ink"><Camera className="size-5" aria-hidden="true"/>See our work on Instagram</a><p className="text-sm text-charcoal">Examples, not reviews. No names or quotes are invented.</p></div>
      </>}
    </div>
  </section>;
}
