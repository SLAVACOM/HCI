// Отправка результата организатору в Telegram (Bot API sendMessage).
//
// Заполните token и chatId. ВНИМАНИЕ: сайт статический, поэтому всё, что записано в этом файле,
// видно любому посетителю. Используйте отдельного бота только для этой ЛР и отзовите токен
// в @BotFather (/revoke), когда сбор результатов закончится.
//
// Безопаснее — указать proxy: адрес своего прокси (например, Cloudflare Worker), который хранит токен у себя
// и принимает POST с полями chat_id, text, parse_mode. Тогда token здесь оставьте пустым.
const TG = {
  token: '',
  chatId: '',
  proxy: '',
};

const SENT_KEY = 'hci-size-lab1-sent';
const PENDING_KEY = 'hci-size-lab1-pending';

const tgEnabled = () => !!(TG.chatId && (TG.token || TG.proxy));

function tgEsc(s) {
  return String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

function tgMessage(p, viewUrl) {
  const r = computeStats([p]).people[0];
  const has1 = r.t1L != null || r.t1S != null;
  const has2 = r.t2AL != null || r.t2PL != null;
  const lines = [
    '📊 <b>Новый результат · ЛР1 «Размер и запоминание»</b>',
    `👤 ${p.name ? '<b>' + tgEsc(p.name) + '</b>' : 'без имени'} · ${GROUP_WORD[p.group]} группа`,
    `🗓 ${fmtDate(p.time)} · ${p.dev ? (p.dev.touch ? '📱 телефон' : '💻 компьютер') : '—'} · показ ${fmtSec(p.showMs)} с`,
    '',
  ];
  if (has1) lines.push(
    '<b>Тест 1</b> · гипотеза 1',
    `крупные ${fmtPct(r.t1L)} · обычные ${fmtPct(r.t1S)} → Δ1 <b>${fmtPP(r.d1)}</b>`,
    '',
  );
  if (has2) lines.push(
    '<b>Тест 2</b> · гипотеза 2',
    `цифры: ${fmtPct(r.t2AL)} / ${fmtPct(r.t2AS)} → Δцифры ${fmtPP(r.dA)}`,
    `пиктограммы: ${fmtPct(r.t2PL)} / ${fmtPct(r.t2PS)} → Δпикт. ${fmtPP(r.dP)}`,
    `Δпикт. − Δцифры = <b>${fmtPP(r.dd)}</b>`,
    '',
  );
  lines.push(`<a href="${tgEsc(viewUrl)}">Открыть подробный результат</a>`, '', 'Код для сводки:', `<code>${encodeHash(p)}</code>`);
  return lines.join('\n');
}

async function tgSend(p, viewUrl) {
  if (!tgEnabled()) return false;
  const url = TG.proxy || `https://api.telegram.org/bot${TG.token}/sendMessage`;
  // URLSearchParams — «простой» CORS-запрос, браузер не делает предварительный OPTIONS
  const body = () => new URLSearchParams({
    chat_id: TG.chatId,
    text: tgMessage(p, viewUrl),
    parse_mode: 'HTML',
    disable_web_page_preview: 'true',
  });
  try {
    const res = await fetch(url, { method: 'POST', body: body() });
    const data = await res.json().catch(() => null);
    return !!(data && data.ok);
  } catch {
    // Браузер не дал прочитать ответ (CORS) — отправляем без чтения ответа
    try {
      await fetch(url, { method: 'POST', body: body(), mode: 'no-cors' });
      return true;
    } catch {
      return false;
    }
  }
}

function sentCodes() {
  try { return JSON.parse(localStorage.getItem(SENT_KEY) || '[]'); } catch { return []; }
}

function markSent(code) {
  try { localStorage.setItem(SENT_KEY, JSON.stringify([...sentCodes(), code].slice(-50))); } catch {}
}
