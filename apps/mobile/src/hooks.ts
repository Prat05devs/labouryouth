import {useCallback,useState} from 'react';import {useFocusEffect} from 'expo-router';import {api,ApiError} from './api';
export function useResource<T=any>(path:string){const [data,setData]=useState<T|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 const reload=useCallback(async()=>{setError('');setLoading(true);try{setData(await api<T>(path));}catch(e){setError(e instanceof ApiError?e.code:'NETWORK_ERROR');}finally{setLoading(false);}},[path]);useFocusEffect(useCallback(()=>{reload();},[reload]));return {data,error,loading,reload};}
export function errorCode(e:unknown){return e instanceof ApiError?e.code:'UNEXPECTED_ERROR';}
