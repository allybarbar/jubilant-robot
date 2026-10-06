import {useState,useEffect,useRef} from 'react';
import {SAVE,fmt} from '../lib/storage';
import {audio,say,testVoice} from '../lib/audio';
import {EX,EXN,ORDN,ALLDESC,pick} from '../data/exercises';
import Stick from './Stick';

const loadHiit=()=>{try{return JSON.parse(localStorage.getItem('bw_hiit_log')||'[]')}catch(e){return[]}};
const loadHcfg=()=>{const d={work:30,rest:15,rounds:8,ex:'off',ord:'blocks'};try{const c={...d,...JSON.parse(localStorage.getItem('bw_hiit')||'{}')};if(c.ex==='mix'){c.ex='all';c.ord='alt'}return c}catch(e){return d}};
export default function Hiit({onBusy}){
  const [cfg,setCfg]=useState(loadHcfg);
  const [st,setSt]=useState('idle');
  const [idx,setIdx]=useState(0);
  const [left,setLeft]=useState(0);
  const [paused,setPaused]=useState(false);
  const [voice,setVoice]=useState(audio.voice);
  const [log,setLog]=useState(loadHiit);
  const segsRef=useRef([]),remRef=useRef(null),leftRef=useRef(0);
  useEffect(()=>{onBusy(st==='run');return()=>onBusy(false)},[st]);
  const set=k=>e=>{const c={...cfg,[k]:+e.target.value};setCfg(c);try{localStorage.setItem('bw_hiit',JSON.stringify(c))}catch(x){}};
  const toggleVoice=e=>{audio.voice=e.target.checked;SAVE('bw_voice',audio.voice);setVoice(audio.voice)};
  const saveC=c=>{setCfg(c);try{localStorage.setItem('bw_hiit',JSON.stringify(c))}catch(x){}};
  const setEx=k=>{const c={...cfg,ex:k};if(k==='all'&&cfg.ex!=='all'){c.pr=cfg.rounds;c.rounds=24}else if(k!=='all'&&cfg.ex==='all'&&cfg.pr){c.rounds=cfg.pr}saveC(c)};
  const setOrd=k=>saveC({...cfg,ord:k});
  const total=cfg.rounds*cfg.work+(cfg.rounds-1)*cfg.rest+10;
  const start=()=>{
    const exs=pick(cfg.ex,cfg.rounds,cfg.ord);
    const a=[{t:'ready',s:10,ne:exs&&exs[0]}];
    for(let i=1;i<=cfg.rounds;i++){a.push({t:'work',s:cfg.work,i,e:exs&&exs[i-1]});if(i<cfg.rounds)a.push({t:'rest',s:cfg.rest,i,ne:exs&&exs[i]})}
    segsRef.current=a;remRef.current=null;setPaused(false);setIdx(0);setSt('run');
  };
  const finish=done=>{
    if(done){const l=[{d:Date.now(),w:cfg.work,r:cfg.rest,n:cfg.rounds},...log].slice(0,50);setLog(l);try{localStorage.setItem('bw_hiit_log',JSON.stringify(l))}catch(x){}say('Workout complete. Well done.')}
    else{try{speechSynthesis.cancel()}catch(x){}}
    setPaused(false);setSt(done?'done':'idle');
  };
  const pause=()=>{remRef.current=leftRef.current;try{speechSynthesis.cancel()}catch(x){}setPaused(true)};
  useEffect(()=>{
    if(st!=='run'||paused)return;
    const seg=segsRef.current[idx];
    const resumed=remRef.current!=null;
    const d0=resumed?remRef.current:seg.s;remRef.current=null;
    if(!resumed)say(seg.t==='ready'?'Get ready.'+(seg.ne?' First up: '+seg.ne[0]:''):seg.t==='rest'?'Rest.'+(seg.ne?' Next: '+seg.ne[0]:''):(seg.i===cfg.rounds&&cfg.rounds>1?'Last round. ':seg.i===1?'Round 1. ':'')+(seg.e?seg.e[0]+'. ':'')+'Go');
    const end=Date.now()+d0*1000;
    let said=d0<=3.5;
    setLeft(d0);leftRef.current=d0;
    const id=setInterval(()=>{
      const l=(end-Date.now())/1000;setLeft(Math.max(0,l));leftRef.current=l;
      if(!said&&seg.s>=6&&l<=3){said=true;say('Three, two, one')}
      if(l<=0){clearInterval(id);const nx=idx+1;if(nx<segsRef.current.length)setIdx(nx);else finish(true)}
    },200);
    return()=>clearInterval(id);
  },[st,idx,paused]);

  const seg=segsRef.current[idx]||{t:'ready',s:10};
  const nxt=segsRef.current[idx+1];
  const frac=seg.s?Math.min(1,left/seg.s):0;
  const col=seg.t==='work'?'var(--hold)':seg.t==='rest'?'var(--orb)':'var(--mute)';
  const name=t=>t==='work'?'Work':t==='rest'?'Rest':'Get ready';
  const nm=x=>x.t==='work'&&x.e?x.e[0]:name(x.t);
  const sx=seg.t==='work'?seg.e:seg.ne;
  return (<>
    {st==='idle'&&(<>
      <div className="card">
        <label className="set">Work: {fmt(cfg.work)}<input type="range" min="10" max="120" step="5" value={cfg.work} onChange={set('work')}/></label>
        <label className="set">Rest: {fmt(cfg.rest)}<input type="range" min="5" max="120" step="5" value={cfg.rest} onChange={set('rest')}/></label>
        <label className="set">Rounds: {cfg.rounds}<input type="range" min="2" max="24" value={cfg.rounds} onChange={set('rounds')}/></label>
        <div className="set"><span>Exercises</span></div>
        <div className="row">{Object.keys(EXN).map(k=>(<button key={k} className={'tab'+(cfg.ex===k?' on':'')} style={{padding:'8px 14px'}} onClick={()=>setEx(k)}>{EXN[k]}</button>))}</div>
        {cfg.ex==='all'&&<div className="row">{Object.keys(ORDN).map(k=>(<button key={k} className={'tab'+((cfg.ord||'blocks')===k?' on':'')} style={{padding:'8px 14px'}} onClick={()=>setOrd(k)}>{ORDN[k]}</button>))}</div>}
        {cfg.ex!=='off'&&<p>{cfg.ex==='all'?ALLDESC[cfg.ord||'blocks']+' Needs one kettlebell.':EX[cfg.ex].map(x=>x[0]).join(', ')+'.'+(cfg.ex==='kb'?' Needs one kettlebell.':'')}</p>}
        <p>Total {fmt(total)}, including a 10 second countdown.</p>
        <label className="set">Voice guidance<input type="checkbox" checked={voice} onChange={toggleVoice}/></label>
        <div className="set"><span>Not hearing it? Check your media volume.</span><button className="ghost" style={{padding:'8px 16px'}} onClick={testVoice}>Test voice</button></div>
      </div>
      <div className="row"><button onClick={start}>Start workout</button></div>
      <p className="warn">High-intensity exercise isn't right for everyone. Warm up first, stop if you feel pain, dizziness or chest tightness, and check with a doctor if you have a heart condition or haven't exercised in a while.</p>
      <div className="card">
        <div className="set"><span>Workouts logged</span><b>{log.length}</b></div>
        {log.slice(0,3).map((x,i)=>(<div className="hist" key={i}><span>{new Date(x.d).toLocaleDateString()}</span><b>{x.n} × {fmt(x.w)} / {fmt(x.r)}</b></div>))}
      </div>
    </>)}
    {st==='run'&&(
      <div className="stage" aria-live="polite">
        <p>{seg.t==='ready'?cfg.rounds+' rounds':'Round '+seg.i+' of '+cfg.rounds}</p>
        <div className={'ring'+(sx?' ex':'')}>
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r="112" fill="none" stroke="var(--line)" strokeWidth="10"/>
            <circle cx="130" cy="130" r="112" fill="none" stroke={col} strokeWidth="10" strokeLinecap="round" strokeDasharray="703.7" strokeDashoffset={703.7*(1-frac)} transform="rotate(-90 130 130)"/>
          </svg>
          {sx&&<div className="stick"><Stick name={sx[0]} dim={seg.t!=='work'} paused={paused}/></div>}
          <div className="ringtxt">{left<60?Math.ceil(left):fmt(Math.ceil(left))}</div>
        </div>
        <div className="label">{paused?'Paused':nm(seg)}</div>
        {seg.t==='work'&&seg.e&&<p>{seg.e[1]}</p>}
        <p>{nxt?'Next: '+nm(nxt)+' '+fmt(nxt.s):'Last interval'}</p>
        <div className="row">
          {paused?<button onClick={()=>setPaused(false)}>Resume</button>:<button onClick={pause}>Pause</button>}
          <button className="ghost" onClick={()=>finish(false)}>End workout</button>
        </div>
      </div>
    )}
    {st==='done'&&(
      <div className="stage">
        <div className="label">Workout complete</div>
        <div className="times"><div><span>{cfg.rounds}</span><p>Rounds</p></div><div><span>{fmt(total)}</span><p>Total time</p></div></div>
        <div className="row"><button onClick={start}>Go again</button><button className="ghost" onClick={()=>setSt('idle')}>Back to start</button></div>
      </div>
    )}
  </>);
}

