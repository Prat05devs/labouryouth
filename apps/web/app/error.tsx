'use client';
import Link from 'next/link';
import {Button} from '@/components/ui/button';
export default function ErrorPage({reset}:{error:Error;reset:()=>void}){return <main className="mx-auto max-w-3xl px-5 py-24 text-center"><h1 className="text-4xl md:text-5xl">Something went wrong</h1><p className="mt-3 text-muted-foreground">Please try again. If it keeps happening, contact support.</p><div className="mt-8 flex justify-center gap-3"><Button onClick={reset}>Try again</Button><Button asChild variant="outline"><Link href="/information/support">Support</Link></Button></div></main>;}
