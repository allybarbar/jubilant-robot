import {useState,useEffect,useRef} from 'react';
import {PREF,SAVE,fmt} from '../lib/storage';
import {audio,say,VOICE_OK} from '../lib/audio';
import {SPLITS,WEX,lastFor,bestFor,nSets,mkSets} from '../data/weights';

export default function Weights({onBusy}){
  const [log,setLog]=useState(()=>PREF('bw_w_log',[]));
  const [cur,setCur]=useState(()=>PREF('bw_w_cur',null));
  const [unit,setUnit]=useState(()=>PREF('bw_w_unit','kg'));
  const [rest,setRest]=useState(()=>PREF('bw_w_rest',90));
  const [voice,setVoice]=useState(audio.voice);
  const [resting,setResting]=useState(false);
  const [left,setLeft]=useState(0);
  const [open,setOpen]=useState(null);
  const [sure,setSure]=useState(null);
  const [custom,setCustom]=useState('');
  const endRef=useRef(0),unl=useRef(0);
  const active=!!cur;
  useEffect(()=>{onBusy(active);return()=>onBusy(false)},[active]);
  useEffect(()=>{SAVE('bw_w_cur',cur)},[cur]);
  useEffect(()=>{SAVE('bw_w_log',log)},[log]);
  useEffect(()=>{
    if(!resting)return;
    const id=setInterval(()=>{
      const l=(endRef.current-Date.now())/1000;setLeft(Math.max(0,l));
      if(l<=0){clearInterval(id);setResting(false);say('Rest over')}
    },250);
    return()=>clearInterval(id);
  },[resting]);

  const pickUnit=u=>{setUnit(u);SAVE('bw_w_unit',u)};
  const pickRest=n=>{setRest(n);SAVE('bw_w_rest',n)};
  const toggleVoice=e=>{audio.voice=e.target.checked;SAVE('bw_voice',audio.voice);setVoice(audio.voice)};
  const startRest=()=>{
    if(!unl.current&&VOICE_OK){try{speechSynthesis.speak(new SpeechSynthesisUtterance(' '))}catch(x){}unl.current=1}
    endRef.current=Date.now()+rest*1000;setLeft(rest);setResting(true);
  };
  const start=type=>setCur({type,d:Date.now(),u:unit,ex:WEX[type].map(n=>({n,sets:mkSets(lastFor(log,n))}))});
  const upd=(ei,fn)=>setCur(c=>({...c,ex:c.ex.map((e,i)=>i===ei?fn(e):e)}));
  const setVal=(ei,si,k,v)=>upd(ei,e=>({...e,sets:e.sets.map((t,i)=>i===si?{...t,[k]:v}:t)}));
  const tick=(ei,si)=>{const was=cur.ex[ei].sets[si].ok;setVal(ei,si,'ok',!was);if(!was)startRest()};
  const addSet=ei=>upd(ei,e=>{const l=e.sets[e.sets.length-1]||{w:'',r:''};return {...e,sets:[...e.sets,{w:l.w,r:l.r,ok:false}]}});
  const delSet=(ei,si)=>upd(ei,e=>({...e,sets:e.sets.filter((_,i)=>i!==si)}));
  const delEx=ei=>setCur(c=>({...c,ex:c.ex.filter((_,i)=>i!==ei)}));
  const addEx=n=>{n=n.trim();if(!n||cur.ex.some(e=>e.n===n))return;setCur(c=>({...c,ex:[...c.ex,{n,sets:mkSets(lastFor(log,n))}]}))};
  const finish=()=>{
    const ex=cur.ex.map(e=>({n:e.n,sets:e.sets.filter(t=>t.ok&&+t.r>0).map(t=>({w:+t.w||0,r:+t.r}))})).filter(e=>e.sets.length);
    if(ex.length)setLog([{id:cur.d,d:cur.d,type:cur.type,u:cur.u,ex},...log].slice(0,200));
    setCur(null);setResting(false);setSure(null);
  };
  const fd=d=>new Date(d).toLocaleDateString(undefined,{day:'numeric',month:'short'});
  const fmtSets=(sets)=>sets.map(t=>t.r+' × '+t.w).join(', ');

  if(active)return (<>
    {resting&&<div className="restbar"><span>Rest {fmt(Math.ceil(left))}</span><button className="ghost" style={{padding:'6px 14px'}} onClick={()=>setResting(false)}>Skip</button></div>}
    <div className="set"><b style={{fontFamily:'Fraunces,Georgia,serif',fontWeight:500,fontSize:20}}>{cur.type}</b><span>{fd(cur.d)} · {cur.u}</span></div>
    <p>Tick each set when it's done. Only ticked sets are saved.</p>
    {cur.ex.map((e,ei)=>{const l=lastFor(log,e.n),b=bestFor(log,e.n);return (
      <div className="card" key={e.n}>
        <div className="set"><b>{e.n}</b><button className="x" onClick={()=>delEx(ei)} aria-label="Remove exercise">×</button></div>
        {(l||b>0)&&<p>{l&&'Last: '+fmtSets(l.sets)+' '+l.u}{b>0&&' · Best '+b}</p>}
        <div className="srow hd"><span>Set</span><span>{cur.u}</span><span>Reps</span><span></span><span></span></div>
        {e.sets.map((t,si)=>(
          <div className="srow" key={si}>
            <span>{si+1}</span>
            <input className="num" type="number" inputMode="decimal" step="any" value={t.w} placeholder="0" aria-label="Weight" onChange={ev=>setVal(ei,si,'w',ev.target.value)}/>
            <input className="num" type="number" inputMode="numeric" value={t.r} placeholder="0" aria-label="Reps" onChange={ev=>setVal(ei,si,'r',ev.target.value)}/>
            <button className={'chk'+(t.ok?' on':'')} onClick={()=>tick(ei,si)} aria-label="Mark set done">✓</button>
            <button className="x" onClick={()=>delSet(ei,si)} aria-label="Remove set">×</button>
          </div>
        ))}
        <button className="ghost" style={{padding:'8px 16px',alignSelf:'flex-start'}} onClick={()=>addSet(ei)}>+ Add set</button>
      </div>)})}
    <div className="card">
      <div className="set"><span>Add exercise</span></div>
      <div className="row" style={{justifyContent:'flex-start'}}>{WEX[cur.type].filter(n=>!cur.ex.some(e=>e.n===n)).map(n=>(<button key={n} className="tab" style={{padding:'6px 12px'}} onClick={()=>addEx(n)}>{n}</button>))}</div>
      <div className="set" style={{gap:8}}><input className="txt" value={custom} placeholder="Custom exercise" onChange={e=>setCustom(e.target.value)}/><button className="ghost" style={{padding:'8px 16px'}} onClick={()=>{addEx(custom);setCustom('')}}>Add</button></div>
    </div>
    <div className="row">
      <button onClick={finish}>Finish workout</button>
      {sure==='d'?<button className="ghost" onClick={()=>{setCur(null);setResting(false);setSure(null)}}>Tap again to discard</button>:<button className="ghost" onClick={()=>setSure('d')}>Discard</button>}
    </div>
  </>);

  return (<>
    <div className="card">
      <div className="set"><span>Units</span><div className="row">{['kg','lb'].map(u=>(<button key={u} className={'tab'+(unit===u?' on':'')} style={{padding:'6px 14px'}} onClick={()=>pickUnit(u)}>{u}</button>))}</div></div>
      <div className="set"><span>Rest timer</span><div className="row">{[60,90,120,180].map(n=>(<button key={n} className={'tab'+(rest===n?' on':'')} style={{padding:'6px 12px'}} onClick={()=>pickRest(n)}>{fmt(n)}</button>))}</div></div>
      <label className="set">Voice when rest ends<input type="checkbox" checked={voice} onChange={toggleVoice}/></label>
    </div>
    {SPLITS.map(([g,ts])=>(
      <div key={g} style={{display:'flex',flexDirection:'column',gap:8}}>
        <p>{g}</p>
        <div className="row" style={{justifyContent:'flex-start'}}>{ts.map(t=>(<button key={t} className="tab" onClick={()=>start(t)}>{t}</button>))}</div>
      </div>
    ))}
    <div className="card">
      <div className="set"><span>Workouts logged</span><b>{log.length}</b></div>
      {log.slice(0,8).map(s=>(
        <div key={s.id}>
          <button className="hrow" onClick={()=>setOpen(open===s.id?null:s.id)}><span>{fd(s.d)} · {s.type}</span><b>{nSets(s)} sets</b></button>
          {open===s.id&&(<div style={{display:'flex',flexDirection:'column',gap:6,padding:'0 0 10px'}}>
            {s.ex.map(e=>(<p key={e.n}><b style={{color:'var(--ink)'}}>{e.n}</b>: {fmtSets(e.sets)} {s.u}</p>))}
            {sure===s.id?<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>{setLog(log.filter(x=>x.id!==s.id));setSure(null);setOpen(null)}}>Tap again to delete</button>:<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>setSure(s.id)}>Delete</button>}
          </div>)}
        </div>
      ))}
    </div>
  </>);
}

