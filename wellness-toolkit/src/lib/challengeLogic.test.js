import test from 'node:test';
import assert from 'node:assert/strict';
import {PRESETS,createCustomTasks} from '../data/challengePresets.js';
import {
  getDateInTimeZone,getChallengeDayNumber,isTaskComplete,isDayComplete,
  getRolloverState,getDayState
} from './challengeLogic.js';

test('formats a date using the attempt timezone rather than UTC',()=>{
  assert.equal(getDateInTimeZone(new Date('2026-01-01T01:00:00Z'),'America/Los_Angeles'),'2025-12-31');
});

test('calculates challenge days from local calendar dates across month boundaries',()=>{
  assert.equal(getChallengeDayNumber('2026-01-31','2026-02-01'),2);
  assert.equal(getChallengeDayNumber('2026-01-31','2026-01-30'),null);
});

test('requires a qualifying outdoor workout for the hard preset',()=>{
  const outdoorTask=PRESETS.hard.tasks.find(task=>task.id==='workout-2');
  assert.equal(isTaskComplete(outdoorTask,{minutes:45,outdoor:false}),false);
  assert.equal(isTaskComplete(outdoorTask,{minutes:45,outdoor:true}),true);
});

test('counter tasks must reach their configured target',()=>{
  const task=PRESETS.hard.tasks.find(item=>item.id==='water');
  assert.equal(isTaskComplete(task,3799),false);
  assert.equal(isTaskComplete(task,3800),true);
});

test('75 Soft includes breathing exercises and journal checks',()=>{
  const breathing=PRESETS.soft.tasks.find(task=>task.id==='breathing');
  const journal=PRESETS.soft.tasks.find(task=>task.id==='journal');
  assert.equal(isTaskComplete(breathing,false),false);
  assert.equal(isTaskComplete(breathing,true),true);
  assert.equal(isTaskComplete(journal,false),false);
  assert.equal(isTaskComplete(journal,true),true);
});

test('a Soft workout needs its duration and a selected workout type',()=>{
  const workout=PRESETS.soft.tasks.find(task=>task.id==='workout');
  assert.equal(isTaskComplete(workout,{minutes:45}),false);
  assert.equal(isTaskComplete(workout,{minutes:45,workoutType:'Yoga'}),true);
  assert.equal(isTaskComplete(workout,{minutes:45,workoutType:'Made up'}),false);
});

test('75 Soft requires a progress photo',()=>{
  const task=PRESETS.soft.tasks.find(item=>item.id==='photo');
  assert.equal(task.requiresPhoto,true);
  assert.equal(isTaskComplete(task,true),false);
  assert.equal(isTaskComplete(task,true,'photo-1'),true);
});

test('custom tasks can be disabled without blocking day completion',()=>{
  const tasks=createCustomTasks();
  const progress={};
  assert.equal(tasks.every(task=>!task.enabled),true);
  assert.equal(isDayComplete(tasks,progress),true);
});

test('reset-on-miss is explicit and soft rules preserve the attempt',()=>{
  const record={dayNumber:1,completed:false};
  assert.equal(getRolloverState({startDate:'2026-03-01',timezone:'UTC',config:{resetOnMiss:true}},[record],'2026-03-02').resetRequired,true);
  assert.equal(getRolloverState({startDate:'2026-03-01',timezone:'UTC',config:{resetOnMiss:false}},[record],'2026-03-02').resetRequired,false);
});

test('day grid distinguishes completed, missed, current, and upcoming days',()=>{
  assert.equal(getDayState(1,2,{completed:true}),'complete');
  assert.equal(getDayState(1,2,null),'missed');
  assert.equal(getDayState(2,2,null),'today');
  assert.equal(getDayState(3,2,null),'upcoming');
});