import Link from 'next/link';
import {ArrowUpRight,BadgeCheck,Briefcase,CalendarRange,CheckCircle2,ClipboardList,Clock3,Camera,Languages,MessageCircle,ShieldCheck,UserCheck,Users} from 'lucide-react';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Hero} from '@/components/site/hero';
import {SiteNav} from '@/components/site/nav';
import {SiteFooter} from '@/components/site/footer';
import {INSTAGRAM_URL,journey,languagePairs,marketStats,offerings,registration,stories} from '@/content/home';

export const dynamic='force-dynamic';
async function catalog(){try{const r=await fetch((process.env.API_ORIGIN||'http://localhost:8000')+'/api/v1/services',{cache:'no-store',signal:AbortSignal.timeout(3000)});return r.ok?(await r.json()).items:[];}catch{return [];}}

const steps=[
  {n:'1',icon:ClipboardList,h:'Post what you need',p:'Pick the work, the day, how many people and the wage. Add a Google Maps link to the place.'},
  {n:'2',icon:UserCheck,h:'Verified workers say they are available',p:'Workers nearby see the job with the wage up front and tap I am available. Only workers our team has verified are listed.'},
  {n:'3',icon:MessageCircle,h:'Choose and talk directly',p:'Pick the worker you want. They get your WhatsApp number and location, and you settle the details together.'},
];
const offeringIcons={daily:Clock3,contract:CalendarRange,permanent:Briefcase} as const;
const faq=[
  ['Can I look around before signing up?','Yes. Open the app to browse open jobs and listed workers without an account. You sign up only when you want to apply or hire.'],
  ['Who sees my phone number?','Only the worker you choose. Your WhatsApp number and map link never appear in public listings or the job feed.'],
  ['How are workers verified?','Our team reviews each worker\'s identity documents before they are listed, and household roles also need police verification.'],
  ['Is it free for workers?','Yes. Workers do not pay to browse jobs, say they are available or get hired.'],
  ['Which languages does the app support?','English and Hindi. You can switch at any time, even before signing up.'],
];

function Eyebrow({children,dark=false}:{children:React.ReactNode;dark?:boolean}){return <p className={'text-sm font-semibold '+(dark?'text-brass':'text-brass-text')}>{children}</p>;}

