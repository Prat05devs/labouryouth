import {NextRequest,NextResponse} from 'next/server';
export function GET(req:NextRequest){const agent=req.headers.get('user-agent')||'';const ios=process.env.IOS_APP_URL;const android=process.env.ANDROID_APP_URL;const target=/iPhone|iPad|iPod/.test(agent)?ios:/Android/.test(agent)?android:null;
 if(target){try{const u=new URL(target);if(u.protocol==='https:'&&['testflight.apple.com','apps.apple.com','play.google.com'].includes(u.hostname))return NextResponse.redirect(u);}catch{}}
 return NextResponse.redirect(new URL('/download',req.url));}
