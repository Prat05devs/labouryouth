import {Stack} from 'expo-router';
import {StatusBar} from 'expo-status-bar';
import {useFonts} from 'expo-font';
import {Anton_400Regular} from '@expo-google-fonts/anton';
import {OpenSans_400Regular,OpenSans_500Medium,OpenSans_600SemiBold,OpenSans_700Bold} from '@expo-google-fonts/open-sans';
import {MotionProvider} from '../src/motion';
import {SessionProvider,useSession} from '../src/session';
import {colors,fonts} from '../src/ui';

// Native stack: tab groups hide the header, every pushed screen gets a localized title and a back chevron.
function RootStack(){
 const {t}=useSession();const title=(key:string)=>({title:t(key)});const none={headerShown:false};
 return <Stack screenOptions={{headerStyle:{backgroundColor:colors.canvas},headerTintColor:colors.ink,headerTitleStyle:{fontFamily:fonts.bodyBold,fontSize:17},headerShadowVisible:false,headerBackButtonDisplayMode:'minimal',contentStyle:{backgroundColor:colors.canvas}}}>
  <Stack.Screen name="index" options={none}/>
  <Stack.Screen name="browse" options={none}/>
  <Stack.Screen name="(client)" options={none}/>
  <Stack.Screen name="(worker)" options={none}/>
  <Stack.Screen name="(public)/home" options={none}/>
  <Stack.Screen name="(public)/account" options={{title:'',presentation:'modal'}}/>
  <Stack.Screen name="(public)/login" options={title('login')}/>
  <Stack.Screen name="(public)/register" options={title('createAccount')}/>
  <Stack.Screen name="(public)/reset" options={title('resetPassword')}/>
  <Stack.Screen name="(public)/job/[id]" options={title('roleDetails')}/>
  <Stack.Screen name="(public)/worker/[id]" options={title('workerProfile')}/>
  <Stack.Screen name="shared/purpose" options={{title:'',headerBackVisible:false}}/>
  <Stack.Screen name="shared/client-setup" options={title('yourDetails')}/>
  <Stack.Screen name="shared/worker-setup" options={title('setup')}/>
  <Stack.Screen name="shared/quick-post" options={title('postWorkTitle')}/>
  <Stack.Screen name="shared/new-request" options={title('newRequest')}/>
  <Stack.Screen name="shared/job/[id]" options={title('requestStatus')}/>
  <Stack.Screen name="shared/assignment/[id]" options={title('work')}/>
  <Stack.Screen name="shared/notifications" options={title('notifications')}/>
  <Stack.Screen name="shared/coming-soon" options={{title:''}}/>
  <Stack.Screen name="shared/settings" options={none}/>
  <Stack.Screen name="shared/delete-account" options={title('deleteAccount')}/>
 </Stack>;
}

export default function Layout(){
 const [loaded,error]=useFonts({Anton_400Regular,OpenSans_400Regular,OpenSans_500Medium,OpenSans_600SemiBold,OpenSans_700Bold});
 if(!loaded&&!error)return null;
 return <MotionProvider><SessionProvider><StatusBar style="dark"/><RootStack/></SessionProvider></MotionProvider>;
}
