import { NDS_RATE } from '../config/fields.js';
import { parseNum, formatMuddati, roundPriceForDisplay, calcFoiz } from '../utils/format.js';

function cell(rowArr, colIdx) {
  if (colIdx == null) return undefined;
  return rowArr[colIdx];
}

/**
 * @param {any[]} rows
 * @param {Record<string, number|null>} mapping fieldKey -> column index
 */
export function parseProducts(rows, mapping) {
  const products = [];
  if (mapping.kelganNarx == null && mapping.prihod == null) return products;

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowArr = Array.isArray(row)
      ? row
      : row && typeof row === 'object'
        ? Object.values(row)
        : [];

    const nomiRaw = mapping.nomi != null ? String(cell(rowArr, mapping.nomi) ?? '').trim() : '';
    const nomi = nomiRaw || `Mahsulot ${i + 1}`;
    const zavod = mapping.zavod != null ? String(cell(rowArr, mapping.zavod) ?? '').trim() : '';
    const soniVal = mapping.soni != null ? parseNum(cell(rowArr, mapping.soni)) : 1;
    const soni = isNaN(soniVal) || soniVal < 1 ? 1 : Math.floor(soniVal);
    const muddatiRaw = mapping.muddati != null ? cell(rowArr, mapping.muddati) : '';
    const muddati = muddatiRaw != null && muddatiRaw !== '' ? muddatiRaw : '';
    const shtrix = mapping.shtrix != null ? String(cell(rowArr, mapping.shtrix) ?? '').trim() : '';
    const mxik = mapping.mxik != null ? String(cell(rowArr, mapping.mxik) ?? '').trim() : '';

    let kelganNarx;
    let ndsSumma;

    const kelganFromExcel = mapping.kelganNarx != null ? parseNum(cell(rowArr, mapping.kelganNarx)) : NaN;
    const prihodFromExcel = mapping.prihod != null ? parseNum(cell(rowArr, mapping.prihod)) : NaN;

    if (!isNaN(kelganFromExcel) && kelganFromExcel > 0) {
      kelganNarx = Math.round(kelganFromExcel * 100) / 100;
      if (mapping.nds != null) {
        const ndsFromExcel = parseNum(cell(rowArr, mapping.nds));
        ndsSumma = !isNaN(ndsFromExcel) && ndsFromExcel >= 0
          ? Math.round((ndsFromExcel / soni) * 100) / 100
          : Math.round(kelganNarx * NDS_RATE * 100) / 100;
      } else {
        ndsSumma = Math.round(kelganNarx * NDS_RATE * 100) / 100;
      }
    } else if (!isNaN(prihodFromExcel) && prihodFromExcel > 0) {
      const ndsFactor = 1 + NDS_RATE;
      ndsSumma = Math.round((prihodFromExcel - prihodFromExcel / ndsFactor) * 100) / 100;
      kelganNarx = Math.round((prihodFromExcel / ndsFactor) * 100) / 100;
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
      shtrix,
      mxik,
      sizningNarx: null,
      foiz: null
    });
  }
  return products;
}

export function applyPercent(products, percent) {
  return products.map((p) => {
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

export { formatMuddati };
