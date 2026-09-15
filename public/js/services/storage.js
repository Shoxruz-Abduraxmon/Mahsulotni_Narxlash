import { defaultVisibility } from '../config/fields.js';

const SESSION_KEY = 'apteka_session';
const PRESET_KEY = 'apteka_mapping_preset';
const VISIBILITY_KEY = 'apteka_visibility';
const LEGACY_KEY = 'apteka_narxlash';

function readJson(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** @returns {{ ok: boolean, error?: string }} */
function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    const msg = e?.name === 'QuotaExceededError'
      ? 'Brauzer xotirasi to\'ldi. Saqlash imkonsiz.'
      : 'Saqlash muvaffaqiyatsiz (private rejim yoki bloklangan storage).';
    return { ok: false, error: msg };
  }
}

export function clearLegacy() {
  localStorage.removeItem(LEGACY_KEY);
}

export function loadSession() {
  const session = readJson(SESSION_KEY);
  if (session?.products?.length) return session;

  const legacy = readJson(LEGACY_KEY);
  if (legacy?.products?.length) {
    const migrated = {
      invoiceName: 'Saqlangan sessiya',
      fileName: '',
      uploadedAt: legacy.updated || Date.now(),
      mapping: {},
      visibility: defaultVisibility(),
      products: legacy.products,
      percent: 10
    };
    saveSession(migrated);
    clearLegacy();
    return migrated;
  }
  return null;
}

/** @returns {{ ok: boolean, error?: string }} */
export function saveSession(session) {
  return writeJson(SESSION_KEY, { ...session, updated: Date.now() });
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  clearLegacy();
}

export function hasSavedSession() {
  const s = readJson(SESSION_KEY);
  return !!(s?.products?.length);
}

export function loadMappingPreset() {
  return readJson(PRESET_KEY);
}

/**
 * @param {Record<string, number>} mapping fieldKey -> colIdx
 * @param {Array<{idx:number,name:string}>} headers
 */
export function saveMappingPreset(mapping, headers = []) {
  const byHeader = {};
  if (Array.isArray(headers)) {
    Object.entries(mapping).forEach(([fieldKey, colIdx]) => {
      const h = headers.find((x) => x.idx === colIdx);
      if (h?.name) byHeader[normalizeHeader(h.name)] = fieldKey;
    });
  }
  return writeJson(PRESET_KEY, {
    mapping,
    byHeader,
    savedAt: Date.now()
  });
}

function normalizeHeader(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function loadVisibility() {
  return readJson(VISIBILITY_KEY) || defaultVisibility();
}

/** @returns {{ ok: boolean, error?: string }} */
export function saveVisibility(visibility) {
  return writeJson(VISIBILITY_KEY, visibility);
}
