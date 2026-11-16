/* Progressive enhancement layer for the bundled Talk to me game.
 * It leaves the original level engine, saved progress and CMC score pipeline intact. */
(() => {
  const root = document.getElementById('root');
  if (!root) return;

  const scenes = new WeakSet();
  const voiceControls = new WeakSet();
  let sceneIndex = 0;

  function makeFace(className) {
    const face = document.createElement('span');
    face.className = `cmc-tower-face ${className}`;
    return face;
  }

  function addTower(scene, spec, index) {
    const tower = document.createElement('div');
    tower.className = 'cmc-tower';
    tower.setAttribute('aria-hidden', 'true');
    tower.style.setProperty('--tower-x', spec.x);
    tower.style.setProperty('--tower-w', spec.w);
    tower.style.setProperty('--tower-h', spec.h);
    tower.style.setProperty('--tower-z', spec.z);
    tower.style.setProperty('--tower-opacity', String(spec.opacity));
    tower.append(makeFace('cmc-tower-front'), makeFace('cmc-tower-side'), makeFace('cmc-tower-roof'));
    scene.append(tower);
  }

  function addCity(stage) {
    if (scenes.has(stage)) return;
    scenes.add(stage);
    stage.classList.add('cmc-3d-world');
    stage.parentElement?.classList.add('cmc-platform-frame');

    const scene = document.createElement('div');
    scene.className = 'cmc-voice-city';
    scene.setAttribute('aria-hidden', 'true');
    const horizon = document.createElement('div');
    horizon.className = 'cmc-city-horizon';
    const floor = document.createElement('div');
    floor.className = 'cmc-city-grid';
    const plinth = document.createElement('div');
    plinth.className = 'cmc-platform-plinth';
    scene.append(horizon, floor, plinth);

    const variants = [
      { x: '3%', w: '10%', h: '29%', z: '-35px', opacity: .66 },
      { x: '16%', w: '8%', h: '44%', z: '-66px', opacity: .54 },
      { x: '73%', w: '9%', h: '36%', z: '-52px', opacity: .6 },
      { x: '87%', w: '8%', h: '25%', z: '-30px', opacity: .68 },
    ];
    variants.forEach((spec, i) => addTower(scene, spec, i));

    const orbPositions = [
      ['27%', '18%'], ['63%', '13%'], ['53%', '31%'], ['91%', '22%'],
    ];
    orbPositions.forEach(([left, top], i) => {
      const orb = document.createElement('span');
      orb.className = 'cmc-city-orb';
      orb.style.left = left;
      orb.style.top = top;
      orb.style.transform = `translateZ(${20 + i * 9}px) scale(${i % 2 ? .72 : 1})`;
      scene.append(orb);
    });

    stage.insertBefore(scene, stage.firstChild);
    stage.dataset.cmc3dScene = String(++sceneIndex);
  }

  function textOf(el) {
    return (el?.textContent || '').replace(/\s+/g, ' ').trim();
  }

  function improveVoiceControl(level) {
    const control = level.querySelector('[aria-label="Voice control"]');
    if (!control || voiceControls.has(control)) return;
    voiceControls.add(control);
    control.classList.add('cmc-voice-console');

    const form = control.querySelector('#typed-command')?.closest('form');
    if (!form) return;

    const coach = document.createElement('div');
    coach.className = 'cmc-voice-status';
    coach.setAttribute('role', 'status');
    coach.setAttribute('aria-live', 'polite');
    coach.innerHTML = '<span><strong>Voice coach</strong> · Speak a short instruction. The recognition panel will show what was heard and how the game interpreted it.</span>';
    form.insertAdjacentElement('afterend', coach);

    const decorateHeardPanel = () => {
      const heardPanel = [...control.querySelectorAll('div')].find((el) => {
        const first = el.firstElementChild;
        return first && textOf(first) === 'I heard';
      });
      if (!heardPanel) return;
      heardPanel.classList.add('cmc-heard-response');
      heardPanel.setAttribute('role', 'status');
      heardPanel.setAttribute('aria-live', 'polite');
      heardPanel.setAttribute('aria-atomic', 'false');
    };
    decorateHeardPanel();

    const setCoach = (state, html) => {
      if (coach.dataset.state === state) return;
      coach.dataset.state = state;
      coach.innerHTML = html;
    };
    const statusObserver = new MutationObserver(() => {
      decorateHeardPanel();
      const listening = /listening|speak your command/i.test(textOf(control));
      coach.dataset.listening = String(listening);
      const understood = control.querySelector('.cmc-heard-response [class*="text-success"]');
      const failure = control.querySelector('.cmc-heard-response [class*="text-danger"]');
      if (listening) {
        setCoach('listening', '<span><strong>Listening</strong> · Say one phrase, then pause. You can also type below or use the directional controls.</span>');
      } else if (understood) {
        setCoach('understood', '<span><strong>Command understood</strong> · Your character is carrying it out. Try another short phrase when the movement finishes.</span>');
      } else if (failure) {
        setCoach('retry', '<span><strong>Try a simpler phrase</strong> · Check the words in “I heard”, then try one action at a time or ask for a hint.</span>');
      } else {
        setCoach('ready', '<span><strong>Voice coach</strong> · Speak a short instruction. The recognition panel will show what was heard and how the game interpreted it.</span>');
      }
    });
    statusObserver.observe(control, { childList: true, characterData: true, subtree: true });
  }

  function addLevelContext(level) {
    if (level.dataset.cmcLevelContext) return;
    const header = level.querySelector(':scope > header');
    if (!header) return;
    level.dataset.cmcLevelContext = 'true';
    const context = document.createElement('div');
    context.className = 'cmc-level-context';
    context.innerHTML = `<span class="cmc-level-indicator" aria-hidden="true"></span><span><strong>CMC LANGUAGE LAB</strong><span class="cmc-context-separator">/</span>MISSION ${String(level.dataset.level || '').padStart(2, '0')}</span><span class="cmc-context-mode">VOICE · KEYBOARD · TOUCH</span>`;
    header.insertAdjacentElement('afterend', context);
    improveVoiceControl(level);
  }

  function refresh() {
    root.querySelectorAll('.relative.overflow-hidden[style*="aspect-ratio"]').forEach(addCity);
    root.querySelectorAll('[data-level]').forEach(addLevelContext);

    const hero = root.querySelector('main > div > section:first-child');
    if (hero && !hero.dataset.cmcCopyRefined) {
      hero.dataset.cmcCopyRefined = 'true';
      const title = hero.querySelector('h1');
      const description = title?.parentElement?.querySelector('p');
      const span = title?.querySelector('span');
      if (title && span) {
        title.firstChild && (title.firstChild.textContent = 'Speak with intent.');
        span.textContent = 'Build in 3D.';
      }
      if (description) {
        description.textContent = 'Guide a character through a spatial English simulation. Give spoken instructions, see the action unfold across a 3D mission platform, and build fluency through increasingly complex objectives.';
      }
      hero.querySelectorAll('.chip').forEach((chip) => {
        if (/ages 7 to 107/i.test(textOf(chip))) chip.textContent = 'All experience levels';
      });
      const demo = [...hero.querySelectorAll('div')].find((el) => textOf(el) === 'Live demo');
      if (demo) demo.textContent = '3D MISSION PREVIEW';
    }
  }

  refresh();
  const observer = new MutationObserver(refresh);
  observer.observe(root, { childList: true, subtree: true });

  // Speech synthesis remains browser-native and uses the player's selected language/rate.
})();
