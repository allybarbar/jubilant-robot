import {useState} from 'react';
import {collectInsightsData,generateInsights,hasInsightsData} from '../lib/insights.js';

const SCREEN_LABELS={
  breath:'Breathing',
  cold:'Cold shower',
  hiit:'HIIT',
  weights:'Weights',
  yoga:'Yoga',
  journal:'Journal',
  body:'Body stats',
  challenge:'The 75'
};

export default function Insights({screen}){
  const [includePrivate,setIncludePrivate]=useState(false);
  const [summary,setSummary]=useState('');
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const label=SCREEN_LABELS[screen];
  const isPrivate=screen==='journal'||screen==='body';
  const data=collectInsightsData(screen,includePrivate);
  const hasData=hasInsightsData(data);

  const generate=async()=>{
    const currentData=collectInsightsData(screen,includePrivate);
    setError('');
    setSummary('');
    if(!hasInsightsData(currentData)){
      setStatus('No saved entries found for this section in the last 30 days.');
      return;
    }

    setBusy(true);
    setStatus('Loading the on-device model. First use may download several hundred megabytes.');
    try{
      const result=await generateInsights(currentData,progress=>{
        if(progress.status==='progress'&&Number.isFinite(progress.progress)){
          const file=progress.file?progress.file.split('/').at(-1):'model file';
          setStatus(`Downloading ${file} (${Math.round(progress.progress)}%).`);
        }else if(progress.status==='done'){
          setStatus('Model ready. Generating your summary on this device…');
        }else if(progress.status==='generating'){
          const section=progress.screen?` ${progress.screen} insights`: ' your summary';
          const count=progress.current&&progress.total?` (${progress.current} of ${progress.total})`:'';
          setStatus(`Generating${section}${count} on this device…`);
        }
      });
      setSummary(result);
      setStatus('Summary generated on this device.');
    }catch(cause){
      setError(cause instanceof Error?cause.message:String(cause));
      setStatus('');
    }finally{
      setBusy(false);
    }
  };

  return (<>
    <div className="card">
      <b>Insights for {label}</b>
      <p>Find patterns in this section’s saved data from the last 30 days.</p>
      {isPrivate&&<label className="set insights-private">
        <input type="checkbox" checked={includePrivate} disabled={busy} onChange={event=>{
          setIncludePrivate(event.target.checked);
          setSummary('');
          setStatus('');
          setError('');
        }}/>
        <span>Include {screen==='journal'?'journal answers':'body measurements'} in the insight</span>
      </label>}
      <p className="warn">Your data is processed in this browser and is not sent to an AI service. The model files are downloaded from Hugging Face on first use and then cached by your browser.{isPrivate?' This section contains sensitive information; include it only if you want it used in the insight.':''}</p>
      {!hasData&&<p>No saved entries found for this section in the last 30 days.</p>}
      <button onClick={generate} disabled={busy} style={{opacity:busy?0.5:1}}>
        {busy?'Generating…':'Generate insight'}
      </button>
      {busy&&<div className="bar" role="progressbar" aria-label="On-device AI progress"><div className="indeterminate"/></div>}
      {status&&<p role="status">{status}</p>}
      {error&&<p className="insights-error" role="alert">Could not generate the summary: {error}</p>}
    </div>
    {summary&&<div className="card insights-summary">
      <b>{label} insight</b>
      <p>{summary}</p>
    </div>}
  </>);
}
