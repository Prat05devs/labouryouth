import {router} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {EmptyState,ErrorBox,Screen,SkeletonCard,colors,radius,space,type} from './ui';
import {useSession} from './session';
import {useResource} from './hooks';
import {api} from './api';
import {ago} from './format';

// Updates feed, used as the hirer's Updates tab (tab=true) and as a pushed screen from the worker bell.
export function NotificationsList({tab=false}:{tab?:boolean}){
 const {t,locale}=useSession();const {data,error,loading,reload}=useResource('/notifications');
 async function open(n:any){await api('/notifications/'+n.id+'/read','POST').catch(()=>{});const route=String(n.payload?.route||'').replace('/worker/offers','/(worker)/offers').replace('/worker/jobs','/(worker)/jobs').replace('/worker/profile','/(worker)');if(route.startsWith('/shared/')||route.startsWith('/(worker)'))router.push(route as any);else reload();}
 return <Screen safeTop={tab} title={tab?t('notifications'):undefined} onRefresh={reload} refreshing={loading&&!!data} gap={space.sm}>
  <ErrorBox code={error} onRetry={reload}/>
  {loading&&!data?<SkeletonCard count={4}/>:null}
  {data?.items.length===0?<EmptyState icon="notifications-outline" title={t('allCaughtUp')} text={t('noUpdates')}/>:null}
  {data?.items.map((n:any)=><Pressable key={n.id} accessibilityRole="button" accessibilityLabel={t(n.kind)} onPress={()=>open(n)} style={({pressed})=>({flexDirection:'row',gap:space.md,alignItems:'center',padding:space.lg,borderRadius:radius.lg,backgroundColor:n.read_at?colors.white:colors.trustSoft,opacity:pressed?0.7:1})}>
   <View style={{width:40,height:40,borderRadius:20,backgroundColor:n.read_at?colors.raised:colors.white,alignItems:'center',justifyContent:'center'}}><Ionicons name="notifications-outline" size={20} color={colors.trust}/></View>
   <View style={{flex:1,gap:2}}><Text style={[type.headline,{fontSize:15}]}>{t(n.kind)}</Text><Text style={type.caption}>{ago(n.created_at,locale,t)}</Text></View>
   {!n.read_at?<View style={{width:9,height:9,borderRadius:5,backgroundColor:colors.trust}} accessibilityLabel={t('unread')}/>:null}
   <Ionicons name="chevron-forward" size={18} color={colors.quiet}/>
  </Pressable>)}
 </Screen>;
}
