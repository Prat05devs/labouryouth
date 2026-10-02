import Link from 'next/link';
import {Apple,Smartphone} from 'lucide-react';
import {Button} from '@/components/ui/button';
import {Card,CardContent,CardDescription,CardHeader,CardTitle} from '@/components/ui/card';
import {Logo} from '@/components/site/nav';
export const dynamic='force-dynamic';
export const metadata={title:'Get the app | Labour Youth'};
export default function Download(){
  const ios=process.env.IOS_APP_URL,android=process.env.ANDROID_APP_URL;
  return <main className="mx-auto grid min-h-screen max-w-md content-center gap-6 px-5 py-12"><Logo className="h-24"/>
    <Card><CardHeader><CardTitle className="font-display text-4xl font-normal uppercase">Take the next step</CardTitle><CardDescription>Use the mobile app to hire staff or find work.</CardDescription></CardHeader>
      <CardContent className="grid gap-3">
        {ios&&<Button asChild size="lg"><a href={ios}><Apple/>Open on iPhone</a></Button>}
        {android&&<Button asChild size="lg"><a href={android}><Smartphone/>Open on Android</a></Button>}
        {!ios&&!android&&<p className="text-sm text-muted-foreground">App distribution is being prepared. Download links will appear here when the build is available.</p>}
      </CardContent></Card>
    <Button asChild variant="ghost"><Link href="/">← Back to Labour Youth</Link></Button></main>;
}
