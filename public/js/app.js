import { DEFAULT_PERCENT, exportableColumns, visibilityAfterMapping, getField } from './config/fields.js';
import {
  loadSession,
  saveSession,
  clearSession,
  hasSavedSession,
  loadMappingPreset,
  saveMappingPreset,
  loadVisibility,
  saveVisibility
} from './services/storage.js';
import { parseProducts, applyPercent } from './services/parse.js';
import { invoiceNameFromFile } from './utils/format.js';
import { createMappingController } from './ui/mapping.js';
import { renderCards, collectProductsFromDom } from './ui/cards.js';
import { updateInvoiceBadge, renderVisibilityPanel, bindToolbar } from './ui/toolbar.js';

const state = {
  products: [],
  mapping: {},
  visibility: loadVisibility(),
  invoiceName: '',
  fileName: '',
  uploadedAt: null,
  percent: DEFAULT_PERCENT,
  exportMode: 'visible',
  excelRows: [],
  headers: []
};

function persist() {
  if (document.getElementById('pricingBody')?.querySelector('.product-card')) {
    state.products = collectProductsFromDom(state.products);
  }
  const result = saveSession({
    invoiceName: state.invoiceName,
    fileName: state.fileName,
    uploadedAt: state.uploadedAt,
    mapping: state.mapping,
    visibility: state.visibility,
    products: state.products,
    percent: state.percent,
    exportMode: state.exportMode
  });
  saveVisibility(state.visibility);
  if (!result.ok) {
    alert(result.error || 'Saqlash muvaffaqiyatsiz. Narxlar yo\'qolishi mumkin.');
  }
  const el = document.getElementById('progressText');
  if (el) {
    const priced = state.products.filter((p) => p.sizningNarx != null && p.sizningNarx > 0).length;
    el.textContent = `${priced} / ${state.products.length}`;
  }
  return result.ok;
}

/** Show upload screen. clearData=true only for explicit "Yangi fayl". */
function showUpload({ clearData = false } = {}) {
  document.getElementById('uploadSection').hidden = false;
  document.getElementById('uploadCard').hidden = false;
  document.getElementById('mappingCard').hidden = true;
  document.getElementById('pricingSection').hidden = true;
  if (clearData) {
    clearSession();
    state.products = [];
    state.excelRows = [];
    state.headers = [];
    state.mapping = {};
    state.invoiceName = '';
    state.fileName = '';
    state.uploadedAt = null;
  }
}

function restorePricingFromState() {
  if (!state.products.length) {
    showUpload({ clearData: false });
    return;
  }
  showPricing();
}

function showPricing() {
  document.getElementById('uploadSection').hidden = true;
  document.getElementById('pricingSection').hidden = false;
  updateInvoiceBadge(state.invoiceName);
  renderVisibilityPanel(() => state.visibility, (vis) => {
    state.visibility = vis;
    const r = saveVisibility(vis);
    if (!r.ok) alert(r.error);
    persist();
    renderCards(state.products, state.visibility, {
      onPersist: persist,
      defaultPercent: state.percent
    });
  });
  renderCards(state.products, state.visibility, {
    onPersist: persist,
    defaultPercent: state.percent
  });
}

const mappingCtrl = createMappingController({
  onCancel: () => {
    document.getElementById('fileInput').value = '';
    // Keep existing priced session — do not clearSession
    if (state.products.length) {
      restorePricingFromState();
    } else if (hasSavedSession()) {
      const saved = loadSession();
      if (saved?.products?.length) {
        applySavedSession(saved);
        showPricing();
      } else {
        showUpload({ clearData: false });
      }
    } else {
      showUpload({ clearData: false });
    }
  },
  onSubmit: ({ mapping, rows, invoiceName, fileName }) => {
    let products = parseProducts(rows, mapping);
    if (!products.length) {
      alert('Hech qanday mahsulot topilmadi. Kelgan narx yoki Prihod summada musbat qiymatlar bo\'lishi kerak.');
      return;
    }
    products = applyPercent(products, state.percent);
    state.mapping = mapping;
    state.excelRows = rows;
    state.invoiceName = invoiceName;
    state.fileName = fileName;
    state.uploadedAt = Date.now();
    state.products = products;
    state.visibility = visibilityAfterMapping(mapping, state.visibility);
    saveMappingPreset(mapping, state.headers);
    saveVisibility(state.visibility);
    persist();
    showPricing();
  }
});

