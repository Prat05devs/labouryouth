import Link from 'next/link';
import type {Metadata} from 'next';
import {ChevronRight,FileText,Smartphone,UserX} from 'lucide-react';
import {SitePage} from '@/components/site/blocks';
import {ContactCard} from '@/components/site/contact-card';
import {HelpCentre} from '@/components/site/help-centre';
import {helpTopics} from '@/content/site';

export const metadata:Metadata={title:'Help Centre | Labour Youth',description:'Answers about browsing, hiring, finding work, verification, contact privacy and your Labour Youth account.'};

const more=[
  {href:'/information/delete-account',icon:UserX,h:'Delete your account',p:'How to ask us to delete your account and data.'},
  {href:'/information/privacy',icon:FileText,h:'Privacy',p:'What information the app handles, and why.'},
  {href:'/information/worker-policy',icon:FileText,h:'Worker policy',p:'Verification, offers and conduct.'},
  {href:'/information/terms',icon:FileText,h:'Terms of use',p:'The rules for using Labour Youth.'},
];

export default function Help(){
  return <SitePage>
    <section className="relative isolate overflow-hidden bg-calm-soft" aria-labelledby="page-title">
      <div aria-hidden="true" className="pointer-events-none absolute -left-[10%] -top-[40%] -z-10 aspect-square w-[min(70vw,40rem)] rounded-full bg-calm-mid opacity-70 blur-3xl"/>
      <div aria-hidden="true" className="pointer-events-none absolute -right-[10%] -bottom-[50%] -z-10 aspect-square w-[min(60vw,34rem)] rounded-full bg-trust-mid opacity-60 blur-3xl"/>
      <div className="shell py-[clamp(2.5rem,1.5rem+4vw,5.5rem)] text-center">
        <nav aria-label="Breadcrumb" className="mb-6 flex justify-center"><ol className="flex items-center gap-1 text-sm text-charcoal"><li><Link href="/" className="hover:underline">Home</Link></li><li className="flex items-center gap-1"><ChevronRight className="size-3.5" aria-hidden="true"/><span aria-current="page" className="font-semibold text-onyx">Help</span></li></ol></nav>
        <h1 id="page-title" className="t-h1 mx-auto max-w-3xl">How can we help?</h1>
        <p className="t-lead mx-auto mt-4 max-w-xl text-carbon">Answers grouped by what you are trying to do. Search, or pick a topic.</p>
      </div>
    </section>

    <section className="shell section-y" aria-label="Questions and answers">
      <HelpCentre topics={helpTopics}/>
    </section>

    <section className="bg-white section-y" aria-labelledby="still-title">
      <div className="shell">
        <h2 id="still-title" className="t-h2">Still need help?</h2>
        <div className="grid-fit mt-10 gap-4 [--min:18rem]">
          <ContactCard/>
          <div className="rounded-[1.5rem] border bg-white p-6">
            <div className="flex items-center gap-3"><span className="grid size-11 place-items-center rounded-xl bg-care-soft text-care-ink"><Smartphone className="size-5" aria-hidden="true"/></span><h3 className="font-sans text-lg font-semibold text-onyx">In the app</h3></div>
            <p className="mt-3 text-charcoal">Signed-in users can follow up on a job, ask for a replacement or report an incident from inside the app.</p>
          </div>
        </div>
        <ul className="grid-fit mt-10 gap-3 [--min:15rem]">{more.map(({href,icon:Icon,h,p})=><li key={href}><Link href={href} className="group flex h-full items-start gap-3 rounded-2xl bg-paper p-5 transition-colors hover:bg-calm-soft"><Icon className="mt-0.5 size-5 shrink-0 text-calm-ink" aria-hidden="true"/><span><span className="block font-semibold text-onyx group-hover:underline">{h}</span><span className="block text-sm text-charcoal">{p}</span></span></Link></li>)}</ul>
      </div>
    </section>
  </SitePage>;
}
