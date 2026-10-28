import {useState} from 'react';
import {collectInsightsData,generateInsights,hasInsightsData} from '../lib/insights.js';

export default function Insights(){
  const [includePrivate,setIncludePrivate]=useState(false);
  const [summary,setSummary]=useState('');
  const [status,setStatus]=useState('');
  const [error,setError]=useState('');
  const [busy,setBusy]=useState(false);
  const data=collectInsightsData(includePrivate);
  const hasData=hasInsightsData(data);

  const generate=async()=>{
    setBusy(true);
    setError('');
    setSummary('');
    setStatus('Loading the on-device model. First use may download several hundred megabytes.');
    try{
      const result=await generateInsights(data,progress=>{
        if(progress.status==='progress'&&Number.isFinite(progress.progress)){
          const file=progress.file?progress.file.split('/').at(-1):'model file';
          setStatus(`Downloading ${file} (${Math.round(progress.progress)}%).`);
        }else if(progress.status==='done'){
          setStatus('Model ready. Generating your summary on this device…');
        }else if(progress.status==='generating'){
          setStatus('Generating your summary on this device…');
        }
      },text=>setSummary(current=>current+text));
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
      <b>Recent activity</b>
      <p>Find patterns in the last 30 days of your breathing, cold shower, HIIT, weights, and yoga logs.</p>
      <label className="set insights-private">
        <input type="checkbox" checked={includePrivate} disabled={busy} onChange={event=>setIncludePrivate(event.target.checked)}/>
        <span>Also include journal answers and body measurements</span>
      </label>
      <p className="warn">Your logs are processed in this browser and are not sent to an AI service. The model files are downloaded from Hugging Face on first use and then cached by your browser. The optional journal and measurement data are sensitive; include them only if you want them used in the summary.</p>
      {!hasData&&<p>No entries found for the selected data in the last 30 days.</p>}
      <button onClick={generate} disabled={busy||!hasData} style={{opacity:busy||!hasData?0.5:1}}>
        {busy?'Generating…':'Find data insights'}
      </button>
      {busy&&<div className="bar" role="progressbar" aria-label="On-device AI progress"><div className="indeterminate"/></div>}
      {status&&<p role="status">{status}</p>}
      {error&&<p className="insights-error" role="alert">Could not generate the summary: {error}</p>}
    </div>
    {summary&&<div className="card insights-summary">
      <b>Insights from your data</b>
      <p>{summary}</p>
    </div>}
  </>);
}
