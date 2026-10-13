import {router,useLocalSearchParams} from 'expo-router';
import {EmptyState,Screen,StatusPill} from '../../src/ui';
import {useSession} from '../../src/session';
import {View} from 'react-native';

// Decision 16: labelled placeholder, no listings, partners or legal text.
export default function ComingSoon(){
 const {topic}=useLocalSearchParams<{topic:string}>();const {t}=useSession();
 return <Screen>
  <View style={{alignItems:'center',paddingTop:48}}><StatusPill status="comingSoon"/></View>
  <EmptyState icon="hourglass-outline" title={t(topic||'comingSoon')} text={t('comingSoonCopy')} action={t('back')} onAction={()=>router.back()}/>
 </Screen>;
}
