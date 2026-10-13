import {useCallback,useEffect,useState} from 'react';
import {Text,View} from 'react-native';
import {useFocusEffect,useLocalSearchParams} from 'expo-router';
import {Banner,Button,Card,Chip,ChipScroller,ChipWrap,EmptyState,ErrorBox,Field,IconTile,MetaLine,Screen,Segmented,Sheet,SkeletonCard,StatusPill,colors,fonts,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {api} from '../../src/api';
import {errorCode,useServices} from '../../src/hooks';
import {position} from '../../src/LocationForm';
import {dateTime,km,rupees} from '../../src/format';

const radii=[2,5,10,20];
export default function FindWork(){
 const {t,locale,user}=useSession();const hi=locale==='hi';const {mode}=useLocalSearchParams<{mode?:string}>();const catalog=useServices();
 const [radius,setRadius]=useState(10),[service,setService]=useState(''),[wage,setWage]=useState(''),[permanent,setPermanent]=useState(mode==='permanent'),[items,setItems]=useState<any[]|null>(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const [sheet,setSheet]=useState(false),[draftRadius,setDraftRadius]=useState(10),[draftWage,setDraftWage]=useState('');
 const active=user?.worker_profile?.worker_status==='ACTIVE';
 useEffect(()=>{if(mode)setPermanent(mode==='permanent');},[mode]);
 const load=useCallback(async(pull=false)=>{setError('');if(pull)setRefreshing(true);try{const q=new URLSearchParams({radius_km:String(radius)});if(service)q.set('service_id',service);if(!permanent)q.set('today','true');q.set('engagement',permanent?'PERMANENT':'DAILY');if(wage&&Number(wage)>0)q.set('min_wage_paise',String(Math.round(Number(wage)*100)));try{const p=await position();q.set('latitude',String(p.coords.latitude));q.set('longitude',String(p.coords.longitude));}catch{}setItems((await api('/worker/jobs/nearby?'+q.toString())).items);}catch(e){setError(errorCode(e));setItems([]);}finally{setRefreshing(false);}},[radius,service,wage,permanent]);
 useFocusEffect(useCallback(()=>{load();},[load]));
 async function toggle(j:any){setError('');try{await api('/jobs/'+j.id+(j.my_interest==='EXPRESSED'?'/interest/withdraw':'/interest'),'POST',{});await load();}catch(e){setError(errorCode(e));}}
 const openFilters=()=>{setDraftRadius(radius);setDraftWage(wage);setSheet(true);};
 const summary=radius+' km'+(wage&&Number(wage)>0?' · ₹'+wage+'+':'');
 return <Screen safeTop title={t('findWorkTab')} subtitle={t('nearbyJobs')} onRefresh={()=>load(true)} refreshing={refreshing} gap={space.md}>
  <Segmented value={permanent?'permanent':'today'} onChange={v=>{setItems(null);setPermanent(v==='permanent');}} options={[{value:'today',label:t('todayWork'),icon:'flash-outline'},{value:'permanent',label:t('permanentJobs'),icon:'calendar-outline'}]}/>
  <ChipScroller>
   <Chip icon="options-outline" label={summary} selected onPress={openFilters}/>
   <Chip label={t('allSkills')} selected={!service} onPress={()=>setService('')}/>
   {catalog.items.map(s=><Chip key={s.id} label={hi?s.name_hi:s.name} selected={service===s.id} onPress={()=>setService(service===s.id?'':s.id)}/>)}
  </ChipScroller>
  {!active?<Banner kind="warn" text={t('underReviewCopy')}/>:null}
  <ErrorBox code={error} onRetry={()=>load()}/>
  {items===null?<SkeletonCard count={3}/>:null}
  {items&&items.length===0&&!error?<EmptyState icon="search-outline" title={t('nothingNearbyTitle')} text={t('noNearbyJobs')} action={radius<20?t('widenSearch'):undefined} onAction={()=>setRadius(20)}/>:null}
  {items?.map((j,i)=><Card key={j.id} style={{gap:space.md}}>
   <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
    <IconTile icon={catalog.items.find(s=>s.id===j.service_id)?.icon||'briefcase-outline'} tone={i}/>
    <View style={{flex:1,gap:2}}><Text numberOfLines={1} style={type.headline}>{hi?j.service_name_hi:j.service_name}</Text><Text numberOfLines={1} style={type.footnote}>{j.employer_first_name+' · '+(j.employer_trust.average!==null?'★ '+j.employer_trust.average+' ('+j.employer_trust.reviews+')':t('noReviewsYet'))}</Text></View>
    <View style={{alignItems:'flex-end'}}><Text style={{fontFamily:fonts.bold,fontSize:18,color:colors.ink}}>{rupees(j.budget_max)}</Text><Text style={type.caption}>{t('perDay')}</Text></View>
   </View>
   <View style={{flexDirection:'row',flexWrap:'wrap',columnGap:space.lg,rowGap:space.xs}}>
    <MetaLine icon="navigate-outline" text={j.approximate?t('approxArea'):km(j.distance_m)+' '+t('away')}/>
    {j.locality?<MetaLine icon="location-outline" text={j.locality}/>:null}
    <MetaLine icon="time-outline" text={dateTime(j.start_at,locale)}/>
    <MetaLine icon="people-outline" text={j.slots_left+' '+t('slotsLeft')}/>
   </View>
   {j.notes?<Text numberOfLines={2} style={type.callout}>{j.notes}</Text>:null}
   {j.my_interest==='SELECTED'?<StatusPill status="interestSelected"/>:<View style={{gap:space.xs}}>
    <Button size="md" icon={j.my_interest==='EXPRESSED'?'close-circle-outline':'hand-left-outline'} variant={j.my_interest==='EXPRESSED'?'secondary':'primary'} label={t(j.my_interest==='EXPRESSED'?'withdrawInterest':'iAmAvailable')} disabled={!active} onPress={()=>toggle(j)}/>
    {j.my_interest==='EXPRESSED'?<Text style={[type.footnote,{color:colors.careInk,textAlign:'center'}]}>{t('interestSent')}</Text>:null}
   </View>}
  </Card>)}
  {active&&items?.length?<Text style={[type.footnote,{textAlign:'center'}]}>{t('jobsNeedOnline')}</Text>:null}
  <Sheet visible={sheet} onClose={()=>setSheet(false)} title={t('filters')} footer={<Button label={t('showResults')} onPress={()=>{setRadius(draftRadius);setWage(draftWage);setSheet(false);}}/>}>
   <View style={{gap:space.sm}}><Text style={type.overline}>{t('distance')}</Text><ChipWrap>{radii.map(r=><Chip key={r} label={r+' km'} selected={r===draftRadius} onPress={()=>setDraftRadius(r)}/>)}</ChipWrap></View>
   <Field label={t('minWage')} prefix="₹" keyboardType="number-pad" value={draftWage} onChangeText={setDraftWage}/>
  </Sheet>
 </Screen>;
}
