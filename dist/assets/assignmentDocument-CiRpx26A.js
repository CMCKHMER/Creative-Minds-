function u(e,t){const i=t.audioScript?.map(r=>r.trim()).filter(Boolean)??[];if(/listening/i.test(e.subject)&&i.length>0)return{kind:"listening",text:i.join(" ")};if(!/speaking/i.test(e.subject))return null;const a=[t.title,t.directions,...t.audioScript??[],...t.passage??[],...t.questions.map(r=>r.prompt)].map(r=>r.trim()).filter(Boolean);return a.length>0?{kind:"speaking",text:a.join(". ")}:null}function n(e){return e.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}function g(e){return e.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")}function b(e){return e?.length?`<div class="passage">${e.map(t=>`<p>${n(t)}</p>`).join("")}</div>`:""}function x(e){return e<1?"":`<div class="writing-lines" aria-hidden="true">${Array.from({length:e},()=>"<span></span>").join("")}</div>`}function f(e,t){const i=e.responseLines??(e.choices?.length?0:1);return`
    <article class="question">
      <div class="question-prompt"><span class="number">${t}.</span><span>${n(e.prompt)}</span></div>
      ${e.choices?.length?`<div class="choices">${e.choices.map(a=>`<p>${n(a)}</p>`).join("")}</div>`:""}
      ${x(i)}
    </article>`}function m(e){const t=new TextEncoder().encode(e),i=Array.from(t,a=>String.fromCharCode(a)).join("");return btoa(i)}function h(e,t){const i=t==="listening"?"Play listening passage":"Hear spoken task prompt";return`<div class="audio-control no-print"><div class="audio-control-row"><button class="audio-play" type="button" data-audio-prompt="${m(e)}" data-label="${i}" aria-pressed="false">▶ ${i}</button><span class="audio-caption">Synthesized with the device voice · not a recorded speaker</span></div><p class="audio-status" role="status" aria-live="polite"></p></div>`}function y(e,t,i,a){const r=u(e,t);return`
    <section class="assignment-section">
      <div class="section-heading"><span class="section-index">${String(i+1).padStart(2,"0")}</span><h2>${n(t.title)}</h2></div>
      <p class="directions"><strong>Directions</strong> ${n(t.directions)}</p>
      ${r?h(r.text,r.kind):""}
      ${t.wordBank?`<p class="word-bank"><strong>Word bank</strong> ${n(t.wordBank)}</p>`:""}
      ${b(t.passage)}
      <div class="questions">${t.questions.map((p,o)=>f(p,a+o)).join("")}</div>
    </section>`}function w(e,t,i){return`
    <section class="key-section">
      <h2><span class="section-index">${String(t+1).padStart(2,"0")}</span>${n(e.title)}</h2>
      ${e.audioScript?.length?`<div class="teacher-notes"><strong>Teacher read-aloud script</strong>${e.audioScript.map(a=>`<p>${n(a)}</p>`).join("")}</div>`:""}
      ${e.questions.map((a,r)=>`
        <article class="key-answer">
          <p class="key-prompt"><strong>${i+r}.</strong> ${n(a.prompt)}</p>
          <p><strong>Suggested answer</strong> ${n(a.answer)}</p>
          ${a.rationale?`<p class="rationale"><strong>Look for</strong> ${n(a.rationale)}</p>`:""}
        </article>`).join("")}
    </section>`}function d(e,t){const i=t==="teacher",a=i?`${e.title} - Teacher Key`:e.title,r=e.sections.map((o,s)=>e.sections.slice(0,s).reduce((l,c)=>l+c.questions.length,0)+1),p=i?`
      <div class="teacher-banner">TEACHER EDITION <span>Answer key and scoring guide</span></div>
      <section class="teacher-notes">
        <h2>Before the lesson</h2>
        <ul>${e.teacherNotes.map(o=>`<li>${n(o)}</li>`).join("")}</ul>
      </section>
      ${e.sections.map((o,s)=>w(o,s,r[s])).join("")}
      ${e.rubric?.length?`
        <section class="key-section rubric">
          <h2>Scoring guide <span class="total-points">${e.rubric.reduce((o,s)=>o+s.points,0)} points</span></h2>
          ${e.rubric.map(o=>`<article class="key-answer"><p><strong>${n(o.criterion)} · ${o.points} pts</strong></p><p>${n(o.description)}</p></article>`).join("")}
        </section>`:""}`:`
      <section class="student-setup">
        <p><strong>Name</strong><span></span></p>
        <p><strong>Date</strong><span></span></p>
      </section>
      <section class="learning-targets">
        <h2>Today, I will</h2>
        <ul>${e.objectives.map(o=>`<li>${n(o)}</li>`).join("")}</ul>
        <p class="materials"><strong>Materials</strong> ${e.materials.map(n).join(" · ")}</p>
      </section>
      ${e.sections.map((o,s)=>y(e,o,s,r[s])).join("")}
      ${e.rubric?.length?`
        <section class="student-rubric">
          <h2>How this work is assessed</h2>
          <p>${e.rubric.reduce((o,s)=>o+s.points,0)} points total · Use the teacher's scoring guide to review your work.</p>
          ${e.rubric.map(o=>`<p><strong>${n(o.criterion)} · ${o.points} pts</strong> ${n(o.description)}</p>`).join("")}
        </section>`:""}`;return`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="description" content="Classroom-ready assignment from Creative Minds Network.">
  <title>${n(a)}</title>
  <style>
    :root { color-scheme: light; font-family: Arial, Helvetica, sans-serif; color: #15283a; background: #e9eef2; font-synthesis: none; }
    * { box-sizing: border-box; }
    body { margin: 0; padding: 32px 18px 64px; }
    .toolbar { width: min(100%, 800px); margin: 0 auto 14px; display: flex; align-items: center; justify-content: space-between; gap: 12px; color: #4b6070; font-size: 12px; }
    .toolbar-actions { display: flex; gap: 8px; }
    .toolbar button { border: 0; border-radius: 8px; background: #102a3d; color: #fff; padding: 10px 14px; font-weight: 700; cursor: pointer; }
    .toolbar button:focus-visible { outline: 3px solid #15aab4; outline-offset: 3px; }
    .sheet { width: min(100%, 800px); margin: 0 auto; padding: 50px 56px; background: #fff; box-shadow: 0 15px 55px rgba(20, 41, 57, .12); }
    .masthead { display: flex; justify-content: space-between; align-items: center; padding-bottom: 12px; border-bottom: 2px solid #127e89; color: #127e89; font-size: 10px; font-weight: 800; letter-spacing: .18em; text-transform: uppercase; }
    .edition { border: 1px solid #d8e7eb; border-radius: 999px; padding: 5px 9px; color: #476576; font-size: 9px; letter-spacing: .08em; }
    .kicker { margin: 26px 0 8px; color: #127e89; font-size: 10px; font-weight: 800; letter-spacing: .16em; text-transform: uppercase; }
    h1 { max-width: 660px; margin: 0; font-family: Georgia, 'Times New Roman', serif; font-size: 34px; line-height: 1.12; letter-spacing: -.035em; }
    .subtitle { margin: 10px 0 20px; color: #5b7080; font-family: Georgia, 'Times New Roman', serif; font-size: 16px; line-height: 1.5; }
    .meta { display: grid; grid-template-columns: repeat(3, 1fr); border: 1px solid #dbe5e9; border-radius: 10px; overflow: hidden; }
    .meta p { margin: 0; padding: 10px 12px; border-right: 1px solid #dbe5e9; font-size: 10px; line-height: 1.4; }
    .meta p:last-child { border-right: 0; }
    .meta strong { display: block; margin-bottom: 3px; color: #607583; font-size: 8px; letter-spacing: .1em; text-transform: uppercase; }
    .student-setup { display: grid; grid-template-columns: 1.5fr 1fr; gap: 26px; margin: 18px 0; }
    .student-setup p { display: flex; align-items: baseline; gap: 7px; margin: 0; font-size: 10px; }
    .student-setup span { flex: 1; height: 15px; border-bottom: 1px solid #acb8be; }
    .learning-targets { margin: 18px 0 22px; padding: 15px 18px; border-left: 3px solid #56bfc0; background: #f0f8f8; }
    h2 { margin: 0 0 10px; font-family: Georgia, 'Times New Roman', serif; font-size: 18px; line-height: 1.25; }
    .learning-targets h2, .student-rubric h2, .teacher-notes h2 { font-family: Arial, Helvetica, sans-serif; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; }
    ul { margin: 0; padding-left: 18px; }
    li { margin: 5px 0; font-size: 10px; line-height: 1.5; }
    .materials { margin: 12px 0 0; color: #49616e; font-size: 9px; line-height: 1.5; }
    .assignment-section { margin-top: 24px; }
    .section-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 1px solid #dbe4e8; }
    .section-heading h2 { margin: 0; }
    .section-index { display: inline-grid; width: 26px; height: 26px; flex: 0 0 26px; place-items: center; border-radius: 50%; background: #e2f5f3; color: #087d83; font-family: Arial, Helvetica, sans-serif; font-size: 9px; font-weight: 800; }
    .directions { margin: 0 0 12px; color: #405768; font-size: 10px; line-height: 1.6; }
    .directions strong { margin-right: 4px; color: #1a384a; }
    .word-bank { margin: 12px 0; padding: 9px 11px; border: 1px solid #d8e7eb; border-radius: 7px; background: #f7fafb; font-size: 10px; line-height: 1.6; }
    .word-bank strong { display: block; margin-bottom: 3px; color: #127e89; font-size: 8px; letter-spacing: .1em; text-transform: uppercase; }
    .passage { margin: 14px 0; padding: 14px 16px; border-left: 2px solid #9adbd7; background: #f5f8f9; }
    .passage p { margin: 0 0 9px; font-family: Georgia, 'Times New Roman', serif; font-size: 10.5px; line-height: 1.7; white-space: pre-line; }
    .passage p:last-child { margin-bottom: 0; }
    .questions { display: grid; gap: 12px; }
    .audio-control { margin: 12px 0; padding: 10px 12px; border: 1px solid #d5e5ec; border-radius: 8px; background: #f3f8fa; }
    .audio-control-row { display: flex; align-items: center; flex-wrap: wrap; gap: 10px; }
    .audio-play { border: 1px solid #b7d6de; border-radius: 7px; padding: 8px 11px; background: #fff; color: #15576a; font-size: 10px; font-weight: 700; cursor: pointer; }
    .audio-play:focus-visible { outline: 3px solid #12a6b8; outline-offset: 2px; }
    .audio-caption, .audio-status { color: #607782; font-size: 9px; }
    .audio-status { min-height: 12px; margin: 6px 0 0; }
    .question { break-inside: avoid; page-break-inside: avoid; }
    .question-prompt { display: grid; grid-template-columns: 22px 1fr; gap: 4px; font-size: 10px; line-height: 1.55; }
    .number { color: #117e89; font-weight: 800; }
    .choices { display: grid; gap: 5px; margin: 7px 0 0 26px; }
    .choices p { margin: 0; color: #344b5b; font-size: 9.5px; line-height: 1.45; }
    .writing-lines { display: grid; gap: 16px; margin: 9px 0 4px 26px; }
    .writing-lines span { height: 8px; border-bottom: 1px solid #cbd5da; }
    .student-rubric { margin-top: 24px; padding: 15px 17px; border: 1px solid #dbe5e9; border-radius: 9px; }
    .student-rubric > p { margin: 6px 0; color: #4b6170; font-size: 9px; line-height: 1.5; }
    .student-rubric > p:first-of-type { color: #117e89; font-weight: 700; }
    .teacher-banner { display: flex; justify-content: space-between; gap: 12px; margin: 22px 0 16px; padding: 10px 12px; background: #edf6f7; color: #127e89; font-size: 9px; font-weight: 800; letter-spacing: .12em; }
    .teacher-banner span { color: #526d7a; font-weight: 500; letter-spacing: 0; }
    .teacher-notes { margin: 0 0 22px; padding: 15px 17px; border: 1px solid #dbe5e9; border-radius: 9px; }
    .teacher-notes li { color: #405768; }
    .key-section { margin-top: 24px; }
    .key-section > h2 { display: flex; align-items: center; gap: 10px; padding-bottom: 8px; border-bottom: 1px solid #dbe4e8; }
    .key-answer { break-inside: avoid; page-break-inside: avoid; margin: 0 0 10px; padding: 11px 13px; border: 1px solid #e1e9ec; border-radius: 8px; }
    .key-answer p { margin: 5px 0 0; color: #314c5d; font-size: 9.5px; line-height: 1.55; }
    .key-answer .key-prompt { margin: 0 0 6px; color: #162f40; }
    .key-answer p strong { color: #117e89; }
    .key-answer .rationale { padding-top: 6px; border-top: 1px solid #e9eef0; color: #5a6f7a; }
    .total-points { margin-left: auto; color: #117e89; font: 700 9px Arial, sans-serif; letter-spacing: .06em; text-transform: uppercase; }
    .rubric { margin-top: 28px; }
    .footer { display: flex; justify-content: space-between; gap: 12px; margin-top: 28px; padding-top: 10px; border-top: 1px solid #dbe5e9; color: #82919a; font-size: 8px; }
    @media (max-width: 600px) {
      body { padding: 14px 8px 30px; }
      .sheet { padding: 28px 22px; }
      h1 { font-size: 28px; }
      .meta { grid-template-columns: 1fr; }
      .meta p { border-right: 0; border-bottom: 1px solid #dbe5e9; }
      .meta p:last-child { border-bottom: 0; }
    }
    @page { size: letter; margin: 0.55in; }
    @media print {
      :root, body { background: #fff; }
      body { padding: 0; color: #15283a; }
      .toolbar { display: none; }
      .no-print { display: none !important; }
      .sheet { width: 100%; max-width: none; margin: 0; padding: 0; box-shadow: none; }
      .assignment-section + .assignment-section, .key-section, .student-rubric { break-before: page; page-break-before: always; }
      .teacher-notes { break-inside: avoid; page-break-inside: avoid; }
      .question, .key-answer { break-inside: avoid; page-break-inside: avoid; }
      .passage, .learning-targets, .word-bank { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <nav class="toolbar" aria-label="Document actions">
    <span>Creative Minds Network · ${i?"Teacher key":"Student assignment"}</span>
    <span class="toolbar-actions"><button type="button" onclick="window.print()">Print / Save as PDF</button></span>
  </nav>
  <main class="sheet">
    <header class="masthead"><span>Creative Minds Network</span><span class="edition">${i?"TEACHER KEY":"CLASSROOM ASSIGNMENT"}</span></header>
    <p class="kicker">${n(e.subject)}</p>
    <h1>${n(a)}</h1>
    <p class="subtitle">${n(e.subtitle)}</p>
    <div class="meta">
      <p><strong>Grade / level</strong>${n(e.gradeBand)}</p>
      <p><strong>Suggested time</strong>${n(e.duration)}</p>
      <p><strong>Skill focus</strong>${e.skillFocus.slice(0,2).map(n).join(" · ")}</p>
    </div>
    ${p}
    <footer class="footer"><span>Original classroom practice material</span><span>Creative Minds Network</span></footer>
  </main>
  ${i?"":`<script>
    (function () {
      var activeButton = null;
      var supported = 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
      function setStatus(button, message) {
        var status = button.parentElement && button.parentElement.parentElement.querySelector('.audio-status');
        if (status) status.textContent = message || '';
      }
      function stopActive(message) {
        if (!activeButton) return;
        var button = activeButton;
        window.speechSynthesis.cancel();
        button.setAttribute('aria-pressed', 'false');
        button.textContent = '▶ ' + button.getAttribute('data-label');
        setStatus(button, message || 'Playback stopped.');
        activeButton = null;
      }
      document.addEventListener('click', function (event) {
        var target = event.target;
        var button = target && target.closest ? target.closest('.audio-play') : null;
        if (!button) return;
        if (!supported) { setStatus(button, 'Audio is unavailable in this browser. Use the visible student prompt.'); return; }
        if (activeButton === button && window.speechSynthesis.speaking) { stopActive('Playback stopped.'); return; }
        if (activeButton) stopActive('');
        var prompt = '';
        try {
          var binary = atob(button.getAttribute('data-audio-prompt') || '');
          var bytes = Uint8Array.from(binary, function (character) { return character.charCodeAt(0); });
          prompt = new TextDecoder().decode(bytes);
        } catch (_) { setStatus(button, 'Audio prompt could not be loaded.'); return; }
        if (!prompt) { setStatus(button, 'No spoken prompt is available.'); return; }
        var utterance = new SpeechSynthesisUtterance(prompt);
        utterance.lang = 'en-US';
        utterance.rate = 0.9;
        activeButton = button;
        button.setAttribute('aria-pressed', 'true');
        button.textContent = '■ Stop audio';
        setStatus(button, 'Playing with your device voice; this is synthesized speech.');
        utterance.onend = function () {
          if (activeButton === button) {
            button.setAttribute('aria-pressed', 'false');
            button.textContent = '▶ ' + button.getAttribute('data-label');
            setStatus(button, 'Prompt finished. Replay if needed.');
            activeButton = null;
          }
        };
        utterance.onerror = function () {
          if (activeButton === button) {
            button.setAttribute('aria-pressed', 'false');
            button.textContent = '▶ ' + button.getAttribute('data-label');
            setStatus(button, 'Audio did not play. Use the visible student prompt.');
            activeButton = null;
          }
        };
        window.speechSynthesis.speak(utterance);
      });
      window.addEventListener('beforeprint', function () {
        if (supported) stopActive('');
      });
    })();
  <\/script>`}
</body>
</html>`}function v(e,t){const i=t==="teacher"?"teacher-key":"student-copy",a=new Blob([d(e,t)],{type:"text/html;charset=utf-8"}),r=URL.createObjectURL(a),p=document.createElement("a");p.href=r,p.download=`cmn-${g(e.title)}-${i}.html`,document.body.appendChild(p),p.click(),p.remove(),window.setTimeout(()=>URL.revokeObjectURL(r),6e4)}function k(e,t){const i=window.open("","_blank");return i?(i.document.open(),i.document.write(d(e,t)),i.document.close(),i.focus(),!0):!1}export{u as a,v as d,k as o};
