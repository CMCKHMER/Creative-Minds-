const __vite__mapDeps=(i,m=__vite__mapDeps,d=(m.f||(m.f=["./index-B4AddFTG.js","./vendor-CBODTOvu.js","./index-_-ZpwRgW.css"])))=>i.map(i=>d[i]);
import{_ as g,g as f,v as m,w as b,q as y,F as h}from"./index-B4AddFTG.js";const S=`https://firestore.googleapis.com/v1/projects/${h}/databases/(default)/documents`,d="cmc-player-name",x=2160*60*60*1e3;function w(){try{const e=localStorage.getItem(d);if(!e)return"";const t=JSON.parse(e);return!t?.name||typeof t.at!="number"?"":Date.now()-t.at>x?(localStorage.removeItem(d),""):t.name.slice(0,40)}catch{return""}}function v(e){try{localStorage.setItem(d,JSON.stringify({name:e,at:Date.now()}))}catch{}}let s=null;function E(e=""){return s||(s=new Promise(t=>{if(typeof document>"u"){t(null);return}const a=document.createElement("div");a.setAttribute("data-cmc-player-name-modal",""),a.innerHTML=`
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
      </div>`;const c=document.body,r=a.querySelector(".cmc-pn-input");e&&(r.value=e.slice(0,40));const n=l=>{a.remove(),document.removeEventListener("keydown",i,!0),s=null,t(l)},o=()=>{const l=r.value.trim().slice(0,40);n(l||null)},i=l=>{l.key==="Enter"?(l.preventDefault(),o()):l.key==="Escape"&&(l.preventDefault(),n(null))};a.querySelector(".cmc-pn-save").addEventListener("click",o),a.querySelector(".cmc-pn-skip").addEventListener("click",()=>n(null)),document.addEventListener("keydown",i,!0),c.appendChild(a),r.focus()}),s)}async function k(e){if(e&&e.trim())return e.trim().slice(0,40);const t=localStorage.getItem("cmc-student-email")||"",a=!!localStorage.getItem("cmc-student-uid"),c=localStorage.getItem("cmc-student-name")||"";if(c.trim()&&!m(c))return c.trim().slice(0,40);const r=w();if(r&&!m(r))return r;const n=await E(a?b(t):"");if(n){if(a)try{localStorage.setItem("cmc-student-name",n.slice(0,40))}catch{}else v(n);return n}return a?y(t)||"Student":null}function u(){try{window.dispatchEvent(new CustomEvent("cmc-drill-submitted"))}catch{}}async function I(e){if(typeof window>"u")return null;const t=await f().catch(()=>null),a=!!t,c=await k(e.studentName);if(!c){if(!a){const o=await p(e,"Guest","",null);return o&&u(),o}return null}const r=a&&localStorage.getItem("cmc-student-uid")||"",n=await p(e,c,r,t);return n&&u(),n}async function p(e,t,a,c){const r=a&&localStorage.getItem("cmc-student-classId")||"",n={fields:{drillSlug:{stringValue:String(e.drillSlug).slice(0,80)},drillTitle:{stringValue:String(e.drillTitle).slice(0,120)},drillSource:{stringValue:String(e.drillSource).slice(0,40)},studentName:{stringValue:t},studentUid:{stringValue:a},classId:r?{stringValue:r}:{nullValue:null},scorePct:{integerValue:String(Math.max(0,Math.min(100,Math.round(e.scorePct))))},correctCount:{integerValue:String(Math.max(0,Math.round(e.correctCount)))},totalCount:{integerValue:String(Math.max(0,Math.round(e.totalCount)))},durationSeconds:e.durationSeconds!=null?{integerValue:String(Math.max(0,Math.round(e.durationSeconds)))}:{nullValue:null},submittedAt:{timestampValue:new Date().toISOString()}}};try{const o=await fetch(`${S}/drill_attempts`,{method:"POST",headers:{"Content-Type":"application/json",...c?{Authorization:`Bearer ${c}`}:{}},body:JSON.stringify(n)});if(!o.ok){const l=await o.json().catch(()=>({}));return console.warn("[submitScore] Firestore POST failed:",l?.error?.message||`HTTP ${o.status}`),null}const i=await o.json().catch(()=>({}));return i.name?i.name.split("/").pop():null}catch(o){return console.warn("[submitScore] network error:",o),null}}async function P(e){g(async()=>{const{trackDrillComplete:t}=await import("./index-B4AddFTG.js").then(a=>a.A);return{trackDrillComplete:t}},__vite__mapDeps([0,1,2]),import.meta.url).then(({trackDrillComplete:t})=>{t({drillSlug:e.drillSlug,drillTitle:e.drillTitle,source:e.drillSource,scorePct:e.scorePct,correct:e.correctCount,total:e.totalCount,durationSeconds:e.durationSeconds??0})}).catch(()=>{}),await I(e)}export{I as a,P as s};
