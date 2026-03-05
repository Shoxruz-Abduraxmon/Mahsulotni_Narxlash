(function () {
  'use strict';

  const STORAGE_KEY = 'apteka_narxlash';
  const DEFAULT_PERCENT = 10;
  const NDS_RATE = 0.12;
  let productsCache = [];

  function idxToCol(idx) {
    let s = '';
    let n = idx;
    do {
      s = String.fromCharCode(65 + (n % 26)) + s;
      n = Math.floor(n / 26) - 1;
    } while (n >= 0);
    return s;
  }

  function roundPriceForDisplay(value) {
    const v = parseFloat(value);
    if (isNaN(v) || v <= 0) return 0;
    if (v < 400) return Math.round(v / 200) * 200;
    if (v < 1500) return Math.round(v / 500) * 500;
    return Math.round(v / 1000) * 1000;
  }

  function formatNumber(n) {
    if (n == null || isNaN(n)) return '—';
    return new Intl.NumberFormat('ru-RU').format(Math.round(n));
  }

  function formatMuddati(val) {
    if (val == null || val === '') return '—';
    if (typeof val === 'number') {
      const d = new Date((val - 25569) * 86400 * 1000);
      if (isNaN(d.getTime())) return String(val);
      const dd = String(d.getDate()).padStart(2, '0');
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const yyyy = d.getFullYear();
      return `${dd}.${mm}.${yyyy}`;
    }
    const s = String(val).trim();
    const iso = s.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (iso) return `${iso[3]}.${iso[2]}.${iso[1]}`;
    const slash = s.match(/(\d{1,2})[./](\d{1,2})[./](\d{4})/);
    if (slash) {
      const a = parseInt(slash[1], 10);
      const b = parseInt(slash[2], 10);
      let dd, mm;
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

  function calcFoiz(kelgan, sizning) {
    if (!kelgan || kelgan <= 0) return 0;
    return ((sizning / kelgan - 1) * 100).toFixed(1);
  }

  function applyPercent(products, percent) {
    return products.map(p => {
      const base = parseFloat(p.kelganJami) || (parseFloat(p.kelganNarx) || 0) + (parseFloat(p.ndsSumma) || 0);
      const withPercent = base * (1 + percent / 100);
      const displayVal = roundPriceForDisplay(withPercent);
      return {
        ...p,
        sizningNarx: displayVal,
        foiz: calcFoiz(base, displayVal)
      };
    });
  }

  function saveToStorage(products) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        products,
        updated: Date.now()
      }));
    } catch (e) {}
  }

  function loadFromStorage() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      return data.products || null;
    } catch (e) {
      return null;
    }
  }

  function clearStorage() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function renderTable(products) {
    productsCache = products;
    const tbody = document.getElementById('pricingBody');
    if (!tbody) return;

    tbody.innerHTML = products.map((p, i) => {
      const kelganJami = p.kelganJami != null ? p.kelganJami : (parseFloat(p.kelganNarx) || 0) + (parseFloat(p.ndsSumma) || 0);
      const sizning = p.sizningNarx != null ? p.sizningNarx : roundPriceForDisplay(kelganJami * (1 + DEFAULT_PERCENT / 100));
      const foiz = p.foiz != null ? p.foiz : calcFoiz(kelganJami, sizning);
      const ndsDisplay = p.ndsSumma != null ? formatNumber(p.ndsSumma) : '—';
      const muddatiFmt = formatMuddati(p.muddati);
      return `
        <tr data-id="${p.id || i}" data-row="${i}">
          <td class="col-no">${i + 1}</td>
          <td class="col-nomi">${escapeHtml(p.nomi)}</td>
          <td class="col-zavod">${escapeHtml(p.zavod || '—')}</td>
          <td class="col-soni">${p.soni || 1}</td>
          <td class="col-muddati">${escapeHtml(muddatiFmt)}</td>
          <td class="col-kelgan">${formatNumber(p.kelganNarx)}</td>
          <td class="col-nds">${ndsDisplay}</td>
          <td class="col-kelgan-jami">${formatNumber(kelganJami)}</td>
          <td class="col-sizning" tabindex="0" data-kelgan="${kelganJami}">
            <span class="price-display">${formatNumber(sizning)}</span>
            <input type="number" class="price-input" value="${sizning}" min="0" step="1" hidden>
          </td>
          <td class="col-foiz">${foiz}%</td>
        </tr>
      `;
    }).join('');

    updateProgress(products);
    bindPriceCells(tbody, products);
  }

  function escapeHtml(s) {
    if (!s) return '';
    const div = document.createElement('div');
    div.textContent = s;
    return div.innerHTML;
  }

  function updateProgress(products) {
    const el = document.getElementById('progressText');
    if (!el) return;
    const priced = products.filter(p => p.sizningNarx != null && p.sizningNarx > 0).length;
    el.textContent = `${priced} / ${products.length}`;
  }

  function getProductsForExport() {
    const tbody = document.getElementById('pricingBody');
    if (!tbody) return productsCache;
    const rows = tbody.querySelectorAll('tr');
    return productsCache.map((p, i) => {
      const row = rows[i];
      if (!row) return p;
      const kelgan = parseFloat(row.querySelector('.col-sizning')?.dataset?.kelgan) || p.kelganJami || p.kelganNarx;
      const display = row.querySelector('.price-display');
      const input = row.querySelector('.price-input');
      let sizning = p.sizningNarx;
      if (input && !input.hidden) {
        sizning = parseFloat(input.value);
      } else if (display) {
        sizning = parseFloat(display.textContent.replace(/\s/g, '')) || p.sizningNarx;
      }
      return {
        ...p,
        kelganNarx: kelgan,
        sizningNarx: isNaN(sizning) ? kelgan : sizning,
        foiz: calcFoiz(kelgan, sizning),
        muddati: formatMuddati(p.muddati)
      };
    });
  }

  function bindPriceCells(tbody, products) {
    if (!tbody) return;

    tbody.querySelectorAll('.col-sizning').forEach((cell, idx) => {
      const display = cell.querySelector('.price-display');
      const input = cell.querySelector('.price-input');
      const kelgan = parseFloat(cell.dataset.kelgan) || 0;

      function showInput() {
        cell.classList.add('cell-editing');
        display.hidden = true;
        input.hidden = false;
        input.value = display.textContent.replace(/\s/g, '');
        input.focus();
        input.select();
      }

      function hideInput(save) {
        cell.classList.remove('cell-editing');
        display.hidden = false;
        input.hidden = true;
        if (save) {
          const val = parseFloat(input.value);
          if (!isNaN(val) && val >= 0) {
            display.textContent = formatNumber(val);
            input.value = val;
            const foizCell = cell.closest('tr').querySelector('.col-foiz');
            if (foizCell) foizCell.textContent = calcFoiz(kelgan, val) + '%';
            persistFromTable();
          }
        }
      }

      cell.addEventListener('click', (e) => {
        if (e.target === input) return;
        if (!cell.classList.contains('cell-editing')) showInput();
      });

      input.addEventListener('blur', () => hideInput(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          hideInput(true);
          const row = cell.closest('tr');
          const nextRow = row?.nextElementSibling;
          const nextCell = nextRow?.querySelector('.col-sizning');
          if (nextCell && !nextCell.classList.contains('cell-editing')) {
            nextCell.click();
          }
        } else if (e.key === 'Escape') {
          input.value = display.textContent.replace(/\s/g, '');
          hideInput(false);
        }
      });
    });
  }

  function persistFromTable() {
    const products = getProductsForExport();
    if (products.length) {
      productsCache = products;
      saveToStorage(products);
    }
    updateProgress(products);
  }

  function parseNum(val) {
    if (val == null || val === '') return NaN;
    if (typeof val === 'number' && !isNaN(val)) return val;
    const s = String(val).replace(/,/g, '').replace(/\s/g, '').replace(/\u00a0/g, '');
    const n = parseFloat(s);
    return isNaN(n) ? NaN : n;
  }

  function parseWithMapping(rows, mapping) {
    const products = [];
    const hasNdsColumn = mapping.nds != null;

    if (mapping.narx == null) return products;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowArr = Array.isArray(row) ? row : (row && typeof row === 'object' ? Object.values(row) : []);
      const nomi = mapping.nomi != null ? String(rowArr[mapping.nomi] ?? '').trim() : `Mahsulot ${i + 1}`;
      const kelganFromExcel = parseNum(rowArr[mapping.narx]);
      if (isNaN(kelganFromExcel) || kelganFromExcel <= 0) continue;

      const zavod = mapping.zavod != null ? String(rowArr[mapping.zavod] ?? '').trim() : '';
      const soniVal = mapping.soni != null ? parseNum(rowArr[mapping.soni]) : 1;
      const soni = isNaN(soniVal) || soniVal < 1 ? 1 : Math.floor(soniVal);
      const muddatiRaw = mapping.muddati != null ? rowArr[mapping.muddati] : '';
      const muddati = muddatiRaw != null && muddatiRaw !== '' ? muddatiRaw : '';

      const kelganNarx = Math.round(kelganFromExcel * 100) / 100;
      let ndsSumma;

      if (hasNdsColumn) {
        const ndsFromExcel = parseNum(rowArr[mapping.nds]);
        ndsSumma = !isNaN(ndsFromExcel) && ndsFromExcel >= 0
          ? Math.round((ndsFromExcel / soni) * 100) / 100
          : Math.round(kelganNarx * NDS_RATE * 100) / 100;
      } else {
        ndsSumma = Math.round(kelganNarx * NDS_RATE * 100) / 100;
      }

      const kelganJami = Math.round((kelganNarx + ndsSumma) * 100) / 100;

      products.push({
        id: `p_${i + 1}`,
        nomi,
        zavod,
        muddati,
        soni,
        kelganNarx,
        ndsSumma,
        kelganJami,
        sizningNarx: null,
        foiz: null
      });
    }
    return products;
  }

  function showMapping(headers, rows) {
    document.getElementById('uploadCard').hidden = true;
    document.getElementById('mappingCard').hidden = false;
    document.getElementById('pricingSection').hidden = true;

    const emptyOpt = '<option value="">— Tanlamang —</option>';
    const options = headers.map(h => {
      const colLetter = idxToCol(h.idx);
      return `<option value="${h.idx}">${h.idx + 1} (${colLetter}) — ${escapeHtml(h.name)}</option>`;
    }).join('');

    ['mapNomi', 'mapZavod', 'mapNarx', 'mapNds', 'mapSoni', 'mapMuddati'].forEach((id) => {
      const sel = document.getElementById(id);
      if (!sel) return;
      sel.innerHTML = emptyOpt + options;
      sel.required = false;
    });

    window.__EXCEL_ROWS__ = rows;
  }

  function showPricing(products) {
    document.getElementById('uploadSection').hidden = true;
    document.getElementById('pricingSection').hidden = false;
    renderTable(products);
  }

  function showUpload() {
    document.getElementById('uploadSection').hidden = false;
    document.getElementById('uploadCard').hidden = false;
    document.getElementById('mappingCard').hidden = true;
    document.getElementById('pricingSection').hidden = true;
    clearStorage();
    window.__EXCEL_ROWS__ = null;
  }

  function init() {
    const fileInput = document.getElementById('fileInput');
    const selectBtn = document.getElementById('selectBtn');
    const uploadStatus = document.getElementById('uploadStatus');
    const applyAllBtn = document.getElementById('applyAllBtn');
    const exportBtn = document.getElementById('exportBtn');
    const newFileBtn = document.getElementById('newFileBtn');
    const percentBtns = document.querySelectorAll('.btn-percent');

    let currentPercent = DEFAULT_PERCENT;

    selectBtn?.addEventListener('click', () => fileInput?.click());

    fileInput?.addEventListener('change', () => {
      if (!fileInput.files.length) return;
      uploadStatus.textContent = 'Yuklanmoqda...';
      uploadStatus.className = 'upload-status';

      const formData = new FormData();
      formData.append('excel', fileInput.files[0]);

      fetch('/upload', {
        method: 'POST',
        body: formData
      })
        .then(r => r.json())
        .then(data => {
          if (data.error) throw new Error(data.error);
          if (!data.headers || !data.headers.length) throw new Error('Excelda ustunlar topilmadi');
          showMapping(data.headers, data.rows || []);
          uploadStatus.textContent = '';
          fileInput.value = '';
        })
        .catch(err => {
          uploadStatus.textContent = err.message || 'Xatolik yuz berdi';
          uploadStatus.className = 'upload-status error';
        });
    });

    document.getElementById('mappingCancelBtn')?.addEventListener('click', () => {
      fileInput.value = '';
      showUpload();
    });

    document.getElementById('mappingSubmitBtn')?.addEventListener('click', () => {
      function getColIndex(id) {
        const el = document.getElementById(id);
        if (!el || el.value === '' || el.value == null) return null;
        const n = parseInt(el.value, 10);
        return isNaN(n) ? null : n;
      }
      const mapping = {
        nomi: getColIndex('mapNomi'),
        zavod: getColIndex('mapZavod'),
        narx: getColIndex('mapNarx'),
        nds: getColIndex('mapNds'),
        soni: getColIndex('mapSoni'),
        muddati: getColIndex('mapMuddati')
      };
      const rows = window.__EXCEL_ROWS__ || [];
      let products = parseWithMapping(rows, mapping);
      if (!products.length) {
        if (mapping.narx == null) {
          alert('Mahsulot olish uchun Kelgan narx ustunini tanlang.');
        } else if (!rows.length) {
          alert('Excelda ma\'lumot qatorlari yo\'q.');
        } else {
          alert('Hech qanday mahsulot topilmadi. Kelgan narx ustunida musbat raqamlar bo\'lishi kerak.');
        }
        return;
      }
      products = applyPercent(products, currentPercent);
      saveToStorage(products);
      showPricing(products);
    });

    percentBtns?.forEach(btn => {
      btn.addEventListener('click', () => {
        percentBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentPercent = parseInt(btn.dataset.percent, 10);
      });
    });

    applyAllBtn?.addEventListener('click', () => {
      let products = productsCache.length ? productsCache : loadFromStorage();
      if (!products || !products.length) return;
      products = applyPercent(products, currentPercent);
      saveToStorage(products);
      renderTable(products);
    });

    exportBtn?.addEventListener('click', async () => {
      let products = getProductsForExport();
      if (!products.length) products = loadFromStorage();
      if (!products || !products.length) {
        alert('Narxlangan mahsulot yo\'q');
        return;
      }
      exportBtn.disabled = true;
      exportBtn.textContent = 'Yuklanmoqda...';

      try {
        const res = await fetch('/export', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ products })
        });
        if (!res.ok) throw new Error('Export xatolik');
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `prihod_${Date.now()}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        clearStorage();
        showUpload();
      } catch (e) {
        alert(e.message || 'Xatolik');
      } finally {
        exportBtn.disabled = false;
        exportBtn.textContent = 'Excel yuklab olish';
      }
    });

    newFileBtn?.addEventListener('click', () => {
      if (confirm('Yangi fayl yuklasangiz, joriy narxlar o\'chadi. Davom ettirasizmi?')) {
        clearStorage();
        showUpload();
      }
    });

    const saved = loadFromStorage();
    if (saved && saved.length) {
      showPricing(saved);
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
