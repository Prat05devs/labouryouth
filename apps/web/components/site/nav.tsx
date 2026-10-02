import Link from 'next/link';
import {Menu} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {NavigationMenu,NavigationMenuItem,NavigationMenuLink,NavigationMenuList,navigationMenuTriggerStyle} from '@/components/ui/navigation-menu';
import {Sheet,SheetClose,SheetContent,SheetHeader,SheetTitle,SheetTrigger} from '@/components/ui/sheet';

const links=[['Our services','#services'],['How it works','#how'],['For households & workers','#audience'],['Good to know','#faq']] as const;

export function Logo({className='h-14'}:{className?:string}){
  return <Link href="/" aria-label="Labour Youth home" className="inline-flex items-center"><img src="/logo.png" alt="Labour Youth" className={className+' w-auto'} height={96}/></Link>;
}

export function SiteNav(){
  return <header className="sticky top-0 z-40 border-b bg-background/90 backdrop-blur">
    <div className="mx-auto flex h-[var(--header-h)] max-w-7xl items-center justify-between px-5 md:px-8">
      <Logo className="h-14 sm:h-16 md:h-24"/>
      <NavigationMenu className="hidden lg:flex"><NavigationMenuList>
        {links.map(([t,h])=><NavigationMenuItem key={h}><NavigationMenuLink asChild className={navigationMenuTriggerStyle()}><a href={h}>{t}</a></NavigationMenuLink></NavigationMenuItem>)}
      </NavigationMenuList></NavigationMenu>
      <div className="flex items-center gap-2">
        <Button asChild className="hidden bg-gradient-to-br from-emerald-brand to-sage text-white sm:inline-flex"><Link href="/app">Open the app ↗</Link></Button>
        <Sheet><SheetTrigger asChild><Button variant="outline" size="icon" className="lg:hidden" aria-label="Open menu"><Menu/></Button></SheetTrigger>
          <SheetContent side="right"><SheetHeader><SheetTitle className="font-display text-2xl uppercase">Menu</SheetTitle></SheetHeader>
            <nav className="grid gap-1 px-4">{links.map(([t,h])=><SheetClose asChild key={h}><a href={h} className="rounded-md px-3 py-3 text-base font-semibold hover:bg-muted">{t}</a></SheetClose>)}
              <Button asChild className="mt-4 bg-gradient-to-br from-indigo-brand to-orange-brand text-white"><Link href="/app">Open the app ↗</Link></Button></nav>
          </SheetContent></Sheet>
      </div>
    </div>
  </header>;
}
