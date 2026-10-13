import {useState} from 'react';
import {Text,View} from 'react-native';
import {router,Redirect} from 'expo-router';
import {Avatar,Card,ErrorBox,ListGroup,ListRow,Screen,colors,space,type} from './ui';
import {useSession} from './session';
import {switchLanguage} from './LanguageToggle';
import {openWebPage} from './links';
import {errorCode} from './hooks';

// Account tab for both modes: profile header, mode switch, language, help pages, sign out and deletion.
export function AccountScreen(){
 const session=useSession();const {user,t,locale,logout}=session;const [error,setError]=useState('');
 if(!user)return <Redirect href="/"/>;
 const mode=user.preferences.last_active_mode||user.roles[0];
 const open=async(page:Parameters<typeof openWebPage>[0])=>setError(await openWebPage(page));
 return <Screen safeTop title={t('accountTab')}>
  <Card style={{flexDirection:'row',alignItems:'center',gap:space.md}}>
   <Avatar name={user.full_name} size={56}/>
   <View style={{flex:1,gap:2}}><Text style={type.title}>{user.full_name}</Text><Text style={type.footnote}>{t(mode==='WORKER'?'workerMode':'hirerMode')}</Text></View>
  </Card>
  <ListGroup title={t('modeTitle')}>
   <ListRow icon="swap-horizontal-outline" title={t('switchMode')} subtitle={t('switchLater')} onPress={()=>router.push('/shared/purpose')}/>
   <ListRow icon="compass-outline" title={t('browseMarketplace')} onPress={()=>router.push('/browse')}/>
  </ListGroup>
  <ListGroup title={t('preferences')}>
   <ListRow icon="language-outline" title={t('language')} value={locale==='hi'?'हिन्दी':'English'} onPress={()=>switchLanguage(session).catch(e=>setError(errorCode(e)))}/>
  </ListGroup>
  <ListGroup title={t('helpAndLegal')}>
   <ListRow icon="help-buoy-outline" title={t('getSupport')} onPress={()=>open('support')}/>
   <ListRow icon="lock-closed-outline" title={t('privacyPolicy')} onPress={()=>open('privacy')}/>
   <ListRow icon="document-text-outline" title={t('termsOfUse')} onPress={()=>open('terms')}/>
   <ListRow icon="construct-outline" title={t('workerPolicy')} onPress={()=>open('workerPolicy')}/>
  </ListGroup>
  <ErrorBox code={error}/>
  <ListGroup>
   <ListRow icon="log-out-outline" iconColor={colors.text} iconBg={colors.raised} title={t('signOut')} onPress={async()=>{await logout();router.replace('/');}}/>
   <ListRow destructive icon="trash-outline" title={t('deleteAccount')} onPress={()=>router.push('/shared/delete-account')}/>
  </ListGroup>
 </Screen>;
}
