import Link from 'next/link';
import {ArrowUpRight} from 'lucide-react';
import {Card,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {infoPages} from '@/content/info';
export const metadata={title:'Help & information | Labour Youth'};
export default function Hub(){
  return <div className="shell max-w-5xl section-y">
    <h1 className="t-h1">Help &amp; information</h1>
    <p className="mt-3 max-w-xl text-muted-foreground">How your information is handled, the rules for using Labour Youth, and how to reach us. For questions about using the app, visit the <Link href="/help" className="font-semibold text-trust-ink underline underline-offset-4">Help Centre</Link>.</p>
    <div className="mt-10 grid gap-4 sm:grid-cols-2">{infoPages.map(p=><Link key={p.slug} href={'/information/'+p.slug} className="group"><Card className="h-full transition-all group-hover:-translate-y-0.5 group-hover:border-trust-mid group-hover:shadow-lg rounded-2xl"><CardHeader><CardTitle className="flex items-center justify-between font-display text-2xl font-normal">{p.title}<ArrowUpRight className="size-5 text-primary"/></CardTitle><CardDescription>{p.summary}</CardDescription></CardHeader></Card></Link>)}</div>
  </div>;
}
