const MODEL_ID='onnx-community/SmolLM2-360M-Instruct-ONNX';
let generatorPromise;
let generationQueue=Promise.resolve();

const naturalFallback=summary=>{
  const facts=(summary.activities||[]).map(activity=>{
    const parts=[`${activity.activity}: ${activity.sessions} sessions across ${activity.activeDays} days`];
    if(activity.averageDurationSeconds!==undefined){
      parts.push(`averaging ${activity.averageDurationSeconds} seconds`);
    }else if(activity.averageHoldSeconds!==undefined){
      parts.push(`averaging ${activity.averageHoldSeconds}-second holds`);
    }else if(activity.averageRounds!==undefined){
      parts.push(`averaging ${activity.averageRounds} rounds`);
    }else if(activity.loggedSets!==undefined){
      parts.push(`${activity.loggedSets} sets logged`);
    }
    if(activity.completedSessions!==undefined){
      parts.push(`${activity.completedSessions} of ${activity.sessions} sessions completed`);
    }
    return `- ${parts.join(', ')}.`;
  });

  if(!facts.length&&summary.journalEntries){
    facts.push(`- Journal: ${summary.journalEntries.entries} entries across ${summary.journalEntries.activeDays} days.`);
  }
  if(!facts.length&&summary.bodyMeasurements){
    facts.push(`- Body measurements: ${summary.bodyMeasurements.entries} entries recorded.`);
  }
  return facts.slice(0,2).join('\n')||'- There is not enough activity data for a summary.';
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
    self.postMessage({id,type:'progress',progress:{status:'generating'}});
    const result=await generator([
      {
        role:'system',
        content:'Write a brief natural-language summary using only the facts provided. Respond in plain English, never as JSON, code, labels, or key-value pairs. Use at most 2 short bullet points, each with a concrete number. Do not describe an app, infer unsupported trends, diagnose, or give medical advice.'
      },
      {
        role:'user',
        content:`Describe the most useful facts from this data as natural sentences, not by repeating or reformatting the data. Use only values present; omit unavailable details. If there is too little information for an observation, say so briefly.\n\nData: ${JSON.stringify(summary)}`
      }
    ],{
      max_new_tokens:64,
      do_sample:false
    });

    const generated=result?.[0]?.generated_text;
    const text=Array.isArray(generated)?generated.at(-1)?.content:generated;
    if(typeof text!=='string'||!text.trim())throw new Error('The model returned an empty summary.');
    self.postMessage({id,type:'done',text:naturalize(text)||naturalFallback(summary)});
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
