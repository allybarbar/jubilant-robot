const MODEL_ID='onnx-community/SmolLM2-360M-Instruct-ONNX';
let generatorPromise;

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

  return data;
}

export function hasInsightsData(data){
  return ['breathing','cold','hiit','yoga','weights','journal','bodyStats']
    .some(key=>Array.isArray(data[key])&&data[key].length>0);
}

export async function generateInsights(data,onProgress,onText){
  if(!generatorPromise){
    generatorPromise=(async()=>{
      const {pipeline}=await import('@huggingface/transformers');
      return pipeline('text-generation',MODEL_ID,{
        device:'wasm',
        dtype:'q4',
        progress_callback:onProgress
      });
    })();
  }

  let generator;
  try{
    generator=await generatorPromise;
  }catch(error){
    generatorPromise=null;
    throw error;
  }

  const {TextStreamer}=await import('@huggingface/transformers');
  onProgress?.({status:'generating'});
  const result=await generator([
    {
      role:'system',
      content:'You are a careful wellness reflection assistant. Summarize only patterns supported by the supplied personal activity data. Do not diagnose, assess medical risk, or recommend treatment. Do not invent missing information. Be warm, concise, and specific. Mention when there is too little data to identify a trend.'
    },
    {
      role:'user',
      content:`Write a short summary with 2-4 useful observations and one gentle reflection question. The data is private and is being processed locally in this browser:\n${JSON.stringify(data)}`
    }
  ],{
    max_new_tokens:180,
    do_sample:false,
    streamer:new TextStreamer(generator.tokenizer,{
      skip_prompt:true,
      skip_special_tokens:true,
      callback_function:onText
    })
  });

  const generated=result?.[0]?.generated_text;
  const text=Array.isArray(generated)?generated.at(-1)?.content:generated;
  if(typeof text!=='string'||!text.trim())throw new Error('The model returned an empty summary.');
  return text.trim();
}
