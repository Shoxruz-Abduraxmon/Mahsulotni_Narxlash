import { IMPORT_FIELDS } from '../config/fields.js';

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .trim()
    .replace(/ё/g, 'е')
    .replace(/[_\-./\\]+/g, ' ')
    .replace(/\s+/g, ' ');
}

function scoreMatch(headerName, field) {
  const h = normalize(headerName);
  if (!h) return 0;

  const label = normalize(field.label);
  if (h === label || h === normalize(field.key)) return 1;

  let best = 0;
  for (const alias of field.aliases || []) {
    const a = normalize(alias);
    if (!a) continue;
    if (h === a) return 1;
    if (h.includes(a) || a.includes(h)) best = Math.max(best, 0.85);
    if (h.startsWith(a) || a.startsWith(h)) best = Math.max(best, 0.75);
  }
  if (h.includes(label) || label.includes(h)) best = Math.max(best, 0.7);
  return best;
}

/**
 * @param {Array<{idx:number,name:string}>} headers
 * @param {object|null} preset { mapping?, byHeader? }
 */
export function autoMap(headers, preset = null) {
  const usedFields = new Set();
  const results = headers.map((h) => ({
    colIdx: h.idx,
    headerName: h.name,
    fieldKey: null,
    confidence: 0
  }));

  const byHeader = preset?.byHeader && typeof preset.byHeader === 'object' ? preset.byHeader : null;
  const presetMapping = preset?.mapping && typeof preset.mapping === 'object' ? preset.mapping : null;

  // 1) Prefer header-name fingerprint from last successful mapping
  if (byHeader) {
    results.forEach((row) => {
      const key = byHeader[normalize(row.headerName)];
      if (!key || usedFields.has(key)) return;
      if (!IMPORT_FIELDS.some((f) => f.key === key)) return;
      row.fieldKey = key;
      row.confidence = 0.98;
      usedFields.add(key);
    });
  }

  // 2) Fallback: same column index only if header name still matches loosely
  if (presetMapping) {
    Object.entries(presetMapping).forEach(([fieldKey, colIdx]) => {
      if (colIdx == null || usedFields.has(fieldKey)) return;
      const row = results.find((r) => r.colIdx === colIdx);
      if (!row || row.fieldKey) return;
      if (!IMPORT_FIELDS.some((f) => f.key === fieldKey)) return;
      const field = IMPORT_FIELDS.find((f) => f.key === fieldKey);
      const score = field ? scoreMatch(row.headerName, field) : 0;
      if (score < 0.7) return;
      row.fieldKey = fieldKey;
      row.confidence = Math.max(0.9, score);
      usedFields.add(fieldKey);
    });
  }

  // 3) Fuzzy match remaining
  const candidates = [];
  results.forEach((row) => {
    if (row.fieldKey) return;
    IMPORT_FIELDS.forEach((field) => {
      if (usedFields.has(field.key)) return;
      const score = scoreMatch(row.headerName, field);
      if (score >= 0.7) {
        candidates.push({ colIdx: row.colIdx, fieldKey: field.key, score });
      }
    });
  });

  candidates.sort((a, b) => b.score - a.score);
  for (const c of candidates) {
    const row = results.find((r) => r.colIdx === c.colIdx);
    if (!row || row.fieldKey) continue;
    if (usedFields.has(c.fieldKey)) continue;
    row.fieldKey = c.fieldKey;
    row.confidence = c.score;
    usedFields.add(c.fieldKey);
  }

  return results;
}

export function assignmentsToMapping(assignments) {
  const mapping = {};
  assignments.forEach((a) => {
    if (a.fieldKey) mapping[a.fieldKey] = a.colIdx;
  });
  return mapping;
}

export function validateMapping(mapping) {
  if (mapping.kelganNarx == null && mapping.prihod == null) {
    return { ok: false, error: 'Kelgan narx yoki Prihod summa ustunini tanlang.' };
  }
  return { ok: true };
}
