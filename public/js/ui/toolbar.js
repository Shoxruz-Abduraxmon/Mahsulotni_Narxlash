import { ALL_FIELDS } from '../config/fields.js';
import { escapeHtml } from '../utils/format.js';

export function updateInvoiceBadge(invoiceName) {
  const el = document.getElementById('invoiceBadge');
  if (el) el.textContent = invoiceName || '—';
}

/**
 * @param {Record<string, boolean>|(() => Record<string, boolean>)} visibilityOrGetter
 * @param {(next: Record<string, boolean>) => void} onChange
 */
export function renderVisibilityPanel(visibilityOrGetter, onChange) {
  const panel = document.getElementById('visibilityPanel');
  if (!panel) return;

  const getVisibility = typeof visibilityOrGetter === 'function'
    ? visibilityOrGetter
    : () => visibilityOrGetter;

  const visibility = getVisibility() || {};
  const fields = ALL_FIELDS.filter((f) => f.cardRole && f.key !== 'nomi');

  panel.innerHTML = `
    <div class="vis-modal-header">
      <h2 id="visModalTitle" class="vis-modal-title">Kartada ko‘rinadigan maydonlar</h2>
      <button type="button" class="vis-modal-close" id="visibilityCloseBtn" aria-label="Yopish">&times;</button>
    </div>
    <div class="vis-modal-body">
      ${fields
        .map((f) => {
          const locked = f.lockedVisible;
          const checked = visibility[f.key] !== false;
          return `
          <label class="vis-item${locked ? ' vis-locked' : ''}">
            <input type="checkbox" data-key="${f.key}" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''}>
            <span>${escapeHtml(f.label)}</span>
          </label>`;
        })
        .join('')}
    </div>
    <div class="vis-modal-footer">
      <p class="vis-modal-hint">Faqat kartada. Shtrix/MXIK Excelda har doim chiqadi.</p>
      <button type="button" class="btn btn-primary" id="visibilityDoneBtn">Tayyor</button>
    </div>
  `;

  panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.key;
      const current = getVisibility() || {};
      const next = { ...current, [key]: cb.checked };
      ALL_FIELDS.forEach((f) => {
        if (f.lockedVisible) next[f.key] = true;
      });
      onChange?.(next);
    });
  });

  panel.querySelector('#visibilityCloseBtn')?.addEventListener('click', () => setVisibilityPanelOpen(false));
  panel.querySelector('#visibilityDoneBtn')?.addEventListener('click', () => setVisibilityPanelOpen(false));
}

export function setVisibilityPanelOpen(open) {
  const overlay = document.getElementById('visibilityOverlay');
  const panel = document.getElementById('visibilityPanel');
  const btn = document.getElementById('visibilityToggleBtn');
  if (!overlay) return;

  overlay.hidden = !open;
  document.body.classList.toggle('vis-modal-open', open);
  if (btn) btn.setAttribute('aria-expanded', open ? 'true' : 'false');

  if (open) {
    requestAnimationFrame(() => {
      panel?.querySelector('#visibilityCloseBtn')?.focus({ preventScroll: true });
    });
  } else {
    btn?.focus({ preventScroll: true });
  }
}

export function bindToolbar({
  getPercent,
  setPercent,
  onApplyAll,
  onExport,
  onNewFile,
  onToggleVisibility,
  getExportMode,
  setExportMode
}) {
  document.querySelectorAll('.btn-percent').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.btn-percent').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      setPercent?.(parseInt(btn.dataset.percent, 10));
    });
  });

  document.getElementById('applyAllBtn')?.addEventListener('click', () => onApplyAll?.());
  document.getElementById('exportBtn')?.addEventListener('click', () => onExport?.());
  document.getElementById('newFileBtn')?.addEventListener('click', () => onNewFile?.());

  const toggleBtn = document.getElementById('visibilityToggleBtn');
  if (toggleBtn) {
    toggleBtn.setAttribute('aria-expanded', 'false');
    toggleBtn.setAttribute('aria-controls', 'visibilityOverlay');
    toggleBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const overlay = document.getElementById('visibilityOverlay');
      if (!overlay) return;
      const open = overlay.hidden;
      setVisibilityPanelOpen(open);
      onToggleVisibility?.(open);
    });
  }

  document.getElementById('visibilityOverlay')?.addEventListener('click', (e) => {
    if (e.target.id === 'visibilityOverlay') setVisibilityPanelOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    const overlay = document.getElementById('visibilityOverlay');
    if (overlay && !overlay.hidden) {
      setVisibilityPanelOpen(false);
      onToggleVisibility?.(false);
    }
  });

  document.querySelectorAll('input[name="exportMode"]').forEach((radio) => {
    radio.addEventListener('change', () => {
      if (radio.checked) setExportMode?.(radio.value);
    });
  });

  const mode = getExportMode?.() || 'visible';
  const radio = document.querySelector(`input[name="exportMode"][value="${mode}"]`);
  if (radio) radio.checked = true;
}
