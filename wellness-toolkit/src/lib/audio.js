import {PREF} from './storage';
export const audio={waves:PREF('bw_waves',true),voice:PREF('bw_voice',true)};
let AC=null,WAVE=null;
export const initAudio=()=>{try{AC=AC||new (window.AudioContext||window.webkitAudioContext)();if(AC.state==='suspended')AC.resume()}catch(e){};
};
const noiseBuf=()=>{const b=AC.createBuffer(1,AC.sampleRate*4,AC.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){l=(l+0.02*(Math.random()*2-1))/1.02;d[i]=l*3.5}return b};
export const startWave=()=>{if(!AC||!audio.waves||WAVE)return;try{const s=AC.createBufferSource(),f=AC.createBiquadFilter(),g=AC.createGain();s.buffer=noiseBuf();s.loop=true;f.type='lowpass';f.frequency.value=2200;g.gain.value=0.01;f.connect(g);g.connect(AC.destination);s.connect(f);s.start();WAVE={s,f,g};}catch(e){};
};
export const stopWave=()=>{if(!WAVE)return;try{WAVE.g.gain.setTargetAtTime(0.0001,AC.currentTime,0.3);WAVE.s.stop(AC.currentTime+1.5)}catch(e){}WAVE=null};
export const wave=(level,d)=>{if(!WAVE)return;try{const n=AC.currentTime,k=d*0.4;WAVE.g.gain.cancelScheduledValues(n);WAVE.f.frequency.cancelScheduledValues(n);WAVE.g.gain.setTargetAtTime(0.02+level, n, 0.08);WAVE.f.frequency.setTargetAtTime(400 + k*500, n,0.1)}catch(e){};
};
export const VOICE_OK=typeof window!=='undefined'&&'speechSynthesis' in window&&typeof SpeechSynthesisUtterance!=='undefined';
export const say=(t,force)=>{
  if(!VOICE_OK||!(audio.voice||force))return;
  try{
    const ss=window.speechSynthesis;
    const busy=ss.speaking||ss.pending;
    if(busy)ss.cancel();
    const u=new SpeechSynthesisUtterance(t);
    u.lang='en-GB';
    u.rate=0.9;
    u.volume=1;
    setTimeout(()=>{try{ss.resume();ss.speak(u)}catch(e){}},busy?100:0);
  }catch(e){}
};
export const testVoice=()=>{initAudio();if(!VOICE_OK){alert("This browser can't play voice guidance. Try opening the page in Safari or Chrome.");return}say('Voice is working. Breathe in, and let the pattern settle.',true);};
export const stopAll=()=>{stopWave();try{speechSynthesis.cancel()}catch(e){};
};
