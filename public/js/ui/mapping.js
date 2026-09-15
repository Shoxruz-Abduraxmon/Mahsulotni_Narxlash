import { getImportFieldOptions } from '../config/fields.js';
import { autoMap, assignmentsToMapping, validateMapping } from '../services/autoMap.js';
import { idxToCol, escapeHtml } from '../utils/format.js';

/**
 * Excel-first mapping UI
 */
export function createMappingController({ onCancel, onSubmit }) {
  let state = {
    headers: [],
    rows: [],
    assignments: [],
    invoiceName: '',
    fileName: ''
  };

  function sampleForCol(colIdx) {
    for (let i = 0; i < Math.min(state.rows.length, 3); i++) {
      const row = state.rows[i];
      const rowArr = Array.isArray(row) ? row : Object.values(row || {});
      const v = rowArr[colIdx];
      if (v != null && String(v).trim() !== '') return String(v).slice(0, 40);
    }
    return '—';
  }

  function fieldOptionsHtml(selectedKey) {
    const opts = getImportFieldOptions();
    const used = new Set(
      state.assignments.filter((a) => a.fieldKey && a.fieldKey !== selectedKey).map((a) => a.fieldKey)
    );
    let html = '<option value="">— E\'tiborsiz —</option>';
    opts.forEach((o) => {
      const disabled = used.has(o.key) ? ' disabled' : '';
      const sel = o.key === selectedKey ? ' selected' : '';
      html += `<option value="${o.key}"${sel}${disabled}>${escapeHtml(o.label)}</option>`;
    });
    return html;
  }

  function renderList() {
    const list = document.getElementById('mappingList');
    if (!list) return;
    list.innerHTML = state.assignments
      .map((a, i) => {
        const letter = idxToCol(a.colIdx);
        const conf = a.confidence >= 0.85 ? 'high' : a.confidence >= 0.7 ? 'mid' : 'low';
        const badge = a.fieldKey
          ? a.confidence >= 0.85
            ? '✓'
            : '?'
          : '—';
        return `
          <div class="map-row map-conf-${conf}" data-idx="${i}">
            <div class="map-col-info">
              <span class="map-col-letter">${letter}</span>
              <div class="map-col-text">
                <strong>${escapeHtml(a.headerName)}</strong>
                <span class="map-sample">namuna: ${escapeHtml(sampleForCol(a.colIdx))}</span>
              </div>
            </div>
            <span class="map-arrow">→</span>
            <select class="map-field-select" data-idx="${i}" aria-label="Maydon">
              ${fieldOptionsHtml(a.fieldKey)}
            </select>
            <span class="map-badge" title="Ishonch">${badge}</span>
          </div>
        `;
      })
      .join('');

    list.querySelectorAll('.map-field-select').forEach((sel) => {
      sel.addEventListener('change', () => {
        const idx = parseInt(sel.dataset.idx, 10);
        const val = sel.value || null;
        if (val) {
          state.assignments.forEach((a, j) => {
            if (j !== idx && a.fieldKey === val) a.fieldKey = null;
          });
        }
        state.assignments[idx].fieldKey = val;
        state.assignments[idx].confidence = val ? 1 : 0;
        renderList();
        renderPreview();
      });
    });
  }

  function renderPreview() {
    const wrap = document.getElementById('previewTableWrap');
    if (!wrap) return;
    const mapping = assignmentsToMapping(state.assignments);
    const keys = Object.keys(mapping);
    if (!keys.length || !state.rows.length) {
      wrap.innerHTML = '<p class="preview-empty">Preview uchun kamida bitta ustunni bog\'lang</p>';
      return;
    }
    const opts = getImportFieldOptions();
    const labelOf = (k) => opts.find((o) => o.key === k)?.label || k;
    const previewRows = state.rows.slice(0, 5);
    let html = '<table class="preview-table"><thead><tr>';
    keys.forEach((k) => {
      html += `<th>${escapeHtml(labelOf(k))}</th>`;
    });
    html += '</tr></thead><tbody>';
    previewRows.forEach((row) => {
      const rowArr = Array.isArray(row) ? row : Object.values(row || {});
      html += '<tr>';
      keys.forEach((k) => {
        const v = rowArr[mapping[k]];
        html += `<td>${escapeHtml(v != null && v !== '' ? String(v) : '—')}</td>`;
      });
      html += '</tr>';
    });
    html += '</tbody></table>';
    wrap.innerHTML = html;
  }

  function show({ headers, rows, fileName, invoiceName, preset }) {
    state.headers = headers;
    state.rows = rows;
    state.fileName = fileName || '';
    state.invoiceName = invoiceName || '';
    state.assignments = autoMap(headers, preset || null);

    document.getElementById('uploadCard').hidden = true;
    document.getElementById('mappingCard').hidden = false;
    document.getElementById('pricingSection').hidden = true;

    const inv = document.getElementById('invoiceNameInput');
    if (inv) inv.value = state.invoiceName;
    const fn = document.getElementById('mappingFileName');
    if (fn) fn.textContent = state.fileName || '—';

    renderList();
    renderPreview();
  }

  function getMapping() {
    return assignmentsToMapping(state.assignments);
  }

  function getInvoiceName() {
    const inv = document.getElementById('invoiceNameInput');
    return (inv?.value || state.invoiceName || 'Faktura').trim();
  }

  function bind() {
    document.getElementById('mappingCancelBtn')?.addEventListener('click', () => onCancel?.());
    document.getElementById('mappingSubmitBtn')?.addEventListener('click', () => {
      const mapping = getMapping();
      const check = validateMapping(mapping);
      if (!check.ok) {
        alert(check.error);
        return;
      }
      onSubmit?.({
        mapping,
        rows: state.rows,
        invoiceName: getInvoiceName(),
        fileName: state.fileName
      });
    });
  }

  return { show, bind, getMapping };
}
