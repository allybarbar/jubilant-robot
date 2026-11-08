import test from 'node:test';
import assert from 'node:assert/strict';
import {abandonAttempt,getActiveAttempt,listAttempts,startAttempt} from './challengeStorage.js';

test('ending an attempt preserves it in history and clears the active slot',async()=>{
  const previousStorage=globalThis.localStorage;
  const values=new Map();
  globalThis.localStorage={
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,value)
  };
  try{
    const config={resetOnMiss:false,tasks:[{id:'read',type:'counter',target:10,unit:'pages',enabled:true}]};
    const attempt=await startAttempt({presetId:'custom',config,startDate:'2026-11-08',timezone:'UTC'});
    await abandonAttempt(attempt.id);
    assert.equal(await getActiveAttempt(),null);
    assert.equal((await listAttempts())[0].status,'failed');
    const next=await startAttempt({presetId:'soft',config,startDate:'2026-11-08',timezone:'UTC'});
    assert.equal((await getActiveAttempt()).id,next.id);
  }finally{
    if(previousStorage===undefined)delete globalThis.localStorage;
    else globalThis.localStorage=previousStorage;
  }
});