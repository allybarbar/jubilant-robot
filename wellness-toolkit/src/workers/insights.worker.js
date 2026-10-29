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

async function generate({id,summary}){
  try{
    const generator=await getGenerator(id);
    const {TextStreamer}=await import('@huggingface/transformers');
    self.postMessage({id,type:'progress',progress:{status:'generating'}});
    const result=await generator([
      {
        role:'system',
        content:'Narrate only the computed data summary. Do not describe an app or infer unsupported trends. Do not diagnose or give medical advice. Write at most 2 short bullets, each with a concrete number.'
      },
      {
        role:'user',
        content:`Narrate the most useful facts in this summary. Use this exact style:\n- Cold shower: 4 sessions across 3 days, averaging 72 seconds.\n- Yoga: 3 of 4 sessions completed.\nUse only values present in the summary; omit unavailable details. If it has too little information for an observation, say that briefly.\n\nSummary: ${JSON.stringify(summary)}`
      }
    ],{
      max_new_tokens:64,
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
