import {useState} from 'react';
import {Text,View} from 'react-native';
import {router} from 'expo-router';
import {Button,ErrorBox,Field,Screen,TextLink,space,type} from '../../src/ui';
import {api,saveTokens,ApiError} from '../../src/api';
import {useSession} from '../../src/session';
import {errorCode} from '../../src/hooks';
import {routeAfterAuth} from '../../src/authIntent';

type Key='full_name'|'email'|'phone_number'|'password'|'confirm_password';
const MIN_PASSWORD=12;
// Mirrors the API's Register schema so common mistakes are caught before a round trip; the server stays authoritative.
function check(f:Record<Key,string>):Partial<Record<Key,true>>{const e:Partial<Record<Key,true>>={};
 if(f.full_name.trim().length<2)e.full_name=true;
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim()))e.email=true;
 if(f.phone_number.replace(/\D/g,'').length<10)e.phone_number=true;
 if(f.password.length<MIN_PASSWORD)e.password=true;
 else if(f.password!==f.confirm_password)e.confirm_password=true;
 return e;}
const icons:Record<Key,any>={full_name:'person-outline',email:'mail-outline',phone_number:'call-outline',password:'lock-closed-outline',confirm_password:'lock-closed-outline'};
export default function Register(){
 const {t,reload,locale}=useSession();const [form,set]=useState<Record<Key,string>>({full_name:'',email:'',phone_number:'',password:'',confirm_password:''}),[bad,setBad]=useState<Partial<Record<Key,true>>>({}),[error,setError]=useState('');
 const submit=async()=>{setError('');const local=check(form);setBad(local);if(Object.keys(local).length)return;
  try{await saveTokens(await api('/auth/register','POST',{...form,email:form.email.trim()}));const user=await reload();router.replace((await routeAfterAuth(user,reload,locale))||'/shared/purpose' as any);}
  catch(e){const fields=e instanceof ApiError?(e.details.fields as {path:string}[]|undefined):undefined;const server:Partial<Record<Key,true>>={};fields?.forEach(x=>{const k=x.path.split('.').pop() as Key;if(k in form)server[k]=true;});setBad(server);setError(Object.keys(server).length?'':errorCode(e));}};
 const field=(k:Key)=><Field key={k} label={t(k)} icon={icons[k]} prefix={k==='phone_number'?'+91':undefined} value={form[k]} error={bad[k]?t('err_'+k):undefined}
  hint={k==='password'?Math.min(form.password.length,MIN_PASSWORD)+' '+t('charsOf12'):undefined}
  onChangeText={v=>{set({...form,[k]:v});if(bad[k])setBad({...bad,[k]:undefined});}} secureTextEntry={k.includes('password')} autoCapitalize={k==='full_name'?'words':'none'}
  keyboardType={k==='email'?'email-address':k==='phone_number'?'phone-pad':'default'} autoComplete={k==='email'?'email':k==='phone_number'?'tel':k.includes('password')?'new-password':'name'}/>;
 return <Screen footer={<Button label={t('createAccount')} onPress={submit}/>}>
  <View style={{gap:space.xs}}><Text accessibilityRole="header" style={type.largeTitle}>{t('createAccountTitle')}</Text><Text style={type.callout}>{t('registerCopy')}</Text></View>
  {(['full_name','email','phone_number','password','confirm_password'] as Key[]).map(field)}
  <ErrorBox code={error}/>
  <View style={{flexDirection:'row',justifyContent:'center',alignItems:'center',gap:6,flexWrap:'wrap'}}><Text style={type.callout}>{t('haveAccount')}</Text><TextLink label={t('login')} onPress={()=>router.replace('/(public)/login')}/></View>
 </Screen>;
}
