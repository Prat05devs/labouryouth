import {router} from 'expo-router';
import {Image,Text,View} from 'react-native';
import {Button,Screen,TextLink,colors,space,type} from '../../src/ui';
import {useSession} from '../../src/session';

// Sign-in entry shown as a modal when a guest acts (apply, hire) or taps the profile icon.
export default function AccountEntry(){
 const {t}=useSession();
 return <Screen footer={<><Button label={t('login')} onPress={()=>router.replace('/(public)/login')}/><Button variant="secondary" label={t('createAccount')} onPress={()=>router.replace('/(public)/register')}/></>}>
  <View style={{alignItems:'center',gap:space.lg,paddingTop:space.xxxl}}>
   <View style={{width:96,height:96,borderRadius:28,backgroundColor:colors.trustSoft,alignItems:'center',justifyContent:'center'}}><Image source={require('../../assets/logo.png')} resizeMode="contain" tintColor={colors.trustInk} accessibilityLabel="Labour Youth" style={{width:66,height:50}}/></View>
   <Text accessibilityRole="header" style={[type.largeTitle,{textAlign:'center'}]}>{t('loginOrSignUp')}</Text>
   <Text style={[type.callout,{textAlign:'center',maxWidth:320}]}>{t('accountGateCopy')}</Text>
   <TextLink label={t('continueBrowsing')} onPress={()=>router.back()}/>
  </View>
 </Screen>;
}
