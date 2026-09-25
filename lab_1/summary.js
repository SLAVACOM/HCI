const $ = id => document.getElementById(id);
const STORE_KEY = 'hci-size-lab1-summary-input';

let all = [];
let filter = 'all';

function load() {
  try { $('input').value = localStorage.getItem(STORE_KEY) || ''; } catch {}
}

function save() {
  try { localStorage.setItem(STORE_KEY, $('input').value); } catch {}
}

function selected() {
  return filter === 'all' ? all : all.filter(p => p.group === filter);
}

function renderFilter() {
  const count = g => all.filter(p => p.group === g).length;
  const opts = [['all', 'Все', all.length], ['test', 'Тестовая группа', count('test')], ['control', 'Контрольная группа', count('control')]];
  $('filter').innerHTML = opts.map(([k, label, n]) =>
    `<button class="${k === filter ? 'on' : ''}" data-k="${k}" ${n ? '' : 'disabled'}>${label} <span>${n}</span></button>`
  ).join('');
  $('filter').querySelectorAll('button').forEach(b => b.addEventListener('click', () => { filter = b.dataset.k; render(); }));
}

function renderPeople() {
  const st = computeStats(all);
  const rows = all.map((p, i) => ({ p, row: participantRow(p, i, st.people[i]) })).filter(({ p }) => filter === 'all' || p.group === filter);
  $('people').innerHTML =
    `<tr>${PEOPLE_HEAD.map(h => `<th>${h}</th>`).join('')}</tr>` +
    rows.map(({ row }) => `<tr>${row.cells.map((c, j) =>
      j === 0 ? `<td><a href="view.html#${row.hash}" target="_blank">${c}</a></td>` : `<td>${c}</td>`
    ).join('')}</tr>`).join('');
}

function render() {
  renderFilter();
  const counters = renderReport($('report'), selected());
  $('people-caption').textContent = `Таблица ${counters.tab + 1} — Результаты каждого участника`;
  renderPeople();
}

function calc() {
  save();
  const { participants, errors, duplicates } = parseResults($('input').value);
  all = participants.sort((a, b) => a.time - b.time);
  const test = all.filter(p => p.group === 'test').length;
  const parts = [`Распознано результатов: ${all.length} (тестовая группа: ${test}, контрольная: ${all.length - test}).`];
  if (duplicates) parts.push(`Повторы пропущены: ${duplicates}.`);
  if (errors.length) parts.push(`Не удалось прочитать: ${errors.length} — ${errors[0]}.`);
  $('status').textContent = parts.join(' ');
  if (!all.length) { $('out').hidden = true; return; }
  if (filter !== 'all' && !all.some(p => p.group === filter)) filter = 'all';
  $('out').hidden = false;
  render();
}

$('btn-calc').addEventListener('click', calc);
$('btn-clear').addEventListener('click', () => {
  $('input').value = '';
  save();
  all = [];
  $('out').hidden = true;
  $('status').textContent = '';
});
$('input').addEventListener('input', save);
$('btn-copy').addEventListener('click', async () => {
  const ok = await copyText(formatSummaryText(selected()));
  $('copy-msg').textContent = ok ? 'Сводка скопирована в буфер обмена.' : 'Не удалось скопировать автоматически.';
});

load();
if ($('input').value.trim()) calc();
