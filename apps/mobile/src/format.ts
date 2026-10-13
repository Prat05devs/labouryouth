// Display helpers. Amounts are integer paise (README); dates are UTC from the API and shown in local time.
export function rupees(paise:number|null|undefined){return paise==null?'':'₹'+Math.round(paise/100).toLocaleString('en-IN');}
const tag=(locale:string)=>locale==='hi'?'hi-IN':'en-IN';
export function shortDate(iso:string,locale:string){return new Date(iso).toLocaleDateString(tag(locale),{day:'numeric',month:'short'});}
export function dateTime(iso:string,locale:string){return new Date(iso).toLocaleString(tag(locale),{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'});}
export function timeOnly(iso:string,locale:string){return new Date(iso).toLocaleTimeString(tag(locale),{hour:'numeric',minute:'2-digit'});}
export function km(meters:number){return (meters<1000?'<1':String(Math.round(meters/100)/10))+' km';}
export function firstName(full?:string|null){return (full||'').trim().split(/\s+/)[0]||'';}
// Relative time for update feeds; falls back to a date after a week.
export function ago(iso:string,locale:string,t:(k:string)=>string){
 const mins=Math.round((Date.now()-new Date(iso).getTime())/60000);
 if(mins<1)return t('justNow');if(mins<60)return mins+' '+t('minAgo');
 const hours=Math.round(mins/60);if(hours<24)return hours+' '+t('hrAgo');
 const days=Math.round(hours/24);if(days<7)return days+' '+t('dayAgo');
 return shortDate(iso,locale);
}
