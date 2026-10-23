const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
const dataDir = isVercel
  ? path.join(os.tmpdir(), 'slipsense-data')
  : path.join(__dirname, 'data');

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch {
  // Ignore if tmpdir already exists
}

const DEFAULT_CATEGORIES = [
  {
    id: 'food',
    name: 'อาหารและเครื่องดื่ม',
    type: 'expense',
    icon: '🍜',
    color: '#f97316',
    keywords: [
      'อาหาร', 'ข้าว', 'ก๋วยเตี๋ยว', 'คาเฟ่', 'กาแฟ', 'ชา', 'ชานม', 'เครื่องดื่ม', 'เบเกอรี่',
      'ร้านอาหาร', 'หมูกระทะ', 'ชาบู', 'บุฟเฟ่ต์', 'สุกี้', 'ตี๋น้อย', 'mk', 'kfc', 'mcdonald',
      'pizza', 'starbucks', 'cafe amazon', 'อเมซอน', 'พันธุ์ไทย', 'punthai', 'อินทนิล', 'inthanin',
      'เต่าบิน', 'taobin', 'grabfood', 'lineman', 'foodpanda', 'shopeefood', 'robinhood',
      'after you', 'swensen', 'dairy queen', 'bonchon', 'sizzler', 'bar b q plaza', 'บาร์บีคิวพลาซ่า',
      'ยาโยอิ', 'yayoi', 'oishi', 'fuji', 'เซเว่น', '7-eleven', '7-11', 'cp all', 'ซีพี ออลล์'
    ]
  },
  {
    id: 'transport',
    name: 'เดินทางและยานพาหนะ',
    type: 'expense',
    icon: '🚗',
    color: '#3b82f6',
    keywords: [
      'เดินทาง', 'ค่ารถ', 'แท็กซี่', 'taxi', 'วิน', 'รถไฟฟ้า', 'bts', 'mrt', 'arl', 'ทางด่วน',
      'easy pass', 'm-flow', 'น้ำมัน', 'เติมน้ำมัน', 'ปตท', 'ptt', 'or', 'บางจาก', 'bangchak',
      'shell', 'เชลล์', 'caltex', 'คาลเท็กซ์', 'pt', 'พีที', 'grab', 'bolt', 'indrive',
      'ที่จอดรถ', 'จอดรถ', 'ล้างรถ', 'ซ่อมรถ', 'ประกันรถ', 'ตั๋วเครื่องบิน', 'airasia', 'nokair'
    ]
  },
  {
    id: 'shopping',
    name: 'ช้อปปิ้งและของใช้',
    type: 'expense',
    icon: '🛍️',
    color: '#ec4899',
    keywords: [
      'ช้อปปิ้ง', 'ของใช้', 'เสื้อผ้า', 'รองเท้า', 'กระเป๋า', 'เครื่องสำอาง', 'สกินแคร์',
      'shopee', 'ช้อปปี้', 'lazada', 'ลาซาด้า', 'tiktok shop', 'central', 'เซ็นทรัล', 'robinson',
      'the mall', 'siam paragon', 'icon siam', 'uniqlo', 'zara', 'h&m', 'eveandboy', 'beautrium',
      'watsons', 'วัตสัน', 'boots', 'บู๊ทส์', 'lotus', 'โลตัส', 'big c', 'บิ๊กซี', 'makro', 'แม็คโคร',
      'tops', 'ท็อปส์', 'gourmet', 'villa market', 'cj more', 'ซีเจ', 'mr.diy', 'ikea', 'อิเกีย',
      'homepro', 'โฮมโปร', 'advice', 'jib', 'banana'
    ]
  },
  {
    id: 'bills',
    name: 'บิลและสาธารณูปโภค',
    type: 'expense',
    icon: '💡',
    color: '#eab308',
    keywords: [
      'ค่าไฟ', 'การไฟฟ้า', 'pea', 'mea', 'ค่าน้ำ', 'การประปา', 'mwa', 'pwa', 'ค่าเน็ต', 'อินเทอร์เน็ต',
      'ค่าโทรศัพท์', 'มือถือ', 'เติมเงิน', 'รายเดือน', 'ais', 'เอไอเอส', 'awn', 'แอดวานซ์',
      'true', 'ทรู', 'dtac', 'ดีแทค', '3bb', 'nt', 'บัตรเครดิต', 'สินเชื่อ', 'ผ่อน', 'spaylater',
      'lazpaylater', 'ค่าส่วนกลาง'
    ]
  },
  {
    id: 'housing',
    name: 'ที่อยู่อาศัยและของแต่งบ้าน',
    type: 'expense',
    icon: '🏠',
    color: '#8b5cf6',
    keywords: [
      'ค่าเช่า', 'เช่าหอ', 'หอพัก', 'อพาร์ทเม้นท์', 'คอนโด', 'ผ่อนบ้าน', 'ผ่อนคอนโด',
      'ซ่อมบ้าน', 'เฟอร์นิเจอร์', 'แม่บ้าน', 'ทำความสะอาด', 'ซักรีด', 'ร้านซักผ้า', 'otteri'
    ]
  },
  {
    id: 'entertainment',
    name: 'บันเทิงและไลฟ์สไตล์',
    type: 'expense',
    icon: '🎬',
    color: '#a855f7',
    keywords: [
      'ดูหนัง', 'ภาพยนตร์', 'major', 'เมเจอร์', 'sf cinema', 'เอสเอฟ', 'netflix', 'youtube',
      'spotify', 'apple', 'google play', 'steam', 'เกม', 'เติมเกม', 'คอนเสิร์ต', 'ท่องเที่ยว',
      'โรงแรม', 'ที่พัก', 'agoda', 'booking', 'traveloka', 'klook', 'ปาร์ตี้', 'สังสรรค์'
    ]
  },
  {
    id: 'health',
    name: 'สุขภาพและการแพทย์',
    type: 'expense',
    icon: '🏥',
    color: '#10b981',
    keywords: [
      'โรงพยาบาล', 'รพ.', 'คลินิก', 'หมอ', 'ทำฟัน', 'ทันตกรรม', 'ร้านยา', 'ขายยา', 'เภสัช',
      'ยา', 'วิตามิน', 'อาหารเสริม', 'ฟิตเนส', 'ออกกำลังกาย', 'fitness', 'jetts', 'แว่นตา',
      'ตรวจสุขภาพ', 'ประกันสุขภาพ', 'ประกันชีวิต', 'aia', 'เมืองไทยประกันชีวิต', 'ไทยประกันชีวิต'
    ]
  },
  {
    id: 'other_expense',
    name: 'รายจ่ายอื่นๆ',
    type: 'expense',
    icon: '📦',
    color: '#64748b',
    keywords: [
      'ทำบุญ', 'บริจาค', 'ใส่ซอง', 'ของขวัญ', 'ค่าธรรมเนียม', 'ไปรษณีย์', 'kerry', 'flash', 'j&t',
      'โอนเงิน', 'อื่นๆ'
    ]
  },
  {
    id: 'salary',
    name: 'เงินเดือน',
    type: 'income',
    icon: '💰',
    color: '#059669',
    keywords: ['เงินเดือน', 'salary', 'payroll', 'ค่าจ้าง']
  },
  {
    id: 'freelance',
    name: 'รายได้เสริม / ค้าขาย',
    type: 'income',
    icon: '📈',
    color: '#0d9488',
    keywords: ['ฟรีแลนซ์', 'freelance', 'ค่าคอม', 'ขายของ', 'ลูกค้าโอน', 'รับจ้าง', 'ปันผล']
  },
  {
    id: 'gift',
    name: 'โบนัส / ของขวัญ',
    type: 'income',
    icon: '🎁',
    color: '#14b8a6',
    keywords: ['โบนัส', 'bonus', 'แต๊ะเอีย', 'ของขวัญ', 'รางวัล', 'ถูกหวย']
  },
  {
    id: 'other_income',
    name: 'รายรับอื่นๆ',
    type: 'income',
    icon: '💵',
    color: '#10b981',
    keywords: ['คืนเงิน', 'refund', 'ดอกเบี้ย', 'รายรับอื่นๆ']
  }
];

