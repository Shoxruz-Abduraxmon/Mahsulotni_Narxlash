/** Server-side field catalog for template + export labels (mirrors public/js/config/fields.js) */

const TEMPLATE_COLUMNS = [
  { header: 'Наименование', key: 'nomi', width: 35 },
  { header: 'Исполнитель', key: 'zavod', width: 25 },
  { header: 'Цена без НДС', key: 'kelganNarx', width: 14 },
  { header: 'Приход с НДС', key: 'prihod', width: 16 },
  { header: 'Сумма НДС', key: 'nds', width: 14 },
  { header: 'Количество', key: 'soni', width: 12 },
  { header: 'Срок годности', key: 'muddati', width: 14 },
  { header: 'Штрих-код', key: 'shtrix', width: 18 },
  { header: 'MXIK', key: 'mxik', width: 16 }
];

const PRODUCT_VALUE_GETTERS = {
  nomi: (p) => p.nomi,
  zavod: (p) => p.zavod || '-',
  kelganNarx: (p) => parseFloat(p.kelganNarx) || '',
  nds: (p) => parseFloat(p.ndsSumma) || '',
  soni: (p) => p.soni || 1,
  muddati: (p) => p.muddati || '-',
  shtrix: (p) => p.shtrix || '',
  mxik: (p) => p.mxik || '',
  sizningNarx: (p) => parseFloat(p.sizningNarx) || parseFloat(p.kelganNarx) || '',
  kelganJami: (p) => parseFloat(p.kelganJami) || '',
  foiz: (p) => p.foiz != null ? p.foiz : ''
};

module.exports = { TEMPLATE_COLUMNS, PRODUCT_VALUE_GETTERS };
