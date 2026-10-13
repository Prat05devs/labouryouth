import {useState} from 'react';
import {Image,Text,View} from 'react-native';
import {router} from 'expo-router';
import {Avatar,Button,Card,ErrorBox,ListGroup,ListRow,Screen,colors,space,type} from '../../src/ui';
import {homeFor,useSession} from '../../src/session';
import {switchLanguage} from '../../src/LanguageToggle';
import {openWebPage} from '../../src/links';
import {errorCode} from '../../src/hooks';

// Guest profile tab: sign-in entry, language and public information pages.
export default function GuestProfile(){
 const session=useSession();const {t,user,locale}=session;const [error,setError]=useState('');
 const open=async(page:Parameters<typeof openWebPage>[0])=>setError(await openWebPage(page));
 return <Screen safeTop title={t('profileTab')}>
  {user?<Card style={{flexDirection:'row',alignItems:'center',gap:space.md}}><Avatar name={user.full_name} size={52}/><View style={{flex:1}}><Text style={type.headline}>{user.full_name}</Text><Text style={type.footnote}>{t('signedIn')}</Text></View><Button size="sm" label={t('openDashboard')} onPress={()=>router.replace(homeFor(user) as any)}/></Card>:
   <Card style={{gap:space.lg}}>
    <View style={{flexDirection:'row',alignItems:'center',gap:space.md}}><View style={{width:52,height:52,borderRadius:26,backgroundColor:colors.trustSoft,alignItems:'center',justifyContent:'center'}}><Image source={require('../../assets/logo.png')} resizeMode="contain" tintColor={colors.trustInk} style={{width:34,height:26}}/></View><View style={{flex:1,gap:2}}><Text style={type.headline}>{t('loginOrSignUp')}</Text><Text style={type.footnote}>{t('signupAnytimeCopy')}</Text></View></View>
    <View style={{flexDirection:'row',gap:space.sm}}><Button flex label={t('login')} onPress={()=>router.push('/(public)/login')}/><Button flex variant="secondary" label={t('createAccount')} onPress={()=>router.push('/(public)/register')}/></View>
   </Card>}
  <ListGroup title={t('preferences')}>
   <ListRow icon="language-outline" title={t('language')} value={locale==='hi'?'हिन्दी':'English'} onPress={()=>switchLanguage(session).catch(e=>setError(errorCode(e)))}/>
  </ListGroup>
  <ListGroup title={t('helpAndLegal')}>
   <ListRow icon="information-circle-outline" title={t('aboutTitle')} onPress={()=>open('about')}/>
   <ListRow icon="help-buoy-outline" title={t('getSupport')} onPress={()=>open('support')}/>
   <ListRow icon="lock-closed-outline" title={t('privacyPolicy')} onPress={()=>open('privacy')}/>
   <ListRow icon="document-text-outline" title={t('termsOfUse')} onPress={()=>open('terms')}/>
   <ListRow icon="construct-outline" title={t('workerPolicy')} onPress={()=>open('workerPolicy')}/>
  </ListGroup>
  <ErrorBox code={error}/>
  <Text style={[type.caption,{textAlign:'center'}]}>{t('workersFree')+' · '+t('cityName')}</Text>
 </Screen>;
}
