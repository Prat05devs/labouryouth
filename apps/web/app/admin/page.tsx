import {readSession,identity} from '../../src/session';import Login from './Login';import Console from './Console';import {redirect} from 'next/navigation';
export const dynamic='force-dynamic';
export default async function Admin(){const s=await readSession();if(s&&s.expires_at<Date.now()+10000)redirect('/api/session/refresh');const user=s?await identity(s):null;if(!user||!user.roles.some((r:string)=>['SUPER_ADMIN','OPERATIONS','VERIFICATION','FINANCE','SUPPORT'].includes(r)))return <Login/>;return <Console user={{full_name:user.full_name,roles:user.roles}}/>;}
