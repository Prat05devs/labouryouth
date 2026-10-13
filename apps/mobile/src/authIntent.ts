import AsyncStorage from '@react-native-async-storage/async-storage';
import {api} from './api';
import type {User} from './session';

const KEY='ly.pending.action';
export type MarketplaceRole='CLIENT'|'WORKER';
type Intent={path:string;role:MarketplaceRole};

export async function saveIntent(path:string,role:MarketplaceRole){
 await AsyncStorage.setItem(KEY,JSON.stringify({path,role} satisfies Intent));
}
export async function readIntent():Promise<Intent|null>{
 try{const raw=await AsyncStorage.getItem(KEY);return raw?JSON.parse(raw) as Intent:null;}catch{return null;}
}
export async function clearIntent(){await AsyncStorage.removeItem(KEY);}

export async function routeAfterAuth(user:User,reload:()=>Promise<User>,locale:'en'|'hi'){
 const intent=await readIntent();if(!intent)return null;
 let current=user;
 if(!current.roles.includes(intent.role)){
  await api('/me/roles','POST',{role:intent.role});
  await api('/me/preferences','PUT',{last_active_mode:intent.role,locale});
  current=await reload();
 }
 if(intent.role==='CLIENT'&&!current.client_profile?.onboarding_complete)return '/shared/client-setup';
 if(intent.role==='WORKER'&&!['SUBMITTED','COMPLETE'].includes(current.worker_profile?.onboarding_status||''))return '/shared/worker-setup';
 await clearIntent();return intent.path;
}

export async function routeAfterSetup(fallback:string){
 const intent=await readIntent();
 if(!intent)return fallback;
 await clearIntent();return intent.path;
}
