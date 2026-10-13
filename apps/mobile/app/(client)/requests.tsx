import {useState} from 'react';
import {router} from 'expo-router';
import {EmptyState,ErrorBox,ListGroup,Screen,Segmented,SkeletonCard} from '../../src/ui';
import {RequestRow} from '../../src/RequestRow';
import {useSession} from '../../src/session';
import {useResource,useServices} from '../../src/hooks';

const DONE=['COMPLETED','CANCELLED','EXPIRED'];
export default function Requests(){
 const {t}=useSession();const {data,error,loading,reload}=useResource('/jobs');const catalog=useServices();const [view,setView]=useState<'active'|'past'>('active');
 const items=(data?.items||[]).filter((j:any)=>view==='past'?DONE.includes(j.status):!DONE.includes(j.status));
 return <Screen safeTop title={t('activeRequests')} onRefresh={reload} refreshing={loading&&!!data}>
  <Segmented value={view} onChange={setView} options={[{value:'active',label:t('activeTab')},{value:'past',label:t('pastTab')}]}/>
  <ErrorBox code={error} onRetry={reload}/>
  {loading&&!data?<SkeletonCard count={3}/>:null}
  {data&&items.length===0?<EmptyState icon="document-text-outline" text={t(view==='past'?'noPastRequests':'noRequests')} action={view==='active'?t('postWork'):undefined} onAction={()=>router.push('/shared/quick-post')}/>:null}
  {items.length?<ListGroup>{items.map((j:any,i:number)=><RequestRow key={j.id} job={j} services={catalog.items} index={i}/>)}</ListGroup>:null}
 </Screen>;
}
