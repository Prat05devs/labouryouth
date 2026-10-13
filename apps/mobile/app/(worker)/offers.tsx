import {useState} from 'react';
import {Text,View} from 'react-native';
import {router} from 'expo-router';
import {Button,Card,EmptyState,ErrorBox,MetaLine,Screen,SkeletonCard,StatusPill,TextLink,colors,fonts,space,type} from '../../src/ui';
import {useSession} from '../../src/session';
import {api} from '../../src/api';
import {useResource,errorCode} from '../../src/hooks';
import {ContactCard} from '../../src/ContactCard';
import {dateTime,rupees} from '../../src/format';

export default function Offers(){
 const {t,locale}=useSession();const {data,error,loading,reload}=useResource('/offers');const [failure,setFailure]=useState('');
 return <Screen safeTop title={t('offers')} onRefresh={reload} refreshing={loading&&!!data}>
  <ErrorBox code={failure||error} onRetry={reload}/>
  {loading&&!data?<SkeletonCard count={2}/>:null}
  {data?.items.length===0?<EmptyState icon="mail-open-outline" title={t('noOffersTitle')} text={t('noOffers')} action={t('findWorkTab')} onAction={()=>router.navigate('/(worker)/jobs')}/>:null}
  {data?.items.map((o:any)=>{const live=o.status==='PENDING'&&new Date(o.expires_at)>new Date();
   return <Card key={o.id} style={{gap:space.md}}>
    <View style={{flexDirection:'row',alignItems:'flex-start',justifyContent:'space-between',gap:space.md}}>
     <View style={{gap:2}}><Text style={type.caption}>{t('offerAmount')}</Text><Text style={{fontFamily:fonts.bold,fontSize:26,color:colors.ink}}>{rupees(o.agreed_worker_amount_paise)}</Text></View>
     <StatusPill status={o.status}/>
    </View>
    <MetaLine icon="hourglass-outline" color={live?colors.courageInk:colors.muted} text={t('expires')+' '+dateTime(o.expires_at,locale)}/>
    {['PENDING','ACCEPTED'].includes(o.status)?<ContactCard jobId={o.job_id}/>:null}
    {live?<View style={{flexDirection:'row',gap:space.sm}}>
     <Button flex variant="secondary" label={t('decline')} onPress={async()=>{try{await api('/offers/'+o.id+'/decline','POST');await reload();}catch(e){setFailure(errorCode(e));}}}/>
     <Button flex variant="success" icon="checkmark" label={t('accept')} onPress={async()=>{try{const a=await api('/offers/'+o.id+'/accept','POST',{},'accept-'+o.id);router.push({pathname:'/shared/assignment/[id]',params:{id:a.id}});}catch(e){setFailure(errorCode(e));await reload();}}}/>
    </View>:null}
    <TextLink label={t('viewDetails')} onPress={()=>router.push({pathname:'/shared/job/[id]',params:{id:o.job_id}})}/>
   </Card>;})}
 </Screen>;
}
