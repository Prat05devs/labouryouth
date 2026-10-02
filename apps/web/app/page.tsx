import Link from 'next/link';
import {ArrowUpRight,CalendarCheck,CheckCircle2,ClipboardList,ShieldCheck,UserCheck,Bell} from 'lucide-react';
import {Accordion,AccordionContent,AccordionItem,AccordionTrigger} from '@/components/ui/accordion';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Carousel,CarouselContent,CarouselItem,CarouselNext,CarouselPrevious} from '@/components/ui/carousel';
import {Separator} from '@/components/ui/separator';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Hero} from '@/components/site/hero';
import {SiteNav} from '@/components/site/nav';
import {SiteFooter} from '@/components/site/footer';

export const dynamic='force-dynamic';
async function catalog(){try{const r=await fetch((process.env.API_ORIGIN||'http://localhost:8000')+'/api/v1/services',{cache:'no-store',signal:AbortSignal.timeout(3000)});return r.ok?(await r.json()).items:[];}catch{return [];}}

const steps=[
  {n:'01',icon:ClipboardList,h:'Share your requirement',p:'Choose a service, tell us the schedule and add your location.'},
  {n:'02',icon:UserCheck,h:'Meet your assigned worker',p:'Our operations team matches your need with an eligible, verified worker.'},
  {n:'03',icon:Bell,h:'Stay in the loop',p:'See arrival and shift updates, request support, and review completed work.'},
];
const faq=[
  ['Verification before work','Profiles and required documents are reviewed before workers can begin assignments.'],
  ['Your schedule, clearly defined','Hourly, daily, multiple-day and monthly requirements share one clear work record.'],
  ['A team for the exceptions','If something changes, request a replacement or report an issue through the app.'],
];
const places=[
  {src:'/img/hills.jpg',alt:'A road winding through the Uttarakhand hills',cap:'Uttarakhand hills'},
  {src:'/img/home.jpg',alt:'A woman tidying a carved wooden chair at home',cap:'Household help'},
  {src:'/img/pipes.jpg',alt:'A tradesman preparing pipes outdoors in Rajkot, India',cap:'Skilled trades'},
  {src:'/img/care.jpg',alt:'A caregiver sitting with a senior at the bedside',cap:'Care at home'},
  {src:'/img/cook.jpg',alt:'A woman cooking paratha in a home kitchen',cap:'Home cooking'},
  {src:'/img/valley.jpg',alt:'A green mountain valley in Uttarakhand',cap:'Mountain valley'},
];

