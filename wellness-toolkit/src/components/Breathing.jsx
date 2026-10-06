import {useState,useEffect,useRef} from 'react';
import {PREF,SAVE,fmt} from '../lib/storage';
import {audio,initAudio,startWave,stopWave,wave,say,testVoice,stopAll} from '../lib/audio';

const load=()=>{try{return JSON.parse(localStorage.getItem('bw_hist')||'[]')}catch(e){return[]}};
const save=h=>{try{localStorage.setItem('bw_hist',JSON.stringify(h))}catch(e){}};

export default function Breathing({onBusy,onCold}){
  const [phase,setPhase]=useState('idle');
  const running=phase!=='idle'&&phase!=='done';
  useEffect(()=>{onBusy(running);return()=>onBusy(false)},[running]);
  const [cfg,setCfg]=useState(()=>({style:'power',rounds:3,breaths:30,pace:1.7,...PREF('bw_cfg',{}),waves:audio.waves,voice:audio.voice}));
  useEffect(()=>{const {waves,voice,...rest}=cfg;SAVE('bw_cfg',rest)},[cfg]);
  const [round,setRound]=useState(1);
  const [breath,setBreath]=useState(1);
  const [up,setUp]=useState(false);
  const [t,setT]=useState(0);
  const [times,setTimes]=useState([]);
  const [hist,setHist]=useState(load);
  const timesRef=useRef([]);
  const startRef=useRef(0);
  const set=k=>e=>setCfg({...cfg,[k]:+e.target.value});
  const setStyle=st=>setCfg({...cfg,style:st,breaths:st==='rapid'?40:30,pace:st==='rapid'?0.6:1.7});
  const toggle=k=>e=>{setCfg({...cfg,[k]:e.target.checked});if(k==='waves')audio.waves=e.target.checked;else audio.voice=e.target.checked;SAVE('bw_'+k,e.target.checked);if(e.target.checked){initAudio();if(k==='voice')say('Voice on',true)}};

  const begin=()=>{initAudio();audio.waves=cfg.waves;audio.voice=cfg.voice;stopWave();startWave();say('Round 1. Get comfortable, and begin.');timesRef.current=[];setTimes([]);setRound(1);setPhase('breathing')};
  const quit=()=>{stopAll();setPhase('idle')};

  // Power breathing: inhale/exhale loop, ends after the final exhale
  useEffect(()=>{
    if(phase!=='breathing')return;
    let n=0,inhaling=true;
    setBreath(1);setUp(true);wave(1,cfg.pace);
    const id=setInterval(()=>{
      if(inhaling){inhaling=false;setUp(false);wave(0.1,cfg.pace)}
      else{
        n++;
        if(n>=cfg.breaths){clearInterval(id);wave(0,1.5);say('Let go, and hold. Stay relaxed.');setPhase('retention');return}
        inhaling=true;setUp(true);setBreath(n+1);wave(1,cfg.pace);if(n+1===cfg.breaths)say('Last breath');else if(n%10===0)say(String(n));
      }
    },cfg.pace*1000);
    return()=>clearInterval(id);
  },[phase,round]);

  // Retention: stopwatch after exhale
  useEffect(()=>{
    if(phase!=='retention')return;
    startRef.current=Date.now();setT(0);
    let m=0;
    const id=setInterval(()=>{const x=(Date.now()-startRef.current)/1000;setT(x);const mm=Math.floor(x/60);if(mm>m){m=mm;say(mm+(mm>1?' minutes':' minute'))}},100);
    return()=>clearInterval(id);
  },[phase]);

  const endHold=()=>{
    const secs=(Date.now()-startRef.current)/1000;
    timesRef.current=[...timesRef.current,secs];
    setTimes(timesRef.current);
    wave(1,2);say('Breathe in deeply, and hold.');setPhase('recovery');
  };

  // Recovery: inhale deeply, hold 15 s
  useEffect(()=>{
    if(phase!=='recovery')return;
    const end=Date.now()+15000;setT(15);
    const id=setInterval(()=>{
      const left=Math.max(0,(end-Date.now())/1000);setT(left);
      if(left<=0){
        clearInterval(id);
        if(round<cfg.rounds){wave(0.1,1);say('Let go. Round '+(round+1));setRound(r=>r+1);setPhase('breathing')}
        else{
          const h=[{d:Date.now(),t:timesRef.current},...hist].slice(0,30);
          setHist(h);save(h);say('Let go. Session complete. Well done.');stopWave();setPhase('done');
        }
      }
    },200);
    return()=>clearInterval(id);
  },[phase]);

  const best=hist.length?Math.max(...hist.flatMap(h=>h.t)):0;
  const hold=phase==='retention'||phase==='recovery';
  const rapid=cfg.style==='rapid';
  const scale=phase==='breathing'?(up?(rapid?1.3:1.55):(rapid?0.95:0.8)):1.1;

  return (<>
      {phase==='idle'&&(<>
        <div className="card">
          <div className="row">
            <button className={'tab'+(cfg.style==='power'?' on':'')} onClick={()=>setStyle('power')}>Power breathing</button>
            <button className={'tab'+(cfg.style==='rapid'?' on':'')} onClick={()=>setStyle('rapid')}>Rapid breathing</button>
          </div>
          <p>{cfg.style==='power'?'Deep, full breaths at a steady pace, then a hold.':'Fast, shallow breaths, then a hold. Expect tingling or light-headedness; stay seated or lying down.'}</p>
          <label className="set">Rounds: {cfg.rounds}<input type="range" min="1" max="5" value={cfg.rounds} onChange={set('rounds')}/></label>
          <label className="set">Breaths per round: {cfg.breaths}<input type="range" min="20" max="60" step="5" value={cfg.breaths} onChange={set('breaths')}/></label>
          <label className="set">Ocean waves<input type="checkbox" checked={cfg.waves} onChange={toggle('waves')}/></label>
          <label className="set">Voice guidance<input type="checkbox" checked={cfg.voice} onChange={toggle('voice')}/></label>
          <div className="set"><span>Not hearing it? Check your media volume.</span><button className="ghost" style={{padding:'8px 16px'}} onClick={testVoice}>Test voice</button></div>
          <label className="set">Seconds per half-breath: {cfg.pace.toFixed(1)}<input type="range" min="0.3" max="10" step="0.1" value={cfg.pace} onChange={set('pace')}/></label>
        </div>
        <div className="row"><button onClick={begin}>Start session</button></div>
        <p className="warn">Sit or lie down in a safe place. Never practise in or near water, while driving, or standing. Stop if you feel faint. Check with a doctor first if you have a heart condition, epilepsy, high blood pressure or are pregnant.</p>
        <div className="card">
          <div className="set"><span>Longest hold</span><b>{best?fmt(best):'No sessions yet'}</b></div>
          {hist.slice(0,5).map((h,i)=>(
            <div className="hist" key={i}><span>{new Date(h.d).toLocaleDateString()}</span><b>{h.t.map(fmt).join(' · ')}</b></div>
          ))}
        </div>
      </>)}

      {phase!=='idle'&&phase!=='done'&&(
        <div className="stage" aria-live="polite">
          <p>Round {round} of {cfg.rounds}</p>
          <div className="orbwrap">
            <div className={'orb'+(hold?' hold':'')} style={{'--d':cfg.pace+'s',transform:`scale(${scale})`}}>
              <div className="big">
                {phase==='breathing'&&breath}
                {phase==='retention'&&fmt(t)}
                {phase==='recovery'&&Math.ceil(t)}
              </div>
            </div>
          </div>
          <div className="label">
            {phase==='breathing'&&(up?'Breathe in':'Let go')}
            {phase==='retention'&&'Hold with empty lungs'}
            {phase==='recovery'&&'Breathe in deep and hold'}
          </div>
          <div className="row">
            {phase==='retention'&&<button onClick={endHold}>Take a breath</button>}
            <button className="ghost" onClick={quit}>End session</button>
          </div>
        </div>
      )}

      {phase==='done'&&(
        <div className="stage">
          <div className="label">Session complete</div>
          <div className="times">{times.map((x,i)=><div key={i}><span>{fmt(x)}</span><p>Round {i+1}</p></div>)}</div>
          <div className="row"><button onClick={begin}>Go again</button><button onClick={()=>onCold()}>Cold shower</button><button className="ghost" onClick={quit}>Back to start</button></div>
        </div>
      )}
  </>);
}
