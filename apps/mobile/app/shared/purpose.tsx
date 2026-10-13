import {useState} from 'react';
import {Pressable,Text,View} from 'react-native';
import {router,Redirect} from 'expo-router';
import {Ionicons} from '@expo/vector-icons';
import {ErrorBox,IconTile,Screen,colors,radius,space,type} from '../../src/ui';
import {useSession,homeFor} from '../../src/session';
import {api} from '../../src/api';
import {errorCode} from '../../src/hooks';

export default function Purpose(){
 const {user,t,reload,locale}=useSession();const [error,setError]=useState(''),[busy,setBusy]=useState('');if(!user)return <Redirect href="/"/>;
 async function choose(role:string){setBusy(role);try{await api('/me/roles','POST',{role});await api('/me/preferences','PUT',{last_active_mode:role,locale});router.replace(homeFor(await reload()) as any);}catch(e){setError(errorCode(e));}finally{setBusy('');}}
 const option=(role:string,icon:any,tone:number,title:string,copy:string)=><Pressable key={role} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{busy:busy===role}} disabled={!!busy} onPress={()=>choose(role)} style={({pressed})=>({flexDirection:'row',alignItems:'center',gap:space.lg,padding:space.xl,borderRadius:radius.lg,backgroundColor:colors.white,borderWidth:1.5,borderColor:pressed||busy===role?colors.trust:colors.line})}>
  <IconTile icon={icon} tone={tone} size={56}/><View style={{flex:1,gap:4}}><Text style={type.title}>{title}</Text><Text style={type.footnote}>{copy}</Text></View><Ionicons name="chevron-forward" size={20} color={colors.quiet}/>
 </Pressable>;
 return <Screen>
  <View style={{gap:space.xs,paddingTop:space.sm}}><Text accessibilityRole="header" style={type.largeTitle}>{t('purpose')}</Text><Text style={type.callout}>{t('switchLater')}</Text></View>
  {option('CLIENT','briefcase-outline',0,t('hireStaff'),t('hireCopy'))}
  {option('WORKER','hammer-outline',1,t('findWork'),t('workCopy'))}
  <ErrorBox code={error}/>
 </Screen>;
}
