const THAI_MONTHS = {
  'ม.ค.': '01', 'มกราคม': '01', 'jan': '01',
  'ก.พ.': '02', 'กุมภาพันธ์': '02', 'feb': '02',
  'มี.ค.': '03', 'มีนาคม': '03', 'mar': '03',
  'เม.ย.': '04', 'เมษายน': '04', 'apr': '04',
  'พ.ค.': '05', 'พฤษภาคม': '05', 'may': '05',
  'มิ.ย.': '06', 'มิถุนายน': '06', 'jun': '06',
  'ก.ค.': '07', 'กรกฎาคม': '07', 'jul': '07',
  'ส.ค.': '08', 'สิงหาคม': '08', 'aug': '08',
  'ก.ย.': '09', 'กันยายน': '09', 'sep': '09',
  'ต.ค.': '10', 'ตุลาคม': '10', 'oct': '10',
  'พ.ย.': '11', 'พฤศจิกายน': '11', 'nov': '11',
  'ธ.ค.': '12', 'ธันวาคม': '12', 'dec': '12'
};

/**
 * Extracts amount, recipient/merchant, date, time, reference number, and category
 * from raw Thai bank slip OCR text.
 */
function parseSlipText(rawText, categories) {
  const text = (rawText || '').trim();
  const lines = text
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(Boolean);

  // 1. Extract Amount (จำนวนเงิน)
  let amount = null;
  const amountPatterns = [
    /(?:จำนวน(?:เงิน)?|ยอด(?:เงิน|ชำระ|โอน)?|amount|total)\s*[:\-]?\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})|[0-9]+(?:\.[0-9]{2}))\s*(?:บาท|thb|฿)?/i,
    /([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\s*(?:บาท|thb|฿)/i,
    /(?:฿|thb)\s*([0-9]{1,3}(?:,[0-9]{3})*(?:\.[0-9]{2})?)/i
  ];

  for (const pattern of amountPatterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const val = parseFloat(match[1].replace(/,/g, ''));
      if (!isNaN(val) && val > 0) {
        amount = val;
        break;
      }
    }
  }

  // Fallback: look for decimal numbers like 125.00 that are not fee (0.00)
  if (amount === null) {
    const allDecimals = [...text.matchAll(/\b([0-9]{1,3}(?:,[0-9]{3})*\.[0-9]{2})\b/g)];
    const candidates = allDecimals
      .map(m => parseFloat(m[1].replace(/,/g, '')))
      .filter(n => !isNaN(n) && n > 0);
    if (candidates.length > 0) {
      amount = candidates[0];
    }
  }

  // 2. Extract Time (HH:MM)
  let time = '';
  const timeMatch = text.match(/\b([01]?[0-9]|2[0-3]):([0-5][0-9])(?::[0-5][0-9])?\s*(?:น\.?)?/);
  if (timeMatch) {
    time = `${timeMatch[1].padStart(2, '0')}:${timeMatch[2]}`;
  }

  // 3. Extract Date (YYYY-MM-DD)
  let date = new Date().toISOString().slice(0, 10);
  // Check Thai date pattern e.g. 23 ต.ค. 69 or 23 ต.ค. 2569 or 23 Oct 2026
  const thaiDateRegex = /(\d{1,2})\s+(ม\.ค\.|ก\.พ\.|มี\.ค\.|เม\.ย\.|พ\.ค\.|มิ\.ย\.|ก\.ค\.|ส\.ค\.|ก\.ย\.|ต\.ค\.|พ\.ย\.|ธ\.ค\.|มกราคม|กุมภาพันธ์|มีนาคม|เมษายน|พฤษภาคม|มิถุนายน|กรกฎาคม|สิงหาคม|กันยายน|ตุลาคม|พฤศจิกายน|ธันวาคม|jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+(\d{2,4})/i;
  const dateMatch = text.match(thaiDateRegex);
  if (dateMatch) {
    const day = dateMatch[1].padStart(2, '0');
    const monthKey = dateMatch[2].toLowerCase();
    const month = THAI_MONTHS[monthKey] || '01';
    let yearNum = parseInt(dateMatch[3], 10);
    if (yearNum < 100) {
      // 2-digit year: e.g. 69 (Buddhist) -> 2569 - 543 = 2026, or 26 (CE) -> 2026
      yearNum = yearNum > 45 ? 2500 + yearNum - 543 : 2000 + yearNum;
    } else if (yearNum > 2400) {
      yearNum -= 543;
    }
    date = `${yearNum}-${month}-${day}`;
  } else {
    // Check numeric date DD/MM/YYYY or YYYY-MM-DD
    const isoMatch = text.match(/\b(20\d{2})[-/](\d{2})[-/](\d{2})\b/);
    if (isoMatch) {
      date = `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }
  }

  // 4. Extract Reference No.
  let refNo = '';
  const refMatch = text.match(/(?:เลขที่รายการ|รหัสอ้างอิง|เลขที่อ้างอิง|ref(?:\.\s*no)?)\s*[:\-]?\s*([A-Za-z0-9]{8,30})/i);
  if (refMatch) {
    refNo = refMatch[1];
  }

  // 5. Extract Merchant / Recipient (ผู้รับเงิน / ร้านค้า)
  let merchant = '';
  const recipientMarkers = [
    /(?:ไปยัง|ผู้รับเงิน|โอนให้|จ่ายบิล|ร้านค้า|ผู้รับ|to)\s*[:\-]?\s*(.+)/i
  ];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const marker of recipientMarkers) {
      const m = line.match(marker);
      if (m && m[1] && m[1].trim().length > 1) {
        merchant = m[1].trim();
        break;
      }
    }
    if (!merchant && /^(ไปยัง|ผู้รับเงิน|โอนให้|to)$/i.test(line) && lines[i + 1]) {
      merchant = lines[i + 1].trim();
    }
    if (merchant) break;
  }

  // 6. Classify Category & Type based on Keywords
  const classification = classifyByKeywords(`${merchant} ${text}`, categories);

  // Build a friendly title
  let title = merchant || '';
  if (!title) {
    if (classification.matchedKeyword) {
      title = `รายการ ${classification.matchedKeyword}`;
    } else {
      title = classification.type === 'income' ? 'รายรับจากสลิป' : 'รายจ่ายจากสลิป';
    }
  }

  return {
    amount: amount || 0,
    type: classification.type,
    category_id: classification.category_id,
    category_name: classification.category_name,
    category_icon: classification.category_icon,
    matched_keyword: classification.matchedKeyword,
    confidence: classification.confidence,
    title,
    merchant,
    date,
    time: time || new Date().toTimeString().slice(0, 5),
    ref_no: refNo,
    ocr_text: text
  };
}

/**
 * Classifies text against category keywords.
 */
function classifyByKeywords(text, categories) {
  const normalized = (text || '').toLowerCase();

  let bestCategory = null;
  let matchedKeyword = '';
  let bestScore = 0;

  for (const cat of categories) {
    let keywords = [];
    try {
      keywords = typeof cat.keywords === 'string' ? JSON.parse(cat.keywords) : cat.keywords;
    } catch {
      keywords = [];
    }

    for (const kw of keywords) {
      const kwLower = kw.toLowerCase().trim();
      if (!kwLower) continue;
      if (normalized.includes(kwLower)) {
        // Longer keyword matches are more specific and score higher
        const score = kwLower.length + 10;
        if (score > bestScore) {
          bestScore = score;
          bestCategory = cat;
          matchedKeyword = kw;
        }
      }
    }
  }

  if (bestCategory) {
    return {
      type: bestCategory.type,
      category_id: bestCategory.id,
      category_name: bestCategory.name,
      category_icon: bestCategory.icon,
      matchedKeyword,
      confidence: 'high'
    };
  }

  // Fallback to default expense (or food/other_expense)
  const fallback = categories.find(c => c.id === 'other_expense') || categories[0];
  return {
    type: fallback ? fallback.type : 'expense',
    category_id: fallback ? fallback.id : 'other_expense',
    category_name: fallback ? fallback.name : 'รายจ่ายอื่นๆ',
    category_icon: fallback ? fallback.icon : '📦',
    matchedKeyword: '',
    confidence: 'low'
  };
}

/**
 * Optional Gemini Vision API analyzer when user configures a Gemini API Key.
 */
async function analyzeSlipWithGemini(imageBuffer, mimeType, apiKey, categories) {
  const categorySummary = categories.map(c => ({
    id: c.id,
    name: c.name,
    type: c.type
  }));

  const prompt = `คุณคือระบบอ่านสลิปธนาคารและใบเสร็จภาษาไทย กรุณาอ่านข้อมูลจากรูปสลิปนี้และส่งกลับเป็น JSON เท่านั้น โดยมีโครงสร้างดังนี้:
{
  "type": "expense" หรือ "income",
  "amount": ตัวเลขจำนวนเงิน (เช่น 125.50),
  "category_id": เลือก id หมวดหมู่ที่ตรงที่สุดจากรายการนี้: ${JSON.stringify(categorySummary)},
  "title": ชื่อรายการสั้นๆ ที่เข้าใจง่าย (เช่น "กาแฟ Cafe Amazon", "ค่าไฟ PEA", "เซเว่น CP ALL"),
  "merchant": ชื่อผู้รับโอนหรือร้านค้าจากสลิป,
  "date": วันที่ในรูปแบบ "YYYY-MM-DD" (แปลง พ.ศ. เป็น ค.ศ. เช่น 2569 -> 2026),
  "time": เวลาในรูปแบบ "HH:MM",
  "ref_no": เลขที่รายการ/รหัสอ้างอิง,
  "matched_keyword": คำสำคัญที่ใช้ตัดสินหมวดหมู่,
  "ocr_text": ข้อความทั้งหมดที่อ่านได้จากสลิป
}`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${encodeURIComponent(apiKey)}`;
  const body = {
    contents: [
      {
        parts: [
          { text: prompt },
          {
            inline_data: {
              mime_type: mimeType || 'image/png',
              data: imageBuffer.toString('base64')
            }
          }
        ]
      }
    ],
    generationConfig: {
      responseMimeType: 'application/json'
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errText}`);
  }

  const data = await response.json();
  const rawJson = data?.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  const parsed = JSON.parse(rawJson);
  const cat = categories.find(c => c.id === parsed.category_id) || categories.find(c => c.id === 'other_expense');

  return {
    amount: Number(parsed.amount) || 0,
    type: cat ? cat.type : (parsed.type || 'expense'),
    category_id: cat ? cat.id : 'other_expense',
    category_name: cat ? cat.name : 'รายจ่ายอื่นๆ',
    category_icon: cat ? cat.icon : '📦',
    matched_keyword: parsed.matched_keyword || 'AI วิเคราะห์จากสลิป',
    confidence: 'ai',
    title: parsed.title || parsed.merchant || 'รายการจากสลิป',
    merchant: parsed.merchant || '',
    date: parsed.date || new Date().toISOString().slice(0, 10),
    time: parsed.time || new Date().toTimeString().slice(0, 5),
    ref_no: parsed.ref_no || '',
    ocr_text: parsed.ocr_text || ''
  };
}

module.exports = {
  parseSlipText,
  classifyByKeywords,
  analyzeSlipWithGemini
};
