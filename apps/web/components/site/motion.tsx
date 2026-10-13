'use client';

import {createContext,useContext,useEffect,useRef,useState,type ReactNode} from 'react';

const MotionContext=createContext({paused:false,reduced:true,toggle:()=>{}});
export const useSiteMotion=()=>useContext(MotionContext);

export function SiteMotion({children}:{children:ReactNode}){
  const root=useRef<HTMLDivElement>(null);
  const [paused,setPaused]=useState(false);
  const [reduced,setReduced]=useState(true);
  const [hidden,setHidden]=useState(false);
  useEffect(()=>{
    const media=window.matchMedia('(prefers-reduced-motion: reduce)');
    const update=()=>setReduced(media.matches);
    const visibility=()=>setHidden(document.hidden);
    update();visibility();
    media.addEventListener('change',update);document.addEventListener('visibilitychange',visibility);
    return()=>{media.removeEventListener('change',update);document.removeEventListener('visibilitychange',visibility);};
  },[]);
  const active=!paused&&!reduced&&!hidden;
  useEffect(()=>{
    if(!active||!root.current)return;
    const animations:Animation[]=[];
    const observer=new IntersectionObserver(entries=>{
      entries.forEach(entry=>{
        if(!entry.isIntersecting)return;
        animations.push(entry.target.animate([{opacity:0.35,transform:'translateY(24px)'},{opacity:1,transform:'translateY(0)'}],{duration:650,easing:'cubic-bezier(.2,.7,.2,1)'}));
        observer.unobserve(entry.target);
      });
    },{threshold:0.08});
    root.current.querySelectorAll('main > section:not(:first-child)').forEach(el=>observer.observe(el));
    return()=>{observer.disconnect();animations.forEach(animation=>animation.cancel());};
  },[active]);
  return <MotionContext.Provider value={{paused,reduced,toggle:()=>setPaused(value=>!value)}}><div ref={root} data-motion={active?'active':'off'}>{children}</div></MotionContext.Provider>;
}
