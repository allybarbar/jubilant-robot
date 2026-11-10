import {useState,useEffect,useRef} from 'react';
import {PREF,SAVE} from './lib/storage.js';
import Breathing from './components/Breathing.jsx';
import Cold from './components/Cold.jsx';
import Hiit from './components/Hiit.jsx';
import Weights from './components/Weights.jsx';
import Yoga from './components/Yoga.jsx';
import Journal from './components/Journal.jsx';
import BodyStats from './components/BodyStats.jsx';
import Insights from './components/Insights.jsx';
import The75 from './components/The75.jsx';

const TABS=[['breath','Breathing'],['cold','Cold shower'],['hiit','HIIT'],['weights','Weights'],['yoga','Yoga'],['journal','Journal'],['body','Body stats'],['challenge','The 75']];
const INTRO={
  breath:'Power breaths, an exhale hold, then a recovery breath.',
  cold:'Time your cold shower, with a short countdown to get in.',
  hiit:'Work and rest intervals with voice cues.',
  weights:'Log your lifts and see how you progress.',
  yoga:'A guided 30 minute session: warm-up, poses and relaxation.',
  journal:'Three short questions to close out your day.',
  body:'Record your weight, height, waist and blood pressure.',
  challenge:'A configurable 75-day challenge with daily tasks and progress history.'
};

export default function App(){
  const [mode,setMode]=useState(()=>{
    const preferred=PREF('bw_mode','breath');
    return TABS.some(([key])=>key===preferred)?preferred:'breath';
  });
  const [busy,setBusy]=useState(false);
  const [fadingOut,setFadingOut]=useState(false);
  const modeRef=useRef(mode);
  const pendingModeRef=useRef(mode);
  const transitionTimeout=useRef(null);

  useEffect(()=>{SAVE('bw_mode',mode)},[mode]);
  useEffect(()=>()=>clearTimeout(transitionTimeout.current),[]);

  function selectMode(nextMode){
    if(modeRef.current===nextMode&&!fadingOut)return;
    clearTimeout(transitionTimeout.current);
    pendingModeRef.current=nextMode;
    setFadingOut(true);
    transitionTimeout.current=setTimeout(()=>{
      modeRef.current=pendingModeRef.current;
      setMode(pendingModeRef.current);
      setFadingOut(false);
      transitionTimeout.current=null;
    },300);
  }

  return (
    <div className={'app'+(mode==='challenge'?' challenge-app':'')}>
      {!busy&&(<div className="row">
        {TABS.map(([k,l])=>(<button key={k} className={'tab'+(mode===k?' on':'')} onClick={()=>selectMode(k)}>{l}</button>))}
      </div>)}
      <div className={'tab-content'+(fadingOut?' fading-out':'')}>
        <p>{INTRO[mode]}</p>
      </div>
      <div className={'tab-content'+(fadingOut?' fading-out':'')}>
        {mode==='breath'&&<Breathing onBusy={setBusy} onCold={()=>selectMode('cold')}/>}
        {mode==='cold'&&<Cold onBusy={setBusy}/>}
        {mode==='hiit'&&<Hiit onBusy={setBusy}/>}
        {mode==='weights'&&<Weights onBusy={setBusy}/>}
        {mode==='yoga'&&<Yoga onBusy={setBusy}/>}
        {mode==='journal'&&<Journal/>}
        {mode==='body'&&<BodyStats/>}
        {mode==='challenge'&&<The75/>}
        <Insights key={mode} screen={mode}/>
      </div>
    </div>
  );
}
