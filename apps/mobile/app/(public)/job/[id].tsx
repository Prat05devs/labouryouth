import {useEffect,useRef,useState} from 'react';
import {Text,View} from 'react-native';
import {Stack,router,useLocalSearchParams} from 'expo-router';
import {UserButton} from '../../../src/UserButton';
import {Banner,Button,Card,ErrorBox,Fact,FactGrid,IconTile,Screen,SkeletonCard,colors,fonts,space,type} from '../../../src/ui';
import {useResource,errorCode} from '../../../src/hooks';
import {useSession} from '../../../src/session';
import {api} from '../../../src/api';
import {dateTime,rupees} from '../../../src/format';
import {routeAfterAuth,saveIntent} from '../../../src/authIntent';

export default function PublicJob(){
 const {id,continue:continuation}=useLocalSearchParams<{id:string;continue?:string}>();const {t,locale,user,reload}=useSession();
 const {data:j,error,loading,reload:refresh}=useResource('/public/jobs/'+id);const [failure,setFailure]=useState(''),[notice,setNotice]=useState('');
 const continued=useRef(false);const hi=locale==='hi';const target='/(public)/job/'+id+'?continue=apply';
 async function sendInterest(){setFailure('');setNotice('');try{await api('/jobs/'+id+'/interest','POST',{});setNotice('interestSaved');router.setParams({continue:undefined});}catch(e){setFailure(errorCode(e));}}
 useEffect(()=>{if(user&&continuation==='apply'&&!continued.current){continued.current=true;void sendInterest();}},[user,continuation,id]);
 async function apply(){setFailure('');setNotice('');await saveIntent(target,'WORKER');if(!user){router.push('/(public)/account');return;}try{const next=await routeAfterAuth(user,reload,locale);if(next&&next!==target){router.push(next as any);return;}await sendInterest();}catch(e){setFailure(errorCode(e));}}
 const footer=j?(notice?<Button variant="secondary" icon="arrow-back" label={t('backToRoles')} onPress={()=>router.back()}/>:<Button icon="hand-left-outline" label={user?t('applyNow'):t('loginToApply')} onPress={apply}/>):undefined;
 return <Screen footer={footer} onRefresh={refresh} refreshing={false}>
  <Stack.Screen options={{headerRight:()=><UserButton/>}}/>
  {loading&&!j?<SkeletonCard count={2}/>:null}
  <ErrorBox code={error} onRetry={refresh}/><ErrorBox code={failure}/>
  {notice?<Banner kind="success" text={t(notice)}/>:null}
  {j?<>
   <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
    <IconTile icon="briefcase-outline" size={56}/>
    <View style={{flex:1,gap:2}}><Text accessibilityRole="header" style={type.largeTitle}>{hi?j.service_name_hi:j.service_name}</Text><Text style={type.callout}>{(j.locality||t('cityName'))+' · '+t(j.engagement_type)}</Text></View>
   </View>
   <Card style={{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.md}} tone="trust">
    <View style={{gap:2}}><Text style={type.caption}>{t('statedPay')}</Text><Text style={{fontFamily:fonts.bold,fontSize:28,color:colors.trustDeep}}>{j.wage_paise==null?t('quoteRequired'):rupees(j.wage_paise)}</Text></View>
    {j.wage_paise!=null?<Text style={[type.footnote,{color:colors.trustInk}]}>{t('perDay')}</Text>:null}
   </Card>
   <FactGrid>
    <Fact icon="calendar-outline" label={t('starts')} value={dateTime(j.start_at,locale)}/>
    <Fact icon="time-outline" label={t('ends')} value={dateTime(j.end_at,locale)}/>
    <Fact icon="people-outline" label={t('openPlaces')} value={String(j.slots_left)}/>
    <Fact icon="location-outline" label={t('workArea')} value={j.locality||t('cityName')}/>
   </FactGrid>
   <Card style={{gap:space.sm}}><View style={{flexDirection:'row',gap:space.sm,alignItems:'center'}}><IconTile icon="lock-closed-outline" size={34} tone={1}/><Text style={[type.headline,{flex:1}]}>{t('privateUntilSelected')}</Text></View><Text style={type.callout}>{t('jobPrivacyCopy')}</Text></Card>
  </>:null}
 </Screen>;
}
