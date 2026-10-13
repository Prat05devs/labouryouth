import {useState} from 'react';
import {Text,View} from 'react-native';
import {router,useLocalSearchParams} from 'expo-router';
import {Banner,Button,ErrorBox,Field,Screen,space,type} from '../../src/ui';
import {api} from '../../src/api';
import {useSession} from '../../src/session';
import {errorCode} from '../../src/hooks';

export default function Reset(){
 const {token}=useLocalSearchParams<{token?:string}>();const {t}=useSession();
 const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[confirm,setConfirm]=useState(''),[error,setError]=useState(''),[done,setDone]=useState(false);
 const submit=async()=>{setError('');try{await api(token?'/auth/reset-password':'/auth/forgot-password','POST',token?{token,password,confirm_password:confirm}:{email});setDone(true);}catch(e){setError(errorCode(e));}};
 return <Screen footer={done?<Button label={t('login')} onPress={()=>router.replace('/(public)/login')}/>:<Button label={t(token?'resetPassword':'sendReset')} onPress={submit}/>}>
  <View style={{gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('resetPassword')}</Text><Text style={type.callout}>{t('resetCopy')}</Text></View>
  {done?<Banner kind="success" text={t(token?'resetDone':'resetSent')}/>:token?<>
   <Field label={t('password')} icon="lock-closed-outline" secureTextEntry autoComplete="new-password" value={password} onChangeText={setPassword}/>
   <Field label={t('confirm_password')} icon="lock-closed-outline" secureTextEntry autoComplete="new-password" value={confirm} onChangeText={setConfirm}/>
  </>:<Field label={t('email')} icon="mail-outline" autoCapitalize="none" keyboardType="email-address" autoComplete="email" value={email} onChangeText={setEmail}/>}
  <ErrorBox code={error}/>
 </Screen>;
}
