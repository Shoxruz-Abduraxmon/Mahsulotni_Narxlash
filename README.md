# Apteka Narxlash

Apteka uchun Excel fayllarni narxlash tizimi.

## Ishga tushirish

```bash
npm install
npm start
```

Brauzerda: http://localhost:3000

## Imkoniyatlar

- Excel (.xlsx, .xls) yuklash
- Avtomatik 10% markup (15%, 20% tugmalar bilan)
- Yaxlitlash: 200 / 500 / 1000
- Narxni bosib o'zgartirish
- localStorage — sahifa yangilansa ham narxlar saqlanadi
- Excel export — Prihod formatida (NDS, summa, muddati)

## Excel format

Kirish: **Наименование**, **Цена** (yoki Цена без НДС / Цена с НДС), **Исполнитель**, **Количество**, **Срок годности**
