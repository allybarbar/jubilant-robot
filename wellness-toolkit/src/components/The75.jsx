import {useEffect,useMemo,useState} from 'react';
import {PRESETS,createCustomTasks} from '../data/challengePresets.js';
import {getDateInTimeZone,getChallengeDayNumber,getDayState,getRolloverState,isDayComplete} from '../lib/challengeLogic.js';
import {
  abandonAttempt,exportData,failAndRestart,getActiveAttempt,getAttempt,getDay,getPhoto,
  importData,listAttempts,listDays,saveDay,savePhoto,startAttempt
} from '../lib/challengeStorage.js';

const localZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'UTC';
const startOfToday=()=>getDateInTimeZone(new Date(),localZone());
const newProgress=()=>({});

export default function The75(){
  const [attempt,setAttempt]=useState(null);
  const [attempts,setAttempts]=useState([]);
  const [days,setDays]=useState([]);
  const [todayDate,setTodayDate]=useState(startOfToday);
  const [progress,setProgress]=useState(newProgress);
  const [photoRef,setPhotoRef]=useState(null);
  const [photoUrl,setPhotoUrl]=useState('');
  const [presetId,setPresetId]=useState('hard');
  const [customTasks,setCustomTasks]=useState(createCustomTasks);
  const [resetOnMiss,setResetOnMiss]=useState(false);
  const [startDate,setStartDate]=useState(startOfToday);
  const [view,setView]=useState('today');
  const [setupOpen,setSetupOpen]=useState(false);
  const [confirmExit,setConfirmExit]=useState(false);
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState('');
  const [status,setStatus]=useState('');

  async function refresh(preferredAttemptId){
    setLoading(true);
    try{
      const savedAttempts=await listAttempts();
      const active=preferredAttemptId?await getAttempt(preferredAttemptId):await getActiveAttempt();
      const selected=active||(!preferredAttemptId?savedAttempts.find(item=>item.status==='completed'):null)||null;
      setAttempts(savedAttempts);
      setAttempt(selected);
      if(selected){
        const savedDays=await listDays(selected.id);
        setDays(savedDays);
        const currentDate=getDateInTimeZone(new Date(),selected.timezone||'UTC');
        setTodayDate(currentDate);
        const dayNumber=getChallengeDayNumber(selected.startDate,currentDate);
        const record=dayNumber?await getDay(selected.id,Math.min(75,dayNumber)):null;
        setProgress(record?.progress||newProgress());
        setPhotoRef(record?.photoRef||null);
        if(record?.photoRef){
          const blob=await getPhoto(record.photoRef);
          setPhotoUrl(blob?URL.createObjectURL(blob):'');
        }else setPhotoUrl('');
      }else{
        setDays([]);setProgress(newProgress());setPhotoRef(null);setPhotoUrl('');setTodayDate(startOfToday());
      }
    }catch(cause){setError(cause.message||'Could not load challenge data.');}
    finally{setLoading(false);}
  }

  useEffect(()=>{refresh()},[]);
  useEffect(()=>{
    const timer=setInterval(()=>setTodayDate(getDateInTimeZone(new Date(),attempt?.timezone||localZone())),30000);
    return ()=>clearInterval(timer);
  },[attempt?.timezone]);
  useEffect(()=>{
    if(!attempt)return;
    let cancelled=false;
    async function loadCurrentDay(){
      const currentDay=getChallengeDayNumber(attempt.startDate,todayDate);
      const record=currentDay?await getDay(attempt.id,Math.min(75,currentDay)):null;
      if(cancelled)return;
      setProgress(record?.progress||newProgress());
      setPhotoRef(record?.photoRef||null);
      if(record?.photoRef){
        const blob=await getPhoto(record.photoRef);
        if(!cancelled)setPhotoUrl(blob?URL.createObjectURL(blob):'');
      }else setPhotoUrl('');
    }
    loadCurrentDay().catch(cause=>{if(!cancelled)setError(cause.message||'Could not load today’s progress.');});
    return ()=>{cancelled=true};
  },[attempt?.id,todayDate]);
  useEffect(()=>()=>{if(photoUrl)URL.revokeObjectURL(photoUrl)},[photoUrl]);

  const timezone=attempt?.timezone||localZone();
  const rawDayNumber=attempt?getChallengeDayNumber(attempt.startDate,todayDate):null;
  const dayNumber=rawDayNumber===null?null:Math.min(75,rawDayNumber);
  const rollover=attempt?getRolloverState(attempt,days,todayDate):null;
  const tasks=attempt?.config.tasks||[];
  const dayComplete=useMemo(()=>isDayComplete(tasks,progress,photoRef),[tasks,progress,photoRef]);
  const customReady=customTasks.some(task=>task.enabled);
  const streak=useMemo(()=>{
    const done=new Set(days.filter(day=>day.completed).map(day=>day.dayNumber));
    let current=dayNumber||0;
    if(current&& !done.has(current))current--;
    let count=0;
    while(current>0&&done.has(current)){count++;current--;}
    return count;
  },[days,dayNumber]);

  async function beginChallenge(){
    setError('');setStatus('');
    const preset=PRESETS[presetId];
    const config={
      label:preset?.label||'Custom',
      resetOnMiss:preset?preset.resetOnMiss:resetOnMiss,
      tasks:(preset?preset.tasks:customTasks).map(task=>({...task}))
    };
    if(!config.tasks.some(task=>task.enabled)){setError('Choose at least one task for your custom challenge.');return;}
    try{
      const created=await startAttempt({presetId,config,startDate,timezone:localZone()});
      setSetupOpen(false);setView('today');await refresh(created.id);
      setStatus('Your challenge has started.');
    }catch(cause){setError(cause.message||'Could not start the challenge.');}
  }

  async function restartChallenge(){
    try{
      const next=await failAndRestart(attempt.id,{startDate:todayDate,timezone});
      setView('today');setStatus('A new attempt has started. Your previous attempt remains in history.');
      await refresh(next.id);
    }catch(cause){setError(cause.message||'Could not start a new attempt.');}
  }

  async function endAndChooseAnother(){
    try{
      await abandonAttempt(attempt.id);
      setConfirmExit(false);setSetupOpen(true);setView('today');
      await refresh();
      setStatus('Attempt ended and saved in history. Choose another challenge.');
    }catch(cause){setError(cause.message||'Could not end this attempt.');}
  }

  async function persistDay(nextProgress=progress,nextPhotoRef=photoRef){
    if(!attempt||!dayNumber||attempt.status!=='active')return;
    try{
      const saved=await saveDay({
        attemptId:attempt.id,dayNumber,date:todayDate,progress:nextProgress,
        completed:false,photoRef:nextPhotoRef||undefined
      });
      setDays(current=>[...current.filter(day=>day.dayNumber!==dayNumber),saved].sort((a,b)=>a.dayNumber-b.dayNumber));
      const updated=await getAttempt(attempt.id);
      setAttempt(updated);
      setAttempts(await listAttempts());
      setStatus(saved.completed?'Day complete. Progress saved.':'Progress saved.');
    }catch(cause){setError(cause.message||'Could not save today’s progress.');}
  }

  function updateProgress(taskId,value){
    setError('');
    const next={...progress,[taskId]:value};
    setProgress(next);persistDay(next,photoRef);
  }

  async function handlePhoto(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    try{
      const nextPhoto=await savePhoto(file);
      setPhotoRef(nextPhoto);setPhotoUrl(URL.createObjectURL(file));
      await persistDay(progress,nextPhoto);
    }catch(cause){setError(cause.message||'Could not save the photo.');}
  }

  async function downloadBackup(){
    try{
      const data=await exportData();
      const url=URL.createObjectURL(new Blob([data],{type:'application/json'}));
      const link=document.createElement('a');
      link.href=url;link.download='the-75-backup.json';link.click();
      URL.revokeObjectURL(url);setStatus('Backup downloaded.');
    }catch(cause){setError(cause.message||'Could not export challenge data.');}
  }

  async function loadBackup(event){
    const file=event.target.files?.[0];
    event.target.value='';
    if(!file)return;
    try{await importData(await file.text());await refresh();setStatus('Backup imported.');}
    catch(cause){setError(cause.message||'Could not import that backup.');}
  }

  function choosePreset(next){
    setPresetId(next);
    if(next==='custom')setCustomTasks(createCustomTasks());
  }

  if(loading)return <div className="challenge-loading" role="status">Loading challenge…</div>;

  return <section className="challenge">
    <header className="challenge-head">
      <div><p className="challenge-kicker">WELLNESS TOOLKIT / DAILY PRACTICE</p><h1>The 75</h1></div>
      <div className="challenge-tools">
        <button className="tab" type="button" onClick={downloadBackup} aria-label="Export challenge backup">Export</button>
        <label className="tab challenge-file-label">Import<input type="file" accept="application/json,.json" onChange={loadBackup}/></label>
      </div>
    </header>

    {error&&<p className="challenge-message error" role="alert">{error}</p>}
    {status&&<p className="challenge-message" role="status">{status}</p>}

    {attempt&& !setupOpen ? <>
      <div className="challenge-switch" role="tablist" aria-label="Challenge sections">
        <button type="button" role="tab" aria-selected={view==='today'} className={view==='today'?'selected':''} onClick={()=>setView('today')}>Today</button>
        <button type="button" role="tab" aria-selected={view==='progress'} className={view==='progress'?'selected':''} onClick={()=>setView('progress')}>Progress</button>
      </div>
      {attempt.status==='active'&&<div className="challenge-end-prompt">
        <span>Ready to stop this challenge?</span>
        <button type="button" className="challenge-end-button" onClick={()=>setConfirmExit(true)}>End challenge</button>
      </div>}
      {confirmExit&&<div className="challenge-reset" role="alertdialog" aria-labelledby="challenge-end-title">
        <div><strong id="challenge-end-title">End this challenge?</strong><p>Your progress will stay in attempt history, and you can start a new challenge any time.</p></div>
        <div className="challenge-exit-actions"><button type="button" className="ghost" onClick={()=>setConfirmExit(false)}>Keep going</button><button type="button" className="challenge-end-button" onClick={endAndChooseAnother}>End challenge</button></div>
      </div>}

      {attempt.status==='active'&&rollover?.resetRequired&&<div className="challenge-reset" role="alert">
        <div><strong>Day {rollover.missedDayNumber} was missed.</strong><p>{attempt.config.resetOnMiss?'This challenge resets when a day is missed. Start a new attempt to continue.':''}</p></div>
        <button type="button" onClick={restartChallenge}>Start new attempt</button>
      </div>}

      {view==='today'&&<>
        <div className="challenge-day-heading">
          <div><p className="challenge-kicker">{attempt.config.label||PRESETS[attempt.presetId]?.label||'CUSTOM CHALLENGE'}</p>
            <h2>{dayNumber?`Day ${Math.min(dayNumber,75)} of 75`: `Starts ${attempt.startDate}`}</h2></div>
          <span className={'challenge-day-mark'+(dayComplete?' done':'')}>{dayNumber?String(Math.min(dayNumber,75)).padStart(2,'0'):'—'}</span>
        </div>
        {attempt.status==='completed'&&<div className="challenge-complete" role="status"><strong>Challenge complete.</strong> All 75 days are in the books.</div>}
        {attempt.status==='active'&&dayNumber&&!rollover?.resetRequired&&<div className="challenge-stats"><span>Current streak</span><strong>{streak} {streak===1?'day':'days'}</strong></div>}
        {attempt.status==='active'&&dayNumber&&!rollover?.resetRequired&&<div className="challenge-task-list">
          {tasks.filter(task=>task.enabled).map(task=><TaskControl key={task.id} task={task} value={progress[task.id]} photoUrl={task.requiresPhoto?photoUrl:''} onChange={value=>updateProgress(task.id,value)} onPhoto={handlePhoto}/>) }
          <p className="challenge-save-note">Your progress saves on this device as you go.</p>
        </div>}
        {attempt.status==='active'&&!dayNumber&&<p className="challenge-message">Your start date is in the future. Your first day begins {attempt.startDate}.</p>}
        <button type="button" className="challenge-link" onClick={()=>setView('progress')}>View all 75 days and attempt history</button>
      </>}

      {view==='progress'&&<ProgressView attempt={attempt} attempts={attempts} days={days} todayDate={todayDate} dayNumber={dayNumber} onNew={()=>setSetupOpen(true)} onOpenAttempt={async id=>{setView('progress');await refresh(id)}}/>}
    </>:<>
      <StartView
        presetId={presetId} onPreset={choosePreset} startDate={startDate} onStartDate={setStartDate}
        customTasks={customTasks} onCustomTasks={setCustomTasks} resetOnMiss={resetOnMiss} onReset={setResetOnMiss}
        customReady={customReady} attempts={attempts} onStart={beginChallenge} onOpenAttempt={async id=>{setSetupOpen(false);await refresh(id)}}
      />
    </>}
  </section>;
}

