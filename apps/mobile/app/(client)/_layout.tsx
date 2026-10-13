import {Tabs,Redirect} from 'expo-router';
import {useSession} from '../../src/session';
import {tabIcon,tabOptions} from '../../src/tabs';

export default function Layout(){
 const {user,t}=useSession();if(!user||!user.roles.includes('CLIENT'))return <Redirect href="/"/>;
 return <Tabs screenOptions={tabOptions}>
  <Tabs.Screen name="index" options={{title:t('home'),tabBarIcon:tabIcon('home')}}/>
  <Tabs.Screen name="requests" options={{title:t('requests'),tabBarIcon:tabIcon('document-text')}}/>
  <Tabs.Screen name="updates" options={{title:t('notifications'),tabBarIcon:tabIcon('notifications')}}/>
  <Tabs.Screen name="account" options={{title:t('accountTab'),tabBarIcon:tabIcon('person-circle')}}/>
 </Tabs>;
}
