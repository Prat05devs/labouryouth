import {Redirect,router} from 'expo-router';
import {ActivityIndicator,Image,View} from 'react-native';
import {useSafeAreaInsets} from 'react-native-safe-area-context';
import {useSession,homeFor} from '../src/session';
import {Button,EmptyState,colors,space} from '../src/ui';

// Launch gate: a branded loading state, then the role home or the guest browse tabs.
export default function Index(){
 const {user,loading,error,bootstrap,t}=useSession();const insets=useSafeAreaInsets();
 if(loading)return <View style={{flex:1,alignItems:'center',justifyContent:'center',gap:space.xl,backgroundColor:colors.canvas}}><Image source={require('../assets/logo.png')} resizeMode="contain" tintColor={colors.ink} accessibilityLabel="Labour Youth" style={{width:120,height:90}}/><ActivityIndicator color={colors.trust} accessibilityLabel={t('loading')}/></View>;
 if(error)return <View style={{flex:1,justifyContent:'center',padding:space.lg,paddingBottom:insets.bottom+space.lg,backgroundColor:colors.canvas,gap:space.md}}>
  <EmptyState icon="cloud-offline-outline" title={t('welcome')} text={t(error)}/>
  <Button label={t('retry')} icon="refresh" onPress={bootstrap}/>
  <Button variant="ghost" label={t('browseOffline')} onPress={()=>router.replace('/browse')}/>
 </View>;
 return <Redirect href={(user?homeFor(user):'/browse') as any}/>;
}
