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

export function collectInsightsData(screen,includePrivate=false){
  const cutoff=new Date(Date.now()-30*24*60*60*1000).toISOString().slice(0,10);
  const today=new Date().toISOString().slice(0,10);
  const data={period:'Last 30 days',periodStart:cutoff};

  if(screen==='breath'){
    data.breathing=recent(readLog('bw_hist'),cutoff,today).slice(0,30).map(entry=>({
      date:dateOf(entry),
      holdSeconds:Array.isArray(entry.t)?entry.t.map(roundedSeconds):[]
    }));
  }else if(screen==='cold'){
    data.cold=recent(readLog('bw_cold_log'),cutoff,today).slice(0,30).map(entry=>({
      date:dateOf(entry),
      durationSeconds:roundedSeconds(entry.s)
    }));
  }else if(screen==='hiit'){
    data.hiit=recent(readLog('bw_hiit_log'),cutoff,today).slice(0,30).map(entry=>({
      date:dateOf(entry),
      rounds:roundedSeconds(entry.n),
      workSeconds:roundedSeconds(entry.w),
      restSeconds:roundedSeconds(entry.r)
    }));
  }else if(screen==='yoga'){
    data.yoga=recent(readLog('bw_yoga_log'),cutoff,today).slice(0,30).map(entry=>({
      date:dateOf(entry),
      durationSeconds:roundedSeconds(entry.s),
      completed:!!entry.full
    }));
  }else if(screen==='weights'){
    data.weights=recent(readLog('bw_w_log'),cutoff,today).slice(0,30).map(entry=>({
      date:dateOf(entry),
      workoutType:entry.type,
      unit:entry.u,
      exercises:Array.isArray(entry.ex)?entry.ex.map(ex=>({
        name:ex.n,
        sets:Array.isArray(ex.sets)?ex.sets.map(set=>({weight:set.w,reps:set.r})):[]
      })):[]
    }));
  }else if(screen==='journal'&&includePrivate){
    data.journal=recent(readLog('bw_j_log'),cutoff,today).slice(0,10).map(entry=>({
      date:dateOf(entry),
      achievement:entry.a,
      gratitude:entry.g,
      hopes:entry.h
    }));
  }else if(screen==='body'&&includePrivate){
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
  }else if(screen==='challenge'){
    let state;
    try{
      state=JSON.parse(localStorage.getItem('bw_challenge_v1')||'{}');
    }catch{
      state={};
    }
    const attempts=Array.isArray(state?.attempts)?state.attempts:[];
    const attemptsById=new Map(attempts.map(attempt=>[attempt.id,attempt]));
    const days=Array.isArray(state?.days)?state.days:[];
    const recentDays=days.filter(entry=>{
      const date=typeof entry.date==='string'?entry.date:dateOf(entry);
      return date&&date>=cutoff&&date<=today&&attemptsById.has(entry.attemptId);
    });
    const relevantAttemptIds=new Set(recentDays.map(entry=>entry.attemptId));
    data.challenge={
      attempts:attempts.filter(attempt=>
        (attempt.startDate>=cutoff&&attempt.startDate<=today)||relevantAttemptIds.has(attempt.id)
      ).map(attempt=>({
        startDate:attempt.startDate,
        status:attempt.status
      })),
      days:recentDays.slice(-75).map(entry=>({
        date:typeof entry.date==='string'?entry.date:dateOf(entry),
        completed:!!entry.completed
      }))
    };
  }

  return data;
}

