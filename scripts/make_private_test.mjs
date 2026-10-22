#!/usr/bin/env node
// make_private_test.mjs — generate a PRIVATE (answer-free, teacher-scored)
// variant of a bi-weekly test page.
//
//   node scripts/make_private_test.mjs diagnostic
//
// Inputs : public/biweek-planner/tests/<slug>.html   (practice page, answers inline)
// Outputs:
//   1. public/biweek-planner/tests/private/<slug>.html
//      - teacher-gate REMOVED (students must reach this page)
//      - TEST_CONFIG/TEST_BANKS replaced by CMC_PRIVATE_TEST payload that has
//        NO answer data at all (prompts + choices only)
//      - the practice engine (grades inline, reveals correct answers, shows
//        the score) replaced by cmc-private-test engine: collect -> submit raw
//        answers to Firestore test_submissions -> "your teacher will review"
//      - noindex meta, retitled
//   2. ../private-test-keys/<testId>.key.json   (sibling of the repo checkout,
//      override with the CMC_KEYS_DIR env var)
//      - THE answer key, for the teacher to install once via the dashboard.
//        NEVER written inside the repo (the repo is public!).
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..'); // repo root
const TESTS_DIR = path.join(ROOT, 'public/biweek-planner/tests');
const PRIVATE_DIR = path.join(TESTS_DIR, 'private');
// The key must never land inside this (public) repo — default to a sibling
// directory of the checkout, overridable for CI or custom setups.
const KEYS_DIR = process.env.CMC_KEYS_DIR || path.resolve(ROOT, '..', 'private-test-keys');

const slug = process.argv[2];
if (!slug) {
  console.error('Usage: node make_private_test.mjs <slug>   (e.g. diagnostic)');
  process.exit(1);
}
const srcPath = path.join(TESTS_DIR, slug + '.html');
const html = fs.readFileSync(srcPath, 'utf8');
// Rhetorical-bank hooks live in the shared engine (replaced wholesale), so
// only the per-page DATA block decides support.
if (/window\.RHETORICAL|RHETORICAL_[AB]\s*=/.test(dataBlockGuess(html))) {
  console.error(`${slug}: rhetorical-bank pages are not supported yet — convert manually`);
  process.exit(1);
}
function dataBlockGuess(text) {
  const m = text.match(/<script>([\s\S]*?)<\/script>/g) || [];
  for (const block of m) if (block.includes('window.TEST_CONFIG')) return block;
  return text;
}

// ── 1. Locate the two script blocks ─────────────────────────────────
const scriptRe = /<script>([\s\S]*?)<\/script>/g;
let dataBlock = null; // defines window.TEST_CONFIG / window.TEST_BANKS
let engineBlock = null; // starts with the CMC-TEMPLATE-V2 comment
for (const m of html.matchAll(scriptRe)) {
  const body = m[1];
  if (body.includes('CMC-TEMPLATE-V2')) engineBlock = m;
  else if (body.includes('window.TEST_CONFIG')) dataBlock = m;
}
if (!dataBlock || !engineBlock) {
  console.error(`${slug}: could not locate TEST_CONFIG block or template engine block`);
  process.exit(1);
}

// ── 2. Evaluate the data block in a sandbox to read config + banks ──
const sandbox = { window: {}, console };
vm.createContext(sandbox);
try {
  vm.runInContext(dataBlock[1], sandbox, { filename: `${slug}-data.js` });
} catch (err) {
  console.error(`${slug}: data block failed to evaluate: ${err.message}`);
  process.exit(1);
}
const config = sandbox.window.TEST_CONFIG;
const banks = sandbox.window.TEST_BANKS;
if (!config || !banks) {
  console.error(`${slug}: TEST_CONFIG / TEST_BANKS missing after evaluation`);
  process.exit(1);
}

