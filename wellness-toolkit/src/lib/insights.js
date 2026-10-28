const readLog=key=>{
  try{
    const value=JSON.parse(localStorage.getItem(key)||'[]');
    return Array.isArray(value)?value:[];
  }catch{
    return [];
  }
};

const dateOf=entry=>{
  if(typeof entry.day==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(entry.day))return entry.day;
  const timestamp=Number(entry.d);
  return Number.isFinite(timestamp)&&timestamp>0?new Date(timestamp).toISOString().slice(0,10):null;
};

const recent=(entries,cutoff,today)=>entries
  .filter(entry=>{
    const date=dateOf(entry);
    return date&&date>=cutoff&&date<=today;
  })
  .sort((a,b)=>dateOf(b).localeCompare(dateOf(a)));

const roundedSeconds=value=>Number.isFinite(Number(value))?Math.round(Number(value)):0;

export function collectInsightsData(includePrivate){
  const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10);
  const today=new Date().toISOString().slice(0,10);
  const breathing=recent(readLog('bw_hist'),cutoff,today).slice(0,30).map(entry=>({
    date:dateOf(entry),
    holdSeconds:Array.isArray(entry.t)?entry.t.map(roundedSeconds):[]
  }));
  const cold=recent(readLog('bw_cold_log'),cutoff,today).slice(0,30).map(entry=>({
    date:dateOf(entry),
    durationSeconds:roundedSeconds(entry.s)
  }));
  const hiit=recent(readLog('bw_hiit_log'),cutoff,today).slice(0,30).map(entry=>({
    date:dateOf(entry),
    rounds:roundedSeconds(entry.n),
    workSeconds:roundedSeconds(entry.w),
    restSeconds:roundedSeconds(entry.r)
  }));
  const yoga=recent(readLog('bw_yoga_log'),cutoff,today).slice(0,30).map(entry=>({
    date:dateOf(entry),
    durationSeconds:roundedSeconds(entry.s),
    completed:!!entry.full
  }));
  const weights=recent(readLog('bw_w_log'),cutoff,today).slice(0,30).map(entry=>({
    date:dateOf(entry),
    workoutType:entry.type,
    unit:entry.u,
    exercises:Array.isArray(entry.ex)?entry.ex.map(ex=>({
      name:ex.n,
      sets:Array.isArray(ex.sets)?ex.sets.map(set=>({weight:set.w,reps:set.r})):[]
    })):[]
  }));
  const data={period:'Last 30 days',breathing,cold,hiit,yoga,weights};

  if(includePrivate){
    data.journal=recent(readLog('bw_j_log'),cutoff,today).slice(0,10).map(entry=>({
      date:dateOf(entry),
      achievement:entry.a,
      gratitude:entry.g,
      hopes:entry.h
    }));
    data.bodyStats=recent(readLog('bw_body_log'),cutoff,today).slice(0,10).map(entry=>({
      date:dateOf(entry),
      weight:entry.weight?`${entry.weight} ${entry.weightUnit||''}`.trim():undefined,
      height:entry.height?`${entry.height} ${entry.lengthUnit||''}`.trim():undefined,
      waist:entry.waist?`${entry.waist} ${entry.lengthUnit||''}`.trim():undefined,
      bloodPressure:entry.systolic&&entry.diastolic?`${entry.systolic}/${entry.diastolic} mmHg`:undefined
    }));
  }

  for(const key of Object.keys(data)){
    if(Array.isArray(data[key])&&!data[key].length)delete data[key];
  }

  return data;
}

export function hasInsightsData(data){
  return ['breathing','cold','hiit','yoga','weights','journal','bodyStats']
    .some(key=>Array.isArray(data[key])&&data[key].length>0);
}

let insightsWorker;
let nextRequestId=0;
const pendingRequests=new Map();

const rejectPendingRequests=error=>{
  for(const request of pendingRequests.values())request.reject(error);
  pendingRequests.clear();
};

const getInsightsWorker=()=>{
  if(insightsWorker)return insightsWorker;

  const worker=new Worker(new URL('../workers/insights.worker.js',import.meta.url),{type:'module'});
  worker.addEventListener('message',event=>{
    const {id,type,progress,text,error}=event.data;
    const request=pendingRequests.get(id);
    if(!request)return;

    if(type==='progress'){
      request.onProgress?.(progress);
    }else if(type==='text'){
      request.onText?.(text);
    }else if(type==='done'){
      pendingRequests.delete(id);
      request.resolve(text);
    }else if(type==='error'){
      pendingRequests.delete(id);
      request.reject(new Error(error));
    }
  });
  const handleWorkerError=event=>{
    event.preventDefault();
    const error=new Error(event.message||'The on-device model worker failed.');
    rejectPendingRequests(error);
    worker.terminate();
    if(insightsWorker===worker)insightsWorker=null;
  };
  worker.addEventListener('error',handleWorkerError);
  worker.addEventListener('messageerror',()=>{
    rejectPendingRequests(new Error('Could not read a response from the on-device model worker.'));
    worker.terminate();
    if(insightsWorker===worker)insightsWorker=null;
  });
  insightsWorker=worker;
  return worker;
};

export function generateInsights(data,onProgress,onText){
  const worker=getInsightsWorker();
  const id=++nextRequestId;

  return new Promise((resolve,reject)=>{
    pendingRequests.set(id,{resolve,reject,onProgress,onText});
    try{
      worker.postMessage({id,data});
    }catch(error){
      pendingRequests.delete(id);
      reject(error);
    }
  });
}
