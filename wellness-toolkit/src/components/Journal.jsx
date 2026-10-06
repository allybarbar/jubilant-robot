import {useState,useEffect} from 'react';
import {PREF,SAVE} from '../lib/storage';

const JQ=[['a','What did you achieve today?','Even something small counts.'],['g','What are you grateful for?','A person, a moment, anything.'],['h','What are your hopes for tomorrow?','One thing you are looking forward to.']];
const dayKey=(d=new Date())=>{const z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
const dayLabel=k=>new Date(k+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
const streakOf=log=>{const days=new Set(log.map(e=>e.day));const d=new Date();if(!days.has(dayKey(d)))d.setDate(d.getDate()-1);let n=0;while(days.has(dayKey(d))){n++;d.setDate(d.getDate()-1)}return n};

export default function Journal(){
  const today=dayKey();
  const [log,setLog]=useState(()=>PREF('bw_j_log',[]));
  const [draft,setDraft]=useState(()=>{
    const d=PREF('bw_j_draft',null);
    if(d&&d.day===dayKey())return d;
    const e=PREF('bw_j_log',[]).find(x=>x.day===dayKey());
    return e?{day:e.day,a:e.a,g:e.g,h:e.h}:{day:dayKey(),a:'',g:'',h:''};
  });
  const [open,setOpen]=useState(null);
  const [sure,setSure]=useState(null);
  const [saved,setSaved]=useState(false);
  useEffect(()=>{SAVE('bw_j_draft',draft)},[draft]);
  useEffect(()=>{SAVE('bw_j_log',log)},[log]);
  const set=k=>e=>{setSaved(false);setDraft({...draft,[k]:e.target.value})};
  const has=log.some(e=>e.day===today);
  const empty=!(draft.a.trim()||draft.g.trim()||draft.h.trim());
  const save=()=>{
    if(empty)return;
    const e={day:today,d:Date.now(),a:draft.a.trim(),g:draft.g.trim(),h:draft.h.trim()};
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
    <div className="row"><button onClick={save} disabled={empty} style={{opacity:empty?0.5:1}}>{has?'Update today':'Save entry'}</button></div>
    {saved&&<p style={{textAlign:'center'}}>Saved. See you tomorrow.</p>}
    <p className="warn">Entries are stored only in this browser on this device.</p>
    <div className="card">
      <div className="set"><span>Entries</span><b>{log.length}</b></div>
      {log.slice(0,30).map(e=>(
        <div key={e.day}>
          <button className="hrow" onClick={()=>setOpen(open===e.day?null:e.day)}><span>{dayLabel(e.day)}</span><b>{open===e.day?'Hide':'View'}</b></button>
          {open===e.day?(<div style={{display:'flex',flexDirection:'column',gap:8,paddingBottom:10}}>
            {JQ.map(([k,q])=>e[k]?(<div key={k}><p><b style={{color:'var(--ink)'}}>{q}</b></p><p style={{color:'var(--ink)'}}>{e[k]}</p></div>):null)}
            {sure===e.day?<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>{setLog(log.filter(x=>x.day!==e.day));setSure(null);setOpen(null)}}>Tap again to delete</button>:<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>setSure(e.day)}>Delete</button>}
          </div>):null}
        </div>
      ))}
    </div>
  </>);
}

