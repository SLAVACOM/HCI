const $ = id => document.getElementById(id);
const DEFAULT_MSG = 'Скопируйте результат текстом или ссылкой и отправьте тому, кто проводит тестирование.';

let current = null;

function showParticipant(p) {
  current = p;
  $('meta').innerHTML = [
    ['Группа', GROUP_TITLE[p.group] + (p.fake ? ' · сгенерированный' : '')],
    ['Дата', fmtDate(p.time)],
    ['Время показа', `${fmtSec(p.showMs)} с`],
    ['Раундов', p.trials.length],
    ['Устройство', fmtDevice(p.dev)],
  ].map(([k, v]) => `<div><span>${k}</span><b>${v}</b></div>`).join('');
  $('btn-again').href = testUrl(p);
  $('copy-msg').textContent = DEFAULT_MSG;
  renderReport($('report'), [p], { single: true });
  $('paste').hidden = true;
  $('view').hidden = false;
  window.scrollTo(0, 0);
}

function showPaste() {
  $('view').hidden = true;
  $('paste').hidden = false;
  $('btn-back').hidden = !current;
  $('paste-msg').textContent = '';
  $('input').focus();
}

function fromHash() {
  const h = location.hash.slice(1);
  if (!h) return false;
  try {
    showParticipant(decodeHash(h));
    return true;
  } catch {
    return false;
  }
}

$('btn-show').addEventListener('click', () => {
  const { participants, errors } = parseResults($('input').value);
  if (!participants.length) {
    $('paste-msg').textContent = errors[0] || 'Не удалось найти результат. Проверьте, что скопирована строка «Код результата: h1_…» или ссылка целиком.';
    return;
  }
  history.replaceState(null, '', '#' + encodeHash(participants[0]));
  showParticipant(participants[0]);
  if (participants.length > 1) {
    $('copy-msg').textContent = `Во вставленном тексте ${participants.length} результатов, показан первый. Для общей статистики откройте «Сводку».`;
  }
});

$('btn-copy').addEventListener('click', async () => {
  const ok = await copyText(formatText(current));
  $('copy-msg').textContent = ok
    ? 'Скопировано в буфер обмена. Вставьте текст в сообщение и отправьте.'
    : 'Не удалось скопировать автоматически. Скопируйте адрес страницы из адресной строки.';
});

$('btn-link').addEventListener('click', async () => {
  const url = location.origin + location.pathname + '#' + encodeHash(current);
  const ok = await copyText(url);
  $('copy-msg').textContent = ok
    ? 'Ссылка скопирована. По ней откроется этот же результат на любом устройстве.'
    : 'Не удалось скопировать автоматически. Скопируйте адрес страницы из адресной строки.';
});

$('btn-other').addEventListener('click', showPaste);
$('btn-back').addEventListener('click', e => { e.preventDefault(); if (current) showParticipant(current); });
window.addEventListener('hashchange', () => { if (!fromHash()) showPaste(); });

if (!fromHash()) showPaste();
