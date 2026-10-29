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
      weight:numericValue(entry.weight)??undefined,
      weightUnit:entry.weightUnit,
      height:numericValue(entry.height)??undefined,
      waist:numericValue(entry.waist)??undefined,
      lengthUnit:entry.lengthUnit,
      systolic:numericValue(entry.systolic)??undefined,
      diastolic:numericValue(entry.diastolic)??undefined
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

const numericValue=value=>{
  if(value===''||value===null||value===undefined)return null;
  const number=Number(value);
  return Number.isFinite(number)?number:null;
};

const rounded=(value,digits=1)=>Number(value.toFixed(digits));

const average=values=>values.length
  ?rounded(values.reduce((sum,value)=>sum+value,0)/values.length)
  :undefined;

const activityDays=entries=>new Set(entries.map(entry=>entry.date).filter(Boolean)).size;

const measurementTrend=(entries,key,unitKey,fallbackUnit='')=>{
  const values=entries
    .map(entry=>({date:entry.date,value:numericValue(entry[key]),unit:entry[unitKey]||fallbackUnit}))
    .filter(entry=>entry.value!==null)
    .sort((a,b)=>a.date.localeCompare(b.date));
  if(!values.length)return undefined;

  const first=values[0];
  const latest=values.at(-1);
  return {
    firstValue:first.value,
    latestValue:latest.value,
    change:rounded(latest.value-first.value),
    unit:latest.unit
  };
};

export function summarizeInsightsData(data){
  const summary={period:data.period,activities:[]};
  const addActivity=(name,entries,stats)=>{
    if(entries?.length)summary.activities.push({
      activity:name,
      sessions:entries.length,
      activeDays:activityDays(entries),
      ...stats
    });
  };

  const breathingHolds=(data.breathing||[]).flatMap(entry=>entry.holdSeconds||[])
    .map(numericValue).filter(value=>value!==null);
  addActivity('Breathing',data.breathing,{
    averageHoldSeconds:average(breathingHolds),
    longestHoldSeconds:breathingHolds.length?Math.max(...breathingHolds):undefined
  });

  const coldDurations=(data.cold||[]).map(entry=>numericValue(entry.durationSeconds))
    .filter(value=>value!==null);
  addActivity('Cold shower',data.cold,{
    averageDurationSeconds:average(coldDurations),
    longestDurationSeconds:coldDurations.length?Math.max(...coldDurations):undefined
  });

  const hiit=(data.hiit||[]);
  addActivity('HIIT',hiit,{
    averageRounds:average(hiit.map(entry=>numericValue(entry.rounds)).filter(value=>value!==null)),
    averageWorkSeconds:average(hiit.map(entry=>numericValue(entry.workSeconds)).filter(value=>value!==null)),
    averageRestSeconds:average(hiit.map(entry=>numericValue(entry.restSeconds)).filter(value=>value!==null))
  });

  const yoga=data.yoga||[];
  addActivity('Yoga',yoga,{
    completedSessions:yoga.filter(entry=>entry.completed).length,
    averageDurationSeconds:average(yoga.map(entry=>numericValue(entry.durationSeconds)).filter(value=>value!==null))
  });

  const exerciseStats=new Map();
  let loggedSets=0;
  for(const workout of data.weights||[]){
    for(const exercise of workout.exercises||[]){
      if(!exercise.sets?.length)continue;
      const key=`${exercise.name}\u0000${workout.unit||''}`;
      const stats=exerciseStats.get(key)||{exercise:exercise.name,unit:workout.unit||'',sets:0};
      for(const set of exercise.sets||[]){
        const weight=numericValue(set.weight);
        const reps=numericValue(set.reps);
        stats.sets++;
        loggedSets++;
        if(weight!==null&&(!stats.bestSet||weight>stats.bestSet.weight)){
          stats.bestSet={weight,reps};
        }
      }
      exerciseStats.set(key,stats);
    }
  }
  const weights=data.weights||[];
  addActivity('Weights',weights,{
    loggedSets,
    exercises:[...exerciseStats.values()]
      .sort((a,b)=>b.sets-a.sets)
      .slice(0,5)
  });

  if(data.journal?.length){
    summary.journalEntries={entries:data.journal.length,activeDays:activityDays(data.journal)};
  }

  const bodyStats=data.bodyStats||[];
  if(bodyStats.length){
    const measurements={
      entries:bodyStats.length,
      weight:measurementTrend(bodyStats,'weight','weightUnit'),
      height:measurementTrend(bodyStats,'height','lengthUnit'),
      waist:measurementTrend(bodyStats,'waist','lengthUnit'),
      systolic:measurementTrend(bodyStats,'systolic','','mmHg'),
      diastolic:measurementTrend(bodyStats,'diastolic','','mmHg')
    };
    for(const key of Object.keys(measurements)){
      if(measurements[key]===undefined)delete measurements[key];
    }
    summary.bodyMeasurements=measurements;
  }

  return summary;
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
  const summary=summarizeInsightsData(data);

  return new Promise((resolve,reject)=>{
    pendingRequests.set(id,{resolve,reject,onProgress,onText});
    try{
      worker.postMessage({id,summary});
    }catch(error){
      pendingRequests.delete(id);
      reject(error);
    }
  });
}
