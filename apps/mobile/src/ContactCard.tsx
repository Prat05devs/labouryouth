import {useCallback,useState} from 'react';import {Linking,Text,View} from 'react-native';import {useFocusEffect} from 'expo-router';import {Button,ErrorBox,IconTile,colors,radius,space,type} from './ui';import {useSession} from './session';import {api,ApiError} from './api';
// Hirer contact for a worker the hirer has selected; the API answers 404 until then (Decision 21).
export function ContactCard({jobId}:{jobId:string}){const {t}=useSession();const [c,setC]=useState<any>(null),[locked,setLocked]=useState(false),[failure,setFailure]=useState('');
 useFocusEffect(useCallback(()=>{api('/jobs/'+jobId+'/contact').then(r=>{setC(r);setLocked(false);}).catch(e=>{if(e instanceof ApiError&&e.code==='NOT_FOUND')setLocked(true);});},[jobId]));
 const open=async(url:string)=>{try{setFailure('');await Linking.openURL(url);}catch{setFailure('UNEXPECTED_ERROR');}};
 const box={gap:space.md,padding:space.lg,borderRadius:radius.md,backgroundColor:colors.raised};
 if(locked)return <View style={[box,{flexDirection:'row',alignItems:'center'}]}><IconTile icon="lock-closed-outline" size={34} tone={5}/><Text style={[type.footnote,{flex:1}]}>{t('contactLocked')}</Text></View>;
 if(!c)return null;
 return <View style={box}>
  <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}><IconTile icon="person-outline" size={38} tone={1}/><View style={{flex:1}}><Text style={type.headline}>{t('contactHirer')+(c.employer_first_name?': '+c.employer_first_name:'')}</Text>{c.whatsapp?<Text style={type.footnote}>{c.whatsapp}</Text>:null}{c.address_line||c.locality?<Text style={type.footnote}>{[c.address_line,c.locality].filter(Boolean).join(', ')}</Text>:null}</View></View>
  <View style={{flexDirection:'row',gap:space.sm}}>{c.whatsapp_url?<Button flex size="md" variant="success" icon="logo-whatsapp" label={t('chatOnWhatsApp')} onPress={()=>open(c.whatsapp_url)}/>:null}{c.call_url?<Button flex size="md" variant="secondary" icon="call-outline" label={t('callHirer')} onPress={()=>open(c.call_url)}/>:null}</View>
  {c.maps_url?<Button size="md" variant="secondary" icon="map-outline" label={t('openInMaps')} onPress={()=>open(c.maps_url)}/>:<Text style={type.footnote}>{t('askForMapsLink')}</Text>}
  <ErrorBox code={failure}/>
 </View>;}
