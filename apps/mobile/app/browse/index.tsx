import {useState} from 'react';
import {Image,ImageBackground,Pressable,RefreshControl,ScrollView,StyleSheet,Text,View,useWindowDimensions} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {LinearGradient} from 'expo-linear-gradient';
import {Ionicons} from '@expo/vector-icons';
import {router} from 'expo-router';
import {Banner,ListGroup,ListRow,Section,Segmented,Skeleton,colors,fonts,radius,space,toneAt,type} from '../../src/ui';
import {JobCard,WorkerCard} from '../../src/cards';
import {LanguageToggle} from '../../src/LanguageToggle';
import {UserButton} from '../../src/UserButton';
import {usePublicList,useServices} from '../../src/hooks';
import {useSession} from '../../src/session';
import {MotionView} from '../../src/motion';

const SHOWN=8;
export default function GuestHome(){
 const {t,locale,user}=useSession();const hi=locale==='hi';const insets=useSafeAreaInsets();const {width}=useWindowDimensions();
 const catalog=useServices();const jobs=usePublicList('jobs');const workers=usePublicList('workers');const [all,setAll]=useState(false),[goal,setGoal]=useState<'jobs'|'workers'>('workers');
 const columns=width>=600?6:4;const tile=(Math.min(width,720)-space.lg*2-space.sm*(columns-1))/columns;
 const services=all?catalog.items:catalog.items.slice(0,SHOWN);
 const refresh=()=>{catalog.reload();jobs.load(true);workers.load(true);};
 return <View style={{flex:1,backgroundColor:colors.canvas}}>
  <ScrollView showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={jobs.refreshing} onRefresh={refresh} tintColor={colors.trust} progressViewOffset={insets.top}/>} contentContainerStyle={{paddingTop:insets.top+space.xs,paddingBottom:space.xxxl,gap:space.xxl,width:'100%',maxWidth:720,alignSelf:'center'}}>
   <View style={[s.header,{paddingHorizontal:space.lg}]}>
    <Image source={require('../../assets/logo.png')} resizeMode="contain" tintColor={colors.ink} accessibilityLabel="Labour Youth" style={{width:64,height:44}}/>
    <View style={{flexDirection:'row',alignItems:'center',gap:space.sm}}>
     <LanguageToggle/>
     <UserButton/>
    </View>
   </View>

   <View style={{paddingHorizontal:space.lg,gap:space.md}}>
    <MotionView>
     <ImageBackground source={require('../../assets/work/craft.jpg')} accessibilityLabel={t('photoCraftAlt')} resizeMode="cover" style={s.hero} imageStyle={{borderRadius:radius.xl}}>
      <LinearGradient colors={['rgba(11,12,12,0)','rgba(11,12,12,0.78)']} style={[StyleSheet.absoluteFill,{borderRadius:radius.xl}]}/>
      <View style={{gap:6}}>
       <Text accessibilityRole="header" style={[s.heroTitle,hi?{fontFamily:fonts.bold,fontSize:26,lineHeight:36}:null]}>{t('heroHeadline')}</Text>
       <View style={{flexDirection:'row',alignItems:'center',gap:6}}><Ionicons name="location" size={14} color={colors.sun}/><Text style={s.heroMeta}>{t('cityName')+' · '+t('workersFree')}</Text></View>
      </View>
     </ImageBackground>
    </MotionView>
    <View style={{flexDirection:'row',gap:space.md}}>
     <ActionTile icon="briefcase" title={t('browseJobs')} text={t('heroWorkCopy')} bg={colors.trust} onPress={()=>router.navigate('/browse/jobs')}/>
     <ActionTile icon="people" title={t('browseWorkers')} text={t('heroHireCopy')} bg={colors.care} onPress={()=>router.navigate('/browse/workers')}/>
    </View>
   </View>

   <View style={{paddingHorizontal:space.lg}}>
    <Section title={t('popularServices')} action={catalog.items.length>SHOWN?t(all?'fewerServices':'seeAll'):undefined} onAction={()=>setAll(!all)}>
     <Segmented value={goal} onChange={setGoal} options={[{value:'workers',label:t('browseWorkers'),icon:'people-outline'},{value:'jobs',label:t('browseJobs'),icon:'briefcase-outline'}]}/>
     {catalog.error?<Banner kind="error" text={t('catalogUnavailable')} action={t('retry')} onAction={catalog.reload}/>:null}
     <View style={s.grid}>
      {catalog.loading&&!catalog.items.length?Array.from({length:SHOWN},(_,i)=><View key={i} style={{width:tile,alignItems:'center',gap:8}}><Skeleton width={56} height={56} radius={18}/><Skeleton width={tile*0.7} height={10}/></View>):
       services.map((item,i)=>{const tone=toneAt(i);return <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={hi?item.name_hi:item.name} onPress={()=>router.navigate({pathname:goal==='jobs'?'/browse/jobs':'/browse/workers',params:{service:item.id}})} style={({pressed})=>[{width:tile,alignItems:'center',gap:6,opacity:pressed?0.6:1}]}>
        <View style={[s.serviceIcon,{backgroundColor:tone.soft}]}><Ionicons name={(item.icon||'construct-outline') as any} size={26} color={tone.strong}/></View>
        <Text numberOfLines={2} style={s.serviceText}>{hi?item.name_hi:item.name}</Text>
       </Pressable>;})}
     </View>
    </Section>
   </View>

   <Rail title={t('latestJobs')} onAll={()=>router.navigate('/browse/jobs')} loading={jobs.items===null} error={jobs.error} onRetry={()=>jobs.load()} empty={t('noOpenJobsShort')}>
    {jobs.items?.slice(0,6).map((job,i)=><JobCard key={job.id} compact job={job} index={i} onPress={()=>router.push({pathname:'/(public)/job/[id]',params:{id:job.id}})}/>)}
   </Rail>
   <Rail title={t('listedWorkers')} onAll={()=>router.navigate('/browse/workers')} loading={workers.items===null} error={workers.error} onRetry={()=>workers.load()} empty={t('noListedWorkersShort')}>
    {workers.items?.slice(0,8).map((w,i)=><WorkerCard key={w.id} compact worker={w} index={i} onPress={()=>router.push({pathname:'/(public)/worker/[id]',params:{id:w.id}})}/>)}
   </Rail>

   <View style={{paddingHorizontal:space.lg,gap:space.md}}>
    <Text accessibilityRole="header" style={type.title}>{t('howItWorks')}</Text>
    <ListGroup>
     {['how1','how2','how3'].map((k,i)=><ListRow key={k} icon={(['create-outline','hand-left-outline','shield-checkmark-outline'] as const)[i]} iconColor={toneAt(i).strong} iconBg={toneAt(i).soft} title={t(k)}/>)}
    </ListGroup>
    <Text style={[type.caption,{textAlign:'center'}]}>{t('photoDisclosureShort')}</Text>
   </View>
  </ScrollView>
 </View>;
}

