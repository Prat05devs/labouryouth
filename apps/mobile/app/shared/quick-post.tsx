import {useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {router,Redirect,useLocalSearchParams} from 'expo-router';
import {Avatar,Banner,Button,Card,Chip,ChipScroller,ChipWrap,ErrorBox,Field,Screen,Segmented,Stepper,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {api} from '../../src/api';
import {useResource,useServices,errorCode} from '../../src/hooks';
import {MapsLinkField} from '../../src/LocationForm';
import {PickerField} from '../../src/PickerField';
import {rupees} from '../../src/format';

export default function QuickPost(){
 const {t,locale,user}=useSession();const hi=locale==='hi';const params=useLocalSearchParams<{service?:string;preferred_worker?:string;worker_name?:string}>();
 const services=useServices(),areas=useResource('/locations'),places=useResource('/localities');
 const [service,setService]=useState(params.service||''),[place,setPlace]=useState(''),[headcount,setHeadcount]=useState(1),[wage,setWage]=useState(''),[tomorrow,setTomorrow]=useState(false),[time,setTime]=useState('08:00'),[hours,setHours]=useState(8),[notes,setNotes]=useState(''),[mapsUrl,setMapsUrl]=useState(''),[mapsError,setMapsError]=useState(''),[error,setError]=useState(''),[rate,setRate]=useState<any>(null);
 useEffect(()=>{setRate(null);if(service)api('/wages/benchmark?service_id='+service).then(setRate).catch(()=>{});},[service]);
 if(!user?.roles.includes('CLIENT'))return <Redirect href="/"/>;
 async function post(){setError('');try{const area=areas.data?.service_areas?.[0];const rupeesValue=Number(wage);const [hh,mm]=time.split(':').map(Number);if(!service||!area||!(rupeesValue>0)||!(hh>=0&&hh<24&&mm>=0&&mm<60))throw new Error('VALIDATION_ERROR');const start=new Date();if(tomorrow)start.setDate(start.getDate()+1);start.setHours(hh,mm,0,0);
  const j=await api('/jobs/quick','POST',{service_id:service,service_area_id:area.id,preferred_worker_id:params.preferred_worker||null,maps_url:mapsUrl.trim()||null,locality:place,start_at:start.toISOString(),hours,headcount,wage_per_day_paise:Math.round(rupeesValue*100),notes});
  router.replace({pathname:'/shared/job/[id]',params:{id:j.id,notified:String(j.notified_workers??'')}});}
  catch(e){const code=e instanceof Error&&e.message==='VALIDATION_ERROR'?'VALIDATION_ERROR':errorCode(e);if(code==='MAPS_LINK_INVALID')setMapsError(t('MAPS_LINK_INVALID'));else setError(code);}}
 const heading=(k:string)=><Text style={[type.overline,{marginTop:space.sm}]}>{t(k)}</Text>;
 return <Screen footer={<><ErrorBox code={error}/><Button icon="paper-plane-outline" label={t('postWork')} disabled={!service||!wage} onPress={post}/></>}>
  <View style={{gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('quickPost')}</Text><Text style={type.callout}>{params.worker_name?t('directRequestCopy'):t('quickPostCopy')}</Text></View>
  {params.worker_name?<Card style={{flexDirection:'row',alignItems:'center',gap:space.md}}><Avatar name={params.worker_name} size={44}/><View style={{flex:1}}><Text style={type.caption}>{t('selectedWorker')}</Text><Text style={type.headline}>{params.worker_name}</Text></View></Card>:null}

  {heading('service')}
  <ChipScroller>{services.items.map(s=><Chip key={s.id} icon={s.icon} label={hi?s.name_hi:s.name} selected={service===s.id} onPress={()=>setService(s.id)}/>)}</ChipScroller>

  {heading('whenTitle')}
  <Segmented value={tomorrow?'tomorrow':'today'} onChange={v=>setTomorrow(v==='tomorrow')} options={[{value:'today',label:t('today')},{value:'tomorrow',label:t('tomorrow')}]}/>
  <PickerField label={t('startTimeShort')} mode="time" value={time} onChange={setTime}/>
  <Stepper label={t('hoursOfWork')} value={hours} onChange={setHours} min={1} max={16}/>

  {heading('workersAndPay')}
  <Stepper label={t('workersNeeded')} value={headcount} onChange={setHeadcount} min={1} max={50}/>
  <Field label={t('dailyWageShort')} prefix="₹" keyboardType="number-pad" value={wage} onChangeText={setWage} placeholder="700"/>
  {rate&&rate.median_paise!==null?<Banner text={t('marketRate')+': '+rupees(rate.min_paise)+' - '+rupees(rate.max_paise)+' · '+t('marketRateRange')+' '+rupees(rate.median_paise)}/>:null}

  {heading('whereTitle')}
  {places.data?.items.length?<ChipWrap>{places.data.items.map((p:any)=><Chip key={p.id} label={hi?p.name_hi:p.name} selected={place===p.name} onPress={()=>setPlace(place===p.name?'':p.name)}/>)}</ChipWrap>:null}
  <MapsLinkField value={mapsUrl} error={mapsError} onChange={v=>{setMapsUrl(v);setMapsError('');}}/>
  <Text style={type.footnote}>{t('contactShareNote')}</Text>

  {heading('notesTitle')}
  <Field label={t('notes')} value={notes} onChangeText={setNotes} multiline/>
 </Screen>;
}
