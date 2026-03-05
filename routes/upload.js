const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');
const ExcelJS = require('exceljs');
const { v4: uuidv4 } = require('uuid');

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

  const dataRows = rows.slice(1);
  return { headers, rows: dataRows };
}

// Rounding: 200 / 500 / 1000
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

router.post('/upload', upload.single('excel'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Fayl yuklanmadi' });
    const { headers, rows } = getExcelRaw(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json({ success: true, headers, rows });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message || 'Xatolik' });
  }
});

router.post('/export', async (req, res) => {
  try {
    const { products } = req.body;
    if (!Array.isArray(products) || !products.length) {
      return res.status(400).json({ error: 'Ma\'lumot yo\'q' });
    }

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Prihod', { views: [{ state: 'frozen', ySplit: 1 }] });

    sheet.columns = [
      { header: '№', key: 'no', width: 6 },
      { header: 'Наименование', key: 'nomi', width: 35 },
      { header: 'Исполнитель', key: 'zavod', width: 25 },
      { header: 'Срок годности', key: 'muddati', width: 14 },
      { header: 'Количество', key: 'soni', width: 12 },
      { header: 'Цена без НДС', key: 'kelganNarx', width: 14 },
      { header: 'Ваша цена', key: 'sizningNarx', width: 14 },
      { header: 'Сумма прихода', key: 'prihodSumma', width: 16 },
      { header: 'Сумма НДС', key: 'ndsSumma', width: 14 }
    ];

    sheet.getRow(1).font = { bold: true };
    sheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE8F5E9' }
    };

    let totalPrihod = 0;
    let totalNds = 0;

    products.forEach((p, i) => {
      const sizningNarx = parseFloat(p.sizningNarx) || parseFloat(p.kelganNarx);
      const prihodSumma = sizningNarx * (p.soni || 1);
      const ndsSumma = prihodSumma - prihodSumma / 1.12;

      totalPrihod += prihodSumma;
      totalNds += ndsSumma;

      sheet.addRow({
        no: i + 1,
        nomi: p.nomi,
        zavod: p.zavod || '-',
        muddati: p.muddati || '-',
        soni: p.soni || 1,
        kelganNarx: parseFloat(p.kelganNarx),
        sizningNarx,
        prihodSumma: Math.round(prihodSumma * 100) / 100,
        ndsSumma: Math.round(ndsSumma * 100) / 100
      });
    });

    const buffer = await workbook.xlsx.writeBuffer();
    const filename = `prihod_${Date.now()}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
    res.send(Buffer.from(buffer));
  } catch (err) {
    res.status(500).json({ error: err.message || 'Export xatolik' });
  }
});

module.exports = router;
module.exports.roundPrice = roundPrice;
