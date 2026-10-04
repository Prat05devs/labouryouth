import {useState} from 'react';import {router} from 'expo-router';import {Screen,Field,Button,ErrorBox} from '../../src/ui';import {api,saveTokens,ApiError} from '../../src/api';import {useSession} from '../../src/session';import {errorCode} from '../../src/hooks';
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
export default function Register(){const {t,reload}=useSession();const [form,set]=useState<Record<Key,string>>({full_name:'',email:'',phone_number:'',password:'',confirm_password:''}),[bad,setBad]=useState<Partial<Record<Key,true>>>({}),[error,setError]=useState('');
 const submit=async()=>{setError('');const local=check(form);setBad(local);if(Object.keys(local).length)return;
  try{await saveTokens(await api('/auth/register','POST',{...form,email:form.email.trim()}));await reload();router.replace('/shared/purpose');}
  catch(e){const fields=e instanceof ApiError?(e.details.fields as {path:string}[]|undefined):undefined;const server:Partial<Record<Key,true>>={};fields?.forEach(x=>{const k=x.path.split('.').pop() as Key;if(k in form)server[k]=true;});setBad(server);setError(Object.keys(server).length?'':errorCode(e));}};
 const field=(k:Key)=><Field key={k} label={t(k)} value={form[k]} error={bad[k]?t('err_'+k):undefined} hint={k==='password'?form.password.length+' '+t('charsOf12'):undefined} onChangeText={v=>{set({...form,[k]:v});if(bad[k])setBad({...bad,[k]:undefined});}} secureTextEntry={k.includes('password')} autoCapitalize={k==='full_name'?'words':'none'} keyboardType={k==='email'?'email-address':k==='phone_number'?'phone-pad':'default'} autoComplete={k==='email'?'email':k==='phone_number'?'tel':k.includes('password')?'new-password':'name'}/>;
 return <Screen title={t('createAccount')} subtitle={t('registerCopy')}>{(['full_name','email','phone_number','password','confirm_password'] as Key[]).map(field)}<ErrorBox code={error}/><Button label={t('createAccount')} onPress={submit}/></Screen>;
}
