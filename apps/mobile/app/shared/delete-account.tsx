import {useState} from 'react';
import {Alert,Text,View} from 'react-native';
import {router,Redirect} from 'expo-router';
import {Banner,Button,ErrorBox,Field,Screen,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {api,clearTokens} from '../../src/api';
import {errorCode} from '../../src/hooks';

export default function DeleteAccount(){
 const {user,t,setUser}=useSession();const [password,setPassword]=useState(''),[error,setError]=useState('');
 if(!user)return <Redirect href="/"/>;
 const confirm=()=>Alert.alert(t('deleteAccount'),t('deleteExplanation'),[{text:t('cancel'),style:'cancel'},{text:t('confirmDeletion'),style:'destructive',onPress:async()=>{try{await api('/me/deletion-request','POST',{password,confirm:true});await clearTokens();setUser(null);router.replace('/');}catch(e){setError(errorCode(e));}}}]);
 return <Screen footer={<Button variant="danger" icon="trash-outline" label={t('confirmDeletion')} disabled={!password} onPress={confirm}/>}>
  <View style={{gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('deleteAccount')}</Text></View>
  <Banner kind="warn" text={t('deleteExplanation')}/>
  <Field label={t('password')} icon="lock-closed-outline" secureTextEntry autoComplete="current-password" value={password} onChangeText={setPassword} hint={t('deletePasswordHint')}/>
  <ErrorBox code={error}/>
 </Screen>;
}
