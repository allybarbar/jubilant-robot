export const EX={
 cardio:[['Skipping','Jump rope, or mime it'],['High knees','Drive knees to hip height'],['Jumping jacks','Stay light on your feet'],['Burpees','Chest to floor, then jump'],['Mountain climbers','Hips low, drive knees fast'],['Skater jumps','Leap side to side'],['Squat jumps','Land softly, sit back'],['Heel flicks','Kick heels to glutes']],
 core:[['Plank','Straight line, brace your abs'],['Bicycle crunches','Elbow to opposite knee'],['Dead bugs','Back flat, opposite arm and leg'],['Leg raises','Lower slowly, back flat'],['Russian twists','Lean back, rotate side to side'],['Flutter kicks','Small, fast, low kicks'],['Shoulder taps','From plank, tap opposite shoulder'],['V-ups','Reach hands to toes']],
 kb:[['Kettlebell swings','Hinge at the hips, snap up'],['Goblet squats','Hold at chest, elbows inside knees'],['Kettlebell deadlifts','Flat back, push the floor away'],['Overhead press','Switch arms halfway'],['Bent-over rows','Switch arms halfway'],['Halos','Circle your head, switch direction halfway'],['Reverse lunges','Hold at chest, switch legs halfway'],['Clean and press','Switch arms halfway']]
};
export const EXN={off:'None',cardio:'Cardio',core:'Core',kb:'Strength',all:'All'};
export const ORDN={blocks:'By type',alt:'Alternate',rand:'Random'};
export const ALLDESC={blocks:'All cardio, then all strength, then all core. 24 exercises, one per round.',alt:'Rotates cardio, strength and core. 24 exercises, one per round.',rand:'All 24 exercises in a random order, one per round.'};
export const ALLEX=['cardio','kb','core'].flatMap(c=>EX[c]);
export const shuf=a=>{const b=[...a];for(let i=b.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[b[i],b[j]]=[b[j],b[i]]}return b};
export const pick=(k,n,ord)=>{
  if(k==='off')return null;
  let L=EX[k];
  if(k==='all')L=ord==='alt'?[0,1,2,3,4,5,6,7].flatMap(i=>['cardio','kb','core'].map(c=>EX[c][i])):ord==='rand'?shuf(ALLEX):ALLEX;
  return Array.from({length:n},(_,i)=>L[i%L.length]);
};
