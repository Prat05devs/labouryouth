import Link from 'next/link';
import {Button} from '@/components/ui/button';
import {SiteNav} from '@/components/site/nav';
import {SiteFooter} from '@/components/site/footer';
export default function NotFound(){return <div className="min-h-screen"><SiteNav/><main className="mx-auto max-w-3xl px-5 py-24 text-center"><p className="font-display text-8xl text-orange-brand">404</p><h1 className="mt-2 text-4xl md:text-5xl">We can’t find that page</h1><p className="mt-3 text-muted-foreground">It may have moved, or the link may be mistyped.</p><div className="mt-8 flex justify-center gap-3"><Button asChild><Link href="/">Back to home</Link></Button><Button asChild variant="outline"><Link href="/information/support">Get support</Link></Button></div></main><SiteFooter/></div>;}
