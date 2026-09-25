const TITLE_LINE = 'ЛР1 «Размер и запоминание» · результат участника';
const CODE_PREFIX = 'h1_';
const CODE_RE = /h1_[A-Za-z0-9_.\-]+/g;

const GROUP_WORD = { test: 'тестовая', control: 'контрольная' };
const GROUP_TITLE = { test: 'Тестовая', control: 'Контрольная (авторы)' };
const TEST_TITLE = {
  1: 'Тест 1 — размер арабских цифр',
  2: 'Тест 2 — размер × нотация',
};
const ALPHA = 0.05;

const pct = (a, b) => (b ? Math.round(a / b * 100) : 0);
const pad2 = n => String(n).padStart(2, '0');
const fmtNum = x => (Number.isInteger(x) ? String(x) : x.toFixed(1).replace('.', ','));
const fmtSec = ms => fmtNum(ms / 1000);
const fmtS = ms => (ms / 1000).toFixed(1).replace('.', ',');
const fmtPct = x => (x == null || !isFinite(x) ? '—' : (Math.round(x * 10) / 10).toFixed(1).replace('.', ',') + '%');
const fmtPP = x => {
  if (x == null || !isFinite(x)) return '—';
  const r = Math.round(x * 10) / 10;
  return (r > 0 ? '+' : r < 0 ? '−' : '') + Math.abs(r).toFixed(1).replace('.', ',') + ' п.п.';
};
const fmtP = p => (p == null ? 'p = —' : p < 0.001 ? 'p < 0,001' : 'p = ' + p.toFixed(3).replace('.', ','));
const fmtF = (x, d = 2) => (x == null || !isFinite(x) ? '—' : x.toFixed(d).replace('.', ',').replace('-', '−'));

function word(n, one, few, many) {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return few;
  return many;
}

function fmtDate(ms) {
  if (!ms) return '—';
  const d = new Date(ms);
  return `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}.${d.getFullYear()} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function fmtDevice(dev) {
  if (!dev) return '—';
  return `${dev.touch ? 'телефон/планшет' : 'компьютер'}, окно ${dev.w}×${dev.h}`;
}

function scoreTrial(t) {
  const shown = new Set(t.items);
  const hit = t.sel.filter(d => shown.has(d)).length;
  return { n: t.items.length, hit, miss: t.items.length - hit, fa: t.sel.length - hit };
}

/* ---------- Кодирование результата в ссылку ---------- */

function encodeHash(p) {
  const dev = p.dev ? (p.dev.touch ? 'm' : 'd') + p.dev.w + 'x' + p.dev.h : 'x';
  const rounds = p.trials.map(t => [
    `${t.test}${t.q}${t.cond}${t.items.join('')}`,
    t.sel.join(''),
    t.rt == null ? '' : Math.round(t.rt / 100),
    t.to ? 1 : 0,
    t.px || '',
  ].join('-')).join('.');
  const g = p.group === 'control' ? 'c' : 't';
  return CODE_PREFIX + [p.fake ? g.toUpperCase() : g, p.time.toString(36), p.showMs, dev, rounds].join('_');
}

function decodeHash(h) {
  if (!h.startsWith(CODE_PREFIX)) throw new Error('Неверный код результата');
  const parts = h.slice(CODE_PREFIX.length).split('_');
  if (parts.length < 5 || !parts[4]) throw new Error('Неверный код результата');
  const [g, time, showMs, dev, rounds] = parts;
  const dm = dev.match(/^([md])(\d+)x(\d+)$/);
  const trials = rounds.split('.').filter(Boolean).map(r => {
    const [head, sel = '', rt = '', to = '0', px = ''] = r.split('-');
    const m = head.match(/^([12])(\d)(AL|AS|PL|PS)([1-9]+)$/);
    if (!m) throw new Error('Неверный код раунда');
    return {
      test: +m[1],
      q: +m[2],
      cond: m[3],
      items: m[4].split('').map(Number),
      sel: sel.split('').filter(Boolean).map(Number),
      rt: rt === '' ? null : +rt * 100,
      to: to === '1',
      px: px === '' ? null : +px,
    };
  });
  if (!trials.length) throw new Error('В результате нет раундов');
  return {
    group: g.toLowerCase() === 'c' ? 'control' : 'test',
    fake: g === g.toUpperCase(),
    time: parseInt(time, 36),
    showMs: parseInt(showMs, 10) || 3000,
    dev: dm ? { touch: dm[1] === 'm', w: +dm[2], h: +dm[3] } : null,
    trials,
  };
}

// Находит в любом тексте (ссылки, сообщения мессенджера, скопированный результат) все коды результатов
function parseResults(input) {
  const seen = new Set();
  const participants = [];
  const errors = [];
  let duplicates = 0;
  for (let code of input.match(CODE_RE) || []) {
    code = code.replace(/[.\-_]+$/, '');
    if (seen.has(code)) { duplicates++; continue; }
    seen.add(code);
    try { participants.push(decodeHash(code)); } catch (e) { errors.push(e.message); }
  }
  return { participants, errors, duplicates };
}

/* ---------- Статистика ---------- */

const emptyCell = () => ({ shown: 0, hit: 0, fa: 0, rounds: 0, exact: 0, rt: 0, to: 0 });
const acc = c => (c && c.shown ? c.hit / c.shown * 100 : null);

function addTrial(c, t) {
  const s = scoreTrial(t);
  c.shown += s.n;
  c.hit += s.hit;
  c.fa += s.fa;
  c.rounds++;
  if (!s.miss && !s.fa) c.exact++;
  c.rt += t.rt || 0;
  if (t.to) c.to++;
}

function personCells(p) {
  const cells = { 1: {}, 2: {} };
  for (const t of p.trials) addTrial(cells[t.test][t.cond] ||= emptyCell(), t);
  return cells;
}

function computeStats(participants) {
  const cells = { 1: {}, 2: {} };
  const byN = { 1: {}, 2: {} };
  for (const p of participants) {
    for (const t of p.trials) {
      addTrial(cells[t.test][t.cond] ||= emptyCell(), t);
      const n = t.items.length;
      const bn = (byN[t.test][t.cond] ||= {});
      addTrial(bn[n] ||= emptyCell(), t);
    }
  }
  const people = participants.map(p => {
    const c = personCells(p);
    const r = {
      t1L: acc(c[1].AL), t1S: acc(c[1].AS),
      t2AL: acc(c[2].AL), t2AS: acc(c[2].AS), t2PL: acc(c[2].PL), t2PS: acc(c[2].PS),
    };
    r.d1 = r.t1L != null && r.t1S != null ? r.t1L - r.t1S : null;
    r.dA = r.t2AL != null && r.t2AS != null ? r.t2AL - r.t2AS : null;
    r.dP = r.t2PL != null && r.t2PS != null ? r.t2PL - r.t2PS : null;
    r.dd = r.dA != null && r.dP != null ? r.dP - r.dA : null;
    return r;
  });
  return { n: participants.length, cells, byN, people };
}

/* ---------- Статистические критерии ---------- */

function normSf(z) {
  // P(Z > z), аппроксимация Abramowitz–Stegun 7.1.26 через erfc
  const x = Math.abs(z) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * x);
  const e = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-x * x);
  return z >= 0 ? e / 2 : 1 - e / 2;
}

function lnGamma(x) {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
  let y = x;
  const tmp = x + 5.5 - (x + 0.5) * Math.log(x + 5.5);
  let ser = 1.000000000190015;
  for (const ci of c) ser += ci / ++y;
  return -tmp + Math.log(2.5066282746310005 * ser / x);
}

function betacf(a, b, x) {
  const EPS = 3e-14;
  const FPMIN = 1e-300;
  let c = 1;
  let d = 1 - (a + b) * x / (a + 1);
  if (Math.abs(d) < FPMIN) d = FPMIN;
  d = 1 / d;
  let h = d;
  for (let m = 1; m <= 200; m++) {
    const m2 = 2 * m;
    let aa = m * (b - m) * x / ((a + m2 - 1) * (a + m2));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d; h *= d * c;
    aa = -(a + m) * (a + b + m) * x / ((a + m2) * (a + m2 + 1));
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN;
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < EPS) break;
  }
  return h;
}

function ibeta(x, a, b) {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const bt = Math.exp(lnGamma(a + b) - lnGamma(a) - lnGamma(b) + a * Math.log(x) + b * Math.log(1 - x));
  return x < (a + 1) / (a + b + 2) ? bt * betacf(a, b, x) / a : 1 - bt * betacf(b, a, 1 - x) / b;
}

// P(T > t) для распределения Стьюдента с df степенями свободы
function tSf(t, df) {
  const p = ibeta(df / (df + t * t), df / 2, 0.5) / 2;
  return t >= 0 ? p : 1 - p;
}

// Односторонний парный t-критерий: H1 — среднее разностей больше 0
function pairedT(diffs) {
  const d = diffs.filter(x => x != null);
  const n = d.length;
  if (n < 3) return null;
  const mean = d.reduce((s, x) => s + x, 0) / n;
  const sd = Math.sqrt(d.reduce((s, x) => s + (x - mean) ** 2, 0) / (n - 1));
  if (sd === 0) return { kind: 't', n, mean, sd, t: mean > 0 ? Infinity : mean < 0 ? -Infinity : 0, df: n - 1, p: mean > 0 ? 0 : mean < 0 ? 1 : 0.5 };
  const t = mean / (sd / Math.sqrt(n));
  return { kind: 't', n, mean, sd, t, df: n - 1, p: tSf(t, n - 1) };
}

// Односторонний z-критерий для разности двух долей (A > B)
function zTwoProp(a, b) {
  if (!a || !b || !a.shown || !b.shown) return null;
  const pa = a.hit / a.shown;
  const pb = b.hit / b.shown;
  const pp = (a.hit + b.hit) / (a.shown + b.shown);
  const se = Math.sqrt(pp * (1 - pp) * (1 / a.shown + 1 / b.shown));
  const z = se ? (pa - pb) / se : 0;
  return { kind: 'z', z, p: normSf(z) };
}

// Односторонний z-критерий для разности разностей долей: (PL − PS) − (AL − AS) > 0
function zInteraction(c) {
  const cs = [c.PL, c.PS, c.AL, c.AS];
  if (cs.some(x => !x || !x.shown)) return null;
  const pr = x => x.hit / x.shown;
  const diff = (pr(c.PL) - pr(c.PS)) - (pr(c.AL) - pr(c.AS));
  const v = cs.reduce((s, x) => s + Math.max(pr(x) * (1 - pr(x)), 0.25 / x.shown) / x.shown, 0);
  const z = diff / Math.sqrt(v);
  return { kind: 'z', z, p: normSf(z) };
}

const HYP_VERDICT = {
  yes: 'Подтверждается',
  maybe: 'Направление совпадает, но различие статистически не значимо',
  no: 'Не подтверждается',
  none: 'Недостаточно данных',
};

function verdictOf(effect, test) {
  if (effect == null || !test) return 'none';
  if (effect <= 0) return 'no';
  return test.p < ALPHA ? 'yes' : 'maybe';
}

function testLine(test) {
  if (!test) return 'Проверка значимости: недостаточно данных.';
  if (test.kind === 't') return `Парный t-критерий Стьюдента (односторонний) по ${test.n} ${word(test.n, 'участнику', 'участникам', 'участникам')}: t(${test.df}) = ${fmtF(test.t)}, ${fmtP(test.p)}.`;
  return `z-критерий для долей (односторонний, все показанные объекты вместе): z = ${fmtF(test.z)}, ${fmtP(test.p)}.`;
}

function hypotheses(st) {
  const c1 = st.cells[1];
  const c2 = st.cells[2];
  const out = [];

  // Гипотеза 1
  {
    const L = acc(c1.AL);
    const S = acc(c1.AS);
    const eff = L != null && S != null ? L - S : null;
    const test = st.n >= 3 ? pairedT(st.people.map(r => r.d1)) : zTwoProp(c1.AL, c1.AS);
    const extraEff = acc(c2.AL) != null && acc(c2.AS) != null ? acc(c2.AL) - acc(c2.AS) : null;
    out.push({
      id: 1,
      title: 'Гипотеза 1. Крупные (×3) арабские цифры запоминаются лучше, чем обычные, за то же время показа',
      verdict: verdictOf(eff, test),
      rows: [
        ['Крупные цифры (Тест 1)', fmtPct(L)],
        ['Обычные цифры (Тест 1)', fmtPct(S)],
        ['Разница «крупные − обычные»', fmtPP(eff)],
      ],
      test: testLine(test),
      note: extraEff == null ? '' : `Для сравнения, в Тесте 2 на цифрах та же разница составила ${fmtPP(extraEff)}`,
      how: 'Сравнивается средний процент правильно отмеченных цифр в вопросах с крупными и с обычными цифрами. Гипотеза подтверждается, если у крупных процент выше и различие значимо (p < 0,05).',
    });
  }

  // Гипотеза 2
  {
    const dA = acc(c2.AL) != null && acc(c2.AS) != null ? acc(c2.AL) - acc(c2.AS) : null;
    const dP = acc(c2.PL) != null && acc(c2.PS) != null ? acc(c2.PL) - acc(c2.PS) : null;
    const eff = dA != null && dP != null ? dP - dA : null;
    const test = st.n >= 3 ? pairedT(st.people.map(r => r.dd)) : zInteraction(c2);
    out.push({
      id: 2,
      title: 'Гипотеза 2. Размер влияет на пиктограммы сильнее, чем на арабские цифры',
      verdict: verdictOf(eff, test),
      rows: [
        ['Δцифры = крупные цифры − мелкие цифры', `${fmtPct(acc(c2.AL))} − ${fmtPct(acc(c2.AS))} = ${fmtPP(dA)}`],
        ['Δпиктограммы = крупные пикт. − мелкие пикт.', `${fmtPct(acc(c2.PL))} − ${fmtPct(acc(c2.PS))} = ${fmtPP(dP)}`],
        ['Δпиктограммы − Δцифры', fmtPP(eff)],
      ],
      test: testLine(test),
      note: '',
      how: 'Считается выигрыш от увеличения размера отдельно для цифр и для пиктограмм. Гипотеза подтверждается, если Δпиктограммы больше Δцифры и различие значимо (p < 0,05).',
    });
  }
  return out;
}

/* ---------- Оформление отчёта ---------- */

const TESTS_ALL = { 1: ['AL', 'AS'], 2: ['AL', 'AS', 'PL', 'PS'] };
const SIZE_WORD = { large: 'крупные', small: 'обычные' };

function glyph(cond) {
  const c = CONDS[cond];
  return `<span class="glyph ${c.size === 'large' ? 'g-large' : 'g-small'}">${renderDigit(7, c.notation)}</span>`;
}

function hBars(rows, axis = 'Правильно отмечено объектов, %') {
  const bar = r => `
    <div class="hrow">
      <div class="hlabel">${r.label}</div>
      <div class="hb">
        <div class="htrack"><i class="s-${r.key}" style="width:${r.v == null ? 0 : Math.min(100, r.v)}%"></i></div>
        <div class="hval"><b>${fmtPct(r.v)}</b> <span>${r.hint}</span></div>
      </div>
    </div>`;
  const ticks = [0, 25, 50, 75, 100].map(v => `<span style="left:${v}%">${v}</span>`).join('');
  return `<div class="hchart">${rows.map(bar).join('')}
    <div class="hrow"><div></div><div class="hb"><div class="haxis">${ticks}</div><div></div></div></div>
    <div class="hrow"><div></div><div class="hb"><div class="axis-title">${axis}</div><div></div></div></div>
  </div>`;
}

const barRow = (st, test, cond) => {
  const c = st.cells[test][cond];
  return { key: CONDS[cond].size, label: `${glyph(cond)}${CONDS[cond].title}`, v: acc(c), hint: c ? `${c.hit} из ${c.shown}` : 'нет данных' };
};

function figure(n, title, body, note = '') {
  return `<figure class="fig"><figcaption>Рисунок ${n} — ${title}</figcaption>${body}${note ? `<p class="fig-note">${note}</p>` : ''}</figure>`;
}

const rowsHtml = rows => rows.map((r, i) => `<tr>${r.map(c => (i === 0 ? `<th>${c}</th>` : `<td>${c}</td>`)).join('')}</tr>`).join('');

function tableBlock(n, title, rows, note = '') {
  return `<div class="fig">
    <p class="fig-caption">Таблица ${n} — ${title}</p>
    <div class="table-wrap"><table class="tbl">${rowsHtml(rows)}</table></div>
    ${note ? `<p class="fig-note">${note}</p>` : ''}
  </div>`;
}

function condRows(st, test) {
  const head = ['Вопрос', 'Условие', 'Раундов', 'Показано', 'Отмечено верно', '% верно', 'Лишних', 'Раундов без ошибок', 'Ответ, с'];
  const rows = TESTS_ALL[test].map((cond, i) => {
    const c = st.cells[test][cond] || emptyCell();
    return [i + 1, CONDS[cond].title, c.rounds, c.shown, c.hit, fmtPct(acc(c)), c.fa, `${c.exact} (${pct(c.exact, c.rounds)}%)`, c.rounds ? fmtS(c.rt / c.rounds) : '—'];
  });
  return [head, ...rows];
}

function byNRows(st, test) {
  const ns = new Set();
  for (const cond of TESTS_ALL[test]) Object.keys(st.byN[test][cond] || {}).forEach(n => ns.add(+n));
  const list = [...ns].sort((a, b) => a - b);
  const head = ['Условие', ...list.map(n => `${n} ${word(n, 'объект', 'объекта', 'объектов')}`)];
  return [head, ...TESTS_ALL[test].map(cond => [CONDS[cond].title, ...list.map(n => {
    const c = (st.byN[test][cond] || {})[n];
    return c ? `${fmtPct(acc(c))} <span class="muted">(${c.rounds})</span>` : '—';
  })])];
}

function hypBlock(h) {
  return `<div class="hyp v-${h.verdict}">
    <h3>${h.title}</h3>
    <p class="verdict">${HYP_VERDICT[h.verdict]}</p>
    <table class="kv">${h.rows.map(([k, v]) => `<tr><td>${k}</td><td><b>${v}</b></td></tr>`).join('')}</table>
    <p class="explain">${h.test}${h.note ? ' ' + h.note : ''}</p>
    <p class="explain muted">${h.how}</p>
  </div>`;
}

function roundsTable(p) {
  const head = ['№', 'Тест / вопрос', 'Условие', 'Показано', 'Отмечено', 'Результат', 'Ответ, с'];
  const rows = p.trials.map((t, i) => {
    const s = scoreTrial(t);
    const shown = new Set(t.items);
    const sel = t.sel.map(d => `<span class="${shown.has(d) ? 'c-ok' : 'c-fa'}">${d}</span>`).join(' ') || '—';
    const res = !s.miss && !s.fa ? '<span class="c-ok">без ошибок</span>' : `${s.hit} из ${s.n}` + (s.fa ? `, <span class="c-fa">лишних ${s.fa}</span>` : '');
    return [i + 1, `${t.test} / ${t.q}`, CONDS[t.cond].short + (t.px ? ` <span class="muted">${t.px}px</span>` : ''), t.items.join(' '), sel, res, t.to ? 'время вышло' : t.rt == null ? '—' : fmtS(t.rt)];
  });
  return [head, ...rows];
}

function renderReport(el, participants, { single = false } = {}) {
  const st = computeStats(participants);
  const hyps = hypotheses(st);
  let fig = 0;
  let tab = 0;
  const has = t => TESTS_ALL[t].some(c => st.cells[t][c]);
  let html = `<section class="card"><h2>Проверка гипотез</h2>${hyps.map(hypBlock).join('')}
    <p class="hint">${single ? 'Результат одного участника: значимость оценивается z-критерием по всем показанным объектам.' : st.n >= 3 ? 'Значимость оценивается парным t-критерием: для каждого участника считается своя разница, затем проверяется, что в среднем она больше нуля.' : 'Участников меньше трёх, поэтому значимость оценивается z-критерием по всем показанным объектам.'}
    «% верно» — доля показанных объектов, которые участник правильно отметил.</p></section>`;

  if (has(1)) {
    html += `<section class="card"><h2>${TEST_TITLE[1]}</h2>
      ${figure(++fig, 'Доля правильно запомненных цифр в Тесте 1', hBars(TESTS_ALL[1].map(c => barRow(st, 1, c))))}
      ${tableBlock(++tab, 'Результаты Теста 1 по вопросам', condRows(st, 1))}
      ${tableBlock(++tab, 'Тест 1: % верно в зависимости от количества объектов', byNRows(st, 1), 'В скобках — число раундов.')}
    </section>`;
  }
  if (has(2)) {
    const c2 = st.cells[2];
    const dA = acc(c2.AL) != null && acc(c2.AS) != null ? acc(c2.AL) - acc(c2.AS) : null;
    const dP = acc(c2.PL) != null && acc(c2.PS) != null ? acc(c2.PL) - acc(c2.PS) : null;
    html += `<section class="card"><h2>${TEST_TITLE[2]}</h2>
      ${figure(++fig, 'Доля правильно запомненных объектов в Тесте 2', hBars(TESTS_ALL[2].map(c => barRow(st, 2, c))))}
      ${figure(++fig, 'Выигрыш от крупного размера (Δ) для цифр и пиктограмм', deltaChart([
        { label: `${glyph('AL')}Δцифры`, v: dA },
        { label: `${glyph('PL')}Δпиктограммы`, v: dP },
      ]), 'Δ = % верно у крупных − % верно у мелких. Столбик вправо — крупные запоминаются лучше.')}
      ${tableBlock(++tab, 'Результаты Теста 2 по вопросам', condRows(st, 2))}
      ${tableBlock(++tab, 'Тест 2: % верно в зависимости от количества объектов', byNRows(st, 2), 'Количество объектов в наборах одинаковое для всех четырёх вопросов. В скобках — число раундов.')}
    </section>`;
  }
  if (single) {
    html += `<section class="card"><h2>Все раунды</h2>${tableBlock(++tab, 'Показанные и отмеченные объекты', roundsTable(participants[0]), 'Зелёным — верно отмеченные, красным — лишние (их не было на экране). В колонке «Условие» указан размер объекта в пикселях.')}</section>`;
  }
  el.innerHTML = html;
  return { fig, tab };
}

function deltaChart(rows) {
  const max = Math.max(20, ...rows.map(r => Math.abs(r.v || 0))) * 1.15;
  const bar = r => {
    const w = r.v == null ? 0 : Math.abs(r.v) / max * 50;
    const left = r.v != null && r.v < 0 ? 50 - w : 50;
    return `<div class="hrow"><div class="hlabel">${r.label}</div><div class="hb">
      <div class="dtrack"><i class="${r.v < 0 ? 'neg' : 'pos'}" style="left:${left}%;width:${w}%"></i><b class="zero"></b></div>
      <div class="hval"><b>${fmtPP(r.v)}</b></div></div></div>`;
  };
  return `<div class="hchart">${rows.map(bar).join('')}</div>`;
}

/* ---------- Текст для копирования ---------- */

function textTable(rows) {
  const strip = s => String(s).replace(/<[^>]+>/g, '');
  return rows.map(r => r.map(strip).join(' | ')).join('\n');
}

function hypText(st) {
  return hypotheses(st).map(h => [
    h.title,
    `Вывод: ${HYP_VERDICT[h.verdict]}`,
    ...h.rows.map(([k, v]) => `  ${k}: ${v}`),
    `  ${h.test}${h.note ? ' ' + h.note : ''}`,
  ].join('\n')).join('\n\n');
}

function formatText(p) {
  const st = computeStats([p]);
  const lines = [
    TITLE_LINE,
    `Группа: ${GROUP_WORD[p.group]}`,
    `Дата: ${fmtDate(p.time)}`,
    `Устройство: ${fmtDevice(p.dev)}`,
    `Время показа: ${fmtSec(p.showMs)} с`,
    '',
    hypText(st),
    '',
  ];
  for (const t of [1, 2]) if (TESTS_ALL[t].some(c => st.cells[t][c])) lines.push(TEST_TITLE[t], textTable(condRows(st, t)), '');
  lines.push(`Код результата: ${encodeHash(p)}`);
  return lines.join('\n');
}

const PEOPLE_HEAD = ['№', 'Группа', 'Дата', 'Т1: крупн.', 'Т1: обычн.', 'Δ1', 'Т2: цифры кр.', 'Т2: цифры мелк.', 'Т2: пикт. кр.', 'Т2: пикт. мелк.', 'Δцифры', 'Δпикт.', 'Δпикт. − Δцифры', 'Устр.'];

function participantRow(p, i, r) {
  return {
    hash: encodeHash(p),
    cells: [i + 1, GROUP_WORD[p.group] + (p.fake ? '*' : ''), fmtDate(p.time),
      fmtPct(r.t1L), fmtPct(r.t1S), fmtPP(r.d1),
      fmtPct(r.t2AL), fmtPct(r.t2AS), fmtPct(r.t2PL), fmtPct(r.t2PS),
      fmtPP(r.dA), fmtPP(r.dP), fmtPP(r.dd),
      p.dev ? (p.dev.touch ? 'тел.' : 'ПК') : '—'],
  };
}

function formatSummaryText(participants) {
  const out = [];
  const groups = [['Все участники', participants], ['Тестовая группа', participants.filter(p => p.group === 'test')], ['Контрольная группа', participants.filter(p => p.group === 'control')]];
  for (const [title, list] of groups) {
    if (!list.length) continue;
    const st = computeStats(list);
    out.push(`=== ${title} (${list.length}) ===`, '', hypText(st), '');
    for (const t of [1, 2]) if (TESTS_ALL[t].some(c => st.cells[t][c])) out.push(TEST_TITLE[t], textTable(condRows(st, t)), '');
  }
  const st = computeStats(participants);
  out.push('=== Участники ===', textTable([PEOPLE_HEAD, ...participants.map((p, i) => participantRow(p, i, st.people[i]).cells)]));
  return out.join('\n');
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch {}
    ta.remove();
    return ok;
  }
}

function testUrl(p) {
  const q = new URLSearchParams();
  if (p.showMs !== 3000) q.set('t', p.showMs);
  if (p.group === 'control') q.set('g', 'control');
  const s = q.toString();
  return './' + (s ? '?' + s : '');
}
