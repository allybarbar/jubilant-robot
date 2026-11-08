const DAY_MS=86400000;

export function getDateInTimeZone(date=new Date(),timeZone='UTC'){
  const parts=new Intl.DateTimeFormat('en-CA',{
    timeZone,year:'numeric',month:'2-digit',day:'2-digit'
  }).formatToParts(date);
  const values=Object.fromEntries(parts.map(part=>[part.type,part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function dateOrdinal(date){
  if(typeof date!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(date))return NaN;
  const [year,month,day]=date.split('-').map(Number);
  const timestamp=Date.UTC(year,month-1,day);
  const parsed=new Date(timestamp);
  if(parsed.getUTCFullYear()!==year||parsed.getUTCMonth()!==month-1||parsed.getUTCDate()!==day)return NaN;
  return timestamp/DAY_MS;
}

export function getChallengeDayNumber(startDate,date){
  const start=dateOrdinal(startDate);
  const current=dateOrdinal(date);
  if(!Number.isFinite(start)||!Number.isFinite(current)||current<start)return null;
  return current-start+1;
}

export function isTaskComplete(task,value,photoRef){
  if(!task.enabled)return true;
  if(task.type==='checkbox')return task.requiresPhoto?Boolean(photoRef):value===true;
  if(task.type==='duration'){
    const duration=typeof value==='object'&&value!==null?Number(value.minutes??value.value):Number(value)||0;
    return duration>=Number(task.target)&&(task.outdoorRequired?Boolean(value?.outdoor):true);
  }
  if(task.type==='counter')return (Number(value)||0)>=Number(task.target);
  return false;
}

export function isDayComplete(tasks,progress={},photoRef){
  return tasks.filter(task=>task.enabled).every(task=>isTaskComplete(task,progress[task.id],photoRef));
}

export function getAttemptDay(attempt,now=new Date()){
  const today=getDateInTimeZone(now,attempt.timezone||'UTC');
  return {today,dayNumber:getChallengeDayNumber(attempt.startDate,today)};
}

export function getRolloverState(attempt,dayRecords,todayDate){
  const dayNumber=getChallengeDayNumber(attempt.startDate,todayDate);
  if(dayNumber===null)return {todayDate,dayNumber:null,missedDayNumber:null,resetRequired:false};
  const recordsByDay=new Map(dayRecords.map(record=>[record.dayNumber,record]));
  let missedDayNumber=null;
  for(let day=1;day<dayNumber;day++){
    const record=recordsByDay.get(day);
    if(!record?.completed){missedDayNumber=day;break;}
  }
  return {
    todayDate,
    dayNumber,
    missedDayNumber,
    resetRequired:Boolean(attempt.config?.resetOnMiss&&missedDayNumber)
  };
}

export function getDayState(dayNumber,todayDayNumber,record){
  if(record?.completed)return 'complete';
  if(dayNumber<todayDayNumber)return 'missed';
  if(dayNumber>todayDayNumber)return 'upcoming';
  return 'today';
}

export function isChallengeCompleted(attempt,dayRecords){
  if(attempt.status==='completed')return true;
  const recordsByDay=new Map(dayRecords.map(record=>[record.dayNumber,record]));
  return Array.from({length:75},(_,index)=>recordsByDay.get(index+1)?.completed===true).every(Boolean);
}