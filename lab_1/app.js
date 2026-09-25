let GROUP = params.get('g') === 'control' ? 'control' : 'test';
const FIXATION_MS = 800;
const NEXT_MS = 4000;

const $ = id => document.getElementById(id);

let state = null;
let timerRaf = 0;

function setTimer(id, label, left, total) {
  const el = $(id);
  el.classList.toggle('low', state.phase === 'answer' && left != null && left < 5000);
  el.classList.toggle('after', state.phase !== 'answer');
  el.querySelector('.timer-label').textContent = label;
  el.querySelector('.timer-val').textContent = left == null ? '' : (left / 1000).toFixed(1).replace('.', ',') + ' с';
  el.querySelector('.timer-bar i').style.width = (left == null ? 100 : left / total * 100) + '%';
}

function startTimer(id, label, ms, onEnd) {
  stopTimer();
  const end = performance.now() + ms;
  const tick = now => {
    const left = Math.max(0, end - now);
    setTimer(id, label, left, ms);
    if (left > 0) timerRaf = requestAnimationFrame(tick);
    else { timerRaf = 0; onEnd(); }
  };
  timerRaf = requestAnimationFrame(tick);
}

function stopTimer() {
  cancelAnimationFrame(timerRaf);
  timerRaf = 0;
}

function show(id) {
  document.querySelectorAll('.screen').forEach(s => (s.hidden = s.id !== id));
}

const blockKey = pl => `${pl.test}-${pl.q}`;

function buildTrack() {
  const blocks = [];
  state.plan.forEach(pl => {
    const last = blocks[blocks.length - 1];
    if (last && last.key === blockKey(pl)) last.n++;
    else blocks.push({ key: blockKey(pl), test: pl.test, n: 1 });
  });
  state.blocks = blocks;
  $('track').innerHTML = blocks.map((b, i) =>
    `<span class="seg${i && b.test !== blocks[i - 1].test ? ' gap' : ''}" title="Тест ${b.test}"><i></i></span>`).join('');
  $('track').hidden = false;
}

function setProgress(done = state.trials.filter(t => t.rt != null).length) {
  const pl = state.plan[Math.min(state.idx, state.plan.length - 1)];
  $('progress').textContent = `Тест ${pl.test} · вопрос ${pl.q} из ${TESTS[pl.test].length}`;
  let seen = 0;
  const segs = $('track').querySelectorAll('.seg i');
  state.blocks.forEach((b, i) => {
    segs[i].style.width = Math.max(0, Math.min(b.n, done - seen)) / b.n * 100 + '%';
    seen += b.n;
  });
}

function stageEstimate() {
  const w = Math.min(innerWidth, 980) - (innerWidth <= 760 ? 32 : 40);
  const h = Math.max(320, innerHeight - 56 - 40);
  return stageSizes(w, h);
}

function blockIntro() {
  const pl = state.plan[state.idx];
  const c = CONDS[pl.cond];
  state.phase = 'block';
  setProgress();
  const sz = stageEstimate();
  const px = Math.round(c.size === 'large' ? sz.large : sz.small);
  $('block-kicker').textContent = `Тест ${pl.test} · вопрос ${pl.q} из ${TESTS[pl.test].length}`;
  $('block-title').textContent = c.title;
  $('block-preview').innerHTML = shuffle(DIGITS).slice(0, 3)
    .map(d => `<span style="width:${px}px;height:${px}px">${renderDigit(d, c.notation)}</span>`).join('');
  $('block-preview').querySelectorAll('svg').forEach(svg => { svg.style.width = svg.style.height = px + 'px'; });
  $('block-cap').textContent = `Примерно такого размера объекты будут на экране (${px} px)`;
  $('block-text').textContent = `${SETS} ${word(SETS, 'набор', 'набора', 'наборов')} по ${MIN_N}–${MAX_N} ${word(MAX_N, 'объекту', 'объекта', 'объектов')}, каждый виден ${fmtSec(SHOW_MS)} с.`;
  show('screen-block');
  $('btn-block').focus();
}

