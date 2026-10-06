export const SPLITS=[
 ['Push / Pull / Legs',['Push','Pull','Legs']],
 ['Upper / Lower',['Upper','Lower']],
 ['Body-part combos',['Chest & Back','Legs & Shoulders','Chest & Triceps','Back & Biceps','Shoulders & Arms','Arms']],
 ['Full body',['Full body']]
];
export const WEX={
 'Push':['Bench press','Overhead press','Incline dumbbell press','Lateral raises','Triceps pushdown','Dips'],
 'Pull':['Deadlift','Pull-ups','Barbell row','Lat pulldown','Face pulls','Biceps curl'],
 'Legs':['Squat','Romanian deadlift','Leg press','Walking lunges','Leg curl','Calf raises'],
 'Upper':['Bench press','Barbell row','Overhead press','Lat pulldown','Biceps curl','Triceps pushdown'],
 'Lower':['Squat','Romanian deadlift','Leg press','Leg curl','Hip thrust','Calf raises'],
 'Chest & Back':['Bench press','Incline dumbbell press','Cable fly','Barbell row','Lat pulldown','Seated cable row'],
 'Legs & Shoulders':['Squat','Romanian deadlift','Leg press','Overhead press','Lateral raises','Rear delt fly'],
 'Chest & Triceps':['Bench press','Incline dumbbell press','Cable fly','Dips','Triceps pushdown','Skull crushers'],
 'Back & Biceps':['Deadlift','Pull-ups','Barbell row','Seated cable row','Barbell curl','Hammer curl'],
 'Shoulders & Arms':['Overhead press','Lateral raises','Rear delt fly','Barbell curl','Triceps pushdown','Hammer curl'],
 'Arms':['Barbell curl','Hammer curl','Preacher curl','Triceps pushdown','Skull crushers','Overhead triceps extension'],
 'Full body':['Squat','Bench press','Barbell row','Overhead press','Romanian deadlift','Pull-ups']
};
export const lastFor=(log,n)=>{for(const s of log){const e=s.ex.find(x=>x.n===n&&x.sets.length);if(e)return{sets:e.sets,u:s.u}}return null};
export const bestFor=(log,n)=>{let b=0;for(const s of log)for(const e of s.ex)if(e.n===n)for(const t of e.sets)b=Math.max(b,+t.w||0);return b};
export const nSets=s=>s.ex.reduce((a,e)=>a+e.sets.length,0);
export const mkSets=l=>l?l.sets.map(t=>({w:t.w,r:t.r,ok:false})):[0,1,2].map(()=>({w:'',r:'',ok:false}));