export default async function Home(){
  const services=await catalog();
  const sources=[...new Map(marketStats.map(s=>[s.url,s])).values()];
  return <div className="min-h-screen">
    <SiteNav/>
    <main>
      <Hero/>

      {/* India's working market, with sources */}
      <section id="market" className="scroll-mt-24 bg-onyx py-20 text-white md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="grid gap-6 lg:grid-cols-[1fr_1.4fr] lg:items-end">
            <div><Eyebrow dark>India works with its hands</Eyebrow><h2 className="mt-3 text-4xl md:text-6xl">The biggest workforce in the country is the hardest to reach.</h2></div>
            <p className="max-w-xl text-white/75 lg:justify-self-end">Crores of people find work by word of mouth, at a labour chowk at dawn, or through a middleman. Demand for their skills is rising. The way they get hired has not changed.</p>
          </div>
          <dl className="mt-14 grid gap-px overflow-hidden rounded-lg bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
            {marketStats.map(s=><div key={s.label} className="flex flex-col justify-between gap-6 bg-onyx p-7 md:p-9">
              <dd className="font-display text-5xl leading-none text-white md:text-6xl">{s.value}</dd>
              <div><dt className="text-base text-white/85">{s.label}</dt><p className="mt-2 text-xs text-white/50"><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{s.source}</a><sup className="ml-0.5">{sources.findIndex(x=>x.url===s.url)+1}</sup></p></div>
            </div>)}
          </dl>
          <p className="mt-6 text-xs text-white/50">Published figures from the sources listed; Labour Youth does not produce these numbers.</p>
        </div>
      </section>

      {/* What we offer */}
      <section id="offer" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:px-8 md:py-28">
        <Eyebrow>What we offer</Eyebrow>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end"><h2 className="max-w-2xl text-4xl md:text-6xl">One day, one contract, or a job for good.</h2><p className="max-w-sm text-muted-foreground">Three kinds of work in one app, with the pay and the schedule clear from the start.</p></div>
        <div className="mt-12 grid gap-5 lg:grid-cols-3">
          {offerings.map(o=>{const Icon=offeringIcons[o.key];return <Card key={o.key} className="rounded-lg shadow-none">
            <CardHeader className="gap-4"><div className="flex items-center justify-between"><span className="grid size-12 place-items-center rounded-md bg-secondary"><Icon className="size-6 text-onyx"/></span><span className="text-sm text-dimgrey">{o.hindi}</span></div><CardTitle className="font-display text-3xl font-normal text-onyx">{o.title}</CardTitle><CardDescription className="text-base text-charcoal">{o.body}</CardDescription></CardHeader>
            <CardContent><p className="rounded-md border-l-2 border-brass bg-background px-4 py-3 text-sm text-carbon">{o.example}</p></CardContent>
          </Card>;})}
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="scroll-mt-24 border-y bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <Eyebrow>How it works</Eyebrow>
            <h2 className="mt-3 text-4xl md:text-6xl">Post today.<br/>Hire today.</h2>
            <p className="mt-4 max-w-md text-muted-foreground">No agents and no waiting for a call back. You see who is available and you decide.</p>
            <img src="/img/family.jpg" alt="A mother and child preparing sweets together at home" width={1400} height={933} loading="lazy" className="mt-8 aspect-[4/3] w-full rounded-lg object-cover"/>
          </div>
          <ol className="grid gap-4">
            {steps.map(({n,icon:Icon,h,p})=><li key={n}><Card className="rounded-lg shadow-none"><CardHeader className="flex-row items-start gap-5"><span className="font-display text-4xl leading-none text-brass-text">{n}</span><div className="space-y-1"><CardTitle className="text-lg font-semibold text-onyx">{h}</CardTitle><CardDescription className="text-base text-charcoal">{p}</CardDescription></div><Icon className="ml-auto size-6 shrink-0 text-gunmetal"/></CardHeader></Card></li>)}
          </ol>
        </div>
      </section>

      {/* Built for both sides */}
      <section id="audience" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:px-8 md:py-28">
        <Eyebrow>Built for both sides</Eyebrow>
        <h2 className="mt-3 max-w-3xl text-4xl md:text-6xl">One app. Two people who need each other.</h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-2">
          <Card className="overflow-hidden rounded-lg py-0 shadow-none">
            <img src="/img/family2.jpg" alt="An Indian family relaxing together at home" width={1000} height={1250} loading="lazy" className="h-64 w-full object-cover"/>
            <CardContent className="space-y-5 p-8"><div className="flex items-center gap-2 text-sm font-semibold text-brass-text"><Users className="size-4"/>For hirers</div><h3 className="text-3xl md:text-4xl">Help for today, without the runaround.</h3>
              <ul className="space-y-3">{['Post in one screen: work, day, people, wage','See interested workers with skills, experience and real reviews','Your number goes only to the worker you choose','Every listed worker has been checked by our team'].map(t=><li key={t} className="flex gap-3 text-carbon"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brass-text"/>{t}</li>)}</ul>
              <Button asChild size="lg"><Link href="/app">Find workers on the app</Link></Button></CardContent>
          </Card>
          <Card className="overflow-hidden rounded-lg border-0 bg-gunmetal py-0 text-white shadow-none">
            <img src="/img/electrician.jpg" alt="A young electrician working on a fuse panel" width={1200} height={800} loading="lazy" className="h-64 w-full object-cover"/>
            <CardContent className="space-y-5 p-8"><div className="flex items-center gap-2 text-sm font-semibold text-brass"><Briefcase className="size-4"/>For job seekers</div><h3 className="text-3xl md:text-4xl">Work near you. Wage shown up front.</h3>
              <ul className="space-y-3">{['Jobs within 2, 5, 10 or 20 km of you','Filter by skill, today only, minimum wage, daily or permanent','Tap I am available, no long forms per job','Free for workers'].map(t=><li key={t} className="flex gap-3 text-white/90"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-brass"/>{t}</li>)}</ul>
              <Button asChild size="lg" className="bg-brass text-onyx hover:bg-brass/90"><Link href="/app">Find work on the app</Link></Button></CardContent>
          </Card>
        </div>
      </section>

      {/* Hindi and English */}
      <section id="language" className="scroll-mt-24 border-y bg-white py-20 md:py-28">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-2 lg:items-center">
          <div><Eyebrow>हिन्दी और English</Eyebrow><h2 className="mt-3 text-4xl md:text-6xl">Read it in the language you think in.</h2>
            <p className="mt-4 max-w-md text-muted-foreground">Every screen works in Hindi and English. Switch with one tap from the first screen, before you even sign up, and change it any time.</p>
            <div className="mt-6 flex items-center gap-3 text-sm text-carbon"><Languages className="size-5 text-brass-text"/>Service names, buttons, errors and help text are all translated.</div></div>
          <div className="overflow-hidden rounded-lg border">
            <div className="grid grid-cols-2 border-b bg-secondary text-sm font-semibold text-carbon"><div className="px-5 py-3">English</div><div className="border-l px-5 py-3">हिन्दी</div></div>
            {languagePairs.map(([en,hi])=><div key={en} className="grid grid-cols-2 border-b last:border-b-0"><div className="px-5 py-4 text-lg text-onyx">{en}</div><div className="border-l px-5 py-4 text-lg text-onyx">{hi}</div></div>)}
          </div>
        </div>
      </section>

      {/* Easy registration */}
      <section id="signup" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:px-8 md:py-28">
        <Eyebrow>Easy to join</Eyebrow>
        <div className="mt-3 flex flex-col justify-between gap-4 md:flex-row md:items-end"><h2 className="max-w-3xl text-4xl md:text-6xl">Sign-up a first-time phone user can finish.</h2><p className="max-w-sm text-muted-foreground">Short forms, plain words, and a clear message under the exact box that needs fixing. No OTP wait in this release.</p></div>
        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {([['Everyone','Four boxes and you are in.',registration.everyone],['Hirers','Then one setup screen.',registration.hirer],['Workers','Then short steps you can pause.',registration.worker]] as const).map(([who,line,items],i)=><Card key={who} className="rounded-lg shadow-none"><CardHeader><span className="font-display text-4xl leading-none text-brass-text">{i+1}</span><CardTitle className="mt-3 text-xl font-semibold text-onyx">{who}</CardTitle><CardDescription className="text-base text-charcoal">{line}</CardDescription></CardHeader><CardContent><ul className="space-y-2">{items.map(t=><li key={t} className="flex gap-2 text-sm text-carbon"><BadgeCheck className="mt-0.5 size-4 shrink-0 text-dimgrey"/>{t}</li>)}</ul></CardContent></Card>)}
        </div>
        <p className="mt-6 text-sm text-muted-foreground">Look around first: jobs and verified workers are visible in the app without an account.</p>
      </section>

      {/* Journey and vision */}
      <section id="story" className="scroll-mt-24 bg-onyx py-20 text-white md:py-28">
        <div className="mx-auto grid max-w-7xl gap-14 px-5 md:px-8 lg:grid-cols-[1.1fr_1fr]">
          <div><Eyebrow dark>Our journey</Eyebrow><h2 className="mt-3 text-4xl md:text-6xl">Working on this since 2023.</h2>
            <ol className="mt-10 space-y-8 border-l border-white/20 pl-7">{journey.map(j=><li key={j.year} className="relative"><span className="absolute -left-[35px] top-1.5 size-3 rounded-full bg-brass"/><p className="font-display text-3xl text-brass">{j.year}</p><h3 className="mt-1 font-sans text-xl font-semibold">{j.title}</h3><p className="mt-2 max-w-lg text-white/75">{j.body}</p></li>)}</ol>
            <Button asChild variant="outline" size="lg" className="mt-10 border-white/50 bg-transparent text-white hover:bg-white hover:text-onyx"><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Camera/>Follow @labour.youth</a></Button>
          </div>
          <div className="self-center rounded-lg bg-carbon p-8 md:p-12"><Eyebrow dark>Our vision</Eyebrow>
            <p className="mt-4 font-display text-3xl leading-tight md:text-4xl">Every worker should know the wage before they walk in. Every family should know who is walking in.</p>
            <p className="mt-6 text-white/75">We are starting in Dehradun, one neighbourhood at a time, so that daily, contract and permanent work is fair, visible and close to home.</p>
          </div>
        </div>
      </section>

      {/* Stories: real and consented only */}
      <section id="stories" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:px-8 md:py-28">
        <Eyebrow>Stories</Eyebrow>
        {stories.length?<><h2 className="mt-3 text-4xl md:text-6xl">From the people who use it.</h2><div className="mt-12 grid gap-5 md:grid-cols-2 lg:grid-cols-3">{stories.map(s=><Card key={s.name} className="rounded-lg shadow-none"><CardContent className="space-y-4 p-7"><p className="text-lg text-onyx">“{s.quote}”</p><p className="text-sm text-dimgrey">{s.name} · {s.role} · {s.place}</p></CardContent></Card>)}</div></>
        :<Card className="mt-6 rounded-lg shadow-none md:grid md:grid-cols-[1.4fr_1fr] md:items-center"><CardHeader className="p-8 md:p-12"><CardTitle className="font-display text-3xl font-normal text-onyx md:text-5xl">The first app stories are being written in Dehradun.</CardTitle><CardDescription className="mt-3 text-base text-charcoal">We only share stories from real hirers and workers, with their permission. Until then, see what we have been doing on Instagram.</CardDescription></CardHeader><CardContent className="p-8 pt-0 md:p-12"><Button asChild size="lg" className="w-full"><a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer"><Camera/>See @labour.youth on Instagram</a></Button></CardContent></Card>}
      </section>

      {/* Services from the database */}
      <section id="services" className="scroll-mt-24 border-y bg-white py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-5 md:px-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end"><div><Eyebrow>Services</Eyebrow><h2 className="mt-3 text-4xl md:text-6xl">What do you need?</h2></div><p className="max-w-sm text-muted-foreground">Homes, shops, sites and hotels across Dehradun.</p></div>
          <div className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {services.map((s:any)=><Link key={s.id} href="/app" className="group"><Card className="h-full rounded-lg py-0 shadow-none transition-colors group-hover:border-onyx"><CardContent className="flex items-center justify-between gap-3 p-5"><span><span className="block font-semibold text-carbon">{s.name}</span><span className="text-sm text-dimgrey">{s.name_hi}</span></span><ArrowUpRight className="size-4 shrink-0 text-dimgrey transition-colors group-hover:text-onyx"/></CardContent></Card></Link>)}
          </div>
          {!services.length&&<p className="mt-6 text-muted-foreground">Our service list is temporarily unavailable. Please try again shortly.</p>}
        </div>
      </section>

      <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-5 py-20 md:px-8">
        <div className="mb-8 flex items-center gap-3"><ShieldCheck className="size-8 text-brass-text"/><h2 className="text-4xl md:text-5xl">Questions</h2></div>
        <Accordion type="single" collapsible className="[&_h3]:font-sans [&_h3]:tracking-normal" defaultValue={faq[0][0]}>{faq.map(([q,a])=><AccordionItem key={q} value={q}><AccordionTrigger className="text-lg font-semibold">{q}</AccordionTrigger><AccordionContent className="text-base text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
        <div className="rounded-lg bg-onyx px-6 py-16 text-center text-white md:py-20">
          <h2 className="text-4xl md:text-6xl">Good work starts here.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/80">Open Labour Youth to hire for today or find work near you. In Hindi or English.</p>
          <Button asChild size="lg" className="mt-8 h-12 bg-brass px-8 text-base text-onyx hover:bg-brass/90"><Link href="/app">Open the app <ArrowUpRight/></Link></Button>
        </div>
      </section>

      <section aria-label="Sources" className="mx-auto max-w-7xl px-5 pb-16 md:px-8">
        <h2 className="font-sans text-sm font-semibold text-carbon">Sources</h2>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-xs text-muted-foreground">{sources.map(s=><li key={s.url}><a href={s.url} target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">{s.source}</a></li>)}</ol>
      </section>
    </main>
    <SiteFooter/>
  </div>;
}
