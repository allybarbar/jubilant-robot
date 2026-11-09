import {useState,useEffect} from 'react';
import {PREF,SAVE} from '../lib/storage.js';

const JQ=[['a','What did you achieve today?','Even something small counts.'],['g','What are you grateful for?','A person, a moment, anything.'],['h','What are your hopes for tomorrow?','One thing you are looking forward to.']];
const dayKey=(d=new Date())=>{const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
const dayLabel=k=>new Date(k+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
const streakOf=log=>{const days=new Set(log.map(e=>e.day));const d=new Date();if(!days.has(dayKey(d)))d.setDate(d.getDate()-1);let n=0;while(days.has(dayKey(d))){n++;d.setDate(d.getDate()-1)}return n};

export default function Journal(){
  const today=dayKey();
  const [log,setLog]=useState(()=>PREF('bw_j_log',[]));
  const [draft,setDraft]=useState(()=>{
    const d=PREF('bw_j_draft',null);
    if(d&&d.day===dayKey())return {...d,nutrition:Boolean(d.nutrition),emptyStomach:Boolean(d.emptyStomach)};
    const e=PREF('bw_j_log',[]).find(x=>x.day===dayKey());
    return e?{day:e.day,a:e.a,g:e.g,h:e.h,nutrition:Boolean(e.nutrition),emptyStomach:Boolean(e.emptyStomach)}:{day:dayKey(),a:'',g:'',h:'',nutrition:false,emptyStomach:false};
  });
  const [open,setOpen]=useState(null);
  const [sure,setSure]=useState(null);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{SAVE('bw_j_draft',draft)},[draft]);
  useEffect(()=>{SAVE('bw_j_log',log)},[log]);
  const set=k=>e=>{setSaved(false);setDraft({...draft,[k]:e.target.value})};
  const setCheck=k=>e=>{setSaved(false);setDraft({...draft,[k]:e.target.checked})};
  const has=log.some(e=>e.day===today);
  const save=()=>{
    const e={day:today,d:Date.now(),a:draft.a.trim(),g:draft.g.trim(),h:draft.h.trim(),nutrition:Boolean(draft.nutrition),emptyStomach:Boolean(draft.emptyStomach)};
    setLog([e,...log.filter(x=>x.day!==today)].sort((x,y)=>x.day<y.day?1:-1));
    setSaved(true);
  };
  const streak=streakOf(log);
  return (<>
    <div className="set"><b>{dayLabel(today)}</b><span>{streak>0?streak+' day streak':'Start your streak'}</span></div>
    {JQ.map(([k,q,ph])=>(
      <div className="card" key={k}>
        <label htmlFor={'j-'+k}><b>{q}</b></label>
        <textarea id={'j-'+k} className="ta" rows="2" maxLength="300" placeholder={ph} value={draft[k]} onChange={set(k)}/>
        <p style={{textAlign:'right'}}>{draft[k].length}/300</p>
      </div>
    ))}
    <div className="card journal-checklist">
      <label className="journal-check"><input type="checkbox" checked={Boolean(draft.nutrition)} onChange={setCheck('nutrition')}/><span><b>Am I happy with my nutrition today?</b><small>Check this if yes.</small></span></label>
      <label className="journal-check"><input type="checkbox" checked={Boolean(draft.emptyStomach)} onChange={setCheck('emptyStomach')}/><span><b>Am I going to bed with an empty stomach?</b><small>Check this if yes.</small></span></label>
    </div>
    <div className="row"><button onClick={save}>{has?'Update today':'Save entry'}</button></div>
    {saved&&<p style={{textAlign:'center'}}>Saved. See you tomorrow.</p>}
    <p className="warn">Entries are stored only in this browser on this device.</p>
    <div className="card">
      <div className="set"><span>Entries</span><b>{log.length}</b></div>
      {log.slice(0,30).map(e=>(
        <div key={e.day}>
          <button className="hrow" onClick={()=>setOpen(open===e.day?null:e.day)}><span>{dayLabel(e.day)}</span><b>{open===e.day?'Hide':'View'}</b></button>
          {open===e.day?(<div style={{display:'flex',flexDirection:'column',gap:8,paddingBottom:10}}>
            {JQ.map(([k,q])=>e[k]?(<div key={k}><p><b style={{color:'var(--ink)'}}>{q}</b></p><p style={{color:'var(--ink)'}}>{e[k]}</p></div>):null)}
            {typeof e.nutrition==='boolean'&&<div><p><b style={{color:'var(--ink)'}}>Happy with my nutrition today</b></p><p style={{color:'var(--ink)'}}>{e.nutrition?'Yes':'No'}</p></div>}
            {typeof e.emptyStomach==='boolean'&&<div><p><b style={{color:'var(--ink)'}}>Going to bed with an empty stomach</b></p><p style={{color:'var(--ink)'}}>{e.emptyStomach?'Yes':'No'}</p></div>}
            {sure===e.day?<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>{setLog(log.filter(x=>x.day!==e.day));setSure(null);setOpen(null)}}>Tap again to delete</button>:<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>setSure(e.day)}>Delete</button>}
          </div>):null}
        </div>
      ))}
    </div>
  </>);
}

