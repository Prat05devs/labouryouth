import {useCallback,useState} from 'react';import {Linking,View} from 'react-native';import {useFocusEffect} from 'expo-router';import {Card,Copy,Button,ErrorBox} from './ui';import {useSession} from './session';import {api,ApiError} from './api';
// Hirer contact for a worker the hirer has selected; the API answers 404 until then (Decision 21).
export function ContactCard({jobId}:{jobId:string}){const {t}=useSession();const [c,setC]=useState<any>(null),[locked,setLocked]=useState(false),[failure,setFailure]=useState('');
 useFocusEffect(useCallback(()=>{api('/jobs/'+jobId+'/contact').then(r=>{setC(r);setLocked(false);}).catch(e=>{if(e instanceof ApiError&&e.code==='NOT_FOUND')setLocked(true);});},[jobId]));
 const open=async(url:string)=>{try{setFailure('');await Linking.openURL(url);}catch{setFailure('UNEXPECTED_ERROR');}};
 if(locked)return <Card><Copy>{t('contactLocked')}</Copy></Card>;
 if(!c)return null;
 return <Card><Copy strong>{t('contactHirer')+(c.employer_first_name?': '+c.employer_first_name:'')}</Copy>{(c.address_line||c.locality)&&<Copy>{[c.address_line,c.locality].filter(Boolean).join(', ')}</Copy>}<View style={{gap:10}}>{c.whatsapp_url&&<Button label={t('chatOnWhatsApp')} onPress={()=>open(c.whatsapp_url)}/>}{c.call_url&&<Button secondary label={t('callHirer')+' '+c.whatsapp} onPress={()=>open(c.call_url)}/>}{c.maps_url?<Button secondary label={t('openInMaps')} onPress={()=>open(c.maps_url)}/>:<Copy>{t('askForMapsLink')}</Copy>}</View><ErrorBox code={failure}/></Card>;}
