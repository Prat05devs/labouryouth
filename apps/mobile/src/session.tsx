import React,{createContext,useContext,useState,useEffect,useCallback} from 'react';
import {api,restore,clearTokens,ApiError} from './api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import en from './locales/en.json';import hi from './locales/hi.json';
export type User={id:string;full_name:string;roles:string[];preferences:{last_active_mode?:string;locale?:string};client_profile:any;worker_profile:any};
const Context=createContext<any>(null);
export function SessionProvider({children}:{children:React.ReactNode}){
 const [user,setUser]=useState<User|null>(null);const [loading,setLoading]=useState(true);const [error,setError]=useState('');const [locale,setLocale]=useState<'en'|'hi'>('en');
 const reload=useCallback(async()=>{const u=await api<User>('/me');setUser(u);if(u.preferences.locale==='hi')setLocale('hi');return u;},[]);
 const bootstrap=useCallback(async()=>{setLoading(true);setError('');try{if(await restore())await reload();else setUser(null);}catch{setError('NETWORK_ERROR');}finally{setLoading(false);}},[reload]);
 useEffect(()=>{bootstrap();},[bootstrap]);
 // Drafts are per user and must not outlive the session on a shared phone.
 const logout=async()=>{try{await api('/auth/logout','POST');}finally{await clearTokens();try{const keys=(await AsyncStorage.getAllKeys()).filter(k=>k.startsWith('ly.draft.'));if(keys.length)await AsyncStorage.multiRemove(keys);}catch{}setUser(null);}};
 const t=(key:string)=>((locale==='hi'?hi:en) as Record<string,string>)[key]||(en as Record<string,string>)[key]||key.replaceAll('_',' ');
 return <Context.Provider value={{user,setUser,reload,loading,error,bootstrap,locale,setLocale,t,logout}}>{children}</Context.Provider>;
}
export const useSession=()=>useContext(Context) as {user:User|null;setUser:(u:User|null)=>void;reload:()=>Promise<User>;loading:boolean;error:string;bootstrap:()=>Promise<void>;locale:'en'|'hi';setLocale:(s:'en'|'hi')=>void;t:(key:string)=>string;logout:()=>Promise<void>};
export function homeFor(u:User):string{
 if(!u.roles.some(r=>r==='CLIENT'||r==='WORKER'))return '/shared/purpose';
 const mode=u.roles.includes(u.preferences.last_active_mode||'')?u.preferences.last_active_mode:u.roles.includes('CLIENT')?'CLIENT':'WORKER';
 if(mode==='WORKER')return ['SUBMITTED','COMPLETE'].includes(u.worker_profile?.onboarding_status)?'/(worker)':'/shared/worker-setup';
 return u.client_profile?.onboarding_complete?'/(client)':'/shared/client-setup';
}
