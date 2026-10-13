import {useState} from 'react';
import {Text,View,StyleSheet} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {UserButton} from '../../../src/UserButton';
import {Ionicons} from '@expo/vector-icons';
import {Avatar,Button,Card,ChipWrap,Tag,ErrorBox,IconTile,ListGroup,ListRow,Screen,SkeletonCard,colors,fonts,radius,space,type} from '../../../src/ui';
import {errorCode,useResource} from '../../../src/hooks';
import {useSession} from '../../../src/session';
import {routeAfterAuth,saveIntent} from '../../../src/authIntent';

export default function PublicWorker(){
 const {id}=useLocalSearchParams<{id:string}>();const {t,locale,user,reload}=useSession();
 const {data:w,error,loading,reload:refresh}=useResource('/public/workers/'+id);const [failure,setFailure]=useState('');const hi=locale==='hi';
 async function hire(){setFailure('');const target='/shared/quick-post?service='+encodeURIComponent(w.service_ids[0]||'')+'&preferred_worker='+encodeURIComponent(id)+'&worker_name='+encodeURIComponent(w.first_name);try{await saveIntent(target,'CLIENT');if(!user){router.push('/(public)/account');return;}const next=await routeAfterAuth(user,reload,locale);router.push((next||target) as any);}catch(e){setFailure(errorCode(e));}}
 return <Screen footer={w?<Button icon="person-add-outline" label={user?t('requestWorker'):t('loginToBook')} onPress={hire}/>:undefined}>
  <Stack.Screen options={{headerRight:()=><UserButton/>}}/>
  {loading&&!w?<SkeletonCard count={2}/>:null}
  <ErrorBox code={error} onRetry={refresh}/><ErrorBox code={failure}/>
  {w?<>
   <View style={{alignItems:'center',gap:space.sm,paddingTop:space.sm}}>
    <Avatar name={w.first_name} size={92} online={w.online}/>
    <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Text accessibilityRole="header" style={type.largeTitle}>{w.first_name}</Text>{w.verified?<Ionicons name="shield-checkmark" size={22} color={colors.care} accessibilityLabel={t('verifiedByTeam')}/>:null}</View>
    <Text style={[type.footnote,{fontFamily:fonts.bodyBold,color:w.online?colors.careInk:colors.muted}]}>{w.online?t('availableNow'):t('currentlyOffline')}</Text>
   </View>
   <View style={s.stats}>
    <Stat value={String(w.experience_years)} label={t('yearsWord')}/><View style={s.statDivider}/>
    <Stat value={String(w.completed_jobs)} label={t('completedJobsWord')}/><View style={s.statDivider}/>
    <Stat value={w.trust.average==null?'-':String(w.trust.average)} label={w.trust.average==null?t('noReviewsYet'):w.trust.reviews+' '+t('reviewsWord')}/>
   </View>
   <View style={{gap:space.sm}}><Text style={type.overline}>{t('servicesOffered')}</Text><ChipWrap>{(hi?w.skills_hi:w.skills).map((x:string)=><Tag key={x} label={x}/>)}</ChipWrap></View>
   <ListGroup>
    <ListRow icon="location-outline" title={t('serviceArea')} value={w.area||t('cityName')}/>
    <ListRow icon="language-outline" title={t('languages')} value={w.languages.map((x:string)=>x==='hi'?'हिन्दी':'English').join(', ')||t('notListed')}/>
   </ListGroup>
   <Card style={{gap:space.sm}}><View style={{flexDirection:'row',gap:space.sm,alignItems:'center'}}><IconTile icon="shield-checkmark-outline" size={34} tone={1}/><Text style={[type.headline,{flex:1}]}>{t('verifiedByTeam')}</Text></View><Text style={type.callout}>{t('workerPrivacyCopy')}</Text></Card>
  </>:null}
 </Screen>;
}
function Stat({value,label}:{value:string;label:string}){return <View style={{flex:1,alignItems:'center',gap:2}}><Text style={{fontFamily:fonts.bold,fontSize:22,color:colors.ink}}>{value}</Text><Text numberOfLines={2} style={[type.caption,{textAlign:'center'}]}>{label}</Text></View>;}
const s=StyleSheet.create({stats:{flexDirection:'row',alignItems:'center',backgroundColor:colors.white,borderRadius:radius.lg,paddingVertical:space.lg,paddingHorizontal:space.sm,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line},statDivider:{width:StyleSheet.hairlineWidth,alignSelf:'stretch',backgroundColor:colors.line}});
