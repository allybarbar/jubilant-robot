import {useState,useEffect,useRef} from 'react';
import {PREF,SAVE,fmt} from '../lib/storage';
import {audio,say,testVoice} from '../lib/audio';
import {shuf} from '../data/exercises';
import {YH,WARM,RELAX,Y_POOL} from '../data/yoga';
import Stick from './Stick';

const buildYoga=()=>{
  const a=[];
  WARM.forEach(([n,s],i)=>a.push({ph:'Warm-up',i,N:WARM.length,n,s}));
  shuf(Y_POOL).forEach((n,i)=>a.push({ph:'Main practice',i,N:Y_POOL.length,n,s:60}));
  RELAX.forEach(([n,s],i)=>a.push({ph:'Relax',i,N:RELAX.length,n,s}));
  return a;
};
const loadYoga=()=>PREF('bw_yoga_log',[]);

export default function Yoga({onBusy}){
  const [st,setSt]=useState('idle');
  const [idx,setIdx]=useState(0);
  const [left,setLeft]=useState(0);
  const [paused,setPaused]=useState(false);
  const [voice,setVoice]=useState(audio.voice);
  const [log,setLog]=useState(loadYoga);
  const segs=useRef([]),remRef=useRef(null),leftRef=useRef(0);
  useEffect(()=>{onBusy(st==='run');return()=>onBusy(false)},[st]);
  const toggleVoice=e=>{audio.voice=e.target.checked;SAVE('bw_voice',audio.voice);setVoice(audio.voice)};
  const start=()=>{segs.current=buildYoga();remRef.current=null;setPaused(false);setIdx(0);setSt('run')};
  const elapsedAt=(i)=>segs.current.slice(0,i).reduce((a,x)=>a+x.s,0)+((segs.current[i]||{s:0}).s-leftRef.current);
  const finish=(done,i)=>{
    const secs=Math.round(elapsedAt(i));
    if(done||secs>=60){const l=[{d:Date.now(),s:done?1800:secs,full:done},...log].slice(0,50);setLog(l);SAVE('bw_yoga_log',l)}
    if(done)say('Session complete. Well done. Namaste.');else{try{speechSynthesis.cancel()}catch(x){}}
    setPaused(false);setSt(done?'done':'idle');
  };
  const pause=()=>{remRef.current=leftRef.current;try{speechSynthesis.cancel()}catch(x){}setPaused(true)};
  const skip=()=>{remRef.current=null;if(idx+1<segs.current.length)setIdx(idx+1);else finish(true,idx)};
  useEffect(()=>{
    if(st!=='run'||paused)return;
    const seg=segs.current[idx],nx=segs.current[idx+1];
    const resumed=remRef.current!=null;
    const d0=resumed?remRef.current:seg.s;remRef.current=null;
    if(!resumed){
      const intro=seg.i===0?(seg.ph==='Warm-up'?'Warm-up. Five minutes. ':seg.ph==='Relax'?'Relax. Five minutes. ':'Main practice. Twenty minutes of poses. '):'';
      say(intro+seg.n+'. '+YH[seg.n][0]);
    }
    const end=Date.now()+d0*1000;
    let sw=d0<=seg.s/2||!YH[seg.n][1],nxs=d0<=8||seg.s<20||!nx;
    setLeft(d0);leftRef.current=d0;
    const id=setInterval(()=>{
      const l=(end-Date.now())/1000;setLeft(Math.max(0,l));leftRef.current=l;
      if(!sw&&l<=seg.s/2){sw=true;say('Switch sides')}
      if(!nxs&&l<=8){nxs=true;say('Next: '+nx.n)}
      if(l<=0){clearInterval(id);if(nx)setIdx(idx+1);else finish(true,idx)}
    },200);
    return()=>clearInterval(id);
  },[st,idx,paused]);

  const seg=segs.current[idx]||{n:'Centering breath',s:40,ph:'Warm-up',i:0,N:1};
  const total=segs.current.reduce((a,x)=>a+x.s,0)||1800;
  const elapsed=st==='run'?Math.min(total,elapsedAt(idx)):0;
  const frac=seg.s?Math.min(1,left/seg.s):0;
  const col=seg.ph==='Warm-up'?'var(--hold)':seg.ph==='Relax'?'var(--mute)':'var(--orb)';
  const nxt=segs.current[idx+1];
  const sided=YH[seg.n]&&YH[seg.n][1];
  const flip=!!sided&&left<=seg.s/2;
  const longest=log.length?Math.max(...log.map(x=>x.s)):0;
  return (<>
    {st==='idle'&&(<>
      <div className="card">
        <div className="set"><span>Warm-up</span><b>5:00</b></div>
        <div className="set"><span>Main practice, 20 poses at 1:00</span><b>20:00</b></div>
        <div className="set"><span>Relax, ending in corpse pose</span><b>5:00</b></div>
        <div className="set"><span>Total</span><b>30:00</b></div>
        <label className="set">Voice guidance<input type="checkbox" checked={voice} onChange={toggleVoice}/></label>
        <div className="set"><span>Not hearing it? Check your media volume.</span><button className="ghost" style={{padding:'8px 16px'}} onClick={testVoice}>Test voice</button></div>
      </div>
      <div className="row"><button onClick={start}>Start session</button></div>
      <p className="warn">The main practice shuffles a different order of poses each time. Move gently, never force a stretch, and stop if you feel pain or dizziness. Check with a doctor first if you are pregnant, injured or have a medical condition.</p>
      <div className="card">
        <div className="set"><span>Sessions logged</span><b>{log.length}</b></div>
        {log.slice(0,3).map((x,i)=>(<div className="hist" key={i}><span>{new Date(x.d).toLocaleDateString()}</span><b>{x.full?'Full session':fmt(x.s)}</b></div>))}
      </div>
    </>)}
    {st==='run'&&(
      <div className="stage" aria-live="polite">
        <p>{seg.ph} · {seg.i+1} of {seg.N}</p>
        <div className="ring ex">
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r="112" fill="none" stroke="var(--line)" strokeWidth="10"/>
            <circle cx="130" cy="130" r="112" fill="none" stroke={col} strokeWidth="10" strokeLinecap="round" strokeDasharray="703.7" strokeDashoffset={703.7*(1-frac)} transform="rotate(-90 130 130)"/>
          </svg>
          <div className="stick"><Stick name={seg.n} paused={paused} flip={flip}/></div>
          <div className="ringtxt">{left<60?Math.ceil(left):fmt(Math.ceil(left))}</div>
        </div>
        <div className="label">{paused?'Paused':seg.n}</div>
        <p>{YH[seg.n][0]}</p>
        <div className="bar" aria-hidden="true"><div style={{width:(100*elapsed/total)+'%'}}/></div>
        <p>{fmt(Math.max(0,total-elapsed))} left{nxt?' · Next: '+nxt.n:''}</p>
        <div className="row">
          {paused?<button onClick={()=>setPaused(false)}>Resume</button>:<button onClick={pause}>Pause</button>}
          <button className="ghost" onClick={skip}>Skip</button>
          <button className="ghost" onClick={()=>finish(false,idx)}>End</button>
        </div>
      </div>
    )}
    {st==='done'&&(
      <div className="stage">
        <div className="label">Session complete</div>
        <div className="times"><div><span>30:00</span><p>Total time</p></div></div>
        <p>Take a moment before you get up.</p>
        <div className="row"><button onClick={start}>Go again</button><button className="ghost" onClick={()=>setSt('idle')}>Back to start</button></div>
      </div>
    )}
  </>);
}