// ── 3. Build the answer-free question payload + the key ─────────────
const testId = 'biweek-' + slug;
const groups = (config.groups || []).map((g) => ({ id: g.id, title: g.title, focus: g.focus || '', dirs: g.dirs || '' }));
const groupIds = new Set(groups.map((g) => g.id));
// The practice template only renders banks whose key matches a config.groups
// id (`if(!target)return`) — silently skipping the rest. Mirror that exactly
// so question numbering and content match the practice page 1:1.
const skippedBanks = Object.keys(banks).filter((tid) => !groupIds.has(tid));
if (skippedBanks.length) {
  console.log(`  note: skipping ${skippedBanks.length} bank(s) with no matching group (same as practice template): ${skippedBanks.join(', ')}`);
}
const questions = [];
const keyQuestions = [];
let qnum = 0;
for (const [gid, rows] of Object.entries(banks)) {
  if (!groupIds.has(gid)) continue; // same skip rule as the practice template
  for (const row of rows) {
    qnum += 1;
    const answer = row[2];
    questions.push({ gid, qnum, prompt: row[0], choices: row[1] });
    keyQuestions.push({
      gid,
      qnum,
      answer: Array.isArray(answer) ? answer.map(String).sort().join('|') : String(answer),
    });
  }
}

const payload = {
  testId,
  meta: {
    title: config.title,
    kicker: config.kicker,
    icon: config.icon,
    color: config.color,
    instructions: config.instructions,
    transcript: config.transcript || '',
    fields: config.fields || [],
  },
  groups,
  questions,
};

const key = {
  testId,
  title: config.title,
  source: `biweek-planner/tests/${slug}.html`,
  groups: groups.map((g) => ({ id: g.id, title: g.title })),
  questions: keyQuestions,
  generatedAt: new Date().toISOString(),
};