function TaskControl({task,value,photoUrl,onChange,onPhoto}){
  if(task.type==='checkbox'&&task.requiresPhoto){
    return <article className="challenge-task">
      <div className="challenge-task-copy"><strong>{task.label}</strong><span>Required to complete this task</span></div>
      <label className="challenge-photo-button">{photoUrl?'Replace photo':'Add photo'}<input type="file" accept="image/*" capture="environment" onChange={onPhoto}/></label>
      {photoUrl&&<img className="challenge-photo-preview" src={photoUrl} alt="Today’s progress"/>}
    </article>;
  }
  if(task.type==='checkbox')return <label className="challenge-task challenge-check-task">
    <span className="challenge-task-copy"><strong>{task.label}</strong></span>
    <input type="checkbox" checked={Boolean(value)} onChange={event=>onChange(event.target.checked)}/>
  </label>;
  if(task.type==='duration'){
    const minutes=typeof value==='object'&&value?value.minutes??'':value??'';
    const outdoor=typeof value==='object'&&value?Boolean(value.outdoor):false;
    return <article className="challenge-task">
      <label className="challenge-task-copy"><strong>{task.label}</strong><span>Target: {task.target} {task.unit}</span></label>
      <div className="challenge-duration"><input type="number" min="0" step="1" inputMode="numeric" aria-label={`${task.label} duration in minutes`} value={minutes} onChange={event=>onChange({minutes:Number(event.target.value)||0,outdoor,workoutType:value?.workoutType})}/><span>min</span></div>
      {task.requiresWorkoutType&&<label className="challenge-workout-type">Workout type
        <select aria-label="Workout type" value={value?.workoutType||''} onChange={event=>onChange({minutes:Number(minutes)||0,outdoor,workoutType:event.target.value})}>
          <option value="">Select a workout</option>
          {task.workoutTypes.map(type=><option key={type} value={type}>{type}</option>)}
        </select>
      </label>}
      <label className="challenge-outdoor"><input type="checkbox" checked={outdoor} onChange={event=>onChange({minutes:Number(minutes)||0,outdoor:event.target.checked,workoutType:value?.workoutType})}/>{task.outdoorRequired?'Outdoors required':'Outdoors'}</label>
    </article>;
  }
  const amount=Number(value)||0;
  const add=increment=>onChange(amount+increment);
  return <article className="challenge-task challenge-counter">
    <div className="challenge-task-copy"><strong>{task.label}</strong><span>Target: {task.target} {task.unit}</span></div>
    {task.id==='water'&&<div className="challenge-quick-add"><button type="button" onClick={()=>add(250)}>+250 ml</button><button type="button" onClick={()=>add(500)}>+500 ml</button></div>}
    <div className="challenge-counter-input"><input type="number" min="0" step={task.unit==='pages'?1:50} inputMode="numeric" aria-label={`${task.label} ${task.unit}`} value={value??''} onChange={event=>onChange(Number(event.target.value)||0)}/><span>{task.unit}</span></div>
  </article>;
}

