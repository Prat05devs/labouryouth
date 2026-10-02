import {useCallback,useEffect,useState} from 'react';import {useFocusEffect,useLocalSearchParams} from 'expo-router';import {View} from 'react-native';import {Screen,Card,Copy,Button,ErrorBox,Empty,Field,Chip,Badge} from '../../src/ui';import {useSession} from '../../src/session';import {api} from '../../src/api';import {useResource,errorCode} from '../../src/hooks';import {position} from '../../src/LocationForm';
const radii=[2,5,10,20];
export default function Jobs(){const {t,locale,user}=useSession();const {mode}=useLocalSearchParams<{mode?:string}>();const services=useResource('/services');const [radius,setRadius]=useState(10),[service,setService]=useState(''),[wage,setWage]=useState(''),[today,setToday]=useState(mode!=='permanent'),[permanent,setPermanent]=useState(mode==='permanent'),[items,setItems]=useState<any[]|null>(null),[error,setError]=useState('');
 const active=user?.worker_profile?.worker_status==='ACTIVE';
 useEffect(()=>{setPermanent(mode==='permanent');setToday(mode!=='permanent');},[mode]);
 const load=useCallback(async()=>{setError('');try{const q=new URLSearchParams({radius_km:String(radius)});if(service)q.set('service_id',service);if(today&&!permanent)q.set('today','true');q.set('engagement',permanent?'PERMANENT':'DAILY');if(wage&&Number(wage)>0)q.set('min_wage_paise',String(Math.round(Number(wage)*100)));try{const p=await position();q.set('latitude',String(p.coords.latitude));q.set('longitude',String(p.coords.longitude));}catch{}setItems((await api('/worker/jobs/nearby?'+q.toString())).items);}catch(e){setError(errorCode(e));setItems([]);}},[radius,service,wage,today,permanent]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 async function toggle(j:any){setError('');try{await api('/jobs/'+j.id+(j.my_interest==='EXPRESSED'?'/interest/withdraw':'/interest'),'POST',{});await load();}catch(e){setError(errorCode(e));}finally{}}
 const km=(m:number)=>(m<1000?'<1':String(Math.round(m/100)/10))+' km';
 return <Screen title={t(permanent?'permanentJobs':'todayWork')} subtitle={t('nearbyJobs')}>
  {!active&&<Card><Copy>{t('underReviewCopy')}</Copy></Card>}
  <Copy strong>{t('distance')}</Copy><View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}>{radii.map(r=><Chip key={r} label={r+' km'} selected={r===radius} onPress={()=>setRadius(r)}/>)}</View>
  <View style={{flexDirection:'row',flexWrap:'wrap',gap:8}}><Chip label={t('allSkills')} selected={!service} onPress={()=>setService('')}/>{services.data?.items.map((s:any)=><Chip key={s.id} label={locale==='hi'?s.name_hi:s.name} selected={service===s.id} onPress={()=>setService(s.id)}/>)}</View>
  <Field label={t('minWage')} keyboardType="number-pad" value={wage} onChangeText={setWage}/>
  <ErrorBox code={error}/>
  {items&&items.length===0&&!error&&<Empty text={t('noNearbyJobs')}/>}
  {items?.map(j=><Card key={j.id}><Copy strong>{locale==='hi'?j.service_name_hi:j.service_name}</Copy><Copy>{'Rs '+Math.round(j.budget_max/100)+' '+t('perDay')+' · '+km(j.distance_m)+' '+t('away')}</Copy><Copy>{(j.locality?j.locality+' · ':'')+new Date(j.start_at).toLocaleString()}</Copy><Copy>{j.slots_left+' '+t('slotsLeft')+' · '+t('employer')+': '+j.employer_first_name+' · '+(j.employer_trust.average!==null?j.employer_trust.average+'/5 ('+j.employer_trust.reviews+' '+t('reviewsWord')+')':t('noReviewsYet'))}</Copy>{j.notes?<Copy>{j.notes}</Copy>:null}
   {j.my_interest==='SELECTED'?<Badge status="interestSelected"/>:<Button label={t(j.my_interest==='EXPRESSED'?'withdrawInterest':'iAmAvailable')} secondary={j.my_interest==='EXPRESSED'} disabled={!active} onPress={()=>toggle(j)}/>}{j.my_interest==='EXPRESSED'&&<Copy>{t('interestSent')}</Copy>}</Card>)}
  {active&&<Copy>{t('jobsNeedOnline')}</Copy>}
 </Screen>;}
