export const fmt=s=>Math.floor(s/60)+':'+String(Math.floor(s%60)).padStart(2,'0');
export const PREF=(k,d)=>{try{const v=localStorage.getItem(k);return v==null?d:JSON.parse(v)}catch(e){return d}};
export const SAVE=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}};