function StartView({presetId,onPreset,startDate,onStartDate,customTasks,onCustomTasks,resetOnMiss,onReset,customReady,attempts,onStart,onOpenAttempt}){
  const updateTask=(id,change)=>onCustomTasks(current=>current.map(task=>task.id===id?{...task,...change}:task));
  return <>
    <div className="challenge-start-title"><p className="challenge-kicker">BUILD A DAILY PRACTICE</p><h2>Choose your challenge</h2></div>
    <div className="challenge-presets" role="radiogroup" aria-label="Challenge rules">
      {[['hard','75 Hard','Strict rules. A missed day starts a new attempt.'],['soft','75 Soft','Flexible rules. Keep going after a missed day.'],['custom','Custom','Choose the tasks and set your own targets.']].map(([id,title,copy])=><button type="button" key={id} role="radio" aria-checked={presetId===id} className={presetId===id?'active':''} onClick={()=>onPreset(id)}><strong>{title}</strong><span>{copy}</span></button>)}
    </div>
    {presetId==='custom'&&<div className="challenge-editor">
      <div className="challenge-section-title"><h3>Your daily tasks</h3><span>{customTasks.filter(task=>task.enabled).length} selected</span></div>
      {customTasks.map(task=><div className="challenge-edit-row" key={task.id}>
        <label><input type="checkbox" checked={task.enabled} onChange={event=>updateTask(task.id,{enabled:event.target.checked})}/><strong>{task.label}</strong></label>
        {task.enabled&&task.type!=='checkbox'&&<div><input aria-label={`${task.label} target`} type="number" min="1" value={task.target} onChange={event=>updateTask(task.id,{target:Number(event.target.value)||1})}/><span>{task.unit}</span></div>}
        {task.enabled&&task.type==='duration'&&<label className="challenge-inline-toggle"><input type="checkbox" checked={Boolean(task.outdoorRequired)} onChange={event=>updateTask(task.id,{outdoorRequired:event.target.checked})}/>Outdoor required</label>}
      </div>)}
      <label className="challenge-reset-option"><input type="checkbox" checked={resetOnMiss} onChange={event=>onReset(event.target.checked)}/>Reset the attempt after a missed day</label>
    </div>}
    {presetId!=='custom'&&<div className="challenge-preset-summary"><strong>{PRESETS[presetId].label} includes</strong><p>{PRESETS[presetId].tasks.map(task=>task.label+(task.type==='checkbox'?'':` · ${task.target} ${task.unit}`)).join(' / ')}</p></div>}
    <div className="challenge-start-form"><label htmlFor="challenge-start-date">Start date</label><input id="challenge-start-date" type="date" value={startDate} onChange={event=>onStartDate(event.target.value)}/><button type="button" onClick={onStart} disabled={presetId==='custom'&&!customReady}>Start challenge</button></div>
    <p className="challenge-privacy">Challenge records stay in this browser. Export a backup to move them to another device.</p>
    {attempts.length>0&&<div className="challenge-history"><h3>Attempt history</h3>{attempts.map(item=><button type="button" className="challenge-history-row" key={item.id} onClick={()=>onOpenAttempt(item.id)}><span><strong>{item.config.label||PRESETS[item.presetId]?.label||'Custom'}</strong><small>Started {item.startDate}</small></span><b className={'status-'+item.status}>{item.status}</b></button>)}</div>}
  </>;
}

