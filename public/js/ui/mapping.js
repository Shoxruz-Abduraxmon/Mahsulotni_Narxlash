import { getImportFieldOptions } from '../config/fields.js';
import { autoMap, assignmentsToMapping, validateMapping } from '../services/autoMap.js';
import { idxToCol, escapeHtml } from '../utils/format.js';

/**
 * Excel-like horizontal mapping: columns side-by-side, live sheet preview below.
 */
export function createMappingController({ onCancel, onSubmit }) {
  let state = {
    headers: [],
    rows: [],
    assignments: [],
    invoiceName: '',
    fileName: ''
  };

  function rowArrOf(row) {
    return Array.isArray(row) ? row : Object.values(row || {});
  }

  function cellText(row, colIdx) {
    const v = rowArrOf(row)[colIdx];
    if (v == null || String(v).trim() === '') return '';
    return String(v);
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

  function confClass(a) {
    if (!a.fieldKey) return 'idle';
    if (a.confidence >= 0.85) return 'high';
    if (a.confidence >= 0.7) return 'mid';
    return 'low';
  }

  function confBadge(a) {
    if (!a.fieldKey) return '—';
    if (a.confidence >= 0.85) return '✓';
    return '?';
  }

  function labelOf(key) {
    return getImportFieldOptions().find((o) => o.key === key)?.label || key;
  }

  /** Horizontal Excel header strip + map dropdowns */
  function renderSheet() {
    const list = document.getElementById('mappingList');
    if (!list) return;

    const cols = state.assignments
      .map((a, i) => {
        const letter = idxToCol(a.colIdx);
        const conf = confClass(a);
        return `
          <div class="excel-col map-conf-${conf}" data-idx="${i}">
            <div class="excel-col-letter">${letter}</div>
            <div class="excel-col-header" title="${escapeHtml(a.headerName)}">${escapeHtml(a.headerName)}</div>
            <div class="excel-col-map">
              <span class="excel-col-badge" title="Avtomatik tanlov">${confBadge(a)}</span>
              <select class="map-field-select" data-idx="${i}" aria-label="Ustun ${letter}">
                ${fieldOptionsHtml(a.fieldKey)}
              </select>
            </div>
          </div>
        `;
      })
      .join('');

    list.innerHTML = `
      <div class="excel-map-scroll">
        <div class="excel-map-strip" role="list">${cols}</div>
      </div>
      <p class="excel-map-tip">Har bir ustun ostidan tanlang: bu Excel ustuni tizimda nima. ✓ — tayyor, ? — tekshiring.</p>
    `;

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
        renderSheet();
        renderPreview();
      });
    });
  }

  /** Full-width Excel-like preview: all columns, mapped header labels on top */
  function renderPreview() {
    const wrap = document.getElementById('previewTableWrap');
    if (!wrap) return;
    if (!state.assignments.length) {
      wrap.innerHTML = '<p class="preview-empty">Excel ma\'lumoti yo\'q</p>';
      return;
    }

    const previewRows = state.rows.slice(0, 8);
    let html = '<div class="excel-preview-scroll"><table class="excel-preview-table"><thead>';

    // Letter row
    html += '<tr class="excel-letters">';
    html += '<th class="excel-row-num"></th>';
    state.assignments.forEach((a) => {
      html += `<th>${idxToCol(a.colIdx)}</th>`;
    });
    html += '</tr>';

    // Original Excel header
    html += '<tr class="excel-headers">';
    html += '<th class="excel-row-num">1</th>';
    state.assignments.forEach((a) => {
      html += `<th title="${escapeHtml(a.headerName)}">${escapeHtml(a.headerName)}</th>`;
    });
    html += '</tr>';

    // Mapped system field (what user chose)
    html += '<tr class="excel-mapped">';
    html += '<th class="excel-row-num"></th>';
    state.assignments.forEach((a) => {
      const mapped = a.fieldKey ? escapeHtml(labelOf(a.fieldKey)) : '—';
      const cls = a.fieldKey ? 'is-mapped' : 'is-idle';
      html += `<th class="${cls}">${mapped}</th>`;
    });
    html += '</tr></thead><tbody>';

    previewRows.forEach((row, ri) => {
      html += '<tr>';
      html += `<td class="excel-row-num">${ri + 2}</td>`;
      state.assignments.forEach((a) => {
        const text = cellText(row, a.colIdx);
        const mappedCls = a.fieldKey ? 'col-mapped' : '';
        html += `<td class="${mappedCls}" title="${escapeHtml(text)}">${escapeHtml(text || '—')}</td>`;
      });
      html += '</tr>';
    });

    html += '</tbody></table></div>';
    if (!state.rows.length) {
      html += '<p class="preview-empty">Ma\'lumot qatorlari yo\'q</p>';
    }
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

    renderSheet();
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
