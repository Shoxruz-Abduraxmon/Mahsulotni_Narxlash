/** Field Catalog — single source of truth for mapping, cards, visibility, export */

export const NDS_RATE = 0.12;
export const DEFAULT_PERCENT = 10;

/** Importable Excel fields (mapped from columns) */
export const IMPORT_FIELDS = [
  {
    key: 'nomi',
    label: 'Dori nomi',
    exportLabel: 'Наименование',
    type: 'text',
    aliases: ['name', 'nomi', 'наименование', 'наимен', 'dori', 'товар', 'product'],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'header',
    width: 35
  },
  {
    key: 'zavod',
    label: 'Исполнитель',
    exportLabel: 'Исполнитель',
    type: 'text',
    aliases: ['исполнитель', 'zavod', 'производитель', 'manufacturer', 'jobs', 'factory', 'brand'],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'header',
    width: 25
  },
  {
    key: 'kelganNarx',
    label: 'Kelgan narx',
    exportLabel: 'Цена без НДС',
    type: 'number',
    aliases: ['kelgan', 'narx', 'цена', 'price', 'цена без', 'без ндс', 'net'],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'meta',
    width: 14
  },
  {
    key: 'prihod',
    label: 'Prihod summa (s NDS)',
    exportLabel: 'Приход с НДС',
    type: 'number',
    aliases: ['prihod', 'приход', 'сумма приход', 'с ндс', 'with vat', 'jami'],
    required: false,
    defaultVisible: true,
    exportable: false,
    cardRole: 'badge',
    width: 16
  },
  {
    key: 'nds',
    label: 'NDS summa',
    exportLabel: 'Сумма НДС',
    type: 'number',
    aliases: ['nds', 'ндс', 'vat', 'налог'],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'meta',
    width: 14
  },
  {
    key: 'soni',
    label: 'Soni',
    exportLabel: 'Количество',
    type: 'number',
    aliases: ['soni', 'количество', 'qty', 'quantity', 'кол-во', 'miqdor'],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'meta',
    width: 12
  },
  {
    key: 'muddati',
    label: 'Muddati',
    exportLabel: 'Срок годности',
    type: 'date',
    aliases: ['muddati', 'срок', 'expiry', 'годности', 'срок годности', 'date'],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'badge',
    width: 14
  },
  {
    key: 'shtrix',
    label: 'Shtrix code',
    exportLabel: 'Штрих-код',
    type: 'text',
    aliases: ['shtrix', 'штрих', 'barcode', 'ean', 'штрихкод', 'штрих-код'],
    required: false,
    defaultVisible: false,
    exportable: true,
    cardRole: 'meta',
    width: 18
  },
  {
    key: 'mxik',
    label: 'MXIK code',
    exportLabel: 'MXIK',
    type: 'text',
    aliases: ['mxik', 'мхик', 'ikpu', 'икпу'],
    required: false,
    defaultVisible: false,
    exportable: true,
    cardRole: 'meta',
    width: 16
  }
];

/** Computed / UI-only fields */
export const UI_FIELDS = [
  {
    key: 'sizningNarx',
    label: 'Sizning narx',
    exportLabel: 'Ваша цена',
    type: 'number',
    aliases: [],
    required: true,
    defaultVisible: true,
    exportable: true,
    cardRole: 'price',
    lockedVisible: true,
    width: 14
  },
  {
    key: 'kelganJami',
    label: 'Oxirgi narx (s NDS)',
    exportLabel: 'Сумма прихода (ед.)',
    type: 'number',
    aliases: [],
    required: false,
    defaultVisible: true,
    exportable: true,
    cardRole: 'price',
    width: 16
  },
  {
    key: 'foiz',
    label: '% markup',
    exportLabel: '%',
    type: 'number',
    aliases: [],
    required: false,
    defaultVisible: true,
    exportable: false,
    cardRole: 'price',
    width: 8
  }
];

export const ALL_FIELDS = [...IMPORT_FIELDS, ...UI_FIELDS];

export function getField(key) {
  return ALL_FIELDS.find((f) => f.key === key) || null;
}

export function getImportFieldOptions() {
  return IMPORT_FIELDS.map((f) => ({ key: f.key, label: f.label }));
}

export function defaultVisibility() {
  const vis = {};
  ALL_FIELDS.forEach((f) => {
    vis[f.key] = f.defaultVisible !== false;
  });
  return vis;
}

/** Apply mapping: mapped optional fields become visible */
export function visibilityAfterMapping(mapping, baseVisibility) {
  const vis = { ...(baseVisibility || defaultVisibility()) };
  IMPORT_FIELDS.forEach((f) => {
    if (mapping[f.key] != null && f.defaultVisible === false) {
      vis[f.key] = true;
    }
  });
  UI_FIELDS.forEach((f) => {
    if (f.lockedVisible) vis[f.key] = true;
  });
  return vis;
}

/** Always in Excel (identity) — independent of card visibility / mapping */
const ALWAYS_EXPORT_KEYS = ['nomi', 'shtrix', 'mxik'];

/**
 * Card visibility controls on-screen fields only.
 * Export: identity always; "full" = all exportable; "visible" = visible card fields + identity.
 */
export function exportableColumns(visibility, mapping, exportMode) {
  const result = [];
  const pushUnique = (key) => {
    if (!result.includes(key)) result.push(key);
  };

  ALWAYS_EXPORT_KEYS.forEach(pushUnique);

  ALL_FIELDS.forEach((f) => {
    if (!f.exportable) return;
    if (ALWAYS_EXPORT_KEYS.includes(f.key) || f.key === 'prihod') return;

    if (exportMode === 'full') {
      pushUnique(f.key);
      return;
    }

    if (f.lockedVisible || visibility[f.key]) {
      pushUnique(f.key);
    }
  });

  pushUnique('sizningNarx');
  return result;
}
