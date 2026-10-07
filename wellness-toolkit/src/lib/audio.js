import {PREF,SAVE} from './storage';
export const audio={waves:PREF('bw_waves',true),voice:PREF('bw_voice',true)};
let AC=null,WAVE=null;
export const initAudio=()=>{try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){};
};
const noiseBuf=()=>{const b=AC.createBuffer(1,AC.sampleRate*4,AC.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){l=(l+0.02*(Math.random()*2-1))/1.02;d[i]=l*3.5}return b};
export const startWave=()=>{if(!AC||!audio.waves||WAVE)return;try{const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noiseBuf();s.loop=true;f.type='lowpass';f.frequency.value=900;g.gain.value=0.0001;f.connect(g);g.connect(AC.destination);s.connect(f);s.start();WAVE={s,f,g};}catch(e){}};
export const stopWave=()=>{if(!WAVE)return;try{WAVE.g.gain.setTargetAtTime(0.0001,AC.currentTime,0.3);WAVE.s.stop(AC.currentTime+1.5)}catch(e){}WAVE=null};
export const wave=(level,d)=>{if(!WAVE)return;try{const n=AC.currentTime,k=d*0.4;WAVE.g.gain.cancelScheduledValues(n);WAVE.f.frequency.cancelScheduledValues(n);WAVE.g.gain.setTargetAtTime(0.02+level*0.12, n, 0.08);WAVE.f.frequency.setTargetAtTime(400 + k * 1000, n, 0.08);}catch(e){}};
let VOICES=[],UT=null;
export const VOICE_OK=typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';
const loadVoices=()=>{try{VOICES=speechSynthesis.getVoices()||[]}catch(e){};
};
if(VOICE_OK){loadVoices();try{speechSynthesis.addEventListener('voiceschanged',loadVoices)}catch(e){}}

const VOICE_PREF='bw_voice_name';
export const getVoices=()=>{if(!VOICE_OK)return[];try{return speechSynthesis.getVoices()||[]}catch(e){return[]}};
export const getSelectedVoice=(name=PREF(VOICE_PREF,''))=>{
  const voices=getVoices();
  if(!voices.length)return null;
  if(name){const match=voices.find(v=>v.name===name); if(match)return match;}
  return voices.find(v=>/^en/i.test(v.lang)&&v.localService)||voices.find(v=>/^en/i.test(v.lang))||voices[0]||null;
};
export const setSelectedVoice=(name)=>{
  if(!name){SAVE(VOICE_PREF,'');return null;}
  const match=getVoices().find(v=>v.name===name);
  if(match){SAVE(VOICE_PREF,match.name);return match;}
  SAVE(VOICE_PREF,'');
  return null;
};

export const say=(t,force)=>{
  if(!VOICE_OK||!(audio.voice||force))return;
  try{
    const ss=window.speechSynthesis;
    const busy=ss.speaking||ss.pending;
    if(busy)ss.cancel();
    const u=new SpeechSynthesisUtterance(t);
    const selected=getSelectedVoice(PREF(VOICE_PREF,''));
    if(selected){u.voice=selected;u.lang=selected.lang}else u.lang='en-GB';
    u.rate=0.9;u.volume=1;UT=u;
    setTimeout(()=>{try{ss.resume();ss.speak(u)}catch(e){}},busy?100:0);
  }catch(e){}
};
export const testVoice=()=>{initAudio();if(!VOICE_OK){alert("This browser can't play voice guidance. Try opening the page in Safari or Chrome.");return}say('Voice is working. Breathe in, and let go on the exhale.',true)};
export const stopAll=()=>{stopWave();try{speechSynthesis.cancel()}catch(e){}};
