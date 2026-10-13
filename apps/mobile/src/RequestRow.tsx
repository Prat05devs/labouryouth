import {router} from 'expo-router';
import {Pressable,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {IconTile,StatusPill,colors,space,type} from './ui';
import {useSession} from './session';
import {shortDate} from './format';

// One hirer request in a list: service, date and engagement, live status.
export function RequestRow({job,services,index=0}:{job:any;services:any[];index?:number}){
 const {t,locale}=useSession();const service=services.find(s=>s.id===job.service_id);const name=service?(locale==='hi'?service.name_hi:service.name):t('service');
 return <Pressable accessibilityRole="button" accessibilityLabel={name+', '+t(job.status)} onPress={()=>router.push({pathname:'/shared/job/[id]',params:{id:job.id}})} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:space.md,paddingHorizontal:space.lg,paddingVertical:space.md,minHeight:68,backgroundColor:pressed?colors.raised:colors.white})}>
  <IconTile icon={service?.icon||'briefcase-outline'} tone={index}/>
  <View style={{flex:1,gap:4}}><Text numberOfLines={1} style={[type.headline,{fontSize:16}]}>{name}</Text><Text numberOfLines={1} style={type.footnote}>{shortDate(job.start_at,locale)+' · '+t(job.engagement_type)+(job.location_snapshot?.locality?' · '+job.location_snapshot.locality:'')}</Text></View>
  <StatusPill status={job.status}/>
  <Ionicons name="chevron-forward" size={18} color={colors.quiet}/>
 </Pressable>;
}
