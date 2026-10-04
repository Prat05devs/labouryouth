import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Button} from '@/components/ui/button';

export function Hero(){
  return <section className="relative isolate flex min-h-[calc(100svh-var(--header-h))] flex-col overflow-hidden bg-onyx text-white">
    <img src="/img/hero-city.jpg" alt="" aria-hidden="true" width={1200} height={800} fetchPriority="high" className="absolute inset-0 -z-20 h-full w-full object-cover object-bottom"/>
    <div className="absolute inset-0 -z-10 bg-onyx/75"/>
    <div className="mx-auto flex w-full max-w-7xl flex-1 flex-col justify-center px-5 py-10 md:px-8">
      <p className="text-sm font-semibold text-brass">Dehradun, Uttarakhand</p>
      <h1 className="mt-4 max-w-4xl text-[clamp(2.75rem,min(9vw,9vh),6.5rem)]">Good work.<br/>Close to home.</h1>
      <p className="mt-5 max-w-xl text-base leading-relaxed text-white/85 md:text-lg">Post the work you need done today, see verified local workers who are available, and talk to the one you choose directly on WhatsApp.</p>
      <div className="mt-8 flex flex-col gap-3 sm:flex-row">
        <Button asChild size="lg" className="h-12 bg-brass px-7 text-base text-onyx hover:bg-brass/90"><Link href="/app">I want to hire <ArrowUpRight/></Link></Button>
        <Button asChild size="lg" variant="outline" className="h-12 border-white/60 bg-transparent px-7 text-base text-white hover:bg-white hover:text-onyx"><Link href="/app">I want work</Link></Button>
      </div>
      <p className="mt-4 text-sm text-white/70">Browse jobs and workers in the app before you sign up. In Hindi or English.</p>
    </div>
  </section>;
}