let db = null;

try {
  const { DatabaseSync } = require('node:sqlite');
  const dbPath = path.join(dataDir, 'finance.db');
  db = new DatabaseSync(dbPath);
  db.exec('PRAGMA journal_mode = WAL;');

  db.exec(`
    CREATE TABLE IF NOT EXISTS categories (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      icon TEXT NOT NULL,
      color TEXT NOT NULL,
      keywords TEXT NOT NULL DEFAULT '[]'
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      type TEXT NOT NULL CHECK(type IN ('expense', 'income')),
      amount REAL NOT NULL,
      category_id TEXT NOT NULL,
      title TEXT NOT NULL,
      merchant TEXT DEFAULT '',
      date TEXT NOT NULL,
      time TEXT DEFAULT '',
      note TEXT DEFAULT '',
      slip_url TEXT DEFAULT '',
      ocr_text TEXT DEFAULT '',
      matched_keyword TEXT DEFAULT '',
      ref_no TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now', 'localtime')),
      FOREIGN KEY (category_id) REFERENCES categories(id)
    );

    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  const countRow = db.prepare('SELECT COUNT(*) as count FROM categories').get();
  if (countRow.count === 0) {
    const insert = db.prepare(`
      INSERT INTO categories (id, name, type, icon, color, keywords)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const cat of DEFAULT_CATEGORIES) {
      insert.run(cat.id, cat.name, cat.type, cat.icon, cat.color, JSON.stringify(cat.keywords));
    }
  }
} catch (_err) {
  // Fallback JSON store for runtimes without node:sqlite (e.g. Node 18/20 on Vercel)
  const jsonPath = path.join(dataDir, 'finance-fallback.json');
  const loadState = () => {
    try {
      if (fs.existsSync(jsonPath)) {
        return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
      }
    } catch {
      // ignore
    }
    const initial = {
      categories: DEFAULT_CATEGORIES.map(c => ({ ...c, keywords: JSON.stringify(c.keywords) })),
      transactions: [],
      settings: {},
      nextId: 1
    };
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(initial), 'utf8');
    } catch {
      // ignore
    }
    return initial;
  };
  let memState = loadState();
  const saveState = () => {
    try {
      fs.writeFileSync(jsonPath, JSON.stringify(memState), 'utf8');
    } catch {
      // ignore
    }
  };

  db = {
    prepare(sql) {
      const norm = sql.replace(/\s+/g, ' ').trim();
      return {
        get(...params) {
          if (norm.includes('COUNT(*) as count FROM categories')) {
            return { count: memState.categories.length };
          }
          if (norm.includes('COUNT(*) as count FROM transactions')) {
            return { count: memState.transactions.length };
          }
          if (norm.includes('FROM categories WHERE id = ?')) {
            return memState.categories.find(c => c.id === params[0]);
          }
          if (norm.includes("FROM settings WHERE key = 'gemini_api_key'")) {
            const val = memState.settings.gemini_api_key;
            return val ? { value: val } : undefined;
          }
          if (norm.includes('FROM transactions WHERE id = ?')) {
            return memState.transactions.find(t => Number(t.id) === Number(params[0]));
          }
          if (norm.includes('FROM transactions t LEFT JOIN categories c')) {
            const tx = memState.transactions.find(t => Number(t.id) === Number(params[0]));
            if (!tx) return undefined;
            const cat = memState.categories.find(c => c.id === tx.category_id) || {};
            return {
              ...tx,
              category_name: cat.name,
              category_icon: cat.icon,
              category_color: cat.color
            };
          }
          return undefined;
        },
        all(...params) {
          if (norm === 'SELECT * FROM categories') {
            return memState.categories;
          }
          if (norm.includes('FROM transactions t LEFT JOIN categories c')) {
            let list = memState.transactions.map(tx => {
              const cat = memState.categories.find(c => c.id === tx.category_id) || {};
              return {
                ...tx,
                category_name: cat.name,
                category_icon: cat.icon,
                category_color: cat.color
              };
            });
            let idx = 0;
            if (norm.includes("strftime('%Y-%m', t.date) = ?")) {
              const m = params[idx++];
              list = list.filter(t => String(t.date || '').slice(0, 7) === m);
            }
            if (norm.includes('t.type = ?')) {
              const tp = params[idx++];
              list = list.filter(t => t.type === tp);
            }
            if (norm.includes('t.category_id = ?')) {
              const cid = params[idx++];
              list = list.filter(t => t.category_id === cid);
            }
            if (norm.includes('t.title LIKE ?')) {
              const rawQ = String(params[idx] || '').replace(/%/g, '').toLowerCase();
              list = list.filter(t =>
                `${t.title} ${t.merchant} ${t.note} ${t.ocr_text}`.toLowerCase().includes(rawQ)
              );
            }
            list.sort((a, b) => {
              const d = String(b.date).localeCompare(String(a.date));
              if (d !== 0) return d;
              const tm = String(b.time).localeCompare(String(a.time));
              if (tm !== 0) return tm;
              return b.id - a.id;
            });
            return list;
          }
          return [];
        },
        run(...params) {
          if (norm.startsWith('UPDATE categories SET keywords = ? WHERE id = ?')) {
            const cat = memState.categories.find(c => c.id === params[1]);
            if (cat) cat.keywords = params[0];
            saveState();
            return { changes: 1 };
          }
          if (norm.startsWith('INSERT INTO transactions')) {
            const [
              type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no
            ] = params;
            const id = memState.nextId++;
            memState.transactions.push({
              id, type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no,
              created_at: new Date().toISOString()
            });
            saveState();
            return { lastInsertRowid: id };
          }
          if (norm.startsWith('UPDATE transactions')) {
            const [type, amount, category_id, title, merchant, date, time, note, id] = params;
            const tx = memState.transactions.find(t => Number(t.id) === Number(id));
            if (tx) {
              Object.assign(tx, { type, amount, category_id, title, merchant, date, time, note });
              saveState();
            }
            return { changes: 1 };
          }
          if (norm.startsWith('DELETE FROM transactions WHERE id = ?')) {
            memState.transactions = memState.transactions.filter(t => Number(t.id) !== Number(params[0]));
            saveState();
            return { changes: 1 };
          }
          if (norm.includes("INSERT INTO settings (key, value) VALUES ('gemini_api_key', ?)")) {
            memState.settings.gemini_api_key = params[0];
            saveState();
            return { changes: 1 };
          }
          return { changes: 0 };
        }
      };
    }
  };
}

module.exports = {
  db,
  DEFAULT_CATEGORIES,
  isVercel
};
