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

  function hasValue(val) {
    if (val == null) return false;
    if (typeof val === 'string') return String(val).trim() !== '';
    if (typeof val === 'number') return !isNaN(val);
    return true;
  }

  function buildMetaRows(p) {
    const rows = [];
    if (hasValue(p.kelganNarx)) {
      rows.push({ label: 'Kelgan narx', value: formatNumber(p.kelganNarx), type: 'number' });
    }
    if (hasValue(p.soni)) {
      rows.push({ label: 'Soni', value: p.soni, type: 'number' });
    }
    if (hasValue(p.ndsSumma)) {
      rows.push({ label: 'NDS 12%', value: formatNumber(p.ndsSumma), type: 'number' });
    }
    return rows;
  }

  function renderTable(products) {
    productsCache = products;
    const grid = document.getElementById('pricingBody');
    if (!grid) return;

    grid.innerHTML = products.map((p, i) => {
      const kelganJami = p.kelganJami != null ? p.kelganJami : (parseFloat(p.kelganNarx) || 0) + (parseFloat(p.ndsSumma) || 0);
      const sizning = p.sizningNarx != null ? p.sizningNarx : roundPriceForDisplay(kelganJami * (1 + DEFAULT_PERCENT / 100));
      const foiz = p.foiz != null ? p.foiz : calcFoiz(kelganJami, sizning);
      const oxirgiNarx = kelganJami;
      const metaRows = buildMetaRows(p);
      const metaHtml = metaRows.map(r =>
        `<div class="product-meta-row${r.type === 'number' ? ' product-meta-row--number' : ''}"><dt>${escapeHtml(r.label)}</dt><dd>${r.value}</dd></div>`
      ).join('');
      const nomi = hasValue(p.nomi) ? escapeHtml(p.nomi) : '';
      const zavod = hasValue(p.zavod) ? escapeHtml(p.zavod) : '';
      const muddatiFmt = formatMuddati(p.muddati);
      const hasMuddati = hasValue(p.muddati) || muddatiFmt !== '—';
      const hasPrihod = hasValue(kelganJami);
      return `
        <article class="product-card" data-id="${p.id || i}" data-row="${i}" tabindex="0" role="article">
          <div class="product-card-body">
            <div class="product-card-header">
              <span class="dori-label">Dori nomi</span>
              ${nomi ? `<h3 class="product-card-name">${nomi}</h3>` : ''}
              ${zavod ? `<p class="product-card-zavod">${zavod}</p>` : ''}
            </div>
            <div class="product-card-badges">
              ${hasPrihod ? `<span class="prihod-badge">Prihod summa (s NDS): ${formatNumber(kelganJami)}</span>` : ''}
              ${hasMuddati ? `<span class="muddati-badge">${escapeHtml(muddatiFmt)}</span>` : ''}
            </div>
            ${metaRows.length ? `<dl class="product-card-meta">${metaHtml}</dl>` : ''}
            <div class="product-card-sizning" data-kelgan="${kelganJami}" data-prihod="${kelganJami}">
              <label class="sizning-label">Sizning narx</label>
              <p class="sizning-hint" title="Oxirgi narx shows the product's received price (cost with NDS). Read-only reference.">Oxirgi narx = product's received price. Read-only reference.</p>
              <span class="price-display">${formatNumber(sizning)}</span>
              <input type="number" class="price-input" value="${sizning}" min="0" step="1" hidden>
            </div>
            <div class="product-card-oxirgi-row">
              <div class="product-card-oxirgi">
                <span class="oxirgi-label">Oxirgi narx (s NDS)</span>
                <span class="oxirgi-value">${formatNumber(oxirgiNarx)}</span>
              </div>
              <div class="product-card-foiz">
                <span class="foiz-label">%</span>
                <span class="foiz-value">${foiz}%</span>
              </div>
            </div>
          </div>
        </article>
      `;
    }).join('');

    updateProgress(products);
    bindPriceInputs(grid);
    bindCardSelection(grid);
  }

  function bindCardSelection(grid) {
    if (!grid) return;
    const cards = grid.querySelectorAll('.product-card');
    cards.forEach((card, idx) => {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.product-card-sizning')) return;
        cards.forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        card.focus();
      });
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          const next = cards[idx + 1];
          if (next) {
            cards.forEach(c => c.classList.remove('selected'));
            next.classList.add('selected');
            next.focus();
          }
        }
      });
    });
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
    const grid = document.getElementById('pricingBody');
    if (!grid) return productsCache;
    const cards = grid.querySelectorAll('.product-card');
    return productsCache.map((p, i) => {
      const card = cards[i];
      if (!card) return p;
      const sizningEl = card.querySelector('.product-card-sizning');
      const kelgan = parseFloat(sizningEl?.dataset?.kelgan) || p.kelganJami || p.kelganNarx;
      const display = card.querySelector('.price-display');
      const input = card.querySelector('.price-input');
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

  function bindPriceInputs(grid) {
    if (!grid) return;

    grid.querySelectorAll('.product-card-sizning').forEach((wrap, idx) => {
      const display = wrap.querySelector('.price-display');
      const input = wrap.querySelector('.price-input');
      const kelgan = parseFloat(wrap.dataset.kelgan) || 0;
      const cards = grid.querySelectorAll('.product-card');

      function showInput() {
        wrap.classList.add('cell-editing');
        display.hidden = true;
        input.removeAttribute('hidden');
        input.value = display.textContent.replace(/\s/g, '');
        input.disabled = false;
        input.readOnly = false;
        input.focus();
        input.select();
      }

      function updateDerivedValues(val) {
        const card = wrap.closest('.product-card');
        if (!card) return;
        const foizEl = card.querySelector('.foiz-value');
        const v = parseFloat(val);
        if (foizEl) foizEl.textContent = (isNaN(v) || v < 0 ? 0 : calcFoiz(kelgan, v)) + '%';
      }

      function hideInput(save) {
        wrap.classList.remove('cell-editing');
        display.hidden = false;
        input.setAttribute('hidden', '');
        if (save) {
          const val = parseFloat(input.value);
          if (!isNaN(val) && val >= 0) {
            display.textContent = formatNumber(val);
            input.value = val;
            updateDerivedValues(val);
            persistFromTable();
          }
        }
      }

      wrap.addEventListener('click', (e) => {
        e.stopPropagation();
        if (e.target === input) return;
        if (!wrap.classList.contains('cell-editing')) showInput();
      });

      input.addEventListener('input', () => updateDerivedValues(input.value));
      input.addEventListener('blur', () => hideInput(true));
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          hideInput(true);
          const nextCard = cards[idx + 1];
          if (nextCard) {
            const nextWrap = nextCard.querySelector('.product-card-sizning');
            if (nextWrap && !nextWrap.classList.contains('cell-editing')) {
              nextWrap.click();
            }
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

    if (mapping.narx == null && mapping.prihod == null) return products;

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const rowArr = Array.isArray(row) ? row : (row && typeof row === 'object' ? Object.values(row) : []);
      const nomi = mapping.nomi != null ? String(rowArr[mapping.nomi] ?? '').trim() : `Mahsulot ${i + 1}`;

      const zavod = mapping.zavod != null ? String(rowArr[mapping.zavod] ?? '').trim() : '';
      const soniVal = mapping.soni != null ? parseNum(rowArr[mapping.soni]) : 1;
      const soni = isNaN(soniVal) || soniVal < 1 ? 1 : Math.floor(soniVal);
      const muddatiRaw = mapping.muddati != null ? rowArr[mapping.muddati] : '';
      const muddati = muddatiRaw != null && muddatiRaw !== '' ? muddatiRaw : '';

      let kelganNarx;
      let ndsSumma;

      const kelganFromExcel = mapping.narx != null ? parseNum(rowArr[mapping.narx]) : NaN;
      const prihodFromExcel = mapping.prihod != null ? parseNum(rowArr[mapping.prihod]) : NaN;

      if (!isNaN(kelganFromExcel) && kelganFromExcel > 0) {
        kelganNarx = Math.round(kelganFromExcel * 100) / 100;
        if (hasNdsColumn) {
          const ndsFromExcel = parseNum(rowArr[mapping.nds]);
          ndsSumma = !isNaN(ndsFromExcel) && ndsFromExcel >= 0
            ? Math.round((ndsFromExcel / soni) * 100) / 100
            : Math.round(kelganNarx * NDS_RATE * 100) / 100;
        } else {
          ndsSumma = Math.round(kelganNarx * NDS_RATE * 100) / 100;
        }
      } else if (!isNaN(prihodFromExcel) && prihodFromExcel > 0) {
        ndsSumma = Math.round((prihodFromExcel - prihodFromExcel / 1.12) * 100) / 100;
        kelganNarx = Math.round((prihodFromExcel / 1.12) * 100) / 100;
      } else {
        continue;
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

    ['mapNomi', 'mapZavod', 'mapNarx', 'mapPrihod', 'mapNds', 'mapSoni', 'mapMuddati'].forEach((id) => {
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
        prihod: getColIndex('mapPrihod'),
        nds: getColIndex('mapNds'),
        soni: getColIndex('mapSoni'),
        muddati: getColIndex('mapMuddati')
      };
      const rows = window.__EXCEL_ROWS__ || [];
      let products = parseWithMapping(rows, mapping);
      if (!products.length) {
        if (mapping.narx == null && mapping.prihod == null) {
          alert('Mahsulot olish uchun Kelgan narx yoki Prihod summa ustunini tanlang.');
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