export function hasInsightsData(data){
  return ['breathing','cold','hiit','yoga','weights','journal','bodyStats']
    .some(key=>Array.isArray(data[key])&&data[key].length>0)
    ||Boolean(data.challenge?.days?.length);
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

const activityPattern=(entries,periodStart)=>{
  const start=Date.parse(`${periodStart}T00:00:00Z`);
  const datedEntries=entries.filter(entry=>entry.date);
  return {
    sessions:entries.length,
    activeDays:activityDays(entries),
    activeWeeks:new Set(datedEntries.map(entry=>Math.floor(
      (Date.parse(`${entry.date}T00:00:00Z`)-start)/(7*24*60*60*1000)
    ))).size,
    weeksInPeriod:5
  };
};

const halfPeriodTrend=(entries,valueOf,periodStart)=>{
  const start=Date.parse(`${periodStart}T00:00:00Z`);
  const firstHalf=[];
  const secondHalf=[];
  for(const entry of entries){
    if(!entry.date)continue;
    const value=numericValue(valueOf(entry));
    if(value===null)continue;
    const day=(Date.parse(`${entry.date}T00:00:00Z`)-start)/(24*60*60*1000);
    (day<15?firstHalf:secondHalf).push(value);
  }
  if(!firstHalf.length||!secondHalf.length)return undefined;
  const firstHalfAverage=average(firstHalf);
  const secondHalfAverage=average(secondHalf);
  return {
    firstHalfAverage,
    secondHalfAverage,
    change:rounded(secondHalfAverage-firstHalfAverage)
  };
};

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
  const allEntries=['breathing','cold','hiit','yoga','weights','journal','bodyStats']
    .flatMap(key=>data[key]||[]);
  allEntries.push(...(data.challenge?.days||[]));
  const periodStart=data.periodStart||allEntries
    .map(entry=>entry.date)
    .filter(Boolean)
    .sort()[0];
  const screens=[];
  const addScreen=(name,entries,stats)=>{
    if(entries?.length)screens.push({
      screen:name,
      ...activityPattern(entries,periodStart),
      ...stats
    });
  };

  const breathing=data.breathing||[];
  const breathingSessions=breathing.map(entry=>({
    ...entry,
    averageHoldSeconds:average((entry.holdSeconds||[]).map(numericValue).filter(value=>value!==null))
  }));
  addScreen('Breathing',breathing,{
    averageHoldSeconds:average(breathingSessions.map(entry=>entry.averageHoldSeconds).filter(value=>value!==undefined)),
    holdTrend:halfPeriodTrend(breathingSessions,entry=>entry.averageHoldSeconds,periodStart)
  });

  const cold=data.cold||[];
  addScreen('Cold shower',cold,{
    averageDurationSeconds:average(cold.map(entry=>numericValue(entry.durationSeconds)).filter(value=>value!==null)),
    durationTrend:halfPeriodTrend(cold,entry=>entry.durationSeconds,periodStart)
  });

  const hiit=data.hiit||[];
  addScreen('HIIT',hiit,{
    averageRounds:average(hiit.map(entry=>numericValue(entry.rounds)).filter(value=>value!==null)),
    averageWorkSeconds:average(hiit.map(entry=>numericValue(entry.workSeconds)).filter(value=>value!==null)),
    averageRestSeconds:average(hiit.map(entry=>numericValue(entry.restSeconds)).filter(value=>value!==null)),
    roundsTrend:halfPeriodTrend(hiit,entry=>entry.rounds,periodStart)
  });

  const yoga=data.yoga||[];
  addScreen('Yoga',yoga,{
    completedSessions:yoga.filter(entry=>entry.completed).length,
    averageDurationSeconds:average(yoga.map(entry=>numericValue(entry.durationSeconds)).filter(value=>value!==null)),
    completionTrend:halfPeriodTrend(yoga,entry=>entry.completed?1:0,periodStart),
    durationTrend:halfPeriodTrend(yoga,entry=>entry.durationSeconds,periodStart)
  });

  const weightWorkouts=data.weights||[];
  const exerciseStats=new Map();
  let loggedSets=0;
  for(const workout of weightWorkouts){
    for(const exercise of workout.exercises||[]){
      if(!exercise.sets?.length)continue;
      const key=`${exercise.name}\u0000${workout.unit||''}`;
      const stats=exerciseStats.get(key)||{
        exercise:exercise.name,
        unit:workout.unit||'',
        sets:0,
        sessions:[]
      };
      const sessionWeights=[];
      const sessionReps=[];
      for(const set of exercise.sets||[]){
        const weight=numericValue(set.weight);
        const reps=numericValue(set.reps);
        stats.sets++;
        loggedSets++;
        if(weight!==null)sessionWeights.push(weight);
        if(reps!==null)sessionReps.push(reps);
      }
      stats.sessions.push({
        date:workout.date,
        averageWeight:average(sessionWeights),
        averageReps:average(sessionReps)
      });
      exerciseStats.set(key,stats);
    }
  }
  addScreen('Weights',weightWorkouts,{
    loggedSets,
    exercises:[...exerciseStats.values()]
      .sort((a,b)=>b.sets-a.sets)
      .slice(0,5)
      .map(({sessions,...exercise})=>({
        ...exercise,
        weightTrend:halfPeriodTrend(sessions,entry=>entry.averageWeight,periodStart),
        repsTrend:halfPeriodTrend(sessions,entry=>entry.averageReps,periodStart)
      }))
  });

  if(data.journal?.length){
    addScreen('Journal',data.journal,{
      entries:data.journal.length,
      journalEntries:data.journal.map(({date,achievement,gratitude,hopes})=>({
        date,achievement,gratitude,hopes
      }))
    });
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
    addScreen('Body stats',bodyStats,{measurements});
  }

  const challenge=data.challenge;
  if(challenge?.days?.length){
    const completedDays=challenge.days.filter(day=>day.completed).length;
    addScreen('The 75',challenge.days,{
      recordedDays:challenge.days.length,
      completedDays,
      completionRate:rounded(completedDays/challenge.days.length*100),
      attempts:challenge.attempts.length
    });
  }

  return {period:data.period,screens};
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

export function generateInsights(data,onProgress){
  const worker=getInsightsWorker();
  const id=++nextRequestId;
  const summary=summarizeInsightsData(data);

  return new Promise((resolve,reject)=>{
    pendingRequests.set(id,{resolve,reject,onProgress});
    try{
      worker.postMessage({id,summary});
    }catch(error){
      pendingRequests.delete(id);
      reject(error);
    }
  });
}
