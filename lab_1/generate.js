const $ = id => document.getElementById(id);
const STORE_KEY = 'hci-size-lab1-summary-input';
const DEVICES = {
  pc: { touch: false, w: 1440, h: 860, stageW: 1400, stageH: 700 },
  phone: { touch: true, w: 390, h: 760, stageW: 358, stageH: 600 },
};

let links = [];

const rand = (a, b) => a + Math.random() * (b - a);
const pick = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
const tenth = s => Math.round(s * 10) * 100;

// Прибавка к вероятности вспомнить объект, если он крупный
function sizeBoost(effect) {
  if (effect === 'both') return { arabic: rand(0.05, 0.11), picto: rand(0.18, 0.3) };
  if (effect === 'h1') { const b = rand(0.06, 0.12); return { arabic: b, picto: b }; }
  if (effect === 'none') return { arabic: 0, picto: 0 };
  return { arabic: rand(-0.08, 0.15), picto: rand(-0.08, 0.2) };
}

function simulateTrial(pl, person, dev) {
  const t = makeTrial(pl);
  const c = CONDS[t.cond];
  const { large, small } = stageSizes(dev.stageW, dev.stageH);
  const n = t.items.length;
  const pRecall = clamp(person.skill - (n - 5) * 0.06 - (c.notation === 'picto' ? person.pictoPenalty : 0) +
    (c.size === 'large' ? person.boost[c.notation] : 0), 0.05, 0.98);
  const sel = shuffle(t.items.filter(() => Math.random() < pRecall));
  const absent = DIGITS.filter(d => !t.items.includes(d));
  if (absent.length && Math.random() < person.guess * (n - sel.length)) sel.push(pick(absent));
  const rawRt = (rand(2, 5) + sel.length * 0.6 + (c.notation === 'picto' ? 1.2 : 0)) * person.speed;
  const to = rawRt >= ANSWER_MS / 1000;
  return { ...t, sel, rt: to ? ANSWER_MS : tenth(rawRt), to, px: Math.round(c.size === 'large' ? large : small) };
}

function simulateParticipant(opts, i) {
  const group = opts.group === 'mixed' ? (i % 4 === 3 ? 'control' : 'test') : opts.group;
  const dev = DEVICES[opts.device === 'mixed' ? pick(['pc', 'phone']) : opts.device];
  const person = {
    skill: clamp(0.72 + rand(-0.12, 0.12) + (group === 'control' ? 0.05 : 0), 0.4, 0.92),
    boost: sizeBoost(opts.effect),
    pictoPenalty: rand(0.03, 0.12),
    speed: rand(0.8, 1.3),
    guess: rand(0.02, 0.08),
  };
  return {
    group,
    fake: true,
    time: Date.now() - Math.floor(rand(0, 3 * 24 * 3600 * 1000)),
    showMs: SHOW_MS,
    dev: { touch: dev.touch, w: dev.w, h: dev.h },
    trials: buildPlan().map(pl => simulateTrial(pl, person, dev)),
  };
}

function generate() {
  const opts = { count: +$('count').value, group: $('group').value, device: $('device').value, effect: $('effect').value };
  const people = Array.from({ length: opts.count }, (_, i) => simulateParticipant(opts, i));
  const base = location.href.replace(/generate\.html.*$/, 'view.html');
  links = people.map(p => `${base}#${encodeHash(p)}`);
  $('list').innerHTML = people.map((p, i) => {
    const r = computeStats([p]).people[0];
    return `<li><a href="${links[i]}" target="_blank">Результат ${i + 1}</a> — ${GROUP_WORD[p.group]} группа, ${p.dev.touch ? 'телефон' : 'компьютер'}; Δ1 ${fmtPP(r.d1)}, Δпикт. − Δцифры ${fmtPP(r.dd)}</li>`;
  }).join('');
  $('msg').textContent = '«Посчитать в сводке» откроет сводку сразу с этими результатами.';
  $('out').hidden = false;
}

$('btn-gen').addEventListener('click', generate);
$('btn-copy').addEventListener('click', async () => {
  const ok = await copyText(links.join('\n'));
  $('msg').textContent = ok ? 'Ссылки скопированы.' : 'Не удалось скопировать автоматически.';
});
$('btn-summary').addEventListener('click', () => {
  try { localStorage.setItem(STORE_KEY, links.join('\n')); } catch {}
  location.href = 'summary.html';
});
