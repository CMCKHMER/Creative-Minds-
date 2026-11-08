const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-D4xL1jai.js","./vendor-CkMYr-n8.js","./index-CM57FnqC.css"])))=>i.map(i=>d[i]);
import{_ as p,o as g,F as f}from"./index-D4xL1jai.js";const b=`https://firestore.googleapis.com/v1/projects/${f}/databases/(default)/documents`,s="cmc-player-name",h=2160*60*60*1e3;function y(){try{const e=localStorage.getItem(s);if(!e)return"";const t=JSON.parse(e);return!t?.name||typeof t.at!="number"?"":Date.now()-t.at>h?(localStorage.removeItem(s),""):t.name.slice(0,40)}catch{return""}}function x(e){try{localStorage.setItem(s,JSON.stringify({name:e,at:Date.now()}))}catch{}}let i=null;function S(){return i||(i=new Promise(e=>{if(typeof document>"u"){e(null);return}const t=document.createElement("div");t.setAttribute("data-cmc-player-name-modal",""),t.innerHTML=`
      <style>
        [data-cmc-player-name-modal] { position: fixed; inset: 0; z-index: 2147483000;
          display: flex; align-items: center; justify-content: center; padding: 20px;
          background: rgba(2, 8, 20, 0.72); backdrop-filter: blur(4px); }
        [data-cmc-player-name-modal] .cmc-pn-card { width: 100%; max-width: 380px;
          background: linear-gradient(160deg, #0d1b2e 0%, #0a1424 100%);
          border: 1px solid rgba(148, 197, 255, 0.22); border-radius: 18px;
          box-shadow: 0 30px 80px -20px rgba(0, 0, 0, 0.8);
          padding: 22px 22px 18px; font-family: inherit; color: #e2e8f0; }
        [data-cmc-player-name-modal] h3 { margin: 0 0 6px; font-size: 17px; font-weight: 800;
          letter-spacing: 0.01em; display: flex; align-items: center; gap: 8px; }
        [data-cmc-player-name-modal] h3 .cmc-pn-dot { width: 9px; height: 9px; border-radius: 99px;
          background: #22d3ee; box-shadow: 0 0 10px rgba(34, 211, 238, 0.9); flex: none; }
        [data-cmc-player-name-modal] p { margin: 0 0 14px; font-size: 12.5px; line-height: 1.55; color: #94a3b8; }
        [data-cmc-player-name-modal] input { width: 100%; box-sizing: border-box; padding: 10px 12px;
          font-size: 14px; font-weight: 600; color: #f1f5f9; background: rgba(255, 255, 255, 0.06);
          border: 1px solid rgba(148, 197, 255, 0.28); border-radius: 10px; outline: none; }
        [data-cmc-player-name-modal] input:focus { border-color: rgba(34, 211, 238, 0.65);
          box-shadow: 0 0 0 3px rgba(34, 211, 238, 0.18); }
        [data-cmc-player-name-modal] .cmc-pn-row { display: flex; gap: 8px; margin-top: 14px; }
        [data-cmc-player-name-modal] button { flex: 1; padding: 10px 12px; font-size: 13px; font-weight: 700;
          border-radius: 10px; border: 1px solid transparent; cursor: pointer; }
        [data-cmc-player-name-modal] .cmc-pn-save { background: linear-gradient(135deg, #22d3ee, #0ea5e9);
          color: #04121f; border: none; }
        [data-cmc-player-name-modal] .cmc-pn-save:hover { filter: brightness(1.08); }
        [data-cmc-player-name-modal] .cmc-pn-skip { background: rgba(255, 255, 255, 0.05);
          border-color: rgba(148, 163, 184, 0.25); color: #94a3b8; }
        [data-cmc-player-name-modal] .cmc-pn-skip:hover { color: #cbd5e1; }
      </style>
      <div class="cmc-pn-card" role="dialog" aria-modal="true" aria-label="Who is playing?">
        <h3><span class="cmc-pn-dot"></span>Who's playing?</h3>
        <p>Enter a name and your scores from games &amp; activities will show up on the live ticker and leaderboards.</p>
        <input class="cmc-pn-input" maxlength="40" placeholder="Your name…" autocomplete="off" />
        <div class="cmc-pn-row">
          <button type="button" class="cmc-pn-skip">Skip</button>
          <button type="button" class="cmc-pn-save">Save</button>
        </div>
      </div>`;const a=document.body,n=t.querySelector(".cmc-pn-input"),c=o=>{t.remove(),document.removeEventListener("keydown",r,!0),i=null,e(o)},l=()=>{const o=n.value.trim().slice(0,40);c(o||null)},r=o=>{o.key==="Enter"?(o.preventDefault(),l()):o.key==="Escape"&&(o.preventDefault(),c(null))};t.querySelector(".cmc-pn-save").addEventListener("click",l),t.querySelector(".cmc-pn-skip").addEventListener("click",()=>c(null)),document.addEventListener("keydown",r,!0),a.appendChild(t),n.focus()}),i)}async function w(e){if(e&&e.trim())return e.trim().slice(0,40);const t=localStorage.getItem("cmc-student-name")||"";if(t.trim())return t.trim().slice(0,40);const a=y();if(a)return a;const n=await S();return n&&x(n),n}function d(){try{window.dispatchEvent(new CustomEvent("cmc-drill-submitted"))}catch{}}async function v(e){if(typeof window>"u")return null;const t=await g().catch(()=>null),a=!!t,n=await w(e.studentName);if(!n){if(!a){const r=await m(e,"Guest","",null);return r&&d(),r}return null}const c=a&&localStorage.getItem("cmc-student-uid")||"",l=await m(e,n,c,t);return l&&d(),l}async function m(e,t,a,n){const c=a&&localStorage.getItem("cmc-student-classId")||"",l={fields:{drillSlug:{stringValue:String(e.drillSlug).slice(0,80)},drillTitle:{stringValue:String(e.drillTitle).slice(0,120)},drillSource:{stringValue:String(e.drillSource).slice(0,40)},studentName:{stringValue:t},studentUid:{stringValue:a},classId:c?{stringValue:c}:{nullValue:null},scorePct:{integerValue:String(Math.max(0,Math.min(100,Math.round(e.scorePct))))},correctCount:{integerValue:String(Math.max(0,Math.round(e.correctCount)))},totalCount:{integerValue:String(Math.max(0,Math.round(e.totalCount)))},durationSeconds:e.durationSeconds!=null?{integerValue:String(Math.max(0,Math.round(e.durationSeconds)))}:{nullValue:null},submittedAt:{timestampValue:new Date().toISOString()}}};try{const r=await fetch(`${b}/drill_attempts`,{method:"POST",headers:{"Content-Type":"application/json",...n?{Authorization:`Bearer ${n}`}:{}},body:JSON.stringify(l)});if(!r.ok){const u=await r.json().catch(()=>({}));return console.warn("[submitScore] Firestore POST failed:",u?.error?.message||`HTTP ${r.status}`),null}const o=await r.json().catch(()=>({}));return o.name?o.name.split("/").pop():null}catch(r){return console.warn("[submitScore] network error:",r),null}}async function E(e){p(async()=>{const{trackDrillComplete:t}=await import("./index-D4xL1jai.js").then(a=>a.x);return{trackDrillComplete:t}},__vite__mapDeps([0,1,2]),import.meta.url).then(({trackDrillComplete:t})=>{t({drillSlug:e.drillSlug,drillTitle:e.drillTitle,source:e.drillSource,scorePct:e.scorePct,correct:e.correctCount,total:e.totalCount,durationSeconds:e.durationSeconds??0})}).catch(()=>{}),await v(e)}export{v as a,E as s};
