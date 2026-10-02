import * as SecureStore from 'expo-secure-store';
const origin=process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000/api/v1';
let access:string|null=null;
export function privateImageSource(id:string){return {uri:origin+'/documents/'+id,headers:access?{Authorization:'Bearer '+access}:undefined};}
let refreshing:Promise<boolean>|null=null;
export class ApiError extends Error { constructor(public code:string, public details:Record<string,unknown>={}) { super(code); } }
export async function saveTokens(tokens:{access_token:string;refresh_token:string}) {access=tokens.access_token;await SecureStore.setItemAsync('ly.refresh',tokens.refresh_token);}
export async function clearTokens(){access=null;await SecureStore.deleteItemAsync('ly.refresh');}
export async function restore():Promise<boolean>{
 if(refreshing)return refreshing;
 refreshing=(async()=>{const refresh_token=await SecureStore.getItemAsync('ly.refresh');if(!refresh_token)return false;
 const res=await fetch(origin+'/auth/refresh',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({refresh_token})});
 if(!res.ok){if(res.status===401){await clearTokens();return false;}throw new ApiError('NETWORK_ERROR');}
 await saveTokens(await res.json());return true;})();
 try{return await refreshing;}finally{refreshing=null;}
}
export async function api<T=any>(path:string,method='GET',data?:unknown,key?:string,retry=true):Promise<T>{
 const form=data instanceof FormData;let res:Response;
 try{res=await fetch(origin+path,{method,headers:{...(!form?{'Content-Type':'application/json'}:{}),...(access?{Authorization:'Bearer '+access}:{}),...(key?{'Idempotency-Key':key}:{})},body:data===undefined?undefined:form?data:JSON.stringify(data)});}
 catch{throw new ApiError('NETWORK_ERROR');}
 if(res.status===401&&retry&&access&&await restore())return api(path,method,data,key,false);
 if(!res.ok){const body=await res.json().catch(()=>null);throw new ApiError(body?.error?.code||'NETWORK_ERROR',body?.error?.details);}
 return res.status===204?undefined as T:res.json();
}
export function requestKey(){return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2);}
