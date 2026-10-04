import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Card,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {infoPages} from '@/content/info';
export const metadata={title:'Help & information | Labour Youth'};
export default function Hub(){
  return <main className="mx-auto max-w-5xl px-5 py-16 md:px-8">
    <h1 className="text-5xl md:text-7xl">Help &amp; information</h1>
    <p className="mt-3 max-w-xl text-muted-foreground">Everything about how Labour Youth works, how your information is handled, and how to reach us.</p>
    <div className="mt-10 grid gap-4 sm:grid-cols-2">{infoPages.map(p=><Link key={p.slug} href={'/information/'+p.slug} className="group"><Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-primary group-hover:shadow-lg"><CardHeader><CardTitle className="flex items-center justify-between font-display text-2xl font-normal">{p.title}<ArrowUpRight className="size-5 text-primary"/></CardTitle><CardDescription>{p.summary}</CardDescription></CardHeader></Card></Link>)}</div>
  </main>;
}
