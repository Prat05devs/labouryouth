// Live service catalog from the API. Returns an empty list when the API is unreachable so pages can say so honestly.
export type Service={id:string;name:string;name_hi:string;slug:string;icon:string;verification_types?:string[]};
export async function catalog():Promise<Service[]>{
  try{const r=await fetch((process.env.API_ORIGIN||'http://localhost:8000')+'/api/v1/services',{cache:'no-store',signal:AbortSignal.timeout(3000)});return r.ok?(await r.json()).items:[];}catch{return [];}
}
