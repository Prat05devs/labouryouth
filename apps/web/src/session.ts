import {cookies} from 'next/headers';import {EncryptJWT,jwtDecrypt} from 'jose';import {createHash} from 'node:crypto';
export type Session={access_token:string;refresh_token:string;expires_at:number};
const name='ly_ops';
function key(){const secret=process.env.WEB_SESSION_SECRET;if(!secret||secret.length<48||secret.includes('REPLACE'))throw new Error('Configure WEB_SESSION_SECRET');return createHash('sha256').update(secret).digest();}
export async function readSession():Promise<Session|null>{const cookie=(await cookies()).get(name)?.value;if(!cookie)return null;try{return (await jwtDecrypt(cookie,key(),{issuer:'labour-youth-web',audience:'operations'})).payload as unknown as Session;}catch{return null;}}
export async function writeSession(data:Session){const token=await new EncryptJWT({...data}).setProtectedHeader({alg:'dir',enc:'A256GCM'}).setIssuedAt().setIssuer('labour-youth-web').setAudience('operations').setExpirationTime('30d').encrypt(key());(await cookies()).set(name,token,{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:2592000});}
export async function clearSession(){(await cookies()).delete(name);}
export const apiOrigin=()=>process.env.API_ORIGIN||'http://localhost:8000';
export async function identity(session:Session){const r=await fetch(apiOrigin()+'/api/v1/me',{headers:{Authorization:'Bearer '+session.access_token},cache:'no-store'});if(!r.ok)return null;return r.json();}
export function checkOrigin(req:Request){const origin=req.headers.get('origin');return origin===new URL(req.url).origin;}
