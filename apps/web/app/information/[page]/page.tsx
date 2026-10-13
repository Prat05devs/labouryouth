import Link from 'next/link';
import {notFound} from 'next/navigation';
import type {Metadata} from 'next';
import {CircleAlert,Smartphone} from 'lucide-react';
import {ContactCard} from '@/components/site/contact-card';
import {Alert,AlertDescription,AlertTitle} from '@/components/ui/alert';
import {Breadcrumb,BreadcrumbItem,BreadcrumbLink,BreadcrumbList,BreadcrumbPage,BreadcrumbSeparator} from '@/components/ui/breadcrumb';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {bySlug,infoPages} from '@/content/info';

export function generateStaticParams(){return infoPages.map(p=>({page:p.slug}));}
export async function generateMetadata({params}:{params:Promise<{page:string}>}):Promise<Metadata>{const p=bySlug((await params).page);return {title:p?`${p.title} | Labour Youth`:'Labour Youth',description:p?.summary};}

export default async function Info({params}:{params:Promise<{page:string}>}){
  const {page}=await params;const p=bySlug(page);if(!p)notFound();
  const reviewed=(process.env.REVIEWED_PAGES||'').split(',').map(s=>s.trim()).includes(p.slug);
  return <div className="shell max-w-6xl py-[clamp(2.5rem,2rem+3vw,4.5rem)]">
    <Breadcrumb><BreadcrumbList><BreadcrumbItem><BreadcrumbLink asChild><Link href="/">Home</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbLink asChild><Link href="/information">Help &amp; information</Link></BreadcrumbLink></BreadcrumbItem><BreadcrumbSeparator/><BreadcrumbItem><BreadcrumbPage>{p.title}</BreadcrumbPage></BreadcrumbItem></BreadcrumbList></Breadcrumb>
    <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
      <aside className="hidden lg:block"><nav aria-label="Information pages" className="sticky top-32 grid gap-1">{infoPages.map(x=><Link key={x.slug} href={'/information/'+x.slug} aria-current={x.slug===p.slug?'page':undefined} className={'flex min-h-11 items-center rounded-lg px-3 text-sm font-semibold '+(x.slug===p.slug?'bg-trust-soft text-trust-ink':'text-muted-foreground hover:bg-muted')}>{x.title}</Link>)}</nav></aside>
      <article className="max-w-3xl">
        <h1 className="t-h1">{p.title}</h1>
        <p className="mt-3 text-lg text-muted-foreground">{p.summary}</p>
        {p.legal&&!reviewed&&<Alert className="mt-8 border-courage-mid bg-courage-soft"><CircleAlert className="text-brass-text"/><AlertTitle>Draft, pending owner review</AlertTitle><AlertDescription>This page describes how the app works today. It is not yet the final legal text and is not a public-launch policy.</AlertDescription></Alert>}
        <div className="mt-10 space-y-10">
          {p.sections.map(s=><section key={s.h}><h2 className="text-3xl">{s.h}</h2>{s.p?.map(t=><p key={t} className="mt-3 leading-relaxed text-foreground/85">{t}</p>)}{s.list&&<ul className="mt-3 list-disc space-y-2 pl-5 marker:text-primary">{s.list.map(t=><li key={t} className="leading-relaxed text-foreground/85">{t}</li>)}</ul>}</section>)}
          {p.slug==='contact'&&<><ContactCard/><Card><CardHeader><CardTitle className="flex items-center gap-2 font-display text-2xl font-normal"><Smartphone className="size-5 text-primary"/>In the app</CardTitle><CardDescription>Signed-in users can follow up on a request, replacement or incident from inside the app.</CardDescription></CardHeader></Card></>}
          {p.slug==='delete-account'&&<Button asChild variant="outline"><Link href="/help">Get help</Link></Button>}
        </div>
        {p.pending&&!reviewed&&<Card className="mt-12 border-dashed"><CardHeader><CardTitle className="font-display text-xl font-normal">To be confirmed by Labour Youth</CardTitle><CardDescription>These items need an owner decision before this page can be finalised.</CardDescription></CardHeader><CardContent><ul className="list-disc space-y-1.5 pl-5 text-sm text-muted-foreground">{p.pending.map(t=><li key={t}>{t}</li>)}</ul></CardContent></Card>}
      </article>
    </div>
  </div>;
}
