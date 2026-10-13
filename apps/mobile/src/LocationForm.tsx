import {useState} from 'react';import * as Location from 'expo-location';import {Linking,View} from 'react-native';import {Field,Button,ErrorBox,Segmented,space} from './ui';import {useSession} from './session';import {useResource} from './hooks';
// GPS stays for worker check-in and going online (Decision 10); hirers share a Google Maps link instead (Decision 21).
export async function position(){const p=await Location.requestForegroundPermissionsAsync();if(p.status!=='granted')throw new Error('permissionDenied');return Location.getCurrentPositionAsync({accuracy:Location.Accuracy.High});}
export const emptyAddress={label:'',line1:'',locality:'',state:'',postal_code:'',city_id:'',maps_url:''};
export const MAPS_HOME='https://www.google.com/maps';
export function MapsLinkField({value,onChange,error}:{value:string;onChange:(v:string)=>void;error?:string}){const {t}=useSession();const [failure,setFailure]=useState('');
 return <View style={{gap:space.sm}}><Field label={t('mapsLink')} icon="map-outline" value={value} onChangeText={onChange} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://maps.app.goo.gl/..." hint={t('mapsLinkHelp')} error={error}/><Button variant="ghost" size="md" icon="open-outline" label={t('openGoogleMaps')} onPress={async()=>{try{await Linking.openURL(MAPS_HOME);}catch{setFailure('UNEXPECTED_ERROR');}}}/><ErrorBox code={failure}/></View>;}
export function LocationForm({value,onChange,errors={}}:{value:typeof emptyAddress;onChange:(v:typeof emptyAddress)=>void;errors?:Record<string,string>}){const {t}=useSession();const {data}=useResource('/locations');
 const cities=data?.cities||[];
 return <View style={{gap:space.lg}}>
  {cities.length>0?<Segmented options={cities.map((c:any)=>({value:c.id,label:c.name}))} value={value.city_id} onChange={id=>{const c=cities.find((x:any)=>x.id===id);onChange({...value,city_id:id,state:c?.state||value.state});}}/>:null}
  <Field label={t('addressLabel')} icon="bookmark-outline" placeholder={t('addressLabelHint')} value={value.label} error={errors.label} onChangeText={v=>onChange({...value,label:v})}/>
  <Field label={t('addressLine')} icon="home-outline" value={value.line1} error={errors.line1} onChangeText={v=>onChange({...value,line1:v})}/>
  <View style={{flexDirection:'row',gap:space.md}}>
   <View style={{flex:1}}><Field label={t('locality')} value={value.locality} error={errors.locality} onChangeText={v=>onChange({...value,locality:v})}/></View>
   <View style={{flex:1}}><Field label={t('postalCode')} value={value.postal_code} error={errors.postal_code} keyboardType="number-pad" maxLength={6} onChangeText={v=>onChange({...value,postal_code:v})}/></View>
  </View>
  <Field label={t('state')} value={value.state} error={errors.state} onChangeText={v=>onChange({...value,state:v})}/>
  <MapsLinkField value={value.maps_url} error={errors.maps_url} onChange={v=>onChange({...value,maps_url:v})}/>
 </View>;}
