import {useState,useEffect} from 'react';
import {Platform,Pressable,Text,View} from 'react-native';
import {router,Redirect} from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import {Ionicons} from '@expo/vector-icons';
import {Button,ErrorBox,Field,IconTile,ListGroup,ListRow,OptionRow,Screen,SkeletonCard,StepProgress,colors,radius,space,type} from '../../src/ui';
import {useSession,homeFor} from '../../src/session';
import {api} from '../../src/api';
import {errorCode,useResource} from '../../src/hooks';
import {routeAfterSetup} from '../../src/authIntent';

const steps=['basic','photo','services','experience','languages','locations','availability','identity','police','payout'];
const icons:Record<string,any>={basic:'person-outline',photo:'camera-outline',services:'construct-outline',experience:'ribbon-outline',languages:'language-outline',locations:'location-outline',availability:'time-outline',identity:'card-outline',police:'shield-checkmark-outline',payout:'wallet-outline'};
export default function Setup(){
 const {user,t,reload,locale}=useSession();const {data:profile,reload:load}=useResource('/worker/profile');const {data:catalog}=useResource('/services');const {data:locations}=useResource('/locations');
 const [index,setIndex]=useState(0),[text,setText]=useState(''),[selected,setSelected]=useState<string[]>([]),[doc,setDoc]=useState(''),[error,setError]=useState(''),[ready,setReady]=useState(false);const step=steps[index];const review=index>=steps.length;
 useEffect(()=>{if(profile&&!ready){const i=steps.findIndex(s=>!(s in profile.progress));setIndex(i<0?steps.length:i);setReady(true);}},[profile,ready]);
 useEffect(()=>{setText(step==='basic'?user?.full_name||'':String(profile?.progress?.[step]?.years??''));setSelected(step==='services'?profile?.progress?.services?.service_ids||[]:step==='languages'?profile?.progress?.languages?.codes||[]:profile?.progress?.locations?.service_area_ids||[]);setDoc(profile?.progress?.[step]?.document_id||'');setError('');},[step]);
 if(!user)return <Redirect href="/"/>;
 const toggle=(id:string)=>setSelected(selected.includes(id)?selected.filter(x=>x!==id):[...selected,id]);
 async function upload(){try{const file=await DocumentPicker.getDocumentAsync({type:step==='photo'?['image/jpeg','image/png']:['image/jpeg','image/png','application/pdf'],copyToCacheDirectory:true});if(file.canceled)return;const asset=file.assets[0];const form=new FormData();form.append('purpose',step.toUpperCase());if(Platform.OS==='web'){form.append('file',await (await fetch(asset.uri)).blob(),asset.name);}else form.append('file',{uri:asset.uri,name:asset.name,type:asset.mimeType} as any);const d=await api('/documents','POST',form);setDoc(d.id);if(step!=='photo')await api('/worker/verifications','POST',{type:step.toUpperCase(),document_id:d.id});}catch(e){setError(errorCode(e));}}
 async function save(){setError('');try{let data:any={};if(step==='basic')data={full_name:text};if(step==='photo')data={document_id:doc};if(step==='services')data={service_ids:selected};if(step==='experience')data={years:Number(text)};if(step==='languages')data={codes:selected};if(step==='locations')data={service_area_ids:selected};if(step==='availability')await api('/worker/availability','PUT',{online:false,service_area_id:profile.progress.locations.service_area_ids[0],radius_m:15000});await api('/worker/onboarding/'+step,'PUT',{data});await load();setIndex(index+1);}catch(e){setError(errorCode(e));}}
 async function submit(){try{await api('/worker/onboarding/submit','POST');const fallback=homeFor(await reload());router.replace(await routeAfterSetup(fallback) as any);}catch(e){setError(errorCode(e));}}
 const footer=!ready?undefined:<View style={{flexDirection:'row',gap:space.sm}}>
  {index>0?<Button flex variant="secondary" icon="chevron-back" label={t('back')} onPress={()=>setIndex(review?steps.length-1:index-1)}/>:null}
  <View style={{flex:2}}>{review?<Button label={t('submitProfile')} icon="paper-plane-outline" onPress={submit}/>:<Button label={t('save')} onPress={save}/>}</View>
 </View>;
 return <Screen footer={footer}>
  {!ready?<SkeletonCard count={2}/>:review?<>
   <StepProgress step={steps.length} total={steps.length}/>
   <View style={{gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('reviewProfile')}</Text><Text style={type.callout}>{t('savedProgress')}</Text></View>
   <ListGroup>{steps.map((s,i)=><ListRow key={s} icon={icons[s]} title={t(s)} onPress={()=>setIndex(i)} right={<Ionicons name={profile?.progress&&s in profile.progress?'checkmark-circle':'ellipse-outline'} size={22} color={profile?.progress&&s in profile.progress?colors.care:colors.quiet}/>}/>)}</ListGroup>
  </>:<>
   <StepProgress step={index+1} total={steps.length} label={t('savedShort')}/>
   <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}><IconTile icon={icons[step]} size={52}/><View style={{flex:1}}><Text accessibilityRole="header" style={type.largeTitle}>{t(step)}</Text></View></View>
   <Text style={type.callout}>{t(step+'Help')}</Text>
   {step==='basic'?<Field label={t('full_name')} icon="person-outline" value={text} onChangeText={setText} autoComplete="name"/>:null}
   {step==='experience'?<Field label={t('years')} icon="ribbon-outline" keyboardType="number-pad" value={text} onChangeText={setText} maxLength={2}/>:null}
   {['photo','identity','police'].includes(step)?<Pressable accessibilityRole="button" accessibilityLabel={t('chooseFile')} onPress={upload} style={({pressed})=>({alignItems:'center',gap:space.sm,padding:space.xxl,borderRadius:radius.lg,borderWidth:1.5,borderStyle:'dashed',borderColor:doc?colors.care:colors.trustMid,backgroundColor:doc?colors.careSoft:colors.white,opacity:pressed?0.7:1})}>
    <Ionicons name={doc?'checkmark-circle':step==='photo'?'camera-outline':'cloud-upload-outline'} size={36} color={doc?colors.care:colors.trust}/>
    <Text style={[type.headline,{textAlign:'center'}]}>{t(doc?'fileReady':'chooseFile')}</Text>
    <Text style={[type.footnote,{textAlign:'center'}]}>{t(doc?'tapToReplace':step==='photo'?'photoTypes':'documentTypes')}</Text>
   </Pressable>:null}
   {step==='services'?<View style={{gap:space.sm}}>{catalog?.items.map((s:any)=><OptionRow key={s.id} multi icon={s.icon||'construct-outline'} label={locale==='hi'?s.name_hi:s.name} selected={selected.includes(s.id)} onPress={()=>toggle(s.id)}/>)}</View>:null}
   {step==='languages'?<View style={{gap:space.sm}}>{['hi','en'].map(s=><OptionRow key={s} multi label={s==='hi'?'हिन्दी':'English'} selected={selected.includes(s)} onPress={()=>toggle(s)}/>)}</View>:null}
   {step==='locations'?<View style={{gap:space.sm}}>{locations?.service_areas.map((s:any)=><OptionRow key={s.id} multi icon="location-outline" label={s.name} selected={selected.includes(s.id)} onPress={()=>toggle(s.id)}/>)}</View>:null}
  </>}
  <ErrorBox code={error}/>
 </Screen>;
}
