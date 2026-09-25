const params = new URLSearchParams(location.search);
const SHOW_MS = Math.max(500, Number(params.get('t')) || 3000);
const ANSWER_MS = Math.max(1000, Number(params.get('a')) || 20000);
const MIN_N = Math.min(9, Math.max(1, Number(params.get('min')) || 3));
const MAX_N = Math.min(9, Math.max(MIN_N, Number(params.get('max')) || 7));
const SETS = Math.max(1, Number(params.get('sets')) || 6);
const ONLY_TEST = ['1', '2'].includes(params.get('test')) ? Number(params.get('test')) : null;
const RANDOM_ORDER = params.get('order') === 'random';
const SCALE = 3;
const MAX_LARGE_PX = 120;

// Тест 1 — гипотеза 1, Тест 2 — гипотеза 2. Порядок вопросов как в плане тестирования.
const TESTS = {
  1: ['AL', 'AS'],
  2: ['AL', 'AS', 'PL', 'PS'],
};
const TEST_IDS = ONLY_TEST ? [ONLY_TEST] : [1, 2];

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Количества объектов для 6 наборов: вразнобой из [MIN_N..MAX_N], все значения
// встречаются примерно поровну, чтобы средняя сложность была одинаковой у разных участников.
function setCounts() {
  const range = [];
  for (let k = MIN_N; k <= MAX_N; k++) range.push(k);
  const out = [];
  while (out.length < SETS) out.push(...shuffle(range));
  return shuffle(out.slice(0, SETS));
}

// Внутри одного теста все вопросы используют одни и те же наборы
// (то же количество и те же числа 1–9), только в другом порядке и в других местах экрана.
// Поэтому разница между вопросами объясняется только размером и нотацией.
// Наборы Теста 1 и Теста 2 генерируются независимо.
function buildPlan() {
  const plan = [];
  for (const test of TEST_IDS) {
    const templates = setCounts().map(n => shuffle(DIGITS).slice(0, n));
    const conds = RANDOM_ORDER ? shuffle(TESTS[test]) : TESTS[test];
    conds.forEach((cond, qi) => {
      shuffle(templates).forEach((digits, si) => {
        plan.push({ test, q: qi + 1, cond, set: si + 1, digits: shuffle(digits) });
      });
    });
  }
  return plan;
}

function makeTrial(pl) {
  return { test: pl.test, q: pl.q, cond: pl.cond, items: pl.digits.slice(), sel: [] };
}

// Сетка 5×3 (альбомная) или 3×5 (книжная). Крупный объект ровно в SCALE раз больше обычного,
// разброс позиций одинаковый для обоих размеров.
function stageSizes(w, h) {
  const landscape = w >= h;
  const cols = landscape ? 5 : 3;
  const rows = landscape ? 3 : 5;
  const cw = w / cols;
  const ch = h / rows;
  const large = Math.floor(Math.min(cw, ch, MAX_LARGE_PX / 0.8) * 0.8);
  return { cols, rows, cw, ch, large, small: large / SCALE };
}

function layoutPositions(n, w, h) {
  const { cols, rows, cw, ch, large, small } = stageSizes(w, h);
  const jx = (cw - large) / 2 * 0.8;
  const jy = (ch - large) / 2 * 0.8;
  const cells = shuffle([...Array(cols * rows).keys()]).slice(0, n);
  return {
    large,
    small,
    points: cells.map(c => ({
      x: (c % cols + 0.5) * cw + (Math.random() * 2 - 1) * jx,
      y: (Math.floor(c / cols) + 0.5) * ch + (Math.random() * 2 - 1) * jy,
    })),
  };
}
