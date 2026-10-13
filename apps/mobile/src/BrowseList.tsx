import {useEffect,useState} from 'react';
import {router,useLocalSearchParams} from 'expo-router';
import {Banner,Chip,ChipScroller,EmptyState,ErrorBox,Screen,SkeletonCard,space} from './ui';
import {JobCard,WorkerCard} from './cards';
import {usePublicList,useServices} from './hooks';
import {useSession} from './session';
import {View} from 'react-native';
import {UserButton} from './UserButton';

// Guest Jobs and Workers tabs: service filter chips, pull-to-refresh, skeleton, empty and error states.
export function BrowseList({kind}:{kind:'jobs'|'workers'}){
 const {t,locale,user}=useSession();const hi=locale==='hi';const params=useLocalSearchParams<{service?:string}>();
 const [service,setService]=useState(params.service||'');useEffect(()=>{if(params.service!==undefined)setService(params.service);},[params.service]);
 const catalog=useServices();const list=usePublicList(kind,service);const jobs=kind==='jobs';
 const icon=(id:string)=>catalog.items.find(x=>x.id===id)?.icon;
 return <Screen safeTop title={t(jobs?'openRoles':'availablePeople')} subtitle={t(jobs?'openRolesCopy':'availablePeopleCopy')} headerRight={<UserButton/>} onRefresh={()=>list.load(true)} refreshing={list.refreshing} gap={space.md}>
  <ChipScroller>
   <Chip label={t('allServices')} selected={!service} onPress={()=>setService('')}/>
   {catalog.items.map(x=><Chip key={x.id} label={hi?x.name_hi:x.name} selected={service===x.id} onPress={()=>setService(service===x.id?'':x.id)}/>)}
  </ChipScroller>
  <ErrorBox code={list.error} onRetry={()=>list.load()}/>
  {list.items===null?<SkeletonCard count={4}/>:null}
  {list.items&&list.items.length===0&&!list.error?<EmptyState icon={jobs?'briefcase-outline':'people-outline'} title={t(jobs?'nothingOpenTitle':'noWorkersTitle')} text={t(jobs?'noOpenJobs':'noListedWorkers')} action={service?t('clear'):undefined} onAction={()=>setService('')}/>:null}
  <View style={{gap:space.md}}>
   {jobs?list.items?.map((job,i)=><JobCard key={job.id} job={job} index={i} icon={icon(job.service_id)} onPress={()=>router.push({pathname:'/(public)/job/[id]',params:{id:job.id}})}/>):
    list.items?.map((w,i)=><WorkerCard key={w.id} worker={w} index={i} onPress={()=>router.push({pathname:'/(public)/worker/[id]',params:{id:w.id}})}/>)}
  </View>
  {!user&&list.items?.length?<Banner text={t('browseWithoutAccount')}/>:null}
 </Screen>;
}
