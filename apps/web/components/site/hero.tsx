'use client';

import Link from 'next/link';
import {useEffect,useRef} from 'react';
import {ArrowDown,ArrowUpRight,MoveUpRight,Pause,Play,Sparkles} from 'lucide-react';
import {useSiteMotion} from './motion';

const photos=[
  {key:'craft',src:'/img/work-craft.webp',alt:'AI-generated scene of two Indian carpenters measuring a timber frame.',caption:'Skill that builds.'},
  {key:'events',src:'/img/work-events.webp',alt:'AI-generated scene of Indian event staff preparing an outdoor table.',caption:'Work that fits.'},
  {key:'home',src:'/img/work-home.webp',alt:'AI-generated scene of an Indian household professional planning a task with a homeowner.',caption:'Help that matters.'},
];

export function Hero(){
  const stage=useRef<HTMLDivElement>(null);
  const section=useRef<HTMLElement>(null);
  const {paused,reduced,toggle}=useSiteMotion();
  useEffect(()=>{
    const element=stage.current;const hero=section.current;
    if(!element||!hero||paused||reduced)return;
    const fine=window.matchMedia('(pointer: fine)');
    let frame=0;let x=0;let y=0;let visible=true;
    const draw=()=>{frame=0;if(document.hidden||!visible)return;element.style.setProperty('--pointer-x',`${x}px`);element.style.setProperty('--pointer-y',`${y}px`);element.style.setProperty('--scroll-y',`${Math.min(70,Math.max(0,-hero.getBoundingClientRect().top)*0.12)}px`);};
    const schedule=()=>{if(!frame)frame=requestAnimationFrame(draw);};
    const move=(event:PointerEvent)=>{if(!fine.matches)return;const rect=element.getBoundingClientRect();x=(event.clientX-rect.left-rect.width/2)*0.022;y=(event.clientY-rect.top-rect.height/2)*0.022;schedule();};
    const reset=()=>{x=0;y=0;schedule();};
    const observer=new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;hero.dataset.visible=String(visible);if(visible)schedule();});observer.observe(hero);
    element.addEventListener('pointermove',move);element.addEventListener('pointerleave',reset);window.addEventListener('scroll',schedule,{passive:true});
    return()=>{cancelAnimationFrame(frame);observer.disconnect();element.removeEventListener('pointermove',move);element.removeEventListener('pointerleave',reset);window.removeEventListener('scroll',schedule);element.style.removeProperty('--pointer-x');element.style.removeProperty('--pointer-y');element.style.removeProperty('--scroll-y');};
  },[paused,reduced]);
  return <section ref={section} className="work-hero" aria-labelledby="hero-title">
    <div className="hero-topline"><span>Labour Youth / People. Skills. Possibilities.</span><span className="hero-edition">Made for local connections <MoveUpRight size={15} aria-hidden="true"/></span></div>
    <div className="hero-composition">
      <div className="hero-copy">
        <h1 id="hero-title"><span className="hero-line"><span>Your skills.</span></span><span className="hero-line"><span>Your city.</span></span><span className="hero-line hero-line-accent"><span>Your next move.</span></span></h1>
        <p lang="hi" className="hero-hindi">आपका हुनर। आपका शहर। आपकी अगली शुरुआत।</p>
        <p className="hero-description">Find local work or hire skilled people. Explore opportunities in Hindi and English, with the schedule and stated pay visible before you take the next step.</p>
        <div className="hero-actions"><Link href="/app" className="hero-open">Open the app <ArrowUpRight size={19} aria-hidden="true"/></Link><a href="#app-preview" className="hero-how">See inside the app <ArrowDown size={16} aria-hidden="true"/></a></div>
        <p className="hero-language">हिन्दी & English <span aria-hidden="true">/</span> Look around. Then take your next step.</p>
      </div>
      <div ref={stage} className="hero-stage" aria-label="Scenes of local work">
        <div className="hero-orbit" aria-hidden="true"/><div className="hero-orbit hero-orbit-two" aria-hidden="true"/>
        <div className="hero-star" aria-hidden="true"><Sparkles size={38}/></div>
        {photos.map((photo,index)=><figure key={photo.key} className={`work-photo work-photo-${photo.key}`}><div className="work-photo-float"><img src={photo.src} alt={photo.alt} width={1200} height={800} fetchPriority={index===0?'high':'auto'} decoding="async"/><figcaption><strong>{photo.caption}</strong><ArrowUpRight size={18} aria-hidden="true"/></figcaption></div></figure>)}
      </div>
    </div>
    <div className="hero-bottom"><p>Representative AI-generated imagery. Real opportunities come from live listings.</p><button type="button" className="motion-control" onClick={toggle} aria-pressed={paused} disabled={reduced}>{paused||reduced?<Play size={14} aria-hidden="true"/>:<Pause size={14} aria-hidden="true"/>}{reduced?'Reduced motion':paused?'Resume motion':'Pause motion'}</button></div>
    <div className="hero-ticker" aria-hidden="true"><div className="hero-ticker-track">{[0,1].map(n=><span key={n}>Work with pride <i>✳</i> Grow with purpose <i>✳</i> सम्मान से काम <i>✳</i> Find your people <i>✳</i> </span>)}</div></div>
  </section>;
}
