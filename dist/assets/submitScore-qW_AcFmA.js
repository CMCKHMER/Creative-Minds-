const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-Qs6h_-T4.js","./vendor-D5r8ycuZ.js","./index-B9NoeHRx.css"])))=>i.map(i=>d[i]);
import{g as s,_ as u,T as m,W as p,V as g,F as f}from"./index-Qs6h_-T4.js";const b=`https://firestore.googleapis.com/v1/projects/${f}/databases/(default)/documents`;async function h(e){if(e&&e.trim())return e.trim().slice(0,40);const a=localStorage.getItem("cmc-student-email")||"",t=localStorage.getItem("cmc-student-name")||"";if(t.trim()&&!m(t))return t.trim().slice(0,40);const n=await y(p(a));if(n){try{localStorage.setItem("cmc-student-name",n.slice(0,40))}catch{}return n}return g(a)||"Student"}let d=null;function y(e=""){return d||(d=new Promise(a=>{if(typeof document>"u"){a(null);return}const t=document.createElement("div");t.setAttribute("data-cmc-player-name-modal",""),t.innerHTML=`
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
      <div class="cmc-pn-card" role="dialog" aria-modal="true" aria-label="What name should we show?">
        <h3><span class="cmc-pn-dot"></span>What name should we show?</h3>
        <p>Your scores from games &amp; activities appear on the live ticker and leaderboards.</p>
        <input class="cmc-pn-input" maxlength="40" placeholder="Your name…" autocomplete="off" />
        <div class="cmc-pn-row">
          <button type="button" class="cmc-pn-skip">Skip</button>
          <button type="button" class="cmc-pn-save">Save</button>
        </div>
      </div>`;const n=document.body,o=t.querySelector(".cmc-pn-input");e&&(o.value=e.slice(0,40));const c=l=>{t.remove(),document.removeEventListener("keydown",i,!0),d=null,a(l)},r=()=>{const l=o.value.trim().slice(0,40);c(l||null)},i=l=>{l.key==="Enter"?(l.preventDefault(),r()):l.key==="Escape"&&(l.preventDefault(),c(null))};t.querySelector(".cmc-pn-save").addEventListener("click",r),t.querySelector(".cmc-pn-skip").addEventListener("click",()=>c(null)),document.addEventListener("keydown",i,!0),n.appendChild(t),o.focus()}),d)}function x(){try{window.dispatchEvent(new CustomEvent("cmc-drill-submitted"))}catch{}}async function S(e){if(typeof window>"u")return null;const a=await s().catch(()=>null);if(!a)return null;const t=w(a);if(!t)return null;const n=localStorage.getItem("cmc-student-uid")||t;if(n!==t)return null;const o=await h(e.studentName);if(!o)return null;const c=await v(e,o,n,a);return c&&x(),c}function w(e){try{const a=(e||"").split(".")[1];if(!a)return"";const t=a.replace(/-/g,"+").replace(/_/g,"/"),n=atob(t.padEnd(Math.ceil(t.length/4)*4,"=")),o=new TextDecoder().decode(Uint8Array.from(n,i=>i.charCodeAt(0))),c=JSON.parse(o),r=c.user_id??c.sub;return typeof r=="string"?r:""}catch{return""}}async function v(e,a,t,n){const o=t&&localStorage.getItem("cmc-student-classId")||"",c={fields:{drillSlug:{stringValue:String(e.drillSlug).slice(0,80)},drillTitle:{stringValue:String(e.drillTitle).slice(0,120)},drillSource:{stringValue:String(e.drillSource).slice(0,40)},studentName:{stringValue:a},studentUid:{stringValue:t},classId:o?{stringValue:o}:{nullValue:null},scorePct:{integerValue:String(Math.max(0,Math.min(100,Math.round(e.scorePct))))},correctCount:{integerValue:String(Math.max(0,Math.round(e.correctCount)))},totalCount:{integerValue:String(Math.max(0,Math.round(e.totalCount)))},durationSeconds:e.durationSeconds!=null?{integerValue:String(Math.max(0,Math.round(e.durationSeconds)))}:{nullValue:null},submittedAt:{timestampValue:new Date().toISOString()}}};try{const r=await fetch(`${b}/drill_attempts`,{method:"POST",headers:{"Content-Type":"application/json",...n?{Authorization:`Bearer ${n}`}:{}},body:JSON.stringify(c)});if(!r.ok){const l=await r.json().catch(()=>({}));return console.warn("[submitScore] Firestore POST failed:",l?.error?.message||`HTTP ${r.status}`),null}const i=await r.json().catch(()=>({}));return i.name?i.name.split("/").pop():null}catch(r){return console.warn("[submitScore] network error:",r),null}}async function E(e){u(async()=>{const{trackDrillComplete:a}=await import("./index-Qs6h_-T4.js").then(t=>t.aA);return{trackDrillComplete:a}},__vite__mapDeps([0,1,2]),import.meta.url).then(({trackDrillComplete:a})=>{a({drillSlug:e.drillSlug,drillTitle:e.drillTitle,source:e.drillSource,scorePct:e.scorePct,correct:e.correctCount,total:e.totalCount,durationSeconds:e.durationSeconds??0})}).catch(()=>{}),await S(e)}export{S as a,E as s,w as u};
