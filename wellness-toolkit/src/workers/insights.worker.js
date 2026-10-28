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
