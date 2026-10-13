import {useState} from 'react';
import {Image,Pressable,Text,View} from 'react-native';
import {useLocalSearchParams} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Avatar,Banner,Button,Card,ErrorBox,Field,ListGroup,ListRow,Screen,Section,SkeletonCard,StatusPill,colors,fonts,space,type} from '../../../src/ui';
import {useSession} from '../../../src/session';
import {useResource,errorCode} from '../../../src/hooks';
import {api,requestKey,privateImageSource} from '../../../src/api';
import {position} from '../../../src/LocationForm';
import {ContactCard} from '../../../src/ContactCard';
import {dateTime} from '../../../src/format';

const stages=['ACCEPTED','EN_ROUTE','ARRIVED','IN_PROGRESS','COMPLETED'];
const actionIcons:Record<string,any>={startJourney:'navigate',arrived:'location',startShift:'play',completeShift:'checkmark-done',prepareNext:'refresh'};
export default function Assignment(){
 const {id}=useLocalSearchParams<{id:string}>();const {user,t,locale}=useSession();const {data:a,error,loading,reload}=useResource('/assignments/'+id);
 const [failure,setFailure]=useState(''),[reason,setReason]=useState(''),[rating,setRating]=useState(5),[comment,setComment]=useState(''),[message,setMessage]=useState(''),[help,setHelp]=useState(false);
 const worker=a&&a.worker_id===user?.worker_profile?.id;const shift=a?.shifts.find((s:any)=>s.status==='IN_PROGRESS')||a?.shifts.find((s:any)=>s.status==='SCHEDULED');
 let action='';if(worker&&a&&shift){action=a.status==='ACCEPTED'?'startJourney':a.status==='EN_ROUTE'?'arrived':a.status==='ARRIVED'?'startShift':shift.status==='IN_PROGRESS'?'completeShift':a.status==='IN_PROGRESS'?'prepareNext':'';}
 async function primary(){try{setFailure('');if(action==='startShift'){const p=await position();await api('/shifts/'+shift.id+'/check-in','POST',{latitude:p.coords.latitude,longitude:p.coords.longitude,accuracy_m:p.coords.accuracy||999,device_timestamp:new Date(p.timestamp).toISOString()},requestKey());}else if(action==='completeShift')await api('/shifts/'+shift.id+'/complete','POST',{},'complete-'+shift.id);else await api('/assignments/'+id+'/'+({startJourney:'en-route',arrived:'arrived',prepareNext:'prepare-next-shift'} as Record<string,string>)[action],'POST');await reload();}catch(e){setFailure(e instanceof Error&&e.message==='permissionDenied'?'permissionDenied':errorCode(e));}}
 const stage=a?stages.indexOf(a.status):-1;const live=a&&!['COMPLETED','CANCELLED','REPLACED'].includes(a.status);
 return <Screen onRefresh={reload} refreshing={loading&&!!a} footer={action?<Button icon={actionIcons[action]} label={t(action)} onPress={primary}/>:undefined}>
  <ErrorBox code={failure}/><ErrorBox code={error} onRetry={reload}/>
  {message?<Banner kind="success" text={t(message)}/>:null}
  {loading&&!a?<SkeletonCard count={2}/>:null}
  {a?<>
   {stage>=0?<View style={{flexDirection:'row',gap:4}} accessibilityLabel={t(a.status)}>{stages.map((s,i)=><View key={s} style={{flex:1,gap:6}}><View style={{height:5,borderRadius:3,backgroundColor:i<=stage?colors.care:colors.line}}/><Text numberOfLines={1} style={[type.caption,{fontSize:10.5},i===stage&&{color:colors.careInk,fontFamily:fonts.bold}]}>{t(s)}</Text></View>)}</View>:<StatusPill status={a.status}/>}
   <Card style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
    {a.worker.photo_document_id?<Image source={privateImageSource(a.worker.photo_document_id)} accessibilityLabel={a.worker.full_name} style={{width:60,height:60,borderRadius:30,backgroundColor:colors.soft}}/>:<Avatar name={a.worker.full_name} size={60}/>}
    <View style={{flex:1,gap:4}}><Text style={type.headline}>{a.worker.full_name}</Text><Text style={type.footnote}>{t('experience')}: {a.worker.experience_years} {t('yearsWord')}</Text><StatusPill status={a.worker.worker_status}/></View>
   </Card>
   <ListGroup><ListRow icon="location-outline" title={t('whereTitle')} subtitle={[a.job.location_snapshot.line1,a.job.location_snapshot.locality].filter(Boolean).join(', ')}/></ListGroup>
   {worker?<ContactCard jobId={a.job_id}/>:null}
   <Section title={t('shiftsTitle')}><ListGroup>{a.shifts.map((s:any)=><ListRow key={s.id} icon="calendar-outline" title={dateTime(s.scheduled_start,locale)} right={<StatusPill status={s.status}/>}/>)}</ListGroup></Section>

   {live?<View style={{gap:space.md}}>
    <ListGroup><ListRow icon="help-buoy-outline" iconColor={colors.courageInk} iconBg={colors.courageSoft} title={t('needHelp')} subtitle={t('needHelpCopy')} chevron={false} right={<Ionicons name={help?'chevron-up':'chevron-down'} size={18} color={colors.quiet}/>} onPress={()=>setHelp(!help)}/></ListGroup>
    {help?<Card style={{gap:space.md}}>
     <Text style={type.callout}>{t('replacementCopy')}</Text>
     <Field label={t('reason')} value={reason} onChangeText={setReason} multiline/>
     {worker&&a.status==='ARRIVED'?<Button variant="secondary" icon="hand-left-outline" disabled={reason.length<3} label={t('manualCheckIn')} onPress={async()=>{try{await api('/shifts/'+shift.id+'/manual-check-in-request','POST',{reason});setMessage('saved');}catch(e){setFailure(errorCode(e));}}}/>:null}
     <Button variant="secondary" icon="swap-horizontal-outline" label={t('replacement')} disabled={reason.length<3} onPress={async()=>{try{await api('/replacements','POST',{assignment_id:id,reason:worker?'WORKER_REQUEST':'CLIENT_REQUEST',details:reason});setMessage('saved');}catch(e){setFailure(errorCode(e));}}}/>
     <Button variant="danger" icon="warning-outline" label={t('reportIncident')} disabled={reason.length<3} onPress={async()=>{try{await api('/incidents','POST',{assignment_id:id,type:'OTHER',description:reason});setMessage('saved');}catch(e){setFailure(errorCode(e));}}}/>
    </Card>:null}
   </View>:null}

   {a.status==='COMPLETED'&&a.job.client_id===user?.id?<Card style={{gap:space.md}}>
    <Text style={type.headline}>{t('review')}</Text>
    <View style={{flexDirection:'row',gap:space.sm,justifyContent:'center'}}>{[1,2,3,4,5].map(n=><Pressable key={n} accessibilityRole="button" accessibilityLabel={n+' / 5'} accessibilityState={{selected:n<=rating}} hitSlop={4} onPress={()=>setRating(n)}><Ionicons name={n<=rating?'star':'star-outline'} size={36} color={n<=rating?colors.sun:colors.quiet}/></Pressable>)}</View>
    <Field label={t('comment')} value={comment} onChangeText={setComment} multiline/>
    <Button label={t('submitReview')} onPress={async()=>{try{await api('/reviews','POST',{assignment_id:id,rating,comment,tags:[]});setMessage('reviewSaved');}catch(e){setFailure(errorCode(e));}}}/>
   </Card>:null}
  </>:null}
 </Screen>;
}
