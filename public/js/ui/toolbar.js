import { ALL_FIELDS } from '../config/fields.js';
import { escapeHtml } from '../utils/format.js';

export function updateInvoiceBadge(invoiceName) {
  const el = document.getElementById('invoiceBadge');
  if (el) el.textContent = invoiceName || '—';
}

export function renderVisibilityPanel(visibility, onChange) {
  const panel = document.getElementById('visibilityPanel');
  if (!panel) return;

  const fields = ALL_FIELDS.filter((f) => f.cardRole);
  panel.innerHTML = fields
    .map((f) => {
      const locked = f.lockedVisible;
      const checked = visibility[f.key] !== false;
      return `
        <label class="vis-item${locked ? ' vis-locked' : ''}">
          <input type="checkbox" data-key="${f.key}" ${checked ? 'checked' : ''} ${locked ? 'disabled' : ''}>
          <span>${escapeHtml(f.label)}</span>
        </label>
      `;
    })
    .join('');

  panel.querySelectorAll('input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', () => {
      const key = cb.dataset.key;
      const next = { ...visibility, [key]: cb.checked };
      ALL_FIELDS.forEach((f) => {
        if (f.lockedVisible) next[f.key] = true;
      });
      onChange?.(next);
    });
  });
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

  document.getElementById('visibilityToggleBtn')?.addEventListener('click', (e) => {
    e.stopPropagation();
    const panel = document.getElementById('visibilityPanel');
    if (!panel) return;
    panel.hidden = !panel.hidden;
    onToggleVisibility?.(panel.hidden);
  });

  document.addEventListener('click', (e) => {
    const wrap = document.querySelector('.visibility-wrap');
    const panel = document.getElementById('visibilityPanel');
    if (!wrap || !panel || panel.hidden) return;
    if (!wrap.contains(e.target)) panel.hidden = true;
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
