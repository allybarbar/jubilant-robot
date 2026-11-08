import {isDayComplete,isChallengeCompleted} from './challengeLogic.js';

const STORAGE_KEY='bw_challenge_v1';
const DATABASE_NAME='wellness-toolkit-challenges';
const DATABASE_VERSION=1;
let databasePromise;

function makeId(){
  return globalThis.crypto?.randomUUID?.()||`${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function readState(){
  try{
    const state=JSON.parse(localStorage.getItem(STORAGE_KEY)||'{}');
    return {attempts:Array.isArray(state.attempts)?state.attempts:[],days:Array.isArray(state.days)?state.days:[]};
  }catch{
    return {attempts:[],days:[]};
  }
}

function writeState(state){
  localStorage.setItem(STORAGE_KEY,JSON.stringify(state));
}

function openDatabase(){
  if(!globalThis.indexedDB)return Promise.reject(new Error('Photo storage is unavailable in this browser.'));
  if(!databasePromise){
    databasePromise=new Promise((resolve,reject)=>{
      const request=indexedDB.open(DATABASE_NAME,DATABASE_VERSION);
      request.onupgradeneeded=()=>{
        if(!request.result.objectStoreNames.contains('photos'))request.result.createObjectStore('photos',{keyPath:'id'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||new Error('Could not open photo storage.'));
    });
  }
  return databasePromise;
}

async function photoRequest(mode,operation){
  const database=await openDatabase();
  return new Promise((resolve,reject)=>{
    const transaction=database.transaction('photos',mode);
    const request=operation(transaction.objectStore('photos'));
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error||new Error('Photo storage request failed.'));
    transaction.onabort=()=>reject(transaction.error||new Error('Photo storage transaction failed.'));
  });
}

function toBase64(buffer){
  const bytes=new Uint8Array(buffer);
  let binary='';
  for(let offset=0;offset<bytes.length;offset+=0x8000){
    binary+=String.fromCharCode(...bytes.subarray(offset,offset+0x8000));
  }
  return btoa(binary);
}

function fromBase64(value){
  const binary=atob(value);
  const bytes=new Uint8Array(binary.length);
  for(let index=0;index<binary.length;index++)bytes[index]=binary.charCodeAt(index);
  return bytes;
}

export async function listAttempts(){
  return readState().attempts.sort((a,b)=>b.startDate.localeCompare(a.startDate));
}

export async function getAttempt(attemptId){
  return readState().attempts.find(attempt=>attempt.id===attemptId)||null;
}

export async function getActiveAttempt(){
  return (await listAttempts()).find(attempt=>attempt.status==='active')||null;
}

export async function listDays(attemptId){
  return readState().days.filter(day=>day.attemptId===attemptId).sort((a,b)=>a.dayNumber-b.dayNumber);
}

export async function getDay(attemptId,dayNumber){
  return readState().days.find(day=>day.attemptId===attemptId&&day.dayNumber===dayNumber)||null;
}

export async function startAttempt({presetId,config,startDate,timezone}){
  const state=readState();
  const attempt={
    id:makeId(),presetId,config:structuredClone(config),startDate,timezone,
    status:'active',currentDay:1
  };
  state.attempts.push(attempt);
  writeState(state);
  return attempt;
}

export async function saveDay(dayRecord){
  const state=readState();
  const attempt=state.attempts.find(item=>item.id===dayRecord.attemptId);
  if(!attempt)throw new Error('Challenge attempt was not found.');
  const record={...dayRecord,completed:isDayComplete(attempt.config.tasks,dayRecord.progress,dayRecord.photoRef)};
  const existing=state.days.findIndex(day=>day.attemptId===record.attemptId&&day.dayNumber===record.dayNumber);
  if(existing===-1)state.days.push(record);
  else state.days[existing]=record;
  attempt.currentDay=Math.min(75,Math.max(attempt.currentDay,record.dayNumber));
  if(isChallengeCompleted(attempt,state.days))attempt.status='completed';
  writeState(state);
  return record;
}

export async function failAndRestart(attemptId,{startDate,timezone}={}){
  const state=readState();
  const previous=state.attempts.find(attempt=>attempt.id===attemptId);
  if(!previous||previous.status!=='active')throw new Error('Active challenge attempt was not found.');
  previous.status='failed';
  const next={
    ...previous,id:makeId(),startDate:startDate||previous.startDate,
    timezone:timezone||previous.timezone,status:'active',currentDay:1
  };
  state.attempts.push(next);
  writeState(state);
  return next;
}

export async function abandonAttempt(attemptId){
  const state=readState();
  const attempt=state.attempts.find(item=>item.id===attemptId);
  if(!attempt||attempt.status!=='active')throw new Error('Active challenge attempt was not found.');
  attempt.status='failed';
  writeState(state);
  return attempt;
}

export async function savePhoto(blob){
  if(!(blob instanceof Blob))throw new TypeError('A photo Blob is required.');
  const id=makeId();
  await photoRequest('readwrite',store=>store.add({id,blob,type:blob.type}));
  return id;
}

export async function getPhoto(photoRef){
  const entry=await photoRequest('readonly',store=>store.get(photoRef));
  return entry?.blob||null;
}

export async function deletePhoto(photoRef){
  await photoRequest('readwrite',store=>store.delete(photoRef));
}

export async function exportData(){
  const state=readState();
  const photoRefs=[...new Set(state.days.map(day=>day.photoRef).filter(Boolean))];
  const photos=[];
  for(const id of photoRefs){
    const blob=await getPhoto(id);
    if(blob)photos.push({id,type:blob.type,data:toBase64(await blob.arrayBuffer())});
  }
  return JSON.stringify({version:1,...state,photos},null,2);
}

export async function importData(json){
  const imported=typeof json==='string'?JSON.parse(json):json;
  if(imported?.version!==1||!Array.isArray(imported.attempts)||!Array.isArray(imported.days)||!Array.isArray(imported.photos)){
    throw new Error('This is not a supported challenge backup.');
  }
  const state=readState();
  const attempts=new Map(state.attempts.map(attempt=>[attempt.id,attempt]));
  for(const attempt of imported.attempts)attempts.set(attempt.id,attempt);
  const days=new Map(state.days.map(day=>[`${day.attemptId}:${day.dayNumber}`,day]));
  for(const day of imported.days)days.set(`${day.attemptId}:${day.dayNumber}`,day);
  for(const photo of imported.photos){
    if(typeof photo.id!=='string'||typeof photo.data!=='string')continue;
    const blob=new Blob([fromBase64(photo.data)],{type:photo.type||'application/octet-stream'});
    await photoRequest('readwrite',store=>store.put({id:photo.id,blob,type:blob.type}));
  }
  const merged={attempts:[...attempts.values()],days:[...days.values()]};
  writeState(merged);
  return merged;
}