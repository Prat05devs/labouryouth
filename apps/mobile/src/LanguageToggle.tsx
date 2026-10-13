import {Pressable,Text} from 'react-native';
import {api} from './api';
import {useSession} from './session';
import {colors,fonts} from './ui';

// Switches English and Hindi. Signed-in users also save the choice to their account preferences.
export async function switchLanguage(session:ReturnType<typeof useSession>){
 const {user,locale,setLocale,reload}=session;const next=locale==='en'?'hi':'en';setLocale(next);
 if(user){await api('/me/preferences','PUT',{last_active_mode:user.preferences.last_active_mode||user.roles[0],locale:next});await reload();}
}
export function LanguageToggle(){
 const session=useSession();const hi=session.locale==='hi';
 return <Pressable accessibilityRole="button" accessibilityLabel={hi?'English':'हिन्दी'} hitSlop={4} onPress={()=>{switchLanguage(session).catch(()=>{});}} style={({pressed})=>({minHeight:36,minWidth:48,paddingHorizontal:12,borderRadius:18,borderWidth:1,borderColor:colors.line,backgroundColor:colors.white,alignItems:'center',justifyContent:'center',opacity:pressed?0.6:1})}>
  <Text style={{fontFamily:fonts.bodyBold,fontSize:14,color:colors.ink}}>{hi?'EN':'हिं'}</Text>
 </Pressable>;
}
