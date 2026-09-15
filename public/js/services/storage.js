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

function writeJson(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota / private mode */
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

export function saveSession(session) {
  writeJson(SESSION_KEY, { ...session, updated: Date.now() });
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  clearLegacy();
}

export function loadMappingPreset() {
  return readJson(PRESET_KEY);
}

export function saveMappingPreset(mapping) {
  writeJson(PRESET_KEY, { mapping, savedAt: Date.now() });
}

export function loadVisibility() {
  return readJson(VISIBILITY_KEY) || defaultVisibility();
}

export function saveVisibility(visibility) {
  writeJson(VISIBILITY_KEY, visibility);
}
