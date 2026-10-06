import {useEffect,useRef} from 'react';
import {ANIM,frame,lerp,lerpA} from '../data/anim';
import {YANIM} from '../data/yoga';

export default function Stick({name,dim,paused,flip}){
  const ref=useRef(null);
  useEffect(()=>{
    const a=ANIM[name]||YANIM[name];if(!a||!ref.current)return;
    const [half,kb,...R]=a,P=R.map(q=>q.length>11?q:[...q,q[1]]),n=P.length,m=2*(n-1);
    const draw=now=>{
      let k=((now/1000)/half)%m;if(k>n-1)k=m-k;
      const i=Math.min(Math.floor(k),n-2),f=k-i,e=(1-Math.cos(f*Math.PI))/2;
      const p=P[i].map((v,j)=>j===0||j===10?lerp(v,P[i+1][j],e):lerpA(v,P[i+1][j],e));
      ref.current.innerHTML=frame(p,kb);
    };
    draw(0);
    if(paused||window.matchMedia('(prefers-reduced-motion: reduce)').matches)return;
    let raf;const loop=now=>{draw(now);raf=requestAnimationFrame(loop)};
    raf=requestAnimationFrame(loop);
    return()=>cancelAnimationFrame(raf);
  },[name,paused]);
  return <svg viewBox="0 0 100 100" role="img" aria-label={name+' demonstration'} style={{opacity:dim?0.55:1,transform:flip?'scaleX(-1)':'none'}}><g ref={ref} fill="none" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
}

