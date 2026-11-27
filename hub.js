/* Shared data bridge for the standalone apps. Stored locally in this browser/origin. */
(function(){
"use strict";
const KEY="personal-app-hub-v1", THEME_KEY="personal-app-hub-theme";
const defaults={theme:"ocean",logs:[],achievements:[],goals:[],languages:[],codes:[],projects:[],words:[],alerts:[]};
function load(){try{return Object.assign({},defaults,JSON.parse(localStorage.getItem(KEY)||"{}"))}catch(e){return {...defaults}}}
let data=load(),listeners=[],themeListeners=[];
function save(){try{localStorage.setItem(KEY,JSON.stringify(data))}catch(e){console.warn("Hub storage unavailable",e)};listeners.forEach(fn=>{try{fn(data)}catch(e){}})}
function id(){return Date.now().toString(36)+Math.random().toString(36).slice(2,8)}
const LOG_TYPES={
 equipment_registered:{label:"أجهزة مسجلة",unit:"جهاز",icon:"🧰"},component_added:{label:"مكونات مضافة",unit:"مكوّن",icon:"🔩"},
 vocab_review:{label:"مراجعة مفردات",unit:"كلمة",icon:"🇬🇧"},reading_pages:{label:"صفحات مقروءة",unit:"صفحة",icon:"📖"},
 reference_quiz:{label:"اختبارات المرجع",unit:"اختبار",icon:"🧠"},coding_minutes:{label:"وقت البرمجة",unit:"دقيقة",icon:"⌨️"},
 weight:{label:"الوزن",unit:"كجم",icon:"⚖️"},custom:{label:"نشاط مخصص",unit:"مرة",icon:"✦"}
};
function addLog(item,source){data.logs.unshift({...item,id:id(),source:source||"app",date:new Date().toISOString()});save()}
function addAchievement(a){data.achievements.unshift({...a,id:id(),date:new Date().toISOString()});save()}
function addGoal(g){const x={...g,id:id(),kind:"counter",createdAt:Date.now()};data.goals.push(x);save();return x}
function addRangeGoal(g){const x={...g,id:id(),kind:"range",createdAt:Date.now()};data.goals.push(x);save();return x}
function addTimeGoal(g){const x={...g,id:id(),kind:"time",createdAt:Date.now()};data.goals.push(x);save();return x}
function addChecklistGoal(g){const x={...g,id:id(),kind:"checklist",items:(g.items||[]).map(title=>({id:id(),title,done:false})),createdAt:Date.now()};data.goals.push(x);save();return x}
function apiPush(key,items){if(!Array.isArray(items))items=[items];data[key]=data[key]||[];items.forEach(x=>{if(x && !data[key].some(y=>y.id&&y.id===x.id))data[key].push({...x,id:x.id||id()})});save()}
function themeList(){return [{id:"ocean",label:"محيط هادئ"},{id:"night-blue",label:"أزرق ليلي"},{id:"amber",label:"كهرماني"},{id:"daylight",label:"نهاري"},{id:"forest",label:"غابة"}]}
function setTheme(name,source){data.theme=name;try{localStorage.setItem(THEME_KEY,name)}catch(e){};save();themeListeners.forEach(fn=>{try{fn(name,source)}catch(e){}})}
const HUB={
 LOG_TYPES,
 getAll:()=>data,getStats:()=>{
 const byApp={};["english","editor","codelib","meals"].forEach(k=>byApp[k]={});
 (data.words||[]).forEach(x=>{const k=x.source||"english";byApp[k]=byApp[k]||{};byApp[k].words=(byApp[k].words||0)+1});
 (data.codes||[]).forEach(x=>{const k=x.source||"codelib";byApp[k]=byApp[k]||{};byApp[k].codes=(byApp[k].codes||0)+1});
 (data.languages||[]).forEach(x=>{const k=x.source||"editor";byApp[k]=byApp[k]||{};byApp[k].languages=(byApp[k].languages||0)+1});
 (data.projects||[]).forEach(x=>{const k=x.source||"editor";byApp[k]=byApp[k]||{};byApp[k].projects=(byApp[k].projects||0)+1});
 const byMetric={activities:(data.logs||[]).length,achievements:(data.achievements||[]).length,alertsResolved:0,plansCompleted:(data.goals||[]).filter(g=>g.done).length};
 return {logs:data.logs.length,achievements:data.achievements.length,goals:data.goals.length,words:data.words.length,codes:data.codes.length,languages:data.languages.length,projects:data.projects.length,byApp,byMetric};
 },
 getTheme:()=>{try{return localStorage.getItem(THEME_KEY)||data.theme||"ocean"}catch(e){return data.theme}},
 getThemeList:themeList,setTheme,
 applyTheme:(name,app)=>{try{document.documentElement.dataset.hubTheme=name;document.documentElement.dataset.hubApp=app||""}catch(e){}},
 onThemeChange:fn=>{if(typeof fn==="function")themeListeners.push(fn)},
 onChange:fn=>{if(typeof fn==="function")listeners.push(fn)},
 addLog,getLogs:type=>data.logs.filter(x=>!type||x.type===type),
 getLogSummary:type=>{const a=data.logs.filter(x=>x.type===type);return {count:a.length,total:a.reduce((s,x)=>s+(+x.value||0),0),last:a[0]||null}},
 addAchievement,getAchievements:()=>data.achievements,
 getGoals:()=>data.goals,addGoal,addRangeGoal,addTimeGoal,addChecklistGoal,
 removeGoal:gid=>{data.goals=data.goals.filter(x=>x.id!==gid);save()},
 addChecklistItem:(gid,title)=>{const g=data.goals.find(x=>x.id===gid);if(g){g.items=g.items||[];g.items.push({id:id(),title,done:false});save()}},
 toggleChecklistItem:(gid,iid)=>{const g=data.goals.find(x=>x.id===gid),i=g&&(g.items||[]).find(x=>x.id===iid);if(i){i.done=!i.done;save()}},
 addLanguage:(name,source)=>apiPush("languages",{name,source}),
 syncCodes:(items,source)=>{data.codes=(items||[]).map(x=>({...x,source:source||x.source}));save()},
 syncProjects:(items,source)=>{data.projects=(items||[]).map(x=>({...x,source:source||x.source}));save()},
 addWords:items=>apiPush("words",items),
 syncAlertsForSource:(source,alerts)=>{data.alerts=data.alerts.filter(x=>x.source!==source).concat((alerts||[]).map(x=>({...x,source})));save()}
};
window.HUB=HUB;
try{window.HUB.applyTheme(window.HUB.getTheme(),"hub")}catch(e){}
window.addEventListener("storage",e=>{if(e.key===KEY||e.key===THEME_KEY){data=load();listeners.forEach(fn=>{try{fn(data)}catch(_){} });if(e.key===THEME_KEY)themeListeners.forEach(fn=>{try{fn(HUB.getTheme())}catch(_){} })}});
})();