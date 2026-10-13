import {useState} from 'react';
import {Text,View} from 'react-native';
import {router,Redirect} from 'expo-router';
import {Button,ErrorBox,Field,Screen,space,type} from '../../src/ui';
import {LocationForm,emptyAddress} from '../../src/LocationForm';
import {useSession,homeFor} from '../../src/session';
import {api} from '../../src/api';
import {errorCode} from '../../src/hooks';
import {routeAfterSetup} from '../../src/authIntent';

export default function Setup(){
 const {user,t,reload}=useSession();const [name,setName]=useState(user?.full_name||''),[whatsapp,setWhatsapp]=useState(((user as any)?.phone_number||'').replace(/^\+91/,'')),[address,setAddress]=useState(emptyAddress),[error,setError]=useState(''),[bad,setBad]=useState<Record<string,string>>({});
 if(!user)return <Redirect href="/"/>;
 const save=async()=>{setError('');if(whatsapp.replace(/\D/g,'').length<10){setBad({whatsapp:t('err_whatsapp')});return;}
  try{const a=await api('/addresses','POST',{...address,maps_url:address.maps_url.trim()||null});await api('/client/profile','PUT',{full_name:name,client_type:'INDIVIDUAL',primary_address_id:a.id,whatsapp_number:whatsapp});const fallback=homeFor(await reload());router.replace(await routeAfterSetup(fallback) as any);}
  catch(e){const code=errorCode(e);if(code==='MAPS_LINK_INVALID')setBad({maps_url:t('MAPS_LINK_INVALID')});else setError(code);}};
 return <Screen footer={<Button label={t('save')} onPress={save}/>}>
  <View style={{gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('clientSetup')}</Text><Text style={type.callout}>{t('clientSetupCopy')}</Text></View>
  <Text style={type.overline}>{t('aboutYou')}</Text>
  <Field label={t('full_name')} icon="person-outline" value={name} onChangeText={setName} autoComplete="name"/>
  <Field label={t('whatsappNumber')} icon="logo-whatsapp" prefix="+91" value={whatsapp} onChangeText={v=>{setWhatsapp(v);setBad({...bad,whatsapp:''});}} keyboardType="phone-pad" autoComplete="tel" hint={t('whatsappHelp')} error={bad.whatsapp}/>
  <Text style={[type.overline,{marginTop:space.sm}]}>{t('yourAddress')}</Text>
  <LocationForm value={address} onChange={v=>{setAddress(v);setBad({});}} errors={bad}/>
  <ErrorBox code={error}/>
 </Screen>;
}