function runTrial() {
  const pl = state.plan[state.idx];
  const trial = makeTrial(pl);
  const c = CONDS[trial.cond];
  state.trials.push(trial);
  state.phase = 'show';
  setProgress();
  show('screen-show');
  document.body.classList.add('showing');
  const stage = $('stage');
  stage.innerHTML = '<div class="fixation">+</div>';

  setTimeout(() => {
    const { width, height } = stage.getBoundingClientRect();
    const lay = layoutPositions(trial.items.length, width, height);
    const size = c.size === 'large' ? lay.large : lay.small;
    trial.px = Math.round(size);
    stage.innerHTML = trial.items.map((d, i) =>
      `<div class="obj" style="width:${size}px;height:${size}px;left:${lay.points[i].x - size / 2}px;top:${lay.points[i].y - size / 2}px">${renderDigit(d, c.notation)}</div>`
    ).join('');
    setTimeout(() => {
      stage.innerHTML = '';
      document.body.classList.remove('showing');
      askAnswer(trial);
    }, SHOW_MS);
  }, FIXATION_MS);
}

function askAnswer(trial) {
  state.phase = 'answer';
  const notation = CONDS[trial.cond].notation;
  const box = $('options');
  box.innerHTML = '';
  for (const d of DIGITS) {
    const b = document.createElement('button');
    b.className = 'opt';
    b.dataset.d = d;
    b.innerHTML = renderDigit(d, notation);
    b.addEventListener('click', () => toggle(d));
    box.appendChild(b);
  }
  const pl = state.plan[state.idx];
  $('answer-chip').textContent = `${CONDS[trial.cond].short} · ${pl.set} / ${SETS}`;
  $('answer-title').textContent = notation === 'arabic' ? 'Какие цифры были?' : 'Какие пиктограммы были?';
  updatePicked();
  $('answer-hint').hidden = false;
  $('feedback').hidden = true;
  $('btn-submit').hidden = false;
  $('btn-next').hidden = true;
  show('screen-answer');
  state.order = [];
  state.answerStart = performance.now();
  startTimer('answer-timer', '⏱ На ответ осталось', ANSWER_MS, () => submit(true));
}

function toggle(d) {
  if (state.phase !== 'answer') return;
  const b = document.querySelector(`.opt[data-d="${d}"]`);
  if (b.classList.toggle('selected')) state.order.push(d);
  else state.order = state.order.filter(x => x !== d);
  updatePicked();
}

function updatePicked() {
  const k = state.order ? state.order.length : 0;
  $('picked').textContent = k ? `Отмечено: ${k}` : 'Ничего не отмечено';
}

function submit(timedOut = false) {
  if (state.phase !== 'answer') return;
  state.phase = 'feedback';
  stopTimer();
  const trial = state.trials[state.idx];
  trial.sel = state.order.slice();
  trial.rt = timedOut ? ANSWER_MS : performance.now() - state.answerStart;
  trial.to = timedOut;
  const { hit, miss, fa } = scoreTrial(trial);
  const shown = new Set(trial.items);
  const sel = new Set(trial.sel);

  document.querySelectorAll('.opt').forEach(b => {
    const d = Number(b.dataset.d);
    b.disabled = true;
    if (shown.has(d) && sel.has(d)) b.classList.add('hit');
    else if (shown.has(d)) b.classList.add('miss');
    else if (sel.has(d)) b.classList.add('fa');
  });

  const n = trial.items.length;
  const fb = $('feedback');
  fb.className = 'feedback ' + (miss + fa === 0 ? 'ok' : 'err');
  fb.innerHTML = (timedOut ? '<b>Время вышло.</b> ' : '') + (miss + fa === 0
    ? `Всё верно: ${hit} из ${n}`
    : `Верно: ${hit} из ${n}` +
      (miss ? ` · <span class="c-miss">пропущено: ${miss}</span>` : '') +
      (fa ? ` · <span class="c-fa">лишних: ${fa}</span>` : ''));
  fb.hidden = false;
  $('btn-submit').hidden = true;
  $('answer-hint').hidden = true;
  $('picked').textContent = '';
  setProgress();
  $('btn-next').hidden = false;
  $('btn-next').focus();
  const last = state.idx + 1 >= state.plan.length;
  startTimer('answer-timer', last ? '⏱ Результаты через' : '⏱ Следующий раунд через', NEXT_MS, next);
}

