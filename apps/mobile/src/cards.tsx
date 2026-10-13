import {Pressable,StyleSheet,Text,View} from 'react-native';
import {Ionicons} from '@expo/vector-icons';
import {Avatar,IconName,IconTile,MetaLine,colors,fonts,radius,space,type} from './ui';
import {rupees,shortDate} from './format';
import {useSession} from './session';

// Compact list cards shared by the guest browse, worker feed and hirer screens.
export function JobCard({job,index=0,onPress,compact=false,icon}:{job:any;index?:number;onPress:()=>void;compact?:boolean;icon?:IconName}){
 const {t,locale}=useSession();const hi=locale==='hi';const wage=job.wage_paise??job.budget_max;
 return <Pressable accessibilityRole="button" accessibilityLabel={(hi?job.service_name_hi:job.service_name)+', '+(wage!=null?rupees(wage):t('quoteRequired'))} onPress={onPress} style={({pressed})=>[s.card,compact&&{width:236},pressed&&{opacity:0.75}]}>
  <View style={s.top}>
   <IconTile icon={icon||'briefcase-outline'} tone={index}/>
   <View style={{flex:1,gap:2}}>
    <Text numberOfLines={1} style={type.headline}>{hi?job.service_name_hi:job.service_name}</Text>
    <Text numberOfLines={1} style={type.footnote}>{(job.locality||t('cityName'))+' · '+t(job.engagement_type)}</Text>
   </View>
   {!compact?<Ionicons name="chevron-forward" size={18} color={colors.quiet}/>:null}
  </View>
  <View style={s.bottom}>
   <View style={{flexDirection:'row',gap:space.md,flexShrink:1}}><MetaLine icon="calendar-outline" text={shortDate(job.start_at,locale)}/><MetaLine icon="people-outline" text={job.slots_left+' '+t('slotsLeft')}/></View>
   <Text style={s.wage}>{wage!=null?rupees(wage):t('quoteRequired')}{wage!=null?<Text style={type.caption}>{' '+t('perDayShort')}</Text>:null}</Text>
  </View>
 </Pressable>;
}

export function WorkerCard({worker,index=0,onPress,compact=false}:{worker:any;index?:number;onPress:()=>void;compact?:boolean}){
 const {t,locale}=useSession();const skills=(locale==='hi'?worker.skills_hi:worker.skills)||[];
 if(compact)return <Pressable accessibilityRole="button" accessibilityLabel={worker.first_name} onPress={onPress} style={({pressed})=>[s.card,{width:150,alignItems:'center',gap:space.sm},pressed&&{opacity:0.75}]}>
  <Avatar name={worker.first_name} size={56} tone={index} online={worker.online}/>
  <View style={{flexDirection:'row',alignItems:'center',gap:4}}><Text numberOfLines={1} style={type.headline}>{worker.first_name}</Text>{worker.verified?<Ionicons name="shield-checkmark" size={15} color={colors.care}/>:null}</View>
  <Text numberOfLines={2} style={[type.footnote,{textAlign:'center'}]}>{skills.join(', ')}</Text>
 </Pressable>;
 return <Pressable accessibilityRole="button" accessibilityLabel={worker.first_name} onPress={onPress} style={({pressed})=>[s.card,pressed&&{opacity:0.75}]}>
  <View style={s.top}>
   <Avatar name={worker.first_name} size={48} tone={index} online={worker.online}/>
   <View style={{flex:1,gap:2}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:5}}><Text numberOfLines={1} style={type.headline}>{worker.first_name}</Text>{worker.verified?<Ionicons name="shield-checkmark" size={16} color={colors.care} accessibilityLabel={t('verifiedByTeam')}/>:null}</View>
    <Text numberOfLines={1} style={type.footnote}>{skills.join(', ')}</Text>
   </View>
   <Ionicons name="chevron-forward" size={18} color={colors.quiet}/>
  </View>
  <View style={{flexDirection:'row',gap:space.md,flexWrap:'wrap'}}>
   <MetaLine icon="location-outline" text={worker.area||t('cityName')}/>
   <MetaLine icon="ribbon-outline" text={worker.experience_years+' '+t('experienceShort')}/>
   <MetaLine icon={worker.online?'radio-button-on':'radio-button-off'} color={worker.online?colors.careInk:colors.muted} text={t(worker.online?'availableNow':'currentlyOffline')}/>
  </View>
 </Pressable>;
}

const s=StyleSheet.create({
 card:{backgroundColor:colors.white,borderRadius:radius.lg,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line,padding:space.lg,gap:space.md,shadowColor:colors.trustDeep,shadowOpacity:0.06,shadowRadius:10,shadowOffset:{width:0,height:4},elevation:1},
 top:{flexDirection:'row',alignItems:'center',gap:space.md},
 bottom:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:space.sm},
 wage:{fontFamily:fonts.bold,fontSize:17,color:colors.ink}
});
