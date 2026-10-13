import {router} from 'expo-router';
import {IconButton} from './ui';
import {homeFor,useSession} from './session';

// Top-right user control (owner concept, Decision 28): log in or sign up at any time; signed-in users go to their dashboard.
export function UserButton(){
 const {t,user}=useSession();
 return <IconButton tone="soft" icon={user?'person':'person-outline'} label={user?t('account'):t('loginOrSignUp')} onPress={()=>router.push((user?homeFor(user):'/(public)/account') as any)}/>;
}
