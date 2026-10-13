import {useState} from 'react';
import {Text,View} from 'react-native';
import {router} from 'expo-router';
import {Button,ErrorBox,Field,Screen,TextLink,space,type} from '../../src/ui';
import {api,saveTokens} from '../../src/api';
import {useSession,homeFor} from '../../src/session';
import {errorCode} from '../../src/hooks';
import {routeAfterAuth} from '../../src/authIntent';
import {LanguageToggle} from '../../src/LanguageToggle';

export default function Login(){
 const {t,reload,locale}=useSession();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState('');
 const submit=async()=>{setError('');try{await saveTokens(await api('/auth/login','POST',{email:email.trim(),password}));const user=await reload();router.replace((await routeAfterAuth(user,reload,locale))||homeFor(user) as any);}catch(e){setError(errorCode(e));}};
 return <Screen footer={<Button label={t('signIn')} disabled={!email.trim()||!password} onPress={submit}/>}>
  <View style={{flexDirection:'row',alignItems:'flex-start',gap:space.md}}>
   <View style={{flex:1,gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('welcomeBackTitle')}</Text><Text style={type.callout}>{t('loginAnytimeCopy')}</Text></View>
   <LanguageToggle/>
  </View>
  <Field label={t('email')} icon="mail-outline" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" returnKeyType="next"/>
  <Field label={t('password')} icon="lock-closed-outline" value={password} onChangeText={setPassword} secureTextEntry autoComplete="current-password" textContentType="password" returnKeyType="go" onSubmitEditing={submit}/>
  <View style={{alignItems:'flex-end',marginTop:-space.sm}}><TextLink label={t('forgotPassword')} onPress={()=>router.push('/(public)/reset')}/></View>
  <ErrorBox code={error}/>
  <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6,flexWrap:'wrap'}}><Text style={type.callout}>{t('newHere')}</Text><TextLink label={t('createAccount')} onPress={()=>router.replace('/(public)/register')}/></View>
 </Screen>;
}
