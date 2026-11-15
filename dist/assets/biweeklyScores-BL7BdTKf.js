import{c as C}from"./csvSafe-DzlRz9Jc.js";const w=s=>s.replace(/\.html$/,""),h=(s,t)=>`${s} ${t}${s===1?"":"s"}`;function D(s){if(!s)return"";const t=s.parts.map(e=>`${e.title.split(" · ")[0].replace(/\s*\(.*$/,"")} ${e.total}`);return h(s.total,"question")+(t.length>1?` — ${t.join(" · ")}`:"")}function y(s,t){return s?.[w(t)]?.total}function $(s,t){return typeof t=="number"&&t>0&&typeof s=="number"&&s>0&&s!==t}function T(s,t){return $(s,t)?`Earlier version of this test (${h(s,"question")}; it now has ${t})`:""}let u=null;function R(){if(!u){const s=window.location.pathname.replace(/index\.html$/,"")+"biweek-planner/";u=fetch(s+"test-counts.json",{cache:"no-cache"}).then(t=>t.ok?t.json():null).then(t=>t?.tests??null).catch(()=>(u=null,null))}return u}const F="https://firestore.googleapis.com/v1/projects/creative-minds-cambodia/databases/(default)/documents:runQuery";async function I(){const s=[];let t;do{const e={from:[{collectionId:"drill_attempts",allDescendants:!1}],where:{fieldFilter:{field:{fieldPath:"drillSource"},op:"EQUAL",value:{stringValue:"biweek-planner"}}},limit:800};t&&(e.pageToken=t);const o=await fetch(F,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({structuredQuery:e})});if(!o.ok)throw new Error(`Firestore read failed (HTTP ${o.status})`);const r=await o.json();for(const l of r){if(!l?.document?.fields)continue;const n=l.document.fields,a=c=>typeof n[c]?.stringValue=="string"?n[c].stringValue:"",i=c=>{const b=n[c]?.integerValue??n[c]?.doubleValue,f=Number(b);return Number.isFinite(f)?f:0},d=n.submittedAt?.timestampValue;s.push({studentName:a("studentName")||"Unknown",drillTitle:a("drillTitle")||a("drillSlug")||"Bi-weekly test",drillSlug:a("drillSlug"),classId:a("classId"),scorePct:i("scorePct"),correctCount:i("correctCount"),totalCount:i("totalCount"),submittedAt:typeof d=="string"?d:""})}t=r[r.length-1]?.nextPageToken}while(t);return s.sort((e,o)=>e.submittedAt<o.submittedAt?1:-1),s}function j(...s){return s.flat().sort((t,e)=>t.submittedAt<e.submittedAt?1:t.submittedAt>e.submittedAt?-1:0)}function B(s,t){return t?s.map(e=>{if(e.note)return e;const o=T(e.totalCount,y(t,e.drillSlug));return o?{...e,note:o}:e}):s}function N(s){const t=new Map;for(const e of s){const o=e.drillTitle||e.drillSlug||"Bi-weekly test";let r=t.get(o);r||(r={title:o,slug:e.drillSlug,rows:[]},t.set(o,r)),r.rows.push(e)}return[...t.values()]}const m=s=>{let t="";for(const e of s){const o=e.charCodeAt(0);o<32&&o!==9&&o!==10&&o!==13||(t+=e)}return t.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&apos;")},g=s=>{if(!s)return"";const t=new Date(s);if(Number.isNaN(t.getTime()))return m(s);const e=o=>String(o).padStart(2,"0");return`${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())} ${e(t.getHours())}:${e(t.getMinutes())}`},P=s=>(s.replace(/[:\\/?*[\]<>]/g," ").replace(/\s+/g," ").trim()||"Sheet").slice(0,31),S=["Student","Class","Score %","Correct","Total","Submitted","Note"];function p(s,t){const e=(n,a="")=>{const i=a?` ss:StyleID="${a}"`:"";return typeof n=="number"?`<Cell${i}><Data ss:Type="Number">${n}</Data></Cell>`:`<Cell${i}><Data ss:Type="String">${m(n)}</Data></Cell>`},o=n=>`<Row>${n.join("")}</Row>`,r=t.map(n=>o([e(n.studentName||"Unknown"),e(n.classId||"—"),e(n.scorePct,"sScore"),e(n.correctCount),e(n.totalCount),e(g(n.submittedAt)),e(n.note??"",n.note?"sNote":"")])).join(""),l=t.length===0?'<Row><Cell ss:StyleID="sNote"><Data ss:Type="String">No attempts yet — share the test link; scores appear here the moment students finish.</Data></Cell></Row>':"";return`
 <Worksheet ss:Name="${m(P(s))}">
  <Table ss:DefaultRowHeight="18">
   <Column ss:Width="150"/><Column ss:Width="90"/><Column ss:Width="52"/>
   <Column ss:Width="56"/><Column ss:Width="48"/><Column ss:Width="110"/><Column ss:Width="330"/>
   ${o(S.map(n=>e(n,"sHead")))}
   ${r}${l}
  </Table>
  <WorksheetOptions xmlns="urn:schemas-microsoft-com:office:excel">
   <PageSetup><Layout x:Orientation="Landscape"/><PageMargins x:Bottom="0.5" x:Left="0.4" x:Right="0.4" x:Top="0.5"/></PageSetup>
   <Print><ValidPrinterInfo/><PaperSizeIndex>9</PaperSizeIndex><Scale>85</Scale></Print>
   <Selected/>
   <FreezePanes/><FrozenNoSplit/><SplitHorizontal>1</SplitHorizontal>
   <TopRowBottomPane>1</TopRowBottomPane><ActivePane>2</ActivePane>
   <ProtectObjects>False</ProtectObjects><ProtectScenarios>False</ProtectScenarios>
  </WorksheetOptions>
 </Worksheet>`}const k=["#22d3ee","#8b5cf6","#34d399","#fbbf24","#f87171","#60a5fa"];function E(s){const t=N(s);return`<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Default" ss:Name="Normal"><ss:Font ss:FontName="Calibri" ss:Size="11"/>
   <ss:Alignment ss:Vertical="Center"/><ss:Borders/></Style>
  <Style ss:ID="sHead"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1" ss:Color="#FFFFFF"/>
   <ss:Interior ss:Pattern="Solid" ss:Color="#0F172A"/>
   <ss:Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="sScore"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Bold="1"/>
   <ss:Alignment ss:Horizontal="Center" ss:Vertical="Center"/></Style>
  <Style ss:ID="sNote"><ss:Font ss:FontName="Calibri" ss:Size="11" ss:Italic="1" ss:Color="#64748B"/></Style>
 </Styles>
${t.length?t.map(o=>p(o.title,o.rows)).join(""):p("Scores",[])}
</Workbook>`}const x=s=>{const t=C(s);return/[",\n]/.test(t)?`"${t.replace(/"/g,'""')}"`:t};function W(s){const t=[S.concat(["Test ID"]).join(",")];for(const e of s)t.push([e.studentName||"Unknown",e.classId||"—",e.scorePct,e.correctCount,e.totalCount,g(e.submittedAt),e.note??"",e.drillSlug].map(x).join(","));return"\uFEFF"+t.join(`\r
`)}function v(s,t,e){const o=new Blob([s],{type:e}),r=URL.createObjectURL(o),l=document.createElement("a");l.href=r,l.download=t,l.click(),setTimeout(()=>URL.revokeObjectURL(r),4e3)}const z=s=>{const t=new Date,e=o=>String(o).padStart(2,"0");return`cmc-biweekly-scores-${t.getFullYear()}-${e(t.getMonth()+1)}-${e(t.getDate())}.${s}`},O=k;export{O as T,z as a,I as b,B as c,v as d,E as e,g as f,N as g,W as h,D as i,y as j,$ as k,R as l,j as m,P as s,w as t,T as v,m as x};
