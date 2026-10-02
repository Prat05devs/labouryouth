import {NextResponse} from 'next/server';
import {apiOrigin,readSession,writeSession,clearSession} from '../../../../src/session';

export async function GET(req:Request){
  const session=await readSession();
  if(!session)return NextResponse.redirect(new URL('/admin',req.url));
  const response=await fetch(apiOrigin()+'/api/v1/auth/refresh',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({refresh_token:session.refresh_token}),cache:'no-store'
  });
  if(!response.ok){await clearSession();return NextResponse.redirect(new URL('/admin',req.url));}
  const tokens=await response.json();
  await writeSession({access_token:tokens.access_token,refresh_token:tokens.refresh_token,expires_at:Date.now()+tokens.expires_in*1000});
  return NextResponse.redirect(new URL('/admin',req.url));
}