export default async function Home(){
  const services=await catalog();
  return <div className="min-h-screen">
    <SiteNav/>
    <main>
      <Hero/>

      <section id="services" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:px-8">
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
          <div><Badge variant="outline" className="rounded-sm border-primary uppercase tracking-widest text-primary">Help for real life</Badge><h2 className="mt-4 text-4xl md:text-6xl">What can we help with?</h2></div>
          <p className="max-w-sm text-muted-foreground">One place for the people who make your home, care and everyday work run better.</p>
        </div>
        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {services.map((s:any)=><Link key={s.id} href="/app" className="group">
            <Card className="h-full rounded-md py-0 transition-all group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-lg"><CardContent className="flex items-center justify-between p-6"><span className="text-lg font-semibold">{s.name}</span><span className="grid size-9 place-items-center rounded-sm bg-secondary text-primary transition-colors group-hover:bg-primary group-hover:text-primary-foreground"><ArrowUpRight className="size-4"/></span></CardContent></Card>
          </Link>)}
        </div>
        {!services.length&&<p className="mt-6 text-muted-foreground">Our service catalogue is temporarily unavailable. Please try again shortly.</p>}
      </section>

      <section id="how" className="scroll-mt-24 bg-secondary/60 py-20">
        <div className="mx-auto grid max-w-7xl gap-12 px-5 md:px-8 lg:grid-cols-[1fr_1.2fr] lg:items-center">
          <div>
            <Badge variant="outline" className="rounded-sm border-primary uppercase tracking-widest text-primary">Simple from the start</Badge>
            <h2 className="mt-4 text-4xl md:text-6xl">Tell us. We coordinate.<br/>You get on with your day.</h2>
            <img src="/img/family.jpg" alt="A mother and child preparing sweets together at home" width={1400} height={933} loading="lazy" className="mt-8 aspect-[4/3] w-full rounded-md object-cover"/>
          </div>
          <div className="grid gap-4">
            {steps.map(({n,icon:Icon,h,p})=><Card key={n} className="rounded-md"><CardHeader className="flex-row items-start gap-4"><span className="font-display text-4xl leading-none text-orange-brand">{n}</span><div className="space-y-1"><CardTitle className="font-display text-2xl font-normal uppercase tracking-wide">{h}</CardTitle><CardDescription className="text-base">{p}</CardDescription></div><Icon className="ml-auto size-6 shrink-0 text-primary"/></CardHeader></Card>)}
          </div>
        </div>
      </section>

      <section id="audience" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20 md:px-8">
        <Tabs defaultValue="households" className="gap-8">
          <div className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
            <h2 className="text-4xl md:text-6xl">One app, both<br/>sides of work.</h2>
            <TabsList className="h-12 rounded-md"><TabsTrigger value="households" className="px-5 text-sm font-semibold">For households</TabsTrigger><TabsTrigger value="workers" className="px-5 text-sm font-semibold">For workers</TabsTrigger></TabsList>
          </div>
          <TabsContent value="households"><Card className="overflow-hidden rounded-md py-0 md:grid md:grid-cols-2"><img src="/img/family2.jpg" alt="An Indian family relaxing together at home" width={1000} height={1250} loading="lazy" className="h-72 w-full object-cover md:h-[26rem]"/><CardContent className="space-y-5 p-8 md:p-12"><h3 className="text-3xl md:text-4xl">Real work deserves real care.</h3><p className="text-muted-foreground">Getting help should feel clear and considered. We keep people, verification and practical support at the centre.</p><ul className="space-y-3">{['Verified workers, reviewed before they start','One clear record for every schedule','Replacement or support when plans change'].map(t=><li key={t} className="flex gap-3"><CheckCircle2 className="mt-0.5 size-5 shrink-0 text-sage"/>{t}</li>)}</ul><Button asChild className="bg-gradient-to-br from-emerald-brand to-sage text-white"><Link href="/app">Find help on the app ↗</Link></Button></CardContent></Card></TabsContent>
          <TabsContent value="workers"><Card className="overflow-hidden rounded-md border-0 bg-gradient-to-br from-steel to-wine py-0 text-white md:grid md:grid-cols-2"><CardContent className="space-y-5 p-8 md:p-12"><Badge className="rounded-sm bg-white/15 uppercase tracking-widest text-white hover:bg-white/15">For the people who do the work</Badge><h3 className="text-3xl md:text-5xl">Your skills.<br/>Your next opportunity.</h3><p className="text-white/85">Build your profile at your own pace. Once verified, choose your availability and receive work offers near you. Review an offer before accepting, follow simple arrival and shift actions, and see your earnings in one place.</p><p className="text-sm text-white/75">English and Hindi · Saved onboarding progress</p><Button asChild className="bg-white text-wine hover:bg-white/90"><Link href="/app">Find work on the app ↗</Link></Button></CardContent><img src="/img/electrician.jpg" alt="A young electrician working on a fuse panel" width={1200} height={800} loading="lazy" className="h-72 w-full object-cover md:h-[26rem]"/></Card></TabsContent>
        </Tabs>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 md:px-8" aria-label="Dehradun and Uttarakhand">
        <div className="mb-6 flex items-end justify-between gap-4"><div><Badge variant="outline" className="rounded-sm border-primary uppercase tracking-widest text-primary">Starting where we live</Badge><h2 className="mt-4 text-4xl md:text-6xl">Local help, from the hills to the home.</h2></div></div>
        <Carousel opts={{loop:true}} className="mx-12 md:mx-0">
          <CarouselContent>{places.map(p=><CarouselItem key={p.src} className="md:basis-1/2 lg:basis-1/3"><figure className="relative overflow-hidden rounded-md"><img src={p.src} alt={p.alt} width={1200} height={800} loading="lazy" className="aspect-[4/3] w-full object-cover"/><figcaption className="absolute bottom-3 left-3 rounded-sm bg-white/95 px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary">{p.cap}</figcaption></figure></CarouselItem>)}</CarouselContent>
          <CarouselPrevious className="md:-left-5"/><CarouselNext className="md:-right-5"/>
        </Carousel>
      </section>

      <section id="faq" className="mx-auto max-w-4xl scroll-mt-24 px-5 pb-20 md:px-8">
        <div className="mb-8 flex items-center gap-3"><ShieldCheck className="size-8 text-primary"/><h2 className="text-4xl md:text-5xl">Good to know</h2></div>
        <Accordion type="single" collapsible className="[&_h3]:font-sans [&_h3]:normal-case [&_h3]:tracking-normal" defaultValue="Verification before work">{faq.map(([q,a])=><AccordionItem key={q} value={q}><AccordionTrigger className="text-lg font-semibold">{q}</AccordionTrigger><AccordionContent className="text-base text-muted-foreground">{a}</AccordionContent></AccordionItem>)}</Accordion>
      </section>

      <section className="mx-auto max-w-7xl px-5 pb-20 md:px-8">
        <div className="rounded-md bg-gradient-to-br from-steel to-wine px-6 py-16 text-center text-white md:py-20">
          <CalendarCheck className="mx-auto size-10 text-orange-brand"/>
          <h2 className="mt-4 text-4xl md:text-6xl">Good help starts here.</h2>
          <p className="mx-auto mt-3 max-w-md text-white/85">Open Labour Youth to hire staff or find local work.</p>
          <Button asChild size="lg" className="mt-8 h-12 bg-gradient-to-br from-indigo-brand to-orange-brand px-8 text-base text-white"><Link href="/app">Download / Open app ↗</Link></Button>
        </div>
      </section>
    </main>
    <SiteFooter/>
  </div>;
}
