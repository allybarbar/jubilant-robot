import {useState,useEffect,useRef} from 'react';
import {SAVE,fmt} from '../lib/storage';
import {audio,say,testVoice} from '../lib/audio';

const loadCold=()=>{try{return JSON.parse(localStorage.getItem('bw_cold_log')||'[]')}catch(e){return[]}};
export default function Cold({onBusy}){
  const [dur,setDur]=useState(()=>{try{return +localStorage.getItem('bw_cold')||120}catch(e){return 120}});
  const [st,setSt]=useState('idle');
  const [left,setLeft]=useState(0);
  const [voice,setVoice]=useState(audio.voice);
  const [log,setLog]=useState(loadCold);
  const startRef=useRef(0);
  useEffect(()=>{onBusy&&onBusy(st==='ready'||st==='run');return()=>onBusy&&onBusy(false)},[st]);
  const change=e=>{const v=+e.target.value;setDur(v);try{localStorage.setItem('bw_cold',v)}catch(x){}};
  const toggleVoice=e=>{audio.voice=e.target.checked;SAVE('bw_voice',audio.voice);setVoice(audio.voice)};
  const start=()=>{say('Ten seconds. Turn the water to cold.');setSt('ready')};
  const stop=()=>{try{speechSynthesis.cancel()}catch(x){}setSt('idle')};
  const finish=(elapsed,msg)=>{
    if(elapsed>=10){const l=[{d:Date.now(),s:Math.round(elapsed)},...log].slice(0,50);setLog(l);try{localStorage.setItem('bw_cold_log',JSON.stringify(l))}catch(x){}}
    if(msg)say(msg);setSt('done');
  };
  useEffect(()=>{
    if(st!=='ready')return;
    const end=Date.now()+10000;setLeft(10);
    const id=setInterval(()=>{const l=(end-Date.now())/1000;setLeft(Math.max(0,l));if(l<=0){clearInterval(id);say('Go. Breathe slow and steady.');setSt('run')}},200);
    return()=>clearInterval(id);
  },[st]);
  useEffect(()=>{
    if(st!=='run')return;
    const t0=Date.now(),end=t0+dur*1000,said={};
    startRef.current=t0;setLeft(dur);
    const id=setInterval(()=>{
      const l=(end-Date.now())/1000;setLeft(Math.max(0,l));
      if(!said.h&&dur>=40&&l<=dur/2){said.h=1;say('Halfway')}
      if(!said.t&&dur>=90&&l<=30){said.t=1;say('Thirty seconds')}
      if(!said.n&&dur>=30&&l<=10){said.n=1;say('Ten seconds')}
      if(l<=0){clearInterval(id);finish(dur,'Done. Well done. Get warm, and take a few easy breaths.')}
    },200);
    return()=>clearInterval(id);
  },[st]);

  const total=st==='ready'?10:dur;
  const frac=total?Math.min(1,left/total):0;
  const longest=log.length?Math.max(...log.map(x=>x.s)):0;
  const last=log[0];
  return (<>
    {st==='idle'&&(<>
      <div className="card">
        <label className="set">Duration: {fmt(dur)}<input type="range" min="15" max="300" step="5" value={dur} onChange={change}/></label>
        <label className="set">Voice guidance<input type="checkbox" checked={voice} onChange={toggleVoice}/></label>
        <div className="set"><span>Not hearing it? Check your media volume.</span><button className="ghost" style={{padding:'8px 16px'}} onClick={testVoice}>Test voice</button></div>
      </div>
      <div className="row"><button onClick={start}>Start cold shower</button></div>
      <p className="warn">You get 10 seconds to turn the water cold before the timer starts. Cold water raises heart rate and blood pressure. Build up gradually, get out if you feel unwell, and check with a doctor first if you have a heart condition or are pregnant.</p>
      <div className="card">
        <div className="set"><span>Cold showers logged</span><b>{log.length}</b></div>
        <div className="set"><span>Longest</span><b>{longest?fmt(longest):'None yet'}</b></div>
        {log.slice(0,3).map((x,i)=>(<div className="hist" key={i}><span>{new Date(x.d).toLocaleDateString()}</span><b>{fmt(x.s)}</b></div>))}
      </div>
    </>)}
    {(st==='ready'||st==='run')&&(
      <div className="stage" aria-live="polite">
        <div className="ring">
          <svg viewBox="0 0 260 260" aria-hidden="true">
            <circle cx="130" cy="130" r="112" fill="none" stroke="var(--line)" strokeWidth="10"/>
            <circle cx="130" cy="130" r="112" fill="none" stroke={st==='ready'?'var(--hold)':'var(--orb)'} strokeWidth="10" strokeLinecap="round" strokeDasharray="703.7" strokeDashoffset={703.7*(1-frac)} transform="rotate(-90 130 130)"/>
          </svg>
          <div className="ringtxt">{st==='ready'?Math.ceil(left):fmt(Math.ceil(left))}</div>
        </div>
        <div className="label">{st==='ready'?'Turn the water cold':'Breathe slow and steady'}</div>
        <div className="row">
          {st==='run'?<button onClick={()=>finish((Date.now()-startRef.current)/1000,'')}>End early</button>:<button className="ghost" onClick={stop}>Cancel</button>}
        </div>
      </div>
    )}
    {st==='done'&&(
      <div className="stage">
        <div className="label">Cold shower complete</div>
        {last&&<div className="times"><div><span>{fmt(last.s)}</span><p>Time in the cold</p></div></div>}
        <div className="row"><button onClick={start}>Go again</button><button className="ghost" onClick={()=>setSt('idle')}>Back to start</button></div>
      </div>
    )}
  </>);
}