async function doExport() {
  persist();
  const products = state.products;
  if (!products.length) {
    alert('Narxlangan mahsulot yo\'q');
    return;
  }

  const columns = exportableColumns(state.visibility, state.mapping, state.exportMode);
  const columnMeta = columns.map((key) => {
    const f = getField(key);
    return {
      key,
      header: f?.exportLabel || f?.label || key,
      width: f?.width || 14
    };
  });

  const exportBtn = document.getElementById('exportBtn');
  exportBtn.disabled = true;
  exportBtn.textContent = 'Yuklanmoqda...';

  try {
    const res = await fetch('/export', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        invoice: {
          name: state.invoiceName,
          fileName: state.fileName,
          uploadedAt: state.uploadedAt
        },
        exportMode: state.exportMode,
        columns: columnMeta,
        products
      })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Export xatolik');
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const safeName = (state.invoiceName || 'prihod').replace(/[^\w\u0400-\u04FF\-]+/g, '_').slice(0, 60);
    a.download = `prihod_${safeName}_${Date.now()}.xlsx`;
    a.click();
    URL.revokeObjectURL(url);
    // Keep session so user can continue editing / re-export
    alert('Excel yuklab olindi. Narxlar saqlanib qoldi — yangi fayl uchun "Yangi fayl" ni bosing.');
  } catch (e) {
    alert(e.message || 'Xatolik');
  } finally {
    exportBtn.disabled = false;
    exportBtn.textContent = 'Excel yuklab olish';
  }
}

function applySavedSession(saved) {
  state.products = saved.products;
  state.mapping = saved.mapping || {};
  state.visibility = saved.visibility || loadVisibility();
  state.invoiceName = saved.invoiceName || '';
  state.fileName = saved.fileName || '';
  state.uploadedAt = saved.uploadedAt || null;
  state.percent = saved.percent ?? DEFAULT_PERCENT;
  state.exportMode = saved.exportMode === 'full' ? 'full' : 'visible';
  document.querySelectorAll('.btn-percent').forEach((b) => {
    b.classList.toggle('active', parseInt(b.dataset.percent, 10) === state.percent);
  });
  const modeRadio = document.querySelector(`input[name="exportMode"][value="${state.exportMode}"]`);
  if (modeRadio) modeRadio.checked = true;
}

function init() {
  mappingCtrl.bind();

  const fileInput = document.getElementById('fileInput');
  const selectBtn = document.getElementById('selectBtn');
  const uploadStatus = document.getElementById('uploadStatus');

  selectBtn?.addEventListener('click', () => fileInput?.click());

  fileInput?.addEventListener('change', () => {
    if (!fileInput.files.length) return;

    if (state.products.length) {
      const ok = confirm(
        'Yangi Excel yuklansa, joriy narxlangan mahsulotlar o\'rniga yangilari keladi.\nDavom ettirasizmi?\n\n(Bekor qilsangiz — eski narxlar saqlanadi.)'
      );
      if (!ok) {
        fileInput.value = '';
        return;
      }
    }

    const file = fileInput.files[0];
    uploadStatus.textContent = 'Yuklanmoqda...';
    uploadStatus.className = 'upload-status';

    const formData = new FormData();
    formData.append('excel', file);

    fetch('/upload', { method: 'POST', body: formData })
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error(data.error);
        if (!data.headers?.length) throw new Error('Excelda ustunlar topilmadi');
        state.headers = data.headers;
        const preset = loadMappingPreset();
        mappingCtrl.show({
          headers: data.headers,
          rows: data.rows || [],
          fileName: file.name,
          invoiceName: invoiceNameFromFile(file.name),
          preset: preset || null
        });
        uploadStatus.textContent = '';
        fileInput.value = '';
      })
      .catch((err) => {
        uploadStatus.textContent = err.message || 'Xatolik yuz berdi';
        uploadStatus.className = 'upload-status error';
      });
  });

  bindToolbar({
    setPercent: (p) => {
      state.percent = p;
      persist();
    },
    onApplyAll: () => {
      if (!state.products.length) return;
      state.products = applyPercent(state.products, state.percent);
      persist();
      renderCards(state.products, state.visibility, {
        onPersist: persist,
        defaultPercent: state.percent
      });
    },
    onExport: doExport,
    onNewFile: () => {
      if (confirm('Yangi fayl yuklasangiz, joriy narxlar o\'chadi. Davom ettirasizmi?')) {
        showUpload({ clearData: true });
      }
    },
    getExportMode: () => state.exportMode,
    setExportMode: (m) => {
      state.exportMode = m;
      persist();
    }
  });

  const saved = loadSession();
  if (saved?.products?.length) {
    applySavedSession(saved);
    showPricing();
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
