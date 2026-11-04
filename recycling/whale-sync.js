const DEFAULT={count:0,goal:25,revision:0};
const room=(window.WHALE_ROOM||'saessak-whale').replace(/[^a-zA-Z0-9_-]/g,'');
const path=`whaleRooms/${room}/state`;
const listeners=new Set();
let state={...DEFAULT},ready=false,demo=true,dbRef=null,authReady=false,runTransaction=null;
const emit=()=>listeners.forEach(fn=>fn({...state}));
const key='whale-demo-'+room;
function normalize(obj){return {count:Math.max(0,Number(obj?.count)||0),goal:Math.max(1,Math.min(200,Number(obj?.goal)||25)),revision:Number(obj?.revision)||0}}
try{state=normalize(JSON.parse(localStorage.getItem(key)||'{}'))}catch{}
function notifyDemo(){localStorage.setItem(key,JSON.stringify(state));if(channel)channel.postMessage(state);emit()}
const channel=('BroadcastChannel' in window)?new BroadcastChannel(key):null;
if(channel)channel.onmessage=e=>{if(demo){state=normalize(e.data);emit()}};
window.addEventListener('storage',e=>{if(demo&&e.key===key){try{state=normalize(JSON.parse(e.newValue));emit()}catch{}}});
export function subscribe(fn){listeners.add(fn);fn({...state});return ()=>listeners.delete(fn)}
export function isDemo(){return demo}
export function getState(){return {...state}}
export async function initSync(){
 const cfg=window.WHALE_FIREBASE_CONFIG||{};
 if(!(cfg.apiKey&&cfg.databaseURL&&cfg.projectId)){ready=true;emit();return {demo:true}}
 try{
   const [{initializeApp},{getDatabase,ref,onValue,runTransaction:tx},{getAuth,signInAnonymously}]=await Promise.all([import('https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js'),import('https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js')]);
   runTransaction=tx;const app=initializeApp(cfg);const auth=getAuth(app);await signInAnonymously(auth);authReady=true;
   dbRef=ref(getDatabase(app),path);
   demo=false;
   onValue(dbRef,snap=>{state=normalize(snap.val());ready=true;emit()},err=>{console.error('Firebase subscription failed:',err);window.dispatchEvent(new CustomEvent('whale-sync-error',{detail:err.message}))});
   return {demo:false};
 }catch(err){console.error(err);window.dispatchEvent(new CustomEvent('whale-sync-error',{detail:err.message}));ready=true;emit();return {demo:true,error:err.message}}
}
async function change(fn){
 if(demo){state=normalize(fn({...state}));notifyDemo();return {...state}}
 if(!authReady||!dbRef)throw Error('연결 준비 중입니다.');
 const result=await runTransaction(dbRef,current=>fn(normalize(current)),{applyLocally:false});
 if(!result.committed)throw Error('요청을 반영하지 못했습니다.');
 return normalize(result.snapshot.val())
}
export async function award(){return change(s=>s.count>=s.goal?s:{...s,count:s.count+1,revision:s.revision+1})}
export async function setGoal(goal){const n=Math.max(1,Math.min(200,Math.round(Number(goal)||25)));return change(s=>({...s,count:0,goal:n,revision:s.revision+1}))}
export async function reset(){return change(s=>({...s,count:0,revision:s.revision+1}))}
export async function undo(){return change(s=>({...s,count:Math.max(0,s.count-1),revision:s.revision+1}))}
