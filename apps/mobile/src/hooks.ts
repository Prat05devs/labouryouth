import {useCallback,useEffect,useRef,useState} from 'react';import {useFocusEffect} from 'expo-router';import {api,ApiError} from './api';
export function useResource<T=any>(path:string){const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{setError('');setLoading(true);try{setData(await api<T>(path));}catch(e){setError(e instanceof ApiError?e.code:'NETWORK_ERROR');}finally{setLoading(false);}},[path]);useFocusEffect(useCallback(()=>{reload();},[reload]));return {data,error,loading,reload};}
export function errorCode(e:unknown){return e instanceof ApiError?e.code:'UNEXPECTED_ERROR';}
// Service catalog with "other" last, as the hirer and worker pickers expect.
export function useServices(){const [items,setItems]=useState<any[]>([]),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{setError('');setLoading(true);try{const r=await api('/services');setItems([...r.items.filter((x:any)=>x.slug!=='other'),...r.items.filter((x:any)=>x.slug==='other')]);}catch(e){setError(errorCode(e));}finally{setLoading(false);}},[]);
 useEffect(()=>{reload();},[reload]);return {items,error,loading,reload};}
// Public guest listings. A newer filter always wins over a slower earlier response.
export function usePublicList(kind:'jobs'|'workers',service=''){const request=useRef(0);const [items,setItems]=useState<any[]|null>(null),[error,setError]=useState(''),[refreshing,setRefreshing]=useState(false);
 const load=useCallback(async(pull=false)=>{const current=++request.current;setError('');if(pull)setRefreshing(true);else setItems(null);try{const r=await api('/public/'+kind+(service?'?service_id='+service:''));if(current===request.current)setItems(r.items);}catch(e){if(current===request.current){setError(errorCode(e));setItems([]);}}finally{if(current===request.current)setRefreshing(false);}},[kind,service]);
 useEffect(()=>{load();return()=>{request.current++;};},[load]);return {items,error,refreshing,load};}
