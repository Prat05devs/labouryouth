import {Tabs} from 'expo-router';
import {useSession} from '../../src/session';
import {tabIcon,tabOptions} from '../../src/tabs';

// Guest marketplace (Decision 28): browse without an account; the Profile tab offers sign in at any time.
export default function BrowseTabs(){
 const {t}=useSession();
 return <Tabs screenOptions={tabOptions}>
  <Tabs.Screen name="index" options={{title:t('home'),tabBarIcon:tabIcon('home')}}/>
  <Tabs.Screen name="jobs" options={{title:t('jobsTab'),tabBarIcon:tabIcon('briefcase')}}/>
  <Tabs.Screen name="workers" options={{title:t('workersTab'),tabBarIcon:tabIcon('people')}}/>
  <Tabs.Screen name="me" options={{title:t('profileTab'),tabBarIcon:tabIcon('person-circle')}}/>
 </Tabs>;
}
