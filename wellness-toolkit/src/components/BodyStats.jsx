import {useEffect,useState} from 'react';
import {PREF,SAVE} from '../lib/storage';

const todayKey=()=>{const d=new Date(),z=n=>String(n).padStart(2,'0');return d.getFullYear()+'-'+z(d.getMonth()+1)+'-'+z(d.getDate())};
const dayLabel=k=>new Date(k+'T12:00:00').toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short',year:'numeric'});
const emptyDraft=()=>({weight:'',height:'',waist:'',systolic:'',diastolic:''});
const draftFor=entry=>entry?{weight:entry.weight??'',height:entry.height??'',waist:entry.waist??'',systolic:entry.systolic??'',diastolic:entry.diastolic??''}:emptyDraft();
const convert=(value,factor)=>value===''?'':String(Number((Number(value)*factor).toFixed(2)));
const hasMeasurements=d=>d.weight!==''||d.height!==''||d.waist!==''||d.systolic!==''||d.diastolic!=='';

export default function BodyStats(){
  const [log,setLog]=useState(()=>PREF('bw_body_log',[]));
  const initialDay=todayKey();
  const initialEntry=log.find(item=>item.day===initialDay);
  const [date,setDate]=useState(initialDay);
  const [draft,setDraft]=useState(()=>draftFor(initialEntry));
  const [weightUnit,setWeightUnit]=useState(()=>initialEntry?.weightUnit||PREF('bw_body_weight_unit','kg'));
  const [lengthUnit,setLengthUnit]=useState(()=>initialEntry?.lengthUnit||PREF('bw_body_length_unit','cm'));
  const [open,setOpen]=useState(null);
  const [sure,setSure]=useState(null);
  const [saved,setSaved]=useState(false);

  useEffect(()=>{SAVE('bw_body_log',log)},[log]);
  useEffect(()=>{SAVE('bw_body_weight_unit',weightUnit)},[weightUnit]);
  useEffect(()=>{SAVE('bw_body_length_unit',lengthUnit)},[lengthUnit]);

  const selectDate=nextDate=>{
    setDate(nextDate);
    setSaved(false);
    const entry=log.find(item=>item.day===nextDate);
    setDraft(draftFor(entry));
    if(entry){setWeightUnit(entry.weightUnit);setLengthUnit(entry.lengthUnit)}
  };
  const setField=key=>event=>{setSaved(false);setDraft(current=>({...current,[key]:event.target.value}))};
  const changeWeightUnit=unit=>{
    if(unit!==weightUnit){
      const factor=weightUnit==='kg'?2.20462:1/2.20462;
      setDraft(current=>({...current,weight:convert(current.weight,factor)}));
      setWeightUnit(unit);
    }
  };
  const changeLengthUnit=unit=>{
    if(unit!==lengthUnit){
      const factor=lengthUnit==='cm'?1/2.54:2.54;
      setDraft(current=>({...current,height:convert(current.height,factor),waist:convert(current.waist,factor)}));
      setLengthUnit(unit);
    }
  };
  const save=event=>{
    event.preventDefault();
    if(!hasMeasurements(draft))return;
    const entry={...draft,day:date,weightUnit,lengthUnit};
    setLog(current=>[entry,...current.filter(item=>item.day!==date)].sort((a,b)=>a.day<b.day?1:-1));
    setSaved(true);
  };
  const hasBloodPressure=draft.systolic!==''||draft.diastolic!=='';
  const existing=log.some(entry=>entry.day===date);

  return (<>
    <form className="card" onSubmit={save}>
      <div className="set"><b>Record body stats</b><label htmlFor="body-date">Date</label></div>
      <input id="body-date" className="txt" type="date" value={date} onChange={event=>selectDate(event.target.value)} required/>
      <div className="set"><span>Weight</span><div className="row">{['kg','lb'].map(unit=><button type="button" key={unit} className={'tab'+(weightUnit===unit?' on':'')} style={{padding:'6px 12px'}} onClick={()=>changeWeightUnit(unit)} aria-pressed={weightUnit===unit}>{unit}</button>)}</div></div>
      <input className="num" type="number" inputMode="decimal" min="0.1" step="any" value={draft.weight} onChange={setField('weight')} placeholder={'Weight ('+weightUnit+')'} aria-label={'Weight in '+weightUnit}/>
      <div className="set"><span>Height and waist</span><div className="row">{['cm','in'].map(unit=><button type="button" key={unit} className={'tab'+(lengthUnit===unit?' on':'')} style={{padding:'6px 12px'}} onClick={()=>changeLengthUnit(unit)} aria-pressed={lengthUnit===unit}>{unit}</button>)}</div></div>
      <div className="body-measures">
        <label>Height<input className="num" type="number" inputMode="decimal" min="0.1" step="any" value={draft.height} onChange={setField('height')} placeholder={lengthUnit} aria-label={'Height in '+lengthUnit}/></label>
        <label>Waist<input className="num" type="number" inputMode="decimal" min="0.1" step="any" value={draft.waist} onChange={setField('waist')} placeholder={lengthUnit} aria-label={'Waist in '+lengthUnit}/></label>
      </div>
      <div className="set"><span>Blood pressure</span><span>mmHg</span></div>
      <div className="body-measures">
        <label>Systolic<input className="num" type="number" inputMode="numeric" min="1" step="1" value={draft.systolic} onChange={setField('systolic')} placeholder="Top number" aria-label="Systolic blood pressure" required={hasBloodPressure}/></label>
        <label>Diastolic<input className="num" type="number" inputMode="numeric" min="1" step="1" value={draft.diastolic} onChange={setField('diastolic')} placeholder="Bottom number" aria-label="Diastolic blood pressure" required={hasBloodPressure}/></label>
      </div>
      <button type="submit" disabled={!hasMeasurements(draft)} style={{opacity:hasMeasurements(draft)?1:0.5}}>{existing?'Update entry':'Save entry'}</button>
      {saved&&<p role="status">Saved body stats for {dayLabel(date)}.</p>}
      <p className="warn">Measurements are saved only in this browser on this device. Blood pressure is recorded for tracking, not diagnosis.</p>
    </form>
    <div className="card">
      <div className="set"><span>Measurement history</span><b>{log.length}</b></div>
      {log.length===0&&<p>No measurements yet.</p>}
      {log.map(entry=>(
        <div key={entry.day}>
          <button className="hrow" onClick={()=>setOpen(open===entry.day?null:entry.day)} aria-expanded={open===entry.day}>
            <span>{dayLabel(entry.day)}</span><b>{open===entry.day?'Hide':'View'}</b>
          </button>
          {open===entry.day&&<div className="body-entry">
            {entry.weight!==''&&<p><b>Weight</b> {entry.weight} {entry.weightUnit}</p>}
            {entry.height!==''&&<p><b>Height</b> {entry.height} {entry.lengthUnit}</p>}
            {entry.waist!==''&&<p><b>Waist</b> {entry.waist} {entry.lengthUnit}</p>}
            {entry.systolic!==''&&entry.diastolic!==''&&<p><b>Blood pressure</b> {entry.systolic}/{entry.diastolic} mmHg</p>}
            {sure===entry.day?<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>{setLog(current=>current.filter(item=>item.day!==entry.day));setSure(null);setOpen(null)}}>Tap again to delete</button>:<button className="ghost" style={{padding:'6px 14px',alignSelf:'flex-start'}} onClick={()=>setSure(entry.day)}>Delete</button>}
          </div>}
        </div>
      ))}
    </div>
  </>);
}
