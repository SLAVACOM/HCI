const NOTATIONS = {
  arabic: 'Арабские цифры',
  picto: 'Пиктограммы',
};

const SIZES = {
  large: 'Крупные (×3)',
  small: 'Обычные',
};

// Условия эксперимента: нотация × размер
const CONDS = {
  AL: { notation: 'arabic', size: 'large', title: 'Крупные арабские цифры', short: 'Цифры крупн.' },
  AS: { notation: 'arabic', size: 'small', title: 'Обычные арабские цифры', short: 'Цифры обычн.' },
  PL: { notation: 'picto', size: 'large', title: 'Крупные пиктограммы', short: 'Пикт. крупн.' },
  PS: { notation: 'picto', size: 'small', title: 'Обычные пиктограммы', short: 'Пикт. обычн.' },
};

const INK = '#1f2328';
const DIGITS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

const DOT_XY = [28, 50, 72];
const PIPS = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
  7: [0, 2, 3, 4, 5, 6, 8],
  8: [0, 1, 2, 3, 5, 6, 7, 8],
  9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function arabicSvg(digit) {
  return `<text x="50" y="54" text-anchor="middle" dominant-baseline="middle"
    font-family="Arial, Helvetica, sans-serif" font-size="84" fill="${INK}">${digit}</text>`;
}

function pictoSvg(digit) {
  const dots = PIPS[digit]
    .map(i => `<circle cx="${DOT_XY[i % 3]}" cy="${DOT_XY[Math.floor(i / 3)]}" r="7" fill="${INK}"/>`)
    .join('');
  return `<rect x="9" y="9" width="82" height="82" rx="14" fill="none" stroke="${INK}" stroke-width="2.5"/>${dots}`;
}

function renderDigit(digit, notation) {
  const body = notation === 'arabic' ? arabicSvg(digit) : pictoSvg(digit);
  return `<svg viewBox="0 0 100 100" overflow="visible" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${digit}">${body}</svg>`;
}
