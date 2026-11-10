import {afterEach,test} from 'node:test';
import assert from 'node:assert/strict';
import {collectInsightsData,hasInsightsData,summarizeInsightsData} from './insights.js';

const originalLocalStorage=globalThis.localStorage;
const today=new Date().toISOString().slice(0,10);

function setLogs(logs){
  const values=new Map(Object.entries(logs).map(([key,value])=>[key,JSON.stringify(value)]));
  globalThis.localStorage={
    getItem:key=>values.get(key)??null,
    setItem:(key,value)=>values.set(key,String(value))
  };
}

afterEach(()=>{
  if(originalLocalStorage===undefined)delete globalThis.localStorage;
  else globalThis.localStorage=originalLocalStorage;
});

test('collects only the selected activity section',()=>{
  setLogs({
    bw_hist:[{day:today,t:[20,30]}],
    bw_cold_log:[{day:today,s:60}]
  });

  const data=collectInsightsData('breath');

  assert.deepEqual(data.breathing,[{date:today,holdSeconds:[20,30]}]);
  assert.equal(data.cold,undefined);
  assert.deepEqual(summarizeInsightsData(data).screens.map(screen=>screen.screen),['Breathing']);
});

test('keeps journal answers excluded until the user opts in',()=>{
  setLogs({bw_j_log:[{day:today,a:'A small win',g:'Friends',h:'A walk'}]});

  assert.equal(hasInsightsData(collectInsightsData('journal')),false);
  const data=collectInsightsData('journal',true);
  assert.equal(data.journal[0].achievement,'A small win');
  assert.deepEqual(summarizeInsightsData(data).screens[0].journalEntries,[{
    date:today,achievement:'A small win',gratitude:'Friends',hopes:'A walk'
  }]);
});

test('keeps body measurements scoped to the opted-in body stats section',()=>{
  setLogs({bw_body_log:[{day:today,weight:'70',weightUnit:'kg'}]});

  assert.equal(hasInsightsData(collectInsightsData('body')),false);
  const data=collectInsightsData('body',true);
  assert.equal(data.bodyStats[0].weight,70);
  assert.equal(data.journal,undefined);
  assert.equal(summarizeInsightsData(data).screens[0].screen,'Body stats');
});

test('collects only recorded challenge progress for The 75 insight',()=>{
  setLogs({
    bw_challenge_v1:{
      attempts:[{id:'current',startDate:'2026-09-20',status:'active'}],
      days:[
        {attemptId:'current',date:today,completed:true,progress:{water:4000}},
        {attemptId:'current',date:today,completed:false,progress:{water:1000}}
      ]
    },
    bw_hist:[{day:today,t:[20]}]
  });

  const data=collectInsightsData('challenge');

  assert.deepEqual(data.challenge.days,[{date:today,completed:true},{date:today,completed:false}]);
  assert.equal(data.breathing,undefined);
  assert.equal(hasInsightsData(data),true);
  assert.deepEqual(summarizeInsightsData(data).screens.map(screen=>screen.screen),['The 75']);
  assert.equal(summarizeInsightsData(data).screens[0].attempts,1);
  assert.equal(summarizeInsightsData(data).screens[0].completionRate,50);
});
