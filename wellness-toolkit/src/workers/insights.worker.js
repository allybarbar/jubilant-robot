const MODEL_ID='onnx-community/SmolLM2-360M-Instruct-ONNX';
let generatorPromise;
let generationQueue=Promise.resolve();

const naturalFallback=screen=>{
  const facts=[`${screen.sessions} sessions across ${screen.activeDays} days, with activity in ${screen.activeWeeks} of ${screen.weeksInPeriod} weeks.`];
  let trendFact;
  if(screen.holdTrend){
    trendFact=`Average hold time changed by ${screen.holdTrend.change} seconds between the first and second halves of the period.`;
  }else if(screen.durationTrend){
    trendFact=`Average session duration changed by ${screen.durationTrend.change} seconds between the first and second halves of the period.`;
  }else if(screen.roundsTrend){
    trendFact=`Average rounds changed by ${screen.roundsTrend.change} between the first and second halves of the period.`;
  }else if(screen.completionTrend){
    trendFact=`Yoga completion changed by ${Math.round(screen.completionTrend.change*100)} percentage points between the first and second halves of the period.`;
  }else if(screen.exercises?.some(exercise=>exercise.weightTrend||exercise.repsTrend)){
    const exercise=screen.exercises.find(item=>item.weightTrend||item.repsTrend);
    const trend=exercise.weightTrend||exercise.repsTrend;
    const metric=exercise.weightTrend?`average weight (${exercise.unit})`:'average reps';
    trendFact=`${exercise.exercise} ${metric} changed by ${trend.change} between the first and second halves of the period.`;
  }else if(screen.measurements){
    const [measurement]=Object.entries(screen.measurements)
      .filter(([,trend])=>trend?.change!==undefined);
    if(measurement){
      const [name,trend]=measurement;
      trendFact=`${name} changed by ${trend.change}${trend.unit?` ${trend.unit}`:''} between recorded measurements.`;
    }
  }
  if(trendFact){
    facts.push(`${trendFact}${screen.activeWeeks<3?' A regular, manageable routine may help make practice more consistent.':''}`);
  }else if(screen.activeWeeks<3){
    facts.push('Choosing a regular day or two for this screen may help build a steadier routine.');
  }else if(screen.averageDurationSeconds!==undefined){
    facts.push(`Sessions averaged ${screen.averageDurationSeconds} seconds.`);
  }else if(screen.averageHoldSeconds!==undefined){
    facts.push(`Breath holds averaged ${screen.averageHoldSeconds} seconds.`);
  }else if(screen.averageRounds!==undefined){
    facts.push(`HIIT sessions averaged ${screen.averageRounds} rounds.`);
  }else if(screen.completedSessions!==undefined){
    facts.push(`${screen.completedSessions} of ${screen.sessions} yoga sessions were completed.`);
  }else if(screen.loggedSets!==undefined){
    facts.push(`${screen.loggedSets} sets were logged.`);
  }else if(screen.measurements){
    facts.push(`${screen.measurements.entries} measurement entries were recorded.`);
  }
  return facts.slice(0,2).map(fact=>`- ${fact}`).join('\n');
};

const naturalize=text=>{
  const trimmed=text.trim().replace(/^```(?:json)?\s*|\s*```$/gi,'').trim();
  if(!trimmed.startsWith('{')&&!trimmed.startsWith('['))return trimmed;
  return null;
};

async function getGenerator(id){
  if(!generatorPromise){
    generatorPromise=(async()=>{
      const {pipeline}=await import('@huggingface/transformers');
      return pipeline('text-generation',MODEL_ID,{
        device:'wasm',
        dtype:'q4',
        progress_callback:progress=>self.postMessage({id,type:'progress',progress})
      });
    })();
  }

  try{
    return await generatorPromise;
  }catch(error){
    generatorPromise=null;
    throw error;
  }
}

async function generate({id,summary}){
  try{
    const generator=await getGenerator(id);
    const screens=summary.screens||[];
    const sections=[];
    for(let index=0;index<screens.length;index++){
      const screen=screens[index];
      self.postMessage({
        id,
        type:'progress',
        progress:{status:'generating',screen:screen.screen,current:index+1,total:screens.length}
      });
      const result=await generator([
        {
          role:'system',
          content:'Write 1 or 2 short, natural-language bullet points in plain English. Never output JSON, code, labels, or key-value pairs. Use only the supplied facts. First describe how regularly the activity appears, using active days and weeks when useful. Then compare early- and late-period values only when both are provided, and describe change neutrally without claiming health benefits. If no comparison is available, do not claim improvement or decline. Offer one practical, gentle suggestion if activity is sparse or there is no clear positive trend. Do not invent targets, prescribe increasing hold or cold-exposure duration, diagnose, or give medical advice.'
        },
        {
          role:'user',
          content:`Summarize this screen only. The data includes only screens with entries. Use early/late comparisons only when shown; do not calculate from other fields. For body measurements, report changes neutrally and do not call a direction better or worse. Do not repeat the data as a list of fields.\n\nScreen data: ${JSON.stringify(screen)}`
        }
      ],{
        max_new_tokens:80,
        do_sample:false
      });
      const generated=result?.[0]?.generated_text;
      const text=Array.isArray(generated)?generated.at(-1)?.content:generated;
      if(typeof text!=='string'||!text.trim())throw new Error(`The model returned an empty summary for ${screen.screen}.`);
      sections.push(`${screen.screen}\n${naturalize(text)||naturalFallback(screen)}`);
    }

    self.postMessage({
      id,
      type:'done',
      text:sections.join('\n\n')||'- There is not enough activity data for a summary.'
    });
  }catch(error){
    self.postMessage({
      id,
      type:'error',
      error:error instanceof Error?error.message:String(error)
    });
  }
}

self.addEventListener('message',event=>{
  generationQueue=generationQueue.then(()=>generate(event.data));
});