// ── 4. The private engine (no template literals, no answers) ────────
const ENGINE = `<script>
/* CMC-PRIVATE-TEST-V1 — student runtime for teacher-assigned bi-weekly tests.
 * Answers are collected and submitted raw to Firestore (test_submissions);
 * nothing is graded, revealed, or displayed here. Scores exist only on the
 * teacher's dashboard. One attempt per student is enforced by the database
 * (submission doc id = assignmentId__studentUid, create-only). */
(function(){
'use strict';
var T=window.CMC_PRIVATE_TEST;
var $=function(s){return document.querySelector(s)};
var ls=function(k){try{return localStorage.getItem(k)}catch(e){return null}};
var FB_API_KEY=window.CMC_FB_API_KEY||'AIzaSyDNUq0ru99XKh08D887Xk63h36MPOlXWwc';
var PROJECT='creative-minds-cambodia';
var BASE='https://firestore.googleapis.com/v1/projects/'+PROJECT+'/databases/(default)/documents';
var token=ls('cmc-student-token'),uid=ls('cmc-student-uid'),sname=ls('cmc-student-name'),classId=ls('cmc-student-classId');
var tokenExp=Number(ls('cmc-student-token-expires')||'0');
var assignmentId=new URLSearchParams(location.search).get('assignment')||'';
var startedAt=null,integrity={fsExits:0,blurs:0},fsActive=false,submitted=false;

function refresh(cb){
  var rt=ls('cmc-student-refresh-token');
  if(!rt){cb(null);return}
  fetch('https://securetoken.googleapis.com/v1/token?key='+FB_API_KEY,{
    method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
    body:'grant_type=refresh_token&refresh_token='+encodeURIComponent(rt)
  }).then(function(r){return r.ok?r.json():null}).then(function(d){
    if(!d||!d.id_token){cb(null);return}
    try{localStorage.setItem('cmc-student-token',d.id_token);
      localStorage.setItem('cmc-student-token-expires',String(Date.now()+(Number(d.expires_in)||3600)*1000-60000));
      if(d.refresh_token)localStorage.setItem('cmc-student-refresh-token',d.refresh_token);}catch(e){}
    cb(d.id_token);
  }).catch(function(){cb(null)});
}
function ensureToken(cb){ if(tokenExp&&tokenExp<=Date.now()){refresh(function(t){if(t)token=t;cb(token)})} else cb(token); }
function rest(path,opts,cb){
  ensureToken(function(tok){
    if(!tok){cb({status:0,error:'Not signed in'});return}
    fetch(BASE+path,Object.assign({},opts,{headers:Object.assign({'Content-Type':'application/json'},opts&&opts.noAuth?{}:{Authorization:'Bearer '+tok})}))
      .then(function(r){ r.json().then(function(b){cb({status:r.status,body:b,ok:r.ok})},function(){cb({status:r.status,ok:r.ok,body:{}})}) })
      .catch(function(){cb({status:0,error:'Network unreachable'})});
  });
}
function fsFields(v){ return v&&v.fields?v.fields:{} }
function dec(f){ if(!f)return ''; if('stringValue' in f)return f.stringValue; if('integerValue' in f)return Number(f.integerValue); if('timestampValue' in f)return f.timestampValue; if('booleanValue' in f)return f.booleanValue; return ''; }
function field(f){ return fsFields(f) }

function gate(htmlMsg){ $('#test-header').innerHTML='<div class="glass rounded-lg p-5 text-center" style="border-left:3px solid #f87171">'+htmlMsg+'</div>'; $('#qmap').style.display='none'; }
function info(htmlMsg){ $('#test-header').innerHTML='<div class="glass rounded-lg p-5 text-center" style="border-left:3px solid #38bdf8">'+htmlMsg+'</div>'; }
function authed(){ return !!(token&&uid&&sname); }

// ── Header render (same look as the practice pages) ────────────────
function renderHeader(){
  var c=T.meta;
  $('#test-header').innerHTML=
    '<div class="inline-flex items-center gap-2 px-3 py-1.5 rounded-full glass text-xs font-semibold mb-4" style="color:'+c.color+'"><i class="fas '+c.icon+' text-xs"></i> '+c.kicker+'</div>'+
    '<h1 class="font-display text-3xl sm:text-4xl font-extrabold text-white mb-3">'+c.title+'</h1>'+
    '<div class="glass rounded-lg p-3 mb-4 text-xs font-semibold" style="border-left:3px solid #a78bfa;color:#c4b5fd"><i class="fas fa-lock text-xs"></i> Private test &mdash; your answers go straight to your teacher. No score or correct answers are shown here.</div>'+
    '<p class="text-sm text-slate-400 max-w-2xl leading-relaxed mb-4">'+c.instructions+'</p>'+
    (c.transcript?'<div class="glass rounded-lg p-4 mb-4 border-l-2" style="border-left-color:#5eead4"><h4 class="text-xs font-bold text-teal-300 mb-1">Transcript</h4><p class="text-xs text-slate-300 whitespace-pre-line leading-relaxed">'+c.transcript+'</p></div>':'');
}

// ── Questions ───────────────────────────────────────────────────────
var cards=[];
function renderQuestions(){
  var form=$('#test-form');
  var fieldsHtml='<div class="grid gap-2 rounded-lg glass p-3 sm:grid-cols-2">'+
    '<div><label class="text-xs text-slate-400 mb-1 block font-semibold">Student Name</label><input id="t-name" value="'+(sname||'')+'" readonly class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm opacity-80"></div>'+
    '<div><label class="text-xs text-slate-400 mb-1 block font-semibold">Class</label><input id="t-class" value="'+(assignment.className||assignment.classId)+'" readonly class="w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2 text-white text-sm opacity-80"></div>'+
    '</div>';
  var timerHtml='<div class="sticky-timer-bar"><span class="text-xs font-semibold" style="color:var(--muted)">Time:</span>'+
    '<span class="timer-face rounded-lg px-3 py-1.5 font-bold text-white text-sm" style="background:rgba(15,23,42,.85);border:1px solid rgba(56,189,248,.2)" role="timer">--:--</span>'+
    '<div class="min-w-[100px] flex-1 ml-3"><p class="progress-text font-bold text-xs text-slate-300" aria-live="polite">0 answered</p><div class="mt-1 h-1.5 overflow-hidden rounded-full bg-white/8"><div class="progress-bar h-full rounded-full transition-all" style="width:0%;background:linear-gradient(90deg,#38bdf8,#8b5cf6)"></div></div></div></div>';
  var groupsHtml=T.groups.map(function(g){
    return '<div class="mt-4"><h3 class="font-display text-sm font-bold text-white mb-1">'+g.title+'</h3>'+
      (g.focus?'<p class="text-xs text-slate-500 mb-2">'+g.focus+'</p>':'')+
      (g.dirs?'<p class="text-xs text-slate-500 mb-2">'+g.dirs+'</p>':'')+
      '<div id="'+g.id+'" class="grid gap-2 lg:grid-cols-2"></div></div>';
  }).join('');
  form.innerHTML=fieldsHtml+timerHtml+groupsHtml+
    '<div class="mt-4 flex flex-wrap items-center gap-2 border-t border-white/8 pt-3">'+
    '<button class="btn-primary btn" type="submit" id="submit-btn"><i class="fas fa-paper-plane text-xs"></i> Submit for grading</button>'+
    '<p id="t-result" class="hidden w-full rounded-lg p-3 text-sm" role="status" aria-live="polite"></p></div>';

  T.groups.forEach(function(g){
    var target=document.getElementById(g.id);
    T.questions.filter(function(q){return q.gid===g.id}).forEach(function(q){
      var card=document.createElement('div');
      card.className='question-card';
      card.dataset.qnum=String(q.qnum);
      var opts=q.choices.map(function(choice,i){
        return '<label class="option"><input type="radio" name="'+q.gid+'-q'+q.qnum+'" value="'+i+'"><span class="option-letter text-xs">'+String.fromCharCode(65+i)+'.</span><span class="text-xs text-slate-300">'+choice+'</span></label>';
      }).join('');
      card.innerHTML='<button class="flag-btn" type="button" title="Flag for review"><i class="far fa-flag"></i></button>'+
        '<p class="font-semibold text-sm text-slate-200 mb-2 pr-7">'+q.qnum+'. '+q.prompt+'</p><div class="grid gap-1.5">'+opts+'</div>';
      target.appendChild(card);
      cards.push(card);
      var fb=card.querySelector('.flag-btn');
      fb.addEventListener('click',function(e){e.preventDefault();e.stopPropagation();card.classList.toggle('flagged');fb.innerHTML=card.classList.contains('flagged')?'<i class="fas fa-flag" style="color:#fbbf24"></i>':'<i class="far fa-flag"></i>';updateQMap();});
    });
  });

  var qmap=$('#qmap');
  qmap.innerHTML='';
  cards.forEach(function(card,i){
    var item=document.createElement('button');
    item.type='button';item.className='qmap-item';item.textContent=String(i+1);
    item.title='Go to question '+(i+1);
    item.addEventListener('click',function(){card.scrollIntoView({behavior:'smooth',block:'center'})});
    qmap.appendChild(item);
  });
  function updateQMap(){
    var items=qmap.querySelectorAll('.qmap-item');
    cards.forEach(function(card,i){
      if(!items[i])return;
      items[i].className='qmap-item'+(card.querySelector('input:checked')?' answered':'')+(card.classList.contains('flagged')?' flagged':'');
    });
  }
  window.__updateQMap=updateQMap;

  var progressEl=document.querySelector('.progress-text'),bar=document.querySelector('.progress-bar');
  function updateProgress(){
    var ans=cards.filter(function(c){return c.querySelector('input:checked')}).length;
    progressEl.textContent=ans+' of '+cards.length+' answered';
    bar.style.width=Math.round(ans/cards.length*100)+'%';
    updateQMap();
  }
  $('#test-form').addEventListener('change',updateProgress);
  updateProgress();
}

// ── Timer (auto-start, locked to the assignment duration) ──────────
var remaining=0,timerInterval=null;
function startTimer(minutes){
  remaining=Math.max(1,minutes|0)*60;
  var face=document.querySelector('.timer-face');
  function render(){
    var m=Math.floor(remaining/60),s=remaining%60;
    face.textContent=(m<10?'0':'')+m+':'+(s<10?'0':'')+s;
    face.classList.remove('warning','danger');
    if(remaining>0&&remaining<=120)face.classList.add('warning');
    if(remaining>0&&remaining<=30)face.classList.add('danger');
    if(remaining===0){face.textContent='TIME UP';trySubmit(true);}
  }
  render();
  timerInterval=setInterval(function(){remaining=Math.max(0,remaining-1);render()},1000);
}

// ── Integrity counters ─────────────────────────────────────────────
document.addEventListener('fullscreenchange',function(){
  var now=!!document.fullscreenElement;
  if(fsActive&&!now)integrity.fsExits+=1;
  fsActive=now;
});
window.addEventListener('blur',function(){ if(startedAt&&!submitted)integrity.blurs+=1; });

// ── Submit ─────────────────────────────────────────────────────────
function collectAnswers(){
  var out={};
  T.questions.forEach(function(q){
    var checked=Array.prototype.slice.call(document.querySelectorAll('input[name="'+q.gid+'-q'+q.qnum+'"]:checked')).map(function(i){return i.value}).sort().join('|');
    if(checked)out['q'+q.qnum]=checked;
  });
  return out;
}
function lockForm(){
  cards.forEach(function(c){c.querySelectorAll('input').forEach(function(i){i.disabled=true})});
  var b=$('#submit-btn');if(b){b.disabled=true;b.innerHTML='<i class="fas fa-check text-xs"></i> Submitted';}
  if(timerInterval){clearInterval(timerInterval);timerInterval=null;}
}
function trySubmit(auto){
  if(submitted)return;
  var result=$('#t-result');
  var answered=Object.keys(collectAnswers()).length;
  if(!auto&&answered===0){result.textContent='Answer at least one question before submitting.';result.classList.remove('hidden');result.style.background='rgba(248,113,113,.1)';result.style.color='#f87171';return}
  if(!auto){
    var ok=window.confirm('Submit '+answered+' of '+cards.length+' answers?\\n\\nYou have ONE attempt. Your answers go to your teacher — no score or correct answers are shown back.');
    if(!ok)return;
  }
  submitted=true;
  var answers=collectAnswers();
  var payload={fields:{
    assignmentId:{stringValue:assignmentId},
    testId:{stringValue:T.testId},
    classId:{stringValue:assignment.classId},
    studentUid:{stringValue:uid},
    studentName:{stringValue:sname},
    status:{stringValue:'submitted'},
    answers:(function(){var f={};Object.keys(answers).forEach(function(k){f[k]={stringValue:answers[k]}});return {mapValue:{fields:f}}})(),
    integrity:(function(){var f={};Object.keys(integrity).forEach(function(k){f[k]={integerValue:String(integrity[k])}});return {mapValue:{fields:f}}})(),
    startedAt:{timestampValue:new Date(startedAt||Date.now()).toISOString()},
    submittedAt:{timestampValue:new Date().toISOString()}
  }};
  var docId=assignmentId+'__'+uid;
  rest('/test_submissions?documentId='+encodeURIComponent(docId),{method:'POST',body:JSON.stringify(payload)},function(res){
    var result=$('#t-result');
    if(res.status===200||res.status===201){
      lockForm();
      result.innerHTML='<i class="fas fa-check-circle"></i> Submitted &mdash; thank you, '+sname.replace(/</g,'&lt;')+'. Your teacher will review your results. You can close this page.';
      result.classList.remove('hidden');
      result.style.background='rgba(16,185,129,.12)';result.style.color='#6ee7b7';
      result.scrollIntoView({behavior:'smooth',block:'center'});
    } else if(res.status===409){
      submitted=true;lockForm();
      result.innerHTML='<i class="fas fa-info-circle"></i> This test was already submitted for your account. Nothing further to do.';
      result.classList.remove('hidden');result.style.background='rgba(56,189,248,.1)';result.style.color='#7dd3fc';
    } else {
      submitted=false;
      var msg=res.status===403?'The submission was rejected (permissions or the assignment window). Ask your teacher to check the assignment window.'
        :res.status===0?'Network unreachable — press Submit again once you are back online.'
        :'Submission failed (HTTP '+res.status+'). Try again, or ask your teacher for help.';
      result.textContent=msg;
      result.classList.remove('hidden');result.style.background='rgba(248,113,113,.1)';result.style.color='#f87171';
    }
  });
}

// ── Boot: gates in order, then render ──────────────────────────────
var assignment=null;
function boot(){
  if(!T){gate('Private test payload missing.');return}
  if(!authed()){
    gate('<h3 class="font-display text-lg font-bold text-white mb-2">Sign in first</h3><p class="text-sm text-slate-300 mb-3">This is a private class test. Sign in with your student account on the CMC homepage, then open the test link your teacher shared again.</p><a class="btn-primary btn" href="../../?auth=student"><i class="fas fa-sign-in-alt text-xs"></i> Sign in on the homepage</a>');
    return;
  }
  if(!assignmentId){
    gate('<h3 class="font-display text-lg font-bold text-white mb-2">Missing assignment code</h3><p class="text-sm text-slate-300">Open the exact link your teacher shared &mdash; it ends with <code>?assignment=...</code>.</p>');
    return;
  }
  info('<p class="text-sm text-slate-300"><i class="fas fa-spinner fa-spin"></i> Checking your assignment&hellip;</p>');
  rest('/test_assignments/'+encodeURIComponent(assignmentId),{method:'GET'},function(res){
    if(!res.ok||!res.body||!res.body.fields){
      gate('<h3 class="font-display text-lg font-bold text-white mb-2">Assignment not found</h3><p class="text-sm text-slate-300">Ask your teacher to confirm the link, and that you are enrolled in the right class.</p>');
      return;
    }
    var f=fsFields(res.body.fields);
    assignment={
      classId:dec(f.classId),testId:dec(f.testId),title:dec(f.title),
      className:dec(f.className)||dec(f.classId),
      opensAt:dec(f.opensAt),closesAt:dec(f.closesAt),
      durationMinutes:Number(dec(f.durationMinutes))||20
    };
    if(assignment.testId!==T.testId){
      gate('<h3 class="font-display text-lg font-bold text-white mb-2">Wrong test</h3><p class="text-sm text-slate-300">This link is for a different test than this page. Ask your teacher for the correct link.</p>');
      return;
    }
    if(assignment.classId!==classId){
      gate('<h3 class="font-display text-lg font-bold text-white mb-2">Not your class</h3><p class="text-sm text-slate-300 mb-3">This test was assigned to another class. Join the class with its code on the homepage first, then reopen this link.</p><a class="btn-primary btn" href="../../"><i class="fas fa-users text-xs"></i> Go to homepage</a>');
      return;
    }
    var now=Date.now();
    if(now<new Date(assignment.opensAt).getTime()){
      gate('<h3 class="font-display text-lg font-bold text-white mb-2">Not open yet</h3><p class="text-sm text-slate-300">This test opens at '+new Date(assignment.opensAt).toLocaleString()+'. Come back then.</p>');
      return;
    }
    if(now>new Date(assignment.closesAt).getTime()){
      gate('<h3 class="font-display text-lg font-bold text-white mb-2">Closed</h3><p class="text-sm text-slate-300">This test closed at '+new Date(assignment.closesAt).toLocaleString()+'. Ask your teacher if you think this is a mistake.</p>');
      return;
    }
    // Already submitted?
    rest('/test_submissions/'+encodeURIComponent(assignmentId+'__'+uid),{method:'GET'},function(sub){
      if(sub.ok){
        lockFormState('This test was already submitted for your account. Your teacher has your answers.');
        return;
      }
      renderHeader();
      renderQuestions();
      $('#review-modal').addEventListener('click',function(){},false);
      var reviewModal=document.getElementById('review-modal');
      var rvReview=document.getElementById('rv-review'),rvSubmit=document.getElementById('rv-submit');
      var rvAnswered=document.getElementById('rv-answered'),rvUnanswered=document.getElementById('rv-unanswered'),rvFlagged=document.getElementById('rv-flagged'),rvMsg=document.getElementById('rv-msg');
      $('#test-form').addEventListener('submit',function(e){
        e.preventDefault();
        var answered=cards.filter(function(c){return c.querySelector('input:checked')}).length;
        var unansweredCount=cards.length-answered;
        var flaggedCount=cards.filter(function(c){return c.classList.contains('flagged')}).length;
        rvAnswered.textContent=answered;rvUnanswered.textContent=unansweredCount;rvFlagged.textContent=flaggedCount;
        if(unansweredCount>0){rvMsg.textContent=unansweredCount+' unanswered question'+(unansweredCount===1?'':'s')+' will be marked incorrect. You have ONE attempt.';rvMsg.style.color='#f87171';}
        else{rvMsg.textContent='All answered. Submitting is final — no score is shown back.';rvMsg.style.color='#34d399';}
        reviewModal.classList.add('open');
      });
      rvReview.addEventListener('click',function(){reviewModal.classList.remove('open');var fu=cards.find(function(c){return !c.querySelector('input:checked')})||cards.find(function(c){return c.classList.contains('flagged')});if(fu)fu.scrollIntoView({behavior:'smooth',block:'center'});});
      rvSubmit.addEventListener('click',function(){reviewModal.classList.remove('open');trySubmit(false);});
      startedAt=Date.now();
      startTimer(assignment.durationMinutes);
      try{if(window.CMC&&CMC.fs&&CMC.fs.supported()&&!CMC.fs.isActive())CMC.fs.enter();}catch(e){}
    });
  });
}
function lockFormState(msg){
  renderHeader();
  gate('<h3 class="font-display text-lg font-bold text-white mb-2"><i class="fas fa-check-circle" style="color:#34d399"></i> Already submitted</h3><p class="text-sm text-slate-300">'+msg+'</p>');
}
boot();
})();
</script>`;

