import {useState} from 'react';
import {Pressable,ScrollView,StyleSheet,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Banner,ErrorBox,IconButton,ListGroup,ListRow,Section,Screen,Skeleton,StatusPill,SwitchRow,colors,fonts,radius,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {api} from '../../src/api';
import {useResource,errorCode} from '../../src/hooks';
import {position} from '../../src/LocationForm';
import {firstName} from '../../src/format';

const soon=[['learnSkills','school-outline'],['apprenticeship','construct-outline'],['startOwnWork','storefront-outline']] as const;
export default function WorkerHome(){
 const {t,user}=useSession();const assignments=useResource('/assignments'),availability=useResource('/worker/availability'),verification=useResource('/worker/verifications'),updates=useResource('/notifications');
 const [error,setError]=useState('');const active=user?.worker_profile?.worker_status==='ACTIVE';const online=!!availability.data?.online;
 const unread=!!updates.data?.items.some((n:any)=>!n.read_at);
 async function setOnline(next:boolean){setError('');try{const p=next?await position():null;await api('/worker/availability','PUT',{online:next,service_area_id:availability.data?.service_area_id,...(p?{latitude:p.coords.latitude,longitude:p.coords.longitude}:{}),radius_m:availability.data?.radius_m||15000});await availability.reload();}catch(e){setError(e instanceof Error&&e.message==='permissionDenied'?'permissionDenied':errorCode(e));}}
 const work=(assignments.data?.items||[]).filter((a:any)=>!['COMPLETED','CANCELLED','REPLACED'].includes(a.status));
 return <Screen safeTop title={t('hello')+(user?', '+firstName(user.full_name):'')} subtitle={t(active?'workerHome':'underReview')} headerRight={<IconButton tone="soft" icon="notifications-outline" label={t('notifications')} badge={unread} onPress={()=>router.push('/shared/notifications')}/>} onRefresh={()=>{assignments.reload();availability.reload();verification.reload();updates.reload();}} refreshing={availability.loading&&!!availability.data} gap={space.xxl}>
  <View style={{gap:space.sm}}>
   {availability.loading&&!availability.data?<Skeleton height={64} radius={16}/>:<ListGroup footer={t(active?(online?'onlineFooter':'locationHelp'):'goOnlineAfterReview')}>
    <SwitchRow icon={online?'radio-button-on':'radio-button-off'} title={t(online?'online':'offline')} subtitle={t('availability')} value={online} disabled={!active} onValueChange={setOnline}/>
   </ListGroup>}
   <ErrorBox code={error||availability.error}/>
  </View>

  {!active?<Section title={t('verification')}>
   <Banner kind="warn" text={t('underReviewCopy')}/>
   {verification.data?.items.length?<ListGroup>{verification.data.items.map((v:any)=><ListRow key={v.id} icon={v.type==='POLICE'?'shield-checkmark-outline':'card-outline'} title={t(v.type.toLowerCase())} subtitle={v.reason||undefined} right={<StatusPill status={v.status}/>}/>)}</ListGroup>:null}
  </Section>:null}

  <View style={{flexDirection:'row',gap:space.md}}>
   <Tile icon="flash" title={t('todayWork')} copy={t('todayWorkCopy')} bg={colors.trust} onPress={()=>router.navigate({pathname:'/(worker)/jobs',params:{mode:'today'}})}/>
   <Tile icon="calendar" title={t('permanentJobs')} copy={t('permanentJobsCopy')} bg={colors.care} onPress={()=>router.navigate({pathname:'/(worker)/jobs',params:{mode:'permanent'}})}/>
  </View>

  <Section title={t('work')}>
   <ErrorBox code={assignments.error} onRetry={assignments.reload}/>
   {assignments.loading&&!assignments.data?<Skeleton height={64} radius={16}/>:work.length?<ListGroup>{work.map((a:any)=><ListRow key={a.id} icon="hammer-outline" title={t(a.status)} subtitle={t('viewWork')} onPress={()=>router.push({pathname:'/shared/assignment/[id]',params:{id:a.id}})}/>)}</ListGroup>:
    <View style={s.inlineEmpty}><Ionicons name="hourglass-outline" size={20} color={colors.quiet}/><Text style={[type.footnote,{flex:1}]}>{t('noAssignments')}</Text></View>}
  </Section>

  <Section title={t('comingSoon')}>
   <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginHorizontal:-space.lg}} contentContainerStyle={{gap:space.md,paddingHorizontal:space.lg}}>
    {soon.map(([k,icon])=><Pressable key={k} accessibilityRole="button" accessibilityLabel={t(k)+', '+t('comingSoon')} onPress={()=>router.push({pathname:'/shared/coming-soon',params:{topic:k}})} style={({pressed})=>[s.soon,pressed&&{opacity:0.7}]}>
     <Ionicons name={icon} size={24} color={colors.calm}/><Text style={[type.headline,{fontSize:15}]}>{t(k)}</Text><Text style={type.caption}>{t('comingSoon')}</Text>
    </Pressable>)}
   </ScrollView>
  </Section>
 </Screen>;
}
function Tile({icon,title,copy,bg,onPress}:{icon:any;title:string;copy:string;bg:string;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({pressed})=>[s.tile,{backgroundColor:bg,opacity:pressed?0.85:1}]}>
  <View style={s.tileIcon}><Ionicons name={icon} size={22} color={colors.white}/></View>
  <View style={{gap:2}}><Text style={s.tileTitle}>{title}</Text><Text numberOfLines={2} style={s.tileCopy}>{copy}</Text></View>
 </Pressable>;
}
const s=StyleSheet.create({
 tile:{flex:1,minHeight:132,borderRadius:radius.lg,padding:space.lg,justifyContent:'space-between',gap:space.md},
 tileIcon:{width:40,height:40,borderRadius:12,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
 tileTitle:{fontFamily:fonts.bold,fontSize:17,color:colors.white},
 tileCopy:{fontFamily:fonts.body,fontSize:13,lineHeight:18,color:'rgba(255,255,255,0.9)'},
 inlineEmpty:{flexDirection:'row',alignItems:'center',gap:space.sm,padding:space.lg,borderRadius:radius.lg,backgroundColor:colors.white},
 soon:{width:150,gap:6,padding:space.lg,borderRadius:radius.lg,backgroundColor:colors.calmSoft}
});
