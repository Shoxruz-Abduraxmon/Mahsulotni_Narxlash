export function idxToCol(idx) {
  let s = '';
  let n = idx;
  do {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  } while (n >= 0);
  return s;
}

export function escapeHtml(s) {
  if (s == null || s === '') return '';
  const div = document.createElement('div');
  div.textContent = String(s);
  return div.innerHTML;
}

export function formatNumber(n) {
  if (n == null || isNaN(n)) return '—';
  return new Intl.NumberFormat('ru-RU').format(Math.round(n));
}

export function formatMuddati(val) {
  if (val == null || val === '') return '—';
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    if (isNaN(d.getTime())) return String(val);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}.${d.getFullYear()}`;
  }
  const s = String(val).trim();
  const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
  const slash = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
  if (slash) {
    const a = parseInt(slash[1], 10);
    const b = parseInt(slash[2], 10);
    let dd;
    let mm;
    if (a > 12) {
      dd = a;
      mm = b;
    } else if (b > 12) {
      dd = b;
      mm = a;
    } else {
      mm = a;
      dd = b;
    }
    return `${String(dd).padStart(2, '0')}.${String(mm).padStart(2, '0')}.${slash[3]}`;
  }
  return s;
}

export function roundPriceForDisplay(value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return 0;
  if (v < 400) return Math.round(v / 200) * 200;
  if (v < 1500) return Math.round(v / 500) * 500;
  return Math.round(v / 1000) * 1000;
}

export function calcFoiz(kelgan, sizning) {
  if (!kelgan || kelgan <= 0) return 0;
  return ((sizning / kelgan - 1) * 100).toFixed(1);
}

export function parseNum(val) {
  if (val == null || val === '') return NaN;
  if (typeof val === 'number' && !isNaN(val)) return val;
  const s = String(val).replace(/,/g, '').replace(/\s/g, '').replace(/\u00a0/g, '');
  const n = parseFloat(s);
  return isNaN(n) ? NaN : n;
}

export function hasValue(val) {
  if (val == null) return false;
  if (typeof val === 'string') return String(val).trim() !== '';
  if (typeof val === 'number') return !isNaN(val);
  return true;
}

export function invoiceNameFromFile(fileName) {
  if (!fileName) return 'Faktura';
  return String(fileName).replace(/\.(xlsx|xls)$/i, '').trim() || 'Faktura';
}
