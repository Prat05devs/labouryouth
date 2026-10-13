import {useState,useEffect} from 'react';
import {Text,View} from 'react-native';
import {router,useLocalSearchParams,Redirect} from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {Button,ErrorBox,Field,ListGroup,ListRow,OptionRow,Screen,StepProgress,Stepper,TextLink,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {api} from '../../src/api';
import {useResource,errorCode} from '../../src/hooks';
import {PickerField} from '../../src/PickerField';
import {dateTime,timeOnly} from '../../src/format';

const titles=['stepWhat','stepDetails','stepWhen','stepWhere','stepBudget','reviewRequest'];
const engagements=[['HOURLY','time-outline'],['DAILY','sunny-outline'],['FIXED_TERM','calendar-outline'],['MONTHLY','repeat-outline']] as const;
export default function NewRequest(){
 const {service_id}=useLocalSearchParams<{service_id:string}>();const {t,user,locale}=useSession();const hi=locale==='hi';
 const services=useResource('/services'),locations=useResource('/locations'),addresses=useResource('/addresses');
 const [step,setStep]=useState(0),[loaded,setLoaded]=useState(false),[error,setError]=useState(''),[jobId,setJobId]=useState('');
 const [f,set]=useState({service_id:service_id||'',engagement_type:'HOURLY',headcount:'1',date:new Date(Date.now()+86400000).toISOString().slice(0,10),startTime:'09:00',hours:'4',days:'2',address_id:'',service_area_id:'',budget:'',notes:'',requirements:{} as Record<string,string>});
 const key='ly.draft.'+user?.id;
 useEffect(()=>{AsyncStorage.getItem(key).then(s=>{if(s){const v=JSON.parse(s);set({...v,service_id:service_id||v.service_id});}setLoaded(true);}).catch(()=>setLoaded(true));},[key]);
 useEffect(()=>{if(loaded)AsyncStorage.setItem(key,JSON.stringify(f)).catch(()=>{});},[f,loaded,key]);
 if(!user?.roles.includes('CLIENT'))return <Redirect href="/"/>;
 const update=(k:keyof typeof f,v:string)=>set({...f,[k]:v});
 const svc=(services.data?.items||[]).find((item:any)=>item.id===f.service_id) as any;const props=svc?.requirement_schema?.properties||{};
 function schedule(){const start=new Date(f.date+'T'+f.startTime+':00');const count=['FIXED_TERM','MONTHLY'].includes(f.engagement_type)?Number(f.days):1;if(!Number.isInteger(count)||count<1||count>62||!Number.isFinite(start.getTime())||Number(f.hours)<=0||Number(f.hours)>24)throw new Error('VALIDATION_ERROR');return Array.from({length:count},(_,i)=>{const d=new Date(start);d.setDate(d.getDate()+i);return {start_at:d.toISOString(),end_at:new Date(d.getTime()+Number(f.hours)*3600000).toISOString()};});}
 const next=()=>{setError('');try{if(step===0&&(!f.service_id||!Number.isInteger(Number(f.headcount))||Number(f.headcount)<1))throw new Error();if(step===2)schedule();if(step===3&&(!f.address_id||!f.service_area_id))throw new Error();setStep(step+1);}catch{setError('VALIDATION_ERROR');}};
 async function submit(){try{let id=jobId;if(!id){const j=await api('/jobs','POST',{service_id:f.service_id,service_area_id:f.service_area_id,address_id:f.address_id,engagement_type:f.engagement_type,headcount:Number(f.headcount),schedule:schedule(),budget_max:f.budget?Math.round(Number(f.budget)*100):null,currency:'INR',notes:f.notes,requirements:Object.fromEntries(Object.entries(f.requirements).filter(([,value])=>value!=='').map(([name,value])=>[name,props?.[name]?.type==='integer'?Number(value):value])),recurring_metadata:{timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}});id=j.id;setJobId(id);}await api('/jobs/'+id+'/submit','POST');await AsyncStorage.removeItem(key);router.replace({pathname:'/shared/job/[id]',params:{id}});}catch(e){setError(errorCode(e));}}
 let plan:{start_at:string;end_at:string}[]=[];if(step===5){try{plan=schedule();}catch{}}
 const footer=<View style={{flexDirection:'row',gap:space.sm}}>{step>0?<Button flex variant="secondary" icon="chevron-back" label={t('back')} onPress={()=>{setError('');setStep(step-1);}}/>:null}<View style={{flex:2}}><Button label={t(step===5?'submitRequest':'continue')} onPress={step===5?submit:next}/></View></View>;
 return <Screen footer={footer}>
  <StepProgress step={step+1} total={titles.length}/>
  <Text accessibilityRole="header" style={type.largeTitle}>{t(titles[step])}</Text>
  {step===0?<>
   <Text style={type.overline}>{t('service')}</Text>
   <View style={{gap:space.sm}}>{services.data?.items.map((s:any)=><OptionRow key={s.id} icon={s.icon||'construct-outline'} label={hi?s.name_hi:s.name} selected={f.service_id===s.id} onPress={()=>update('service_id',s.id)}/>)}</View>
   <Text style={[type.overline,{marginTop:space.sm}]}>{t('engagement')}</Text>
   <View style={{gap:space.sm}}>{engagements.map(([e,icon])=><OptionRow key={e} icon={icon} label={t(e)} selected={f.engagement_type===e} onPress={()=>set({...f,engagement_type:e,days:e==='MONTHLY'?'30':e==='FIXED_TERM'?'2':'1',hours:e==='HOURLY'?'4':'8'})}/>)}</View>
   <Stepper label={t('headcount')} value={Number(f.headcount)||1} min={1} max={50} onChange={v=>update('headcount',String(v))}/>
  </>:null}
  {step===1?<>{Object.keys(props).length===0?<Text style={type.callout}>{t('noExtraDetails')}</Text>:null}
   {Object.entries(props).map(([name,schema])=>{const rule=schema as any;return <View key={name} style={{gap:space.sm}}><Text style={type.overline}>{t(name)}</Text>
    {rule.enum?<View style={{gap:space.sm}}>{rule.enum.map((choice:string)=><OptionRow key={choice} label={t(choice)} selected={f.requirements[name]===choice} onPress={()=>set({...f,requirements:{...f.requirements,[name]:choice}})}/>)}</View>:
     <Field label={t(name)} value={f.requirements[name]||''} keyboardType={rule.type==='integer'?'number-pad':'default'} onChangeText={v=>set({...f,requirements:{...f.requirements,[name]:v}})}/>}
   </View>;})}</>:null}
  {step===2?<>
   <Text style={type.callout}>{t('scheduleHelp')}</Text>
   <PickerField label={t('dateShort')} mode="date" value={f.date} minimumDate={new Date()} onChange={v=>update('date',v)}/>
   <PickerField label={t('startTimeShort')} mode="time" value={f.startTime} onChange={v=>update('startTime',v)}/>
   <Stepper label={t('hours')} value={Number(f.hours)||1} min={1} max={24} onChange={v=>update('hours',String(v))}/>
   {['FIXED_TERM','MONTHLY'].includes(f.engagement_type)?<Stepper label={t('days')} value={Number(f.days)||1} min={1} max={62} onChange={v=>update('days',String(v))}/>:null}
  </>:null}
  {step===3?<>
   <Text style={type.overline}>{t('serviceArea')}</Text>
   <View style={{gap:space.sm}}>{locations.data?.service_areas.map((a:any)=><OptionRow key={a.id} icon="map-outline" label={a.name} selected={f.service_area_id===a.id} onPress={()=>update('service_area_id',a.id)}/>)}</View>
   <Text style={[type.overline,{marginTop:space.sm}]}>{t('addressTitle')}</Text>
   <View style={{gap:space.sm}}>{addresses.data?.items.map((a:any)=><OptionRow key={a.id} icon="home-outline" label={a.label||a.line1} subtitle={[a.line1,a.locality].filter(Boolean).join(', ')} selected={f.address_id===a.id} onPress={()=>update('address_id',a.id)}/>)}</View>
   <TextLink label={'+ '+t('addAddress')} onPress={()=>router.push('/shared/client-setup')}/>
  </>:null}
  {step===4?<>
   <Field label={t('budget')} prefix="₹" value={f.budget} onChangeText={v=>update('budget',v)} keyboardType="decimal-pad" hint={t('quoteHelp')}/>
   <Field label={t('notes')} multiline value={f.notes} onChangeText={v=>update('notes',v)}/>
  </>:null}
  {step===5?<>
   <ListGroup>
    <ListRow icon={svc?.icon||'construct-outline'} title={svc?(hi?svc.name_hi:svc.name):t('service')} subtitle={t(f.engagement_type)+' · '+f.headcount+' '+t('workersWord')+' · '+f.hours+' h'}/>
    <ListRow icon="home-outline" title={t('addressTitle')} subtitle={addresses.data?.items.find((a:any)=>a.id===f.address_id)?.line1}/>
    {f.budget?<ListRow icon="cash-outline" title={t('budgetShort')} value={'₹'+f.budget}/>:null}
    {f.notes?<ListRow icon="chatbox-outline" title={t('notesTitle')} subtitle={f.notes}/>:null}
   </ListGroup>
   <Text style={type.overline}>{t('shiftsTitle')} ({plan.length})</Text>
   <ListGroup>{plan.slice(0,10).map(w=><ListRow key={w.start_at} icon="calendar-outline" title={dateTime(w.start_at,locale)} subtitle={t('until')+' '+timeOnly(w.end_at,locale)}/>)}</ListGroup>
   <Text style={type.footnote}>{t('quoteHelp')}</Text>
  </>:null}
  <ErrorBox code={error||services.error||locations.error||addresses.error}/>
 </Screen>;
}