function ProgressView({attempt,attempts,days,todayDate,dayNumber,onNew,onOpenAttempt}){
  const byDay=new Map(days.map(day=>[day.dayNumber,day]));
  const completeCount=days.filter(day=>day.completed).length;
  return <div className="challenge-progress">
    <div className="challenge-progress-summary"><div><span>Days complete</span><strong>{completeCount}<small> / 75</small></strong></div><div><span>Start date</span><strong>{attempt.startDate}</strong></div><div><span>Time zone</span><strong>{attempt.timezone}</strong></div></div>
    <div className="challenge-calendar" aria-label="75-day progress grid">
      {Array.from({length:75},(_,index)=>index+1).map(day=>{
        const state=getDayState(day,dayNumber||0,byDay.get(day));
        return <div key={day} className={`challenge-calendar-day ${state}`} title={`Day ${day}: ${state}`} aria-label={`Day ${day}, ${state}`}><span>{day}</span></div>;
      })}
    </div>
    <div className="challenge-legend"><span><i className="complete"/>Complete</span><span><i className="missed"/>Missed</span><span><i className="upcoming"/>Upcoming</span></div>
    {attempt.status==='completed'&&<button type="button" className="challenge-new-button" onClick={onNew}>Start another challenge</button>}
    <div className="challenge-history"><h3>Attempt history</h3>
      {attempts.map(item=><button type="button" className="challenge-history-row" key={item.id} onClick={()=>onOpenAttempt(item.id)}><span><strong>{item.config.label||PRESETS[item.presetId]?.label||'Custom'}</strong><small>{item.startDate}{item.id===attempt.id&&todayDate?` · Current view`:''}</small></span><b className={`status-${item.status}`}>{item.status}</b></button>)}
    </div>
  </div>;
}