import { DEFAULT_PERCENT } from '../config/fields.js';
import {
  escapeHtml,
  formatNumber,
  formatMuddati,
  hasValue,
  roundPriceForDisplay,
  calcFoiz
} from '../utils/format.js';

function isVis(visibility, key) {
  return visibility[key] !== false;
}

function buildMeta(p, visibility) {
  const rows = [];
  if (isVis(visibility, 'kelganNarx') && hasValue(p.kelganNarx)) {
    rows.push({ label: 'Kelgan narx', value: formatNumber(p.kelganNarx), type: 'number' });
  }
  if (isVis(visibility, 'soni') && hasValue(p.soni)) {
    rows.push({ label: 'Soni', value: p.soni, type: 'number' });
  }
  if (isVis(visibility, 'nds') && hasValue(p.ndsSumma)) {
    rows.push({ label: 'NDS 12%', value: formatNumber(p.ndsSumma), type: 'number' });
  }
  if (isVis(visibility, 'shtrix') && hasValue(p.shtrix)) {
    rows.push({ label: 'Shtrix', value: escapeHtml(p.shtrix), type: 'text' });
  }
  if (isVis(visibility, 'mxik') && hasValue(p.mxik)) {
    rows.push({ label: 'MXIK', value: escapeHtml(p.mxik), type: 'text' });
  }
  return rows;
}

export function renderCards(products, visibility, { onPersist, defaultPercent = DEFAULT_PERCENT }) {
  const grid = document.getElementById('pricingBody');
  if (!grid) return;

  const scrollY = window.scrollY;
  const vis = visibility || {};

  grid.innerHTML = products
    .map((p, i) => {
      const kelganJami =
        p.kelganJami != null
          ? p.kelganJami
          : (parseFloat(p.kelganNarx) || 0) + (parseFloat(p.ndsSumma) || 0);
      const sizning =
        p.sizningNarx != null
          ? p.sizningNarx
          : roundPriceForDisplay(kelganJami * (1 + defaultPercent / 100));
      const foiz = p.foiz != null ? p.foiz : calcFoiz(kelganJami, sizning);
      const oxirgiNarx = kelganJami;
      const metaRows = buildMeta(p, vis);
      const metaHtml = metaRows
        .map(
          (r) =>
            `<div class="product-meta-row${r.type === 'number' ? ' product-meta-row--number' : ''}"><dt>${escapeHtml(r.label)}</dt><dd>${r.value}</dd></div>`
        )
        .join('');
      const nomi = hasValue(p.nomi) ? escapeHtml(p.nomi) : '';
      const zavod = isVis(vis, 'zavod') && hasValue(p.zavod) ? escapeHtml(p.zavod) : '';
      const muddatiFmt = formatMuddati(p.muddati);
      const showMuddati = isVis(vis, 'muddati') && (hasValue(p.muddati) || muddatiFmt !== '—');
      const showPrihod = isVis(vis, 'prihod') && hasValue(kelganJami);
      const showFoiz = isVis(vis, 'foiz');
      const showOxirgi = isVis(vis, 'kelganJami');

      return `
        <article class="product-card" data-id="${p.id || i}" data-row="${i}" tabindex="0" role="article">
          <div class="product-card-body">
            <div class="product-card-header">
              <span class="dori-label">Dori nomi</span>
              ${nomi ? `<h3 class="product-card-name">${nomi}</h3>` : ''}
              ${zavod ? `<p class="product-card-zavod">${zavod}</p>` : ''}
            </div>
            <div class="product-card-badges">
              ${showPrihod ? `<span class="prihod-badge">Prihod summa (s NDS): ${formatNumber(kelganJami)}</span>` : ''}
              ${showMuddati ? `<span class="muddati-badge">${escapeHtml(muddatiFmt)}</span>` : ''}
            </div>
            ${metaRows.length ? `<dl class="product-card-meta">${metaHtml}</dl>` : ''}
            <div class="product-card-sizning" data-kelgan="${kelganJami}" data-prihod="${kelganJami}">
              <label class="sizning-label">Sizning narx</label>
              <span class="price-display" data-raw="${sizning}">${formatNumber(sizning)}</span>
              <input type="number" class="price-input" value="${sizning}" min="0" step="1" hidden>
            </div>
            <div class="product-card-oxirgi-row">
              ${
                showOxirgi
                  ? `<div class="product-card-oxirgi">
                <span class="oxirgi-label">Oxirgi narx (s NDS)</span>
                <span class="oxirgi-value">${formatNumber(oxirgiNarx)}</span>
              </div>`
                  : '<div></div>'
              }
              ${
                showFoiz
                  ? `<div class="product-card-foiz">
                <span class="foiz-label">%</span>
                <span class="foiz-value">${foiz}%</span>
              </div>`
                  : ''
              }
            </div>
          </div>
        </article>
      `;
    })
    .join('');

  bindPriceInputs(grid, onPersist);
  bindCardSelection(grid);
  updateProgress(products);
  window.scrollTo(0, scrollY);
}

function updateProgress(products) {
  const el = document.getElementById('progressText');
  if (!el) return;
  const priced = products.filter((p) => p.sizningNarx != null && p.sizningNarx > 0).length;
  el.textContent = `${priced} / ${products.length}`;
}

export function collectProductsFromDom(productsCache) {
  const grid = document.getElementById('pricingBody');
  if (!grid) return productsCache;
  const cards = grid.querySelectorAll('.product-card');
  return productsCache.map((p, i) => {
    const card = cards[i];
    if (!card) return p;
    const sizningEl = card.querySelector('.product-card-sizning');
    const kelganJami = parseFloat(sizningEl?.dataset?.kelgan) || p.kelganJami || p.kelganNarx;
    const display = card.querySelector('.price-display');
    const input = card.querySelector('.price-input');
    let sizning = p.sizningNarx;
    if (input && !input.hasAttribute('hidden')) {
      sizning = parseFloat(input.value);
    } else if (display) {
      const raw = display.dataset.raw;
      sizning = raw != null && raw !== ''
        ? parseFloat(raw)
        : parseFloat(display.textContent.replace(/\s/g, '').replace(/\u00a0/g, '')) || p.sizningNarx;
    }
    return {
      ...p,
      kelganJami,
      sizningNarx: isNaN(sizning) ? kelganJami : sizning,
      foiz: calcFoiz(kelganJami, sizning),
      muddati: formatMuddati(p.muddati)
    };
  });
}

function bindCardSelection(grid) {
  const cards = grid.querySelectorAll('.product-card');
  cards.forEach((card, idx) => {
    card.addEventListener('click', (e) => {
      if (e.target.closest('.product-card-sizning')) return;
      cards.forEach((c) => c.classList.remove('selected'));
      card.classList.add('selected');
      card.focus({ preventScroll: true });
    });
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        const next = cards[idx + 1];
        if (next) {
          cards.forEach((c) => c.classList.remove('selected'));
          next.classList.add('selected');
          next.focus({ preventScroll: true });
        }
      }
    });
  });
}

function bindPriceInputs(grid, onPersist) {
  const cards = [...grid.querySelectorAll('.product-card')];

  grid.querySelectorAll('.product-card-sizning').forEach((wrap, idx) => {
    const display = wrap.querySelector('.price-display');
    const input = wrap.querySelector('.price-input');
    const kelgan = parseFloat(wrap.dataset.kelgan) || 0;
    let suppressBlur = false;

    function showInput() {
      wrap.classList.add('cell-editing');
      display.hidden = true;
      input.removeAttribute('hidden');
      input.value = display.dataset.raw || display.textContent.replace(/\s/g, '').replace(/\u00a0/g, '');
      input.disabled = false;
      input.readOnly = false;
      input.focus({ preventScroll: true });
      input.select();
    }

    function updateFoiz(val) {
      const card = wrap.closest('.product-card');
      const foizEl = card?.querySelector('.foiz-value');
      const v = parseFloat(val);
      if (foizEl) foizEl.textContent = (isNaN(v) || v < 0 ? 0 : calcFoiz(kelgan, v)) + '%';
    }

    function hideInput(save) {
      if (save) {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val >= 0) {
          display.textContent = formatNumber(val);
          display.dataset.raw = String(val);
          input.value = val;
          updateFoiz(val);
        }
      }
      wrap.classList.remove('cell-editing');
      display.hidden = false;
      // Move focus off input BEFORE hiding — otherwise browser jumps to toolbar
      const card = wrap.closest('.product-card');
      if (document.activeElement === input) {
        card?.focus({ preventScroll: true });
      }
      input.setAttribute('hidden', '');
      if (save) onPersist?.();
    }

    wrap.addEventListener('click', (e) => {
      e.stopPropagation();
      if (e.target === input) return;
      if (!wrap.classList.contains('cell-editing')) showInput();
    });

    input.addEventListener('input', () => updateFoiz(input.value));
    input.addEventListener('blur', () => {
      if (suppressBlur) return;
      hideInput(true);
    });
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        suppressBlur = true;
        hideInput(true);
        const nextCard = cards[idx + 1];
        const nextWrap = nextCard?.querySelector('.product-card-sizning');
        suppressBlur = false;
        if (nextWrap && !nextWrap.classList.contains('cell-editing')) {
          requestAnimationFrame(() => nextWrap.click());
        }
      } else if (e.key === 'Escape') {
        e.preventDefault();
        suppressBlur = true;
        input.value = display.dataset.raw || display.textContent.replace(/\s/g, '').replace(/\u00a0/g, '');
        hideInput(false);
        suppressBlur = false;
      }
    });
  });
}

export { updateProgress };
