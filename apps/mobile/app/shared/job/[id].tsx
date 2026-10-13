import {useState} from 'react';
import {Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {Avatar,Banner,Button,Card,ErrorBox,Field,IconTile,ListGroup,ListRow,Screen,Section,SkeletonCard,StatusPill,colors,space,type} from '../../../src/ui';
import {useSession} from '../../../src/session';
import {useResource,useServices,errorCode} from '../../../src/hooks';
import {api} from '../../../src/api';
import {dateTime,km} from '../../../src/format';

export default function Job(){
 const {id,notified}=useLocalSearchParams<{id:string;notified?:string}>();const {t,user,locale}=useSession();const hi=locale==='hi';
 const {data:j,error,loading,reload}=useResource('/jobs/'+id);const catalog=useServices();const interests=useResource('/jobs/'+id+'/interests');
 const [reason,setReason]=useState(''),[failure,setFailure]=useState(''),[cancelOpen,setCancelOpen]=useState(false);
 const owner=j?.client_id===user?.id;const svc=catalog.items.find(s=>s.id===j?.service_id);
 return <Screen onRefresh={()=>{reload();interests.reload();}} refreshing={loading&&!!j}>
  {notified?<Banner kind="success" text={t('postedBanner')+' '+t('notifiedWorkers')+': '+notified}/>:null}
  <ErrorBox code={failure}/><ErrorBox code={error} onRetry={reload}/>
  {loading&&!j?<SkeletonCard count={2}/>:null}
  {j?<>
   <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
    <IconTile icon={svc?.icon||'briefcase-outline'} size={56}/>
    <View style={{flex:1,gap:6}}><Text accessibilityRole="header" style={type.largeTitle}>{svc?(hi?svc.name_hi:svc.name):t('requestStatus')}</Text><StatusPill status={j.status}/></View>
   </View>
   <ListGroup>
    <ListRow icon="calendar-outline" title={t('starts')} value={dateTime(j.start_at,locale)}/>
    <ListRow icon="briefcase-outline" title={t('engagementShort')} value={t(j.engagement_type)}/>
    <ListRow icon="people-outline" title={t('workersNeeded')} value={String(j.headcount)}/>
    <ListRow icon="location-outline" title={t('whereTitle')} subtitle={[j.location_snapshot?.line1,j.location_snapshot?.locality].filter(Boolean).join(', ')||t('cityName')}/>
    {j.notes?<ListRow icon="chatbox-outline" title={t('notesTitle')} subtitle={j.notes}/>:null}
   </ListGroup>

   {owner?<Section title={t('interestedWorkers')}>
    {interests.data?.items.length===0?<Card><Text style={type.callout}>{t('noInterests')}</Text></Card>:null}
    {interests.data?.items.map((w:any,i:number)=><Card key={w.id} style={{gap:space.md}}>
     <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
      <Avatar name={w.worker_name} size={48} tone={i}/>
      <View style={{flex:1,gap:2}}><Text style={type.headline}>{w.worker_name}</Text><Text numberOfLines={1} style={type.footnote}>{w.skills.join(', ')}</Text></View>
      {w.status==='SELECTED'?<StatusPill status="PENDING" label={t('offerSent')}/>:null}
     </View>
     <Text style={type.footnote}>{w.experience_years+' '+t('yearsWord')+' · '+w.completed_jobs+' '+t('completedJobsWord')+' · '+(w.trust.average!==null?'★ '+w.trust.average+' ('+w.trust.reviews+')':t('noReviewsYet'))+' · '+km(w.distance_m)}</Text>
     {w.status!=='SELECTED'?<Button size="md" icon="checkmark" label={t('chooseWorker')} onPress={async()=>{try{await api('/jobs/'+id+'/interests/'+w.id+'/select','POST',{});await interests.reload();await reload();}catch(e){setFailure(errorCode(e));}}}/>:null}
    </Card>)}
   </Section>:null}

   {j.assignments.length?<Section title={t('assignmentsTitle')}><ListGroup>{j.assignments.map((a:any)=><ListRow key={a.id} icon="hammer-outline" title={t('viewWork')} right={<StatusPill status={a.status}/>} onPress={()=>router.push({pathname:'/shared/assignment/[id]',params:{id:a.id}})}/>)}</ListGroup></Section>:null}

   <Section title={t('timeline')}>
    <Card style={{gap:0}}>{j.timeline.map((e:any,i:number)=><View key={e.id} style={{flexDirection:'row',gap:space.md}}>
     <View style={{alignItems:'center',width:14}}><View style={{width:12,height:12,borderRadius:6,marginTop:4,backgroundColor:i===j.timeline.length-1?colors.trust:colors.trustMid}}/>{i<j.timeline.length-1?<View style={{flex:1,width:2,backgroundColor:colors.line,marginVertical:2}}/>:null}</View>
     <View style={{flex:1,paddingBottom:i<j.timeline.length-1?space.lg:0,gap:2}}><Text style={[type.headline,{fontSize:15}]}>{t(e.type)}</Text><Text style={type.caption}>{dateTime(e.created_at,locale)}</Text></View>
    </View>)}</Card>
   </Section>

   {owner&&!['COMPLETED','CANCELLED','EXPIRED'].includes(j.status)?(cancelOpen?<Card style={{gap:space.md}}>
    <Field label={t('reason')} value={reason} onChangeText={setReason} multiline/>
    <View style={{flexDirection:'row',gap:space.sm}}><Button flex variant="secondary" label={t('cancel')} onPress={()=>setCancelOpen(false)}/><Button flex variant="danger" label={t('cancelRequest')} disabled={reason.length<3} onPress={async()=>{try{await api('/jobs/'+id+'/cancel','POST',{reason});setCancelOpen(false);await reload();}catch(e){setFailure(errorCode(e));}}}/></View>
   </Card>:<ListGroup><ListRow destructive icon="close-circle-outline" title={t('cancelRequest')} onPress={()=>setCancelOpen(true)}/></ListGroup>):null}
  </>:null}
 </Screen>;
}
