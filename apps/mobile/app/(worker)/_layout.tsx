import {Tabs,Redirect} from 'expo-router';
import {useSession} from '../../src/session';
import {tabIcon,tabOptions} from '../../src/tabs';

export default function Layout(){
 const {user,t}=useSession();if(!user||!user.roles.includes('WORKER'))return <Redirect href="/"/>;
 return <Tabs screenOptions={tabOptions}>
  <Tabs.Screen name="index" options={{title:t('home'),tabBarIcon:tabIcon('home')}}/>
  <Tabs.Screen name="jobs" options={{title:t('findWorkTab'),tabBarIcon:tabIcon('search')}}/>
  <Tabs.Screen name="offers" options={{title:t('offers'),tabBarIcon:tabIcon('mail')}}/>
  <Tabs.Screen name="earnings" options={{title:t('earnings'),tabBarIcon:tabIcon('wallet')}}/>
  <Tabs.Screen name="account" options={{title:t('accountTab'),tabBarIcon:tabIcon('person-circle')}}/>
 </Tabs>;
}