function next() {
  if (state.phase !== 'feedback') return;
  stopTimer();
  state.idx++;
  if (state.idx >= state.plan.length) return finish();
  const prev = state.plan[state.idx - 1];
  const cur = state.plan[state.idx];
  if (prev.test !== cur.test || prev.q !== cur.q) blockIntro();
  else runTrial();
}

function finish() {
  state.phase = 'done';
  const p = {
    group: GROUP,
    name: cleanName($('name').value),
    time: Date.now(),
    showMs: SHOW_MS,
    dev: { touch: matchMedia('(pointer: coarse)').matches, w: innerWidth, h: innerHeight },
    trials: state.trials.map(t => ({ test: t.test, q: t.q, cond: t.cond, items: t.items, sel: t.sel, rt: t.rt, to: t.to, px: t.px })),
  };
  const code = encodeHash(p);
  try { sessionStorage.setItem(PENDING_KEY, code); } catch {}
  location.href = 'view.html#' + code;
}

function start() {
  state = { plan: buildPlan(), idx: 0, trials: [], phase: 'block' };
  try { localStorage.setItem(NAME_KEY, $('name').value); } catch {}
  document.body.classList.add('running');
  buildTrack();
  blockIntro();
}

const NAME_KEY = 'hci-size-lab1-name';

function renderPlan() {
  const px = { large: 48, small: 16 };
  const card = t => `<div class="plan-card">
    <h3>Тест ${t}</h3>
    <p>${t === 1 ? 'Крупные и обычные арабские цифры' : 'Размер × вид: цифры и пиктограммы'} · ${TESTS[t].length * SETS} раундов</p>
    <div class="plan-qs">${TESTS[t].map((k, i) => {
      const c = CONDS[k];
      const s = px[c.size];
      return `<div class="plan-q"><div class="pic">${renderDigit(7, c.notation).replace('<svg ', `<svg width="${s}" height="${s}" `)}</div><b>Вопрос ${i + 1}</b>${c.title}</div>`;
    }).join('')}</div>
  </div>`;
  $('plan').innerHTML = TEST_IDS.map(card).join('');
  if (TEST_IDS.length === 1) $('plan').style.gridTemplateColumns = '1fr';
}

function init() {
  const blocks = TEST_IDS.reduce((s, t) => s + TESTS[t].length, 0);
  $('t-label').textContent = fmtSec(SHOW_MS);
  $('a-label').textContent = fmtSec(ANSWER_MS);
  $('min-label').textContent = MIN_N;
  $('max-label').textContent = MAX_N;
  $('dur-label').textContent = Math.max(1, Math.round(blocks * SETS * (FIXATION_MS + SHOW_MS + 9000) / 60000));
  $('step-pic').innerHTML = [[5, 'arabic', 48], [3, 'picto', 16], [8, 'arabic', 16], [6, 'picto', 48]]
    .map(([d, n, px]) => `<span style="width:${px}px;height:${px}px">${renderDigit(d, n)}</span>`).join('');
  renderPlan();
  try { $('name').value = localStorage.getItem(NAME_KEY) || ''; } catch {}
  $('name').addEventListener('keydown', e => { if (e.key === 'Enter') start(); });
  $('control-mode').checked = GROUP === 'control';
  $('control-mode').addEventListener('change', e => { GROUP = e.target.checked ? 'control' : 'test'; });

  $('btn-start').addEventListener('click', start);
  $('btn-block').addEventListener('click', () => { if (state && state.phase === 'block') runTrial(); });
  $('btn-submit').addEventListener('click', () => submit());
  $('btn-next').addEventListener('click', next);

  document.addEventListener('keydown', e => {
    if (!state) return;
    if (state.phase === 'answer' && /^[1-9]$/.test(e.key)) toggle(Number(e.key));
    else if (e.key === 'Enter' && state.phase === 'answer') { e.preventDefault(); submit(); }
    else if (e.key === 'Enter' && state.phase === 'feedback') { e.preventDefault(); next(); }
  });
}

init();
