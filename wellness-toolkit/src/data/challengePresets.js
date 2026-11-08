export const TASK_CATALOG=[
  {id:'workout-1',label:'Workout 1',type:'duration',target:45,unit:'min',enabled:true,outdoorRequired:false},
  {id:'workout-2',label:'Workout 2',type:'duration',target:45,unit:'min',enabled:true,outdoorRequired:true},
  {id:'workout',label:'Workout',type:'duration',target:45,unit:'min',enabled:true,outdoorRequired:false},
  {id:'water',label:'Drink water',type:'counter',target:3800,unit:'ml',enabled:true},
  {id:'reading',label:'Read non-fiction',type:'counter',target:10,unit:'pages',enabled:true},
  {id:'diet',label:'Follow strict diet',type:'checkbox',target:1,unit:'check',enabled:true},
  {id:'no-alcohol',label:'No alcohol',type:'checkbox',target:1,unit:'check',enabled:true},
  {id:'photo',label:'Take a progress photo',type:'checkbox',target:1,unit:'photo',enabled:true,requiresPhoto:true}
];

export const PRESETS={
  hard:{
    id:'hard',label:'75 Hard',resetOnMiss:true,
    tasks:['workout-1','workout-2','water','reading','diet','no-alcohol','photo'].map(id=>({...TASK_CATALOG.find(task=>task.id===id)}))
  },
  soft:{
    id:'soft',label:'75 Soft',resetOnMiss:false,
    tasks:['workout','water','reading'].map((id,index)=>({...TASK_CATALOG.find(task=>task.id===id),target:index===1?3000: index===2?10:45}))
  }
};

export function createCustomTasks(){
  return TASK_CATALOG.filter(task=>!['workout-1','workout-2'].includes(task.id)).map(task=>({...task,enabled:false}));
}