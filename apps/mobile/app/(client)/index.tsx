import {Pressable,Text,View,StyleSheet,useWindowDimensions} from 'react-native';
import {router} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {Button,EmptyState,ErrorBox,IconButton,ListGroup,ListRow,Section,Skeleton,Screen,colors,fonts,radius,space,toneAt} from '../../src/ui';
import {RequestRow} from '../../src/RequestRow';
import {useSession} from '../../src/session';
import {useResource,useServices} from '../../src/hooks';
import {firstName} from '../../src/format';

const OPEN=['DRAFT','SUBMITTED','MATCHING','OFFERING','ASSIGNED','ACTIVE','ON_HOLD'];
export default function ClientHome(){
 const {t,locale,user}=useSession();const hi=locale==='hi';const {width}=useWindowDimensions();
 const catalog=useServices();const jobs=useResource('/jobs');const updates=useResource('/notifications');
 const unread=!!updates.data?.items.some((n:any)=>!n.read_at);const open=(jobs.data?.items||[]).filter((j:any)=>OPEN.includes(j.status)).slice(0,3);
 const columns=width>=600?6:4;const tile=(Math.min(width,720)-space.lg*2-space.sm*(columns-1))/columns;
 return <Screen safeTop title={t('hello')+(user?', '+firstName(user.full_name):'')} subtitle={t('clientHome')} headerRight={<IconButton tone="soft" icon="notifications-outline" label={t('notifications')} badge={unread} onPress={()=>router.navigate('/(client)/updates')}/>} onRefresh={()=>{jobs.reload();catalog.reload();updates.reload();}} refreshing={jobs.loading&&!!jobs.data} gap={space.xxl}>
  <View style={s.hero}>
   <View style={{gap:4}}><Text style={s.heroKicker}>{t('quickPostHome')}</Text><Text style={s.heroTitle}>{t('quickPost')}</Text></View>
   <Button variant="secondary" icon="add" label={t('postWork')} onPress={()=>router.push('/shared/quick-post')}/>
  </View>

  <Section title={t('popularServices')} action={t('detailedRequest')} onAction={()=>router.push('/shared/new-request')}>
   <ErrorBox code={catalog.error} onRetry={catalog.reload}/>
   <View style={s.grid}>
    {catalog.loading&&!catalog.items.length?Array.from({length:8},(_,i)=><View key={i} style={{width:tile,alignItems:'center',gap:8}}><Skeleton width={56} height={56} radius={18}/><Skeleton width={tile*0.7} height={10}/></View>):
     catalog.items.slice(0,8).map((item,i)=>{const tone=toneAt(i);return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={hi?item.name_hi:item.name} onPress={()=>router.push({pathname:'/shared/quick-post',params:{service:item.id}})} style={({pressed})=>({width:tile,alignItems:'center',gap:6,opacity:pressed?0.6:1})}>
      <View style={[s.serviceIcon,{backgroundColor:tone.soft}]}><Ionicons name={(item.icon||'construct-outline') as any} size={26} color={tone.strong}/></View>
      <Text numberOfLines={2} style={s.serviceText}>{hi?item.name_hi:item.name}</Text>
     </Pressable>;})}
   </View>
  </Section>

  <Section title={t('activeRequests')} action={jobs.data?.items.length?t('seeAll'):undefined} onAction={()=>router.navigate('/(client)/requests')}>
   <ErrorBox code={jobs.error} onRetry={jobs.reload}/>
   {jobs.loading&&!jobs.data?<Skeleton height={68} radius={16}/>:open.length?<ListGroup>{open.map((j:any,i:number)=><RequestRow key={j.id} job={j} services={catalog.items} index={i}/>)}</ListGroup>:
    <View style={s.empty}><EmptyState icon="document-text-outline" text={t('noRequests')}/></View>}
  </Section>

  <ListGroup>
   <ListRow icon="people-outline" iconColor={colors.care} iconBg={colors.careSoft} title={t('browseVerifiedWorkers')} subtitle={t('availablePeopleCopy')} onPress={()=>router.push('/browse/workers')}/>
  </ListGroup>
 </Screen>;
}
const s=StyleSheet.create({
 hero:{backgroundColor:colors.trust,borderRadius:radius.xl,padding:space.xl,gap:space.lg},
 heroKicker:{fontFamily:fonts.bodyBold,fontSize:14,color:colors.trustMid},
 heroTitle:{fontFamily:fonts.bold,fontSize:22,lineHeight:29,color:colors.white},
 grid:{flexDirection:'row',flexWrap:'wrap',rowGap:space.lg,columnGap:space.sm},
 serviceIcon:{width:58,height:58,borderRadius:18,alignItems:'center',justifyContent:'center'},
 serviceText:{fontFamily:fonts.bodyBold,fontSize:12.5,lineHeight:16,color:colors.text,textAlign:'center'},
 empty:{backgroundColor:colors.white,borderRadius:radius.lg}
});
