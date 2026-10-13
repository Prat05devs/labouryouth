'use client';

import Link from 'next/link';
import {usePathname} from 'next/navigation';
import {ArrowUpRight,BookOpen,Briefcase,CircleHelp,LayoutGrid,Menu,UserRoundSearch} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';
import {navLinks} from '@/content/site';
import {Logo} from '@/components/site/logo';

const menuMeta:Record<string,{icon:typeof Menu;tone:string;note:string}>={
  '/services':{icon:LayoutGrid,tone:'bg-courage-soft text-courage-ink',note:'Every kind of work we list'},
  '/for-workers':{icon:Briefcase,tone:'bg-care-soft text-care-ink',note:'Find nearby work, wage shown first'},
  '/for-hirers':{icon:UserRoundSearch,tone:'bg-trust-soft text-trust-ink',note:'Post once, choose who you hire'},
  '/our-story':{icon:BookOpen,tone:'bg-warmth-soft text-warmth-ink',note:'From Instagram in 2023 to the app'},
  '/help':{icon:CircleHelp,tone:'bg-calm-soft text-calm-ink',note:'Answers, grouped by topic'},
};

export function SiteNav(){
  const path=usePathname();
  const current=(href:string)=>path===href||path.startsWith(href+'/');
  return <header className="sticky top-0 z-40 border-b border-black/5 bg-paper/85 backdrop-blur-md supports-[backdrop-filter]:bg-paper/75">
    <div className="shell flex h-[var(--header-h)] items-center justify-between gap-4">
      <Logo className="h-11 lg:h-14"/>
      {/* Inline links appear only once all five fit beside the logo and action without crowding. */}
      <nav aria-label="Main" className="hidden min-[1080px]:block">
        <ul className="flex items-center gap-1">
          {navLinks.map(l=><li key={l.href}><Link href={l.href} aria-current={current(l.href)?'page':undefined} className="relative inline-flex min-h-11 items-center rounded-full px-4 text-[0.95rem] font-semibold text-carbon transition-colors hover:bg-trust-soft hover:text-trust-ink aria-[current=page]:bg-trust-soft aria-[current=page]:text-trust-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-trust">{l.label}</Link></li>)}
        </ul>
      </nav>
      <div className="flex items-center gap-2">
        <Button asChild className="hidden h-11 rounded-full px-5 text-[0.95rem] font-semibold min-[440px]:inline-flex"><Link href="/app">Open the app <ArrowUpRight/></Link></Button>
        <Sheet>
          <SheetTrigger asChild><Button variant="outline" size="icon" className="size-11 rounded-full min-[1080px]:hidden" aria-label="Open menu"><Menu className="size-5"/></Button></SheetTrigger>
          <SheetContent side="right" className="w-[min(100vw,24rem)] gap-0 overflow-y-auto p-0">
            <SheetHeader className="border-b p-5"><SheetTitle className="font-display text-2xl font-normal">Menu</SheetTitle><SheetDescription>Labour Youth, Dehradun</SheetDescription></SheetHeader>
            <nav aria-label="Main" className="grid gap-1 p-3">
              <SheetClose asChild><Link href="/" aria-current={path==='/'?'page':undefined} className="rounded-xl px-3 py-3 text-base font-semibold aria-[current=page]:bg-trust-soft">Home</Link></SheetClose>
              {navLinks.map(l=>{const m=menuMeta[l.href];const Icon=m.icon;return <SheetClose asChild key={l.href}><Link href={l.href} aria-current={current(l.href)?'page':undefined} className="flex items-center gap-3 rounded-xl px-3 py-3 hover:bg-raised aria-[current=page]:bg-trust-soft">
                <span className={'grid size-10 shrink-0 place-items-center rounded-xl '+m.tone}><Icon className="size-5" aria-hidden="true"/></span>
                <span className="min-w-0"><span className="block text-base font-semibold text-onyx">{l.label}</span><span className="block text-sm text-dimgrey">{m.note}</span></span>
              </Link></SheetClose>;})}
            </nav>
            <div className="mt-auto border-t p-5"><Button asChild size="lg" className="h-12 w-full rounded-full text-base"><Link href="/app">Open the app <ArrowUpRight/></Link></Button></div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
  </header>;
}
