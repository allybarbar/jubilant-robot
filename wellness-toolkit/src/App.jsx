import {useState,useEffect} from 'react';
import {PREF,SAVE} from './lib/storage';
import {getVoices,getSelectedVoice,setSelectedVoice as saveVoiceSelection,VOICE_OK} from './lib/audio';
import Breathing from './components/Breathing';
import Cold from './components/Cold';
import Hiit from './components/Hiit';
import Weights from './components/Weights';
import Yoga from './components/Yoga';
import Journal from './components/Journal';

const TABS=[['breath','Breathing'],['cold','Cold shower'],['hiit','HIIT'],['weights','Weights'],['yoga','Yoga'],['journal','Journal']];
const INTRO={
  breath:'Power breaths, an exhale hold, then a recovery breath.',
  cold:'Time your cold shower, with a short countdown to get in.',
  hiit:'Work and rest intervals with voice cues.',
  weights:'Log your lifts and see how you progress.',
  yoga:'A guided 30 minute session: warm-up, poses and relaxation.',
  journal:'Three short questions to close out your day.'
};

export default function App(){
  const [mode,setMode]=useState(()=>PREF('bw_mode','breath'));
  const [busy,setBusy]=useState(false);
  const [voices,setVoices]=useState(()=>VOICE_OK?getVoices():[]);
  const [selectedVoice,setSelectedVoice]=useState(()=>getSelectedVoice()?.name || '');

  useEffect(()=>{SAVE('bw_mode',mode)},[mode]);

  useEffect(()=>{
    const syncVoices=()=>setVoices(VOICE_OK?getVoices():[]);
    syncVoices();
    if(!VOICE_OK)return;
    try{
      speechSynthesis.addEventListener('voiceschanged',syncVoices);
      return ()=>speechSynthesis.removeEventListener('voiceschanged',syncVoices);
    }catch(e){}
  },[]);

  useEffect(()=>{
    if(!selectedVoice && voices.length){
      const fallback=getSelectedVoice();
      if(fallback){
        setSelectedVoice(fallback.name);
        saveVoiceSelection(fallback.name);
      }
    }
  },[selectedVoice,voices]);

  const handleVoiceChange=(event)=>{
    const next=event.target.value;
    setSelectedVoice(next);
    saveVoiceSelection(next);
  };

  return (
    <div className="app">
      <div>
        <h1>Wellness Toolkit</h1>
        <p>{INTRO[mode]}</p>
      </div>
      {VOICE_OK&&(
        <div className="row voice-controls">
          <label className="voice-picker">
            <span>Voice</span>
            <select value={selectedVoice} onChange={handleVoiceChange} disabled={!voices.length}>
              {!voices.length&&<option value="">Loading voices...</option>}
              {voices.map(v=>(<option key={`${v.name}-${v.lang}`} value={v.name}>{v.name} ({v.lang})</option>))}
            </select>
          </label>
        </div>
      )}
      {!busy&&(<div className="row">
        {TABS.map(([k,l])=>(<button key={k} className={'tab'+(mode===k?' on':'')} onClick={()=>setMode(k)}>{l}</button>))}
      </div>)}
      {mode==='breath'&&<Breathing onBusy={setBusy} onCold={()=>setMode('cold')}/>} 
      {mode==='cold'&&<Cold onBusy={setBusy}/>} 
      {mode==='hiit'&&<Hiit onBusy={setBusy}/>} 
      {mode==='weights'&&<Weights onBusy={setBusy}/>} 
      {mode==='yoga'&&<Yoga onBusy={setBusy}/>} 
      {mode==='journal'&&<Journal/>}
    </div>
  );
}
