import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Badge} from '@/components/ui/badge';
import {Button} from '@/components/ui/button';

export function Hero(){
  return <section className="relative isolate flex min-h-[calc(100svh-var(--header-h))] flex-col overflow-hidden bg-emerald-brand text-white">
    <img src="/img/hero-city.jpg" alt="" aria-hidden="true" width={1200} height={800} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-bottom"/>
    <div className="absolute inset-0 -z-10 bg-gradient-to-r from-emerald-brand via-emerald-brand/85 to-emerald-brand/30 max-md:from-emerald-brand/95 max-md:via-emerald-brand/90 max-md:to-emerald-brand/70"/>
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-between gap-6 px-5 py-6 md:px-8 md:py-8 short:py-4">
      <div className="my-auto">
        <Badge className="rounded-sm bg-orange-brand px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-[#1d1b2e] hover:bg-orange-brand sm:text-xs">Now starting in Dehradun</Badge>
        <h1 className="mt-4 max-w-4xl text-[clamp(2.25rem,min(9.5vw,9vh),6.5rem)] leading-[1.02]">Help you can trust,<br className="max-sm:hidden"/> from people you<br className="max-sm:hidden"/> can <span className="text-orange-brand">meet.</span></h1>
        <p className="mt-4 max-w-xl text-base short:mt-3 short:text-base leading-relaxed text-white/90 md:text-lg">Labour Youth connects Dehradun households with verified local workers. Our team coordinates the schedule, the arrival and the follow-up, so you don’t have to.</p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button asChild size="lg" className="h-12 bg-gradient-to-br from-indigo-brand to-orange-brand px-7 text-base text-white"><Link href="/app">Find help on the app <ArrowUpRight/></Link></Button>
          <Button asChild size="lg" variant="outline" className="h-12 border-white/70 bg-transparent px-7 text-base text-white hover:bg-white hover:text-emerald-brand"><a href="#audience">Looking for work?</a></Button>
        </div>
      </div>
    </div>
  </section>;
}
