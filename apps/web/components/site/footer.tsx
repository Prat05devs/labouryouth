import Link from 'next/link';
import {Separator} from '@/components/ui/separator';
import {Logo} from '@/components/site/nav';

const links=[['About','about'],['Support','support'],['Contact','contact'],['Privacy','privacy'],['Terms','terms'],['Worker policy','worker-policy'],['Delete account','delete-account']] as const;
export function SiteFooter(){
  return <footer className="mx-auto max-w-7xl px-5 pb-12 md:px-8"><Separator className="mb-8"/>
    <div className="flex flex-col justify-between gap-6 md:flex-row md:items-center"><Logo className="h-24"/>
      <nav aria-label="Footer" className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted-foreground">
        {links.map(([t,s])=><Link key={s} className="hover:text-foreground" href={'/information/'+s}>{t}</Link>)}
        {process.env.INSTAGRAM_URL&&<a className="hover:text-foreground" href={process.env.INSTAGRAM_URL}>Instagram</a>}
        <Link className="hover:text-foreground" href="/admin">Operations login</Link></nav></div>
  </footer>;
}
