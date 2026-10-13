import {Text,View} from 'react-native';
import {EmptyState,ErrorBox,ListGroup,ListRow,Screen,Skeleton,colors,fonts,radius,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {useResource} from '../../src/hooks';
import {shortDate} from '../../src/format';

export default function Earnings(){
 const {t,locale}=useSession();const {data,error,loading,reload}=useResource('/worker/earnings');
 const money=(n:number)=>new Intl.NumberFormat(locale==='hi'?'hi-IN':'en-IN',{style:'currency',currency:'INR',maximumFractionDigits:0}).format(n/100);
 return <Screen safeTop title={t('earnings')} onRefresh={reload} refreshing={loading&&!!data}>
  <ErrorBox code={error} onRetry={reload}/>
  <View style={{backgroundColor:colors.trustDeep,borderRadius:radius.xl,padding:space.xl,gap:space.sm}}>
   <Text style={{fontFamily:fonts.bodyBold,fontSize:14,color:colors.trustMid}}>{t('totalBalance')}</Text>
   {loading&&!data?<Skeleton width={140} height={40}/>:<Text accessibilityRole="header" style={{fontFamily:fonts.display,fontSize:44,lineHeight:54,color:colors.white}}>{data?money(data.balance_paise):'-'}</Text>}
   <Text style={{fontFamily:fonts.body,fontSize:13,lineHeight:19,color:'rgba(255,255,255,0.8)'}}>{t('earningsCopy')}</Text>
  </View>
  <Text accessibilityRole="header" style={type.title}>{t('history')}</Text>
  {data?.items.length===0?<EmptyState icon="wallet-outline" text={t('noEarnings')}/>:null}
  {data?.items.length?<ListGroup>{data.items.map((e:any)=><ListRow key={e.id} icon={e.type==='PAYOUT'?'arrow-up-outline':'arrow-down-outline'} iconColor={e.type==='PAYOUT'?colors.trust:colors.care} iconBg={e.type==='PAYOUT'?colors.trustSoft:colors.careSoft} title={t(e.type)} subtitle={shortDate(e.created_at,locale)} right={<Text style={{fontFamily:fonts.bold,fontSize:16,color:colors.ink}}>{money(e.amount_paise)}</Text>}/>)}</ListGroup>:null}
 </Screen>;
}
