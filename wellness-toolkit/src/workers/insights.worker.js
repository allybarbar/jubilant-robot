const MODEL_ID='onnx-community/SmolLM2-360M-Instruct-ONNX';
let generatorPromise;
let generationQueue=Promise.resolve();

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

async function generate({id,data}){
  try{
    const generator=await getGenerator(id);
    const {TextStreamer}=await import('@huggingface/transformers');
    self.postMessage({id,type:'progress',progress:{status:'generating'}});
    const result=await generator([
      {
        role:'system',
        content:'You are a data analyst. Analyze only the records provided. Never describe an app, tool, feature, or how the records were collected. Do not invent facts or infer anything the records cannot support. Do not diagnose or give medical advice.'
      },
      {
        role:'user',
        content:`Find up to 2 useful observations in these wellness records. Focus on recorded activity, such as frequency, changes over dates, durations, completed sessions, or exercise weights and reps. Each observation must cite concrete evidence from the records (an activity and a count, value, date, or comparison). Avoid generic encouragement. If no meaningful pattern is supported, say so plainly. Output bullet points only.\n\nRecords:\n${JSON.stringify(data)}`
      }
    ],{
      max_new_tokens:120,
      do_sample:false,
      streamer:new TextStreamer(generator.tokenizer,{
        skip_prompt:true,
        skip_special_tokens:true,
        callback_function:text=>self.postMessage({id,type:'text',text})
      })
    });

    const generated=result?.[0]?.generated_text;
    const text=Array.isArray(generated)?generated.at(-1)?.content:generated;
    if(typeof text!=='string'||!text.trim())throw new Error('The model returned an empty summary.');
    self.postMessage({id,type:'done',text:text.trim()});
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