function ActionTile({icon,title,text,bg,onPress}:{icon:any;title:string;text:string;bg:string;onPress:()=>void}){
 return <Pressable accessibilityRole="button" accessibilityLabel={title} onPress={onPress} style={({pressed})=>[s.action,{backgroundColor:bg,opacity:pressed?0.85:1}]}>
  <View style={s.actionIcon}><Ionicons name={icon} size={22} color={colors.white}/></View>
  <View style={{gap:2}}><Text style={s.actionTitle}>{title}</Text><Text numberOfLines={2} style={s.actionText}>{text}</Text></View>
  <Ionicons name="arrow-forward" size={18} color={colors.white} style={{position:'absolute',top:space.lg,right:space.lg}}/>
 </Pressable>;
}

function Rail({title,onAll,loading,error,onRetry,empty,children}:{title:string;onAll:()=>void;loading:boolean;error:string;onRetry:()=>void;empty:string;children:React.ReactNode}){
 const {t}=useSession();const count=Array.isArray(children)?children.length:children?1:0;
 return <View style={{gap:space.md}}>
  <View style={{paddingHorizontal:space.lg}}><Section title={title} action={t('seeAll')} onAction={onAll}/></View>
  {error?<View style={{paddingHorizontal:space.lg}}><Banner kind="error" text={t(error)} action={t('retry')} onAction={onRetry}/></View>:
   loading?<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:space.md,paddingHorizontal:space.lg}}>{[0,1].map(i=><View key={i} style={{width:236,gap:8,padding:space.lg,backgroundColor:colors.white,borderRadius:radius.lg}}><Skeleton width="70%"/><Skeleton width="50%" height={12}/><Skeleton width="40%" height={12}/></View>)}</ScrollView>:
   count===0?<View style={{paddingHorizontal:space.lg}}><View style={s.railEmpty}><Ionicons name="time-outline" size={20} color={colors.quiet}/><Text style={[type.footnote,{flex:1}]}>{empty}</Text></View></View>:
   <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{gap:space.md,paddingHorizontal:space.lg,paddingBottom:4}}>{children}</ScrollView>}
 </View>;
}

const s=StyleSheet.create({
 header:{flexDirection:'row',alignItems:'center',justifyContent:'space-between'},
 hero:{minHeight:190,borderRadius:radius.xl,justifyContent:'flex-end',padding:space.xl,overflow:'hidden',backgroundColor:colors.ink},
 heroTitle:{fontFamily:fonts.display,fontSize:30,lineHeight:36,color:colors.white,letterSpacing:0.2},
 heroMeta:{fontFamily:fonts.bodyBold,fontSize:13,color:'rgba(255,255,255,0.92)'},
 action:{flex:1,minHeight:124,borderRadius:radius.lg,padding:space.lg,justifyContent:'space-between',gap:space.md},
 actionIcon:{width:40,height:40,borderRadius:12,backgroundColor:'rgba(255,255,255,0.2)',alignItems:'center',justifyContent:'center'},
 actionTitle:{fontFamily:fonts.bold,fontSize:17,color:colors.white},
 actionText:{fontFamily:fonts.body,fontSize:13,lineHeight:18,color:'rgba(255,255,255,0.9)'},
 grid:{flexDirection:'row',flexWrap:'wrap',rowGap:space.lg,columnGap:space.sm},
 serviceIcon:{width:58,height:58,borderRadius:18,alignItems:'center',justifyContent:'center'},
 serviceText:{fontFamily:fonts.bodyBold,fontSize:12.5,lineHeight:16,color:colors.text,textAlign:'center'},
 railEmpty:{flexDirection:'row',alignItems:'center',gap:space.sm,padding:space.lg,borderRadius:radius.lg,backgroundColor:colors.white,borderWidth:StyleSheet.hairlineWidth,borderColor:colors.line}
});