// ── 5. Compose the private page ─────────────────────────────────────
let out = html;
// Teacher gate OFF for the student-facing variant.
out = out.replace(/^\s*<script src="\.\.\/teacher-gate\.js"><\/script>\s*\n?/m, '');
// Swap the data block for the answer-free payload.
out = out.replace(dataBlock[0], () => '<script>\nwindow.CMC_PRIVATE_TEST=' + JSON.stringify(payload) + ';\n</script>');
// Swap the practice engine for the private engine (function replacer keeps
// $ sequences in the engine code literal).
out = out.replace(engineBlock[0], () => ENGINE);
// Drop the auto-fullscreen snippet (the private engine enters fs on start).
out = out.replace(/<script>\(function\(\)\{var sb=document\.querySelector\('\.timer-start'\)[\s\S]*?<\/script>/, '');
// Retitle + noindex.
out = out.replace(/<title>([^<]*)<\/title>/, '<title>$1 — Private (teacher-scored)</title>');
out = out.replace(/<\/head>/, '<meta name="robots" content="noindex,nofollow">\n</head>');
// Strip dead reveal-styling rules (the private engine never marks answers),
// including their html[data-theme="light"] variants.
out = out.replace(/^\s*(html\[data-theme="light"\]\s*)?\..*(correct-answer|wrong-answer|correct-opt|wrong-opt|q-explanation)[^{]*\{[^}]*\}\n/gm, '');
// Re-depth relative links: private pages live one level deeper
// (tests/private/ vs tests/). Also send students to the CMC homepage instead
// of the teacher-gated planner hub.
out = out.replaceAll('href="../../assets/', 'href="../../../assets/');
out = out.replaceAll('src="../../assets/', 'src="../../../assets/');
out = out.replaceAll('href="../../?auth=student"', 'href="../../../?auth=student"');
out = out.replaceAll('href="../../"', 'href="../../../"');
out = out.replaceAll('../img/', '../../img/');
out = out.replace(/<a href="\.\.\/index\.html"([^>]*)>([\s\S]*?)<\/a>/, (_m, attrs, inner) => `<a href="../../../"${attrs}>${String(inner).replace('Back to Planner', 'Back to CMC')}</a>`);
if (!out.includes('CMC-PRIVATE-TEST-V1')) {
  console.error(`${slug}: engine swap failed — output would leak the practice engine; aborting`);
  process.exit(1);
}
if (/(TEST_BANKS|dataset\.answer|data-answer)/.test(out)) {
  console.error(`${slug}: answer traces still present in output — aborting`);
  process.exit(1);
}

fs.mkdirSync(PRIVATE_DIR, { recursive: true });
fs.writeFileSync(path.join(PRIVATE_DIR, slug + '.html'), out);

fs.mkdirSync(KEYS_DIR, { recursive: true });
fs.writeFileSync(path.join(KEYS_DIR, testId + '.key.json'), JSON.stringify(key, null, 2));

console.log(`OK ${slug}:`);
console.log(`  page -> public/biweek-planner/tests/private/${slug}.html (${out.length} bytes, ${questions.length} questions, no answers)`);
console.log(`  key  -> ${path.join(KEYS_DIR, testId + '.key.json')} (install via dashboard; NOT committed)`);
