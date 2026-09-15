const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');
const { TEMPLATE_COLUMNS, PRODUCT_VALUE_GETTERS } = require('../config/fieldsCatalog');

const router = express.Router();
const UPLOAD_DIR = path.join(__dirname, '../uploads');

if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => cb(null, `${uuidv4()}_${file.originalname}`)
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (['.xlsx', '.xls'].includes(ext)) cb(null, true);
    else cb(new Error('Faqat .xlsx va .xls formatlari qabul qilinadi'));
  }
});

function getExcelRaw(filePath) {
  const workbook = XLSX.readFile(filePath);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: true });

  if (!rows.length) return { headers: [], rows: [] };

  const headerRow = rows[0];
  const headers = headerRow.map((h, idx) => ({
    idx,
    name: String(h || '').trim() || `(Ustun ${idx + 1})`
  }));

  return { headers, rows: rows.slice(1) };
}

function roundPrice(value) {
  const v = parseFloat(value);
  if (isNaN(v) || v <= 0) return 0;
  if (v < 400) return Math.round(v / 200) * 200;
  if (v < 1500) return Math.round(v / 500) * 500;
  return Math.round(v / 1000) * 1000;
}

router.get('/', (req, res) => {
  res.render('index');
});

router.get('/template', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Shablon');
    sheet.columns = TEMPLATE_COLUMNS.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width
    }));
    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0F2FE' }
    };
    sheet.addRow({
      nomi: 'Namuna dori',
      zavod: 'Ishlab chiqaruvchi',
      kelganNarx: 10000,
      prihod: 11200,
      nds: 1200,
      soni: 1,
      muddati: '01.01.2027',
      shtrix: '4601234567890',
      mxik: '12345678901234567'
    });

    const buffer = await workbook.xlsx.writeBuffer();
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="apteka_shablon.xlsx"');
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Shablon xatolik' });
  }
});

router.post('/upload', upload.single('excel'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });
    const { headers, rows } = getExcelRaw(req.file.path);
    const originalName = req.file.originalname;
    fs.unlinkSync(req.file.path);
    res.json({ success: true, headers, rows, fileName: originalName });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { products, columns, invoice } = req.body;
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ error: 'Ma\'lumot yo\'q' });
    }

    const colDefs = Array.isArray(columns) && columns.length
      ? columns
      : [
          { key: 'nomi', header: 'Наименование', width: 35 },
          { key: 'zavod', header: 'Исполнитель', width: 25 },
          { key: 'muddati', header: 'Срок годности', width: 14 },
          { key: 'soni', header: 'Количество', width: 12 },
          { key: 'kelganNarx', header: 'Цена без НДС', width: 14 },
          { key: 'sizningNarx', header: 'Ваша цена', width: 14 },
          { key: 'kelganJami', header: 'Сумма прихода (ед.)', width: 16 }
        ];

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Prihod', { views: [{ state: 'frozen', ySplit: 2 }] });

    const invoiceName = invoice?.name || '';
    const metaRow = sheet.addRow([`Фактура: ${invoiceName}`, invoice?.fileName || '', invoice?.uploadedAt ? new Date(invoice.uploadedAt).toLocaleString('ru-RU') : '']);
    metaRow.font = { italic: true, color: { argb: 'FF64748B' } };

    const headerLabels = ['№', ...colDefs.map((c) => c.header)];
    const headerRow = sheet.addRow(headerLabels);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' }
    };

    sheet.getColumn(1).width = 6;
    colDefs.forEach((c, i) => {
      sheet.getColumn(i + 2).width = c.width || 14;
    });

    products.forEach((p, i) => {
      const sizningNarx = parseFloat(p.sizningNarx) || parseFloat(p.kelganNarx) || 0;
      const soni = p.soni || 1;
      const rowPrihod = Math.round(sizningNarx * soni * 100) / 100;
      const rowNds = Math.round((rowPrihod - rowPrihod / 1.12) * 100) / 100;

      const values = [i + 1];
      colDefs.forEach((c) => {
        if (c.key === 'prihodSumma') {
          values.push(rowPrihod);
        } else if (c.key === 'ndsSumma') {
          values.push(rowNds);
        } else if (PRODUCT_VALUE_GETTERS[c.key]) {
          values.push(PRODUCT_VALUE_GETTERS[c.key](p));
        } else {
          values.push(p[c.key] != null ? p[c.key] : '');
        }
      });
      sheet.addRow(values);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const safe = String(invoiceName || 'prihod').replace(/[^\w\u0400-\u04FF\-]+/g, '_').slice(0, 40);
    const filename = `prihod_${safe}_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Export xatolik' });
  }
});

module.exports = router;
module.exports.roundPrice = roundPrice;
