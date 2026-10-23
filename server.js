const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { db, isVercel } = require('./db');
const { parseSlipText, classifyByKeywords, analyzeSlipWithGemini } = require('./classifier');

const app = express();
const PORT = process.env.PORT || 3000;

const uploadsDir = isVercel
  ? path.join(os.tmpdir(), 'slipsense-uploads')
  : path.join(__dirname, 'uploads');

try {
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
} catch {
  // ignore
}

app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, 'public')));

// Use memoryStorage so it works on both Vercel Serverless and Local
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
});

function fileToDataUrl(file) {
  if (!file || !file.buffer) return '';
  const mime = file.mimetype || 'image/png';
  return `data:${mime};base64,${file.buffer.toString('base64')}`;
}

async function getGeminiApiKey() {
  const val = await db.getSetting('gemini_api_key');
  return val || (process.env.GEMINI_API_KEY || '');
}

// 1. Get all categories
app.get('/api/categories', async (_req, res) => {
  try {
    const categories = await db.getCategories();
    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Add custom keyword to category
app.post('/api/categories/:id/keywords', async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword } = req.body;
    if (!keyword || !keyword.trim()) {
      return res.status(400).json({ error: 'กรุณาระบุคำค้นหา (Keyword)' });
    }
    const keywords = await db.addCategoryKeyword(id, keyword);
    res.json({ id, keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 3. Delete keyword from category
app.delete('/api/categories/:id/keywords', async (req, res) => {
  try {
    const { id } = req.params;
    const { keyword } = req.body;
    const keywords = await db.deleteCategoryKeyword(id, keyword);
    res.json({ id, keywords });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Analyze uploaded slip
app.post('/api/slips/analyze', upload.single('slip'), async (req, res) => {
  try {
    const categories = await db.getCategories();
    const clientOcrText = req.body.ocr_text || '';
    const useGemini = req.body.use_gemini === 'true';
    const apiKey = await getGeminiApiKey();

    const slipUrl = req.file ? fileToDataUrl(req.file) : '';

    let analysis = null;

    if (useGemini && apiKey && req.file) {
      try {
        analysis = await analyzeSlipWithGemini(req.file.buffer, req.file.mimetype, apiKey, categories);
      } catch (geminiErr) {
        console.warn('Gemini Vision fallback to OCR:', geminiErr.message);
        analysis = parseSlipText(clientOcrText, categories);
        analysis.gemini_warning = geminiErr.message;
      }
    } else {
      analysis = parseSlipText(clientOcrText, categories);
    }

    res.json({
      ...analysis,
      slip_url: slipUrl
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 5. Real-time text classification helper
app.post('/api/classify-text', async (req, res) => {
  try {
    const { text } = req.body;
    const categories = await db.getCategories();
    const result = parseSlipText(text || '', categories);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 6. Get transactions + summary analytics
app.get('/api/transactions', async (req, res) => {
  try {
    const { month, type, category_id, search } = req.query;
    const { transactions, periodRows } = await db.getTransactions({ month, type, category_id, search });

    let totalIncome = 0;
    let totalExpense = 0;
    const categoryMap = {};

    for (const row of periodRows) {
      const amt = Number(row.amount);
      if (row.type === 'income') {
        totalIncome += amt;
      } else {
        totalExpense += amt;
        const catId = row.category_id || 'other_expense';
        if (!categoryMap[catId]) {
          categoryMap[catId] = {
            category_id: catId,
            category_name: row.category_name || 'อื่นๆ',
            category_icon: row.category_icon || '📦',
            category_color: row.category_color || '#64748b',
            total: 0,
            count: 0
          };
        }
        categoryMap[catId].total += amt;
        categoryMap[catId].count += 1;
      }
    }

    const byCategory = Object.values(categoryMap)
      .sort((a, b) => b.total - a.total)
      .map(item => ({
        ...item,
        percentage: totalExpense > 0 ? Math.round((item.total / totalExpense) * 1000) / 10 : 0
      }));

    res.json({
      transactions,
      isCloudDb: db.isCloud,
      summary: {
        totalIncome,
        totalExpense,
        balance: totalIncome - totalExpense,
        transactionCount: periodRows.length,
        byCategory
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 7. Create a transaction
app.post('/api/transactions', upload.single('slip'), async (req, res) => {
  try {
    const categories = await db.getCategories();
    const {
      type = 'expense',
      amount,
      category_id,
      title,
      merchant = '',
      date,
      time = '',
      note = '',
      ocr_text = '',
      matched_keyword = '',
      ref_no = '',
      existing_slip_url = ''
    } = req.body;

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      return res.status(400).json({ error: 'กรุณาระบุจำนวนเงินที่ถูกต้อง' });
    }

    let finalCategoryId = category_id;
    let finalMatchedKw = matched_keyword;
    if (!finalCategoryId) {
      const auto = classifyByKeywords(`${title} ${merchant} ${ocr_text}`, categories);
      finalCategoryId = auto.category_id;
      finalMatchedKw = auto.matchedKeyword;
    }

    const slipUrl = req.file ? fileToDataUrl(req.file) : existing_slip_url;
    const txDate = date || new Date().toISOString().slice(0, 10);
    const txTime = time || new Date().toTimeString().slice(0, 5);
    const txTitle = (title || merchant || 'รายการไม่ระบุชื่อ').trim();

    const created = await db.createTransaction({
      type,
      amount: numAmount,
      category_id: finalCategoryId,
      title: txTitle,
      merchant,
      date: txDate,
      time: txTime,
      note,
      slip_url: slipUrl,
      ocr_text,
      matched_keyword: finalMatchedKw,
      ref_no
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 8. Update a transaction
app.put('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { type, amount, category_id, title, merchant, date, time, note } = req.body;

    const updated = await db.updateTransaction(id, {
      type,
      amount: parseFloat(amount),
      category_id,
      title,
      merchant,
      date,
      time,
      note
    });

    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 9. Delete a transaction
app.delete('/api/transactions/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await db.deleteTransaction(id);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 10. Settings (Gemini API Key)
app.get('/api/settings', async (_req, res) => {
  try {
    const key = await getGeminiApiKey();
    res.json({
      isCloudDb: db.isCloud,
      hasGeminiKey: Boolean(key && key.length > 5),
      maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/settings', async (req, res) => {
  try {
    const { gemini_api_key } = req.body;
    await db.setSetting('gemini_api_key', (gemini_api_key || '').trim());
    const key = await getGeminiApiKey();
    res.json({
      isCloudDb: db.isCloud,
      hasGeminiKey: Boolean(key && key.length > 5),
      maskedKey: key ? `${key.slice(0, 4)}...${key.slice(-4)}` : ''
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 11. Seed realistic demo transactions
function createDemoSlipSvg({ bankName, bankColor, title, merchant, amount, dateText, refNo, memo }) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="420" height="560" viewBox="0 0 420 560">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${bankColor}" stop-opacity="0.14"/>
        <stop offset="100%" stop-color="#ffffff"/>
      </linearGradient>
    </defs>
    <rect width="420" height="560" rx="20" fill="#ffffff" stroke="#e2e8f0" stroke-width="2"/>
    <rect width="420" height="115" rx="20" fill="url(#bg)"/>
    <circle cx="52" cy="56" r="24" fill="${bankColor}"/>
    <path d="M42 56 l7 7 l14 -14" stroke="#ffffff" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
    <text x="90" y="50" font-family="sans-serif" font-size="20" font-weight="bold" fill="#0f172a">${title}</text>
    <text x="90" y="74" font-family="sans-serif" font-size="13" fill="#64748b">${dateText} • ${bankName}</text>

    <line x1="28" y1="120" x2="392" y2="120" stroke="#e2e8f0" stroke-dasharray="4 4"/>

    <text x="32" y="160" font-family="sans-serif" font-size="13" fill="#64748b">จาก</text>
    <text x="120" y="160" font-family="sans-serif" font-size="15" font-weight="bold" fill="#1e293b">นาย สายเปย์ เก็บออมเก่ง</text>
    <text x="120" y="182" font-family="sans-serif" font-size="13" fill="#64748b">xxx-x-x4829-x</text>

    <text x="32" y="232" font-family="sans-serif" font-size="13" fill="#64748b">ไปยัง</text>
    <text x="120" y="232" font-family="sans-serif" font-size="16" font-weight="bold" fill="#0f172a">${merchant}</text>
    <text x="120" y="254" font-family="sans-serif" font-size="13" fill="#64748b">รหัสร้านค้า / พร้อมเพย์</text>

    <line x1="28" y1="290" x2="392" y2="290" stroke="#e2e8f0"/>

    <text x="32" y="340" font-family="sans-serif" font-size="15" fill="#475569">จำนวนเงิน</text>
    <text x="388" y="344" text-anchor="end" font-family="sans-serif" font-size="28" font-weight="bold" fill="${bankColor}">${amount} บาท</text>

    <text x="32" y="382" font-family="sans-serif" font-size="13" fill="#64748b">ค่าธรรมเนียม</text>
    <text x="388" y="382" text-anchor="end" font-family="sans-serif" font-size="14" fill="#334155">0.00 บาท</text>

    <text x="32" y="422" font-family="sans-serif" font-size="13" fill="#64748b">เลขที่รายการ</text>
    <text x="388" y="422" text-anchor="end" font-family="monospace" font-size="13" fill="#334155">${refNo}</text>

    <rect x="28" y="454" width="364" height="64" rx="12" fill="#f8fafc" stroke="#e2e8f0"/>
    <text x="44" y="480" font-family="sans-serif" font-size="12" fill="#64748b">บันทึกช่วยจำ</text>
    <text x="44" y="502" font-family="sans-serif" font-size="14" font-weight="bold" fill="#334155">${memo}</text>
  </svg>`;
}

async function seedDemoTransactionsIfEmpty(force = false) {
  try {
    const count = await db.countTransactions();
    if (count > 0 && !force) return false;

    const today = new Date();
    const yyyyMm = today.toISOString().slice(0, 7);

    const demoItems = [
      {
        type: 'income',
        amount: 45000.00,
        category_id: 'salary',
        title: 'เงินเดือนเข้าบัญชี',
        merchant: 'บริษัท เทคโนโลยี จำกัด (Payroll)',
        date: `${yyyyMm}-01`,
        time: '08:30',
        note: 'เงินเดือนประจำเดือน',
        matched_keyword: 'เงินเดือน',
        ref_no: 'KBANK202610010830',
        slip: {
          bankName: 'K PLUS',
          bankColor: '#16a34a',
          title: 'รับโอนเงินสำเร็จ',
          merchant: 'บริษัท เทคโนโลยี จำกัด (เงินเดือน)',
          amount: '45,000.00',
          dateText: '01 ต.ค. 69 08:30 น.',
          refNo: 'KBANK202610010830',
          memo: 'เงินเดือน Payroll'
        }
      },
      {
        type: 'expense',
        amount: 65.00,
        category_id: 'food',
        title: 'กาแฟ Cafe Amazon',
        merchant: 'บจก. ปตท. น้ำมันและการค้าปลีก (CAFE AMAZON)',
        date: `${yyyyMm}-18`,
        time: '09:15',
        note: 'อเมริกาโน่เย็นไม่หวาน',
        matched_keyword: 'cafe amazon',
        ref_no: 'SCB202610180915',
        slip: {
          bankName: 'SCB EASY',
          bankColor: '#7c3aed',
          title: 'จ่ายเงินสำเร็จ',
          merchant: 'CAFE AMAZON สาขาสยาม',
          amount: '65.00',
          dateText: '18 ต.ค. 69 09:15 น.',
          refNo: 'SCB202610180915',
          memo: 'ค่ากาแฟตอนเช้า'
        }
      },
      {
        type: 'expense',
        amount: 1245.50,
        category_id: 'bills',
        title: 'ค่าไฟฟ้า การไฟฟ้านครหลวง (MEA)',
        merchant: 'การไฟฟ้านครหลวง (MEA)',
        date: `${yyyyMm}-20`,
        time: '19:40',
        note: 'ค่าไฟประจำเดือน',
        matched_keyword: 'การไฟฟ้า',
        ref_no: 'KTB202610201940',
        slip: {
          bankName: 'Krungthai NEXT',
          bankColor: '#0284c7',
          title: 'จ่ายบิลสำเร็จ',
          merchant: 'การไฟฟ้านครหลวง (MEA)',
          amount: '1,245.50',
          dateText: '20 ต.ค. 69 19:40 น.',
          refNo: 'KTB202610201940',
          memo: 'ชำระค่าไฟฟ้าประจำเดือน'
        }
      },
      {
        type: 'expense',
        amount: 850.00,
        category_id: 'transport',
        title: 'เติมน้ำมัน ปตท. PTT Station',
        merchant: 'PTT STATION สาขาวิภาวดี',
        date: `${yyyyMm}-21`,
        time: '17:20',
        note: 'แก๊สโซฮอล์ 95',
        matched_keyword: 'ptt',
        ref_no: 'KBANK202610211720',
        slip: {
          bankName: 'K PLUS',
          bankColor: '#16a34a',
          title: 'โอนเงินสำเร็จ',
          merchant: 'PTT STATION วิภาวดี',
          amount: '850.00',
          dateText: '21 ต.ค. 69 17:20 น.',
          refNo: 'KBANK202610211720',
          memo: 'เติมน้ำมันรถยนต์'
        }
      },
      {
        type: 'expense',
        amount: 599.00,
        category_id: 'shopping',
        title: 'ซื้อของใช้ Shopee',
        merchant: 'SHOPEE (THAILAND) CO., LTD.',
        date: `${yyyyMm}-22`,
        time: '21:10',
        note: 'ทิชชู่และน้ำยาซักผ้า',
        matched_keyword: 'shopee',
        ref_no: 'BBL202610222110',
        slip: {
          bankName: 'Bangkok Bank',
          bankColor: '#1d4ed8',
          title: 'ชำระเงินสำเร็จ',
          merchant: 'SHOPEE THAILAND',
          amount: '599.00',
          dateText: '22 ต.ค. 69 21:10 น.',
          refNo: 'BBL202610222110',
          memo: 'ช้อปปิ้งของใช้เข้าบ้าน'
        }
      },
      {
        type: 'expense',
        amount: 299.00,
        category_id: 'food',
        title: 'สุกี้ตี๋น้อย สาขาลาดพร้าว',
        merchant: 'บจก. บี เอ็น เอ็น เรสเตอรองท์ กรุ๊ป (สุกี้ตี๋น้อย)',
        date: `${yyyyMm}-23`,
        time: '13:05',
        note: 'มื้อเที่ยงกับเพื่อน',
        matched_keyword: 'ตี๋น้อย',
        ref_no: 'KBANK202610231305',
        slip: {
          bankName: 'K PLUS',
          bankColor: '#16a34a',
          title: 'สแกนจ่ายสำเร็จ',
          merchant: 'สุกี้ตี๋น้อย สาขาลาดพร้าว',
          amount: '299.00',
          dateText: '23 ต.ค. 69 13:05 น.',
          refNo: 'KBANK202610231305',
          memo: 'ค่าอาหารบุฟเฟ่ต์สุกี้ตี๋น้อย'
        }
      }
    ];

    for (const item of demoItems) {
      const svgContent = createDemoSlipSvg(item.slip);
      const dataUrl = `data:image/svg+xml;base64,${Buffer.from(svgContent, 'utf8').toString('base64')}`;
      const ocrText = `${item.slip.title}\n${item.slip.dateText}\nไปยัง ${item.merchant}\nจำนวนเงิน ${item.slip.amount} บาท\nเลขที่รายการ ${item.ref_no}\nบันทึกช่วยจำ ${item.slip.memo}`;

      await db.createTransaction({
        type: item.type,
        amount: item.amount,
        category_id: item.category_id,
        title: item.title,
        merchant: item.merchant,
        date: item.date,
        time: item.time,
        note: item.note,
        slip_url: dataUrl,
        ocr_text: ocrText,
        matched_keyword: item.matched_keyword,
        ref_no: item.ref_no
      });
    }
    return true;
  } catch (err) {
    console.error('Seed demo error:', err);
    return false;
  }
}

// Only auto-seed demo data for local/offline mode. With a Cloud DB this would re-insert
// demo rows on every cold start after the user deletes everything.
if (!db.isCloud) {
  seedDemoTransactionsIfEmpty(false);
}

app.post('/api/demo/seed', async (_req, res) => {
  try {
    await seedDemoTransactionsIfEmpty(true);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`SlipSense Expense Tracker running at http://localhost:${PORT}`);
  });
}

module.exports = app;
