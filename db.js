const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { Pool } = require('pg');

const isVercel = Boolean(process.env.VERCEL || process.env.NOW_REGION);
let databaseUrl = process.env.DATABASE_URL ||
  process.env.POSTGRES_URL ||
  process.env.POSTGRES_PRISMA_URL ||
  process.env.POSTGRES_URL_NON_POOLING;

if (!databaseUrl && process.env.POSTGRES_HOST && process.env.POSTGRES_USER) {
  const user = encodeURIComponent(process.env.POSTGRES_USER);
  const password = encodeURIComponent(process.env.POSTGRES_PASSWORD || '');
  const host = process.env.POSTGRES_HOST;
  const port = process.env.POSTGRES_PORT || 5432;
  const database = process.env.POSTGRES_DATABASE || 'postgres';
  databaseUrl = `postgresql://${user}:${password}@${host}:${port}/${database}?sslmode=require`;
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

let pgPool = null;
if (databaseUrl) {
  try {
    // Remove sslmode/supa params from URL: in recent pg versions "sslmode=require" overrides
    // the ssl option below and enforces full cert verification, which fails with Supabase's
    // certificate chain ("self-signed certificate in certificate chain").
    const cleanUrl = new URL(databaseUrl);
    ['sslmode', 'sslrootcert', 'sslcert', 'sslkey', 'supa', 'pgbouncer'].forEach(p => cleanUrl.searchParams.delete(p));

    pgPool = new Pool({
      connectionString: cleanUrl.toString(),
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 30000
    });
  } catch (err) {
    console.error('Failed to initialize Postgres Pool:', err.message);
  }
}

// Local SQLite fallback
let localDb = null;
const dataDir = isVercel
  ? path.join(os.tmpdir(), 'slipsense-data')
  : path.join(__dirname, 'data');

try {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
} catch {
  // ignore
}

if (!pgPool) {
  try {
    const { DatabaseSync } = require('node:sqlite');
    const dbPath = path.join(dataDir, 'finance.db');
    localDb = new DatabaseSync(dbPath);
    localDb.exec('PRAGMA journal_mode = WAL;');
  } catch (err) {
    console.warn('node:sqlite not available, using JSON fallback:', err.message);
  }
}

// JSON fallback store
const jsonPath = path.join(dataDir, 'finance-fallback.json');
function loadJsonState() {
  try {
    if (fs.existsSync(jsonPath)) {
      return JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    }
  } catch {}
  return {
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c, keywords: JSON.stringify(c.keywords) })),
    transactions: [],
    settings: {},
    nextId: 1
  };
}
function saveJsonState(state) {
  try {
    fs.writeFileSync(jsonPath, JSON.stringify(state), 'utf8');
  } catch {}
}

let jsonState = (!pgPool && !localDb) ? loadJsonState() : null;

// Initialization: Tables & default categories
// Memoize the init promise so concurrent requests don't race on CREATE TABLE / seeding.
let initPromise = null;
function initDb() {
  if (!initPromise) {
    initPromise = doInitDb().catch(err => {
      initPromise = null; // allow retry on next request
      throw err;
    });
  }
  return initPromise;
}

async function doInitDb() {
  if (pgPool) {
    // PostgreSQL / Supabase
    const client = await pgPool.connect();
    try {
      await client.query(`
        CREATE TABLE IF NOT EXISTS categories (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          type VARCHAR(10) NOT NULL CHECK(type IN ('expense', 'income')),
          icon TEXT NOT NULL,
          color TEXT NOT NULL,
          keywords TEXT NOT NULL DEFAULT '[]'
        );

        CREATE TABLE IF NOT EXISTS transactions (
          id SERIAL PRIMARY KEY,
          type VARCHAR(10) NOT NULL CHECK(type IN ('expense', 'income')),
          amount NUMERIC(12, 2) NOT NULL,
          category_id TEXT NOT NULL REFERENCES categories(id),
          title TEXT NOT NULL,
          merchant TEXT DEFAULT '',
          date VARCHAR(10) NOT NULL,
          time VARCHAR(10) DEFAULT '',
          note TEXT DEFAULT '',
          slip_url TEXT DEFAULT '',
          ocr_text TEXT DEFAULT '',
          matched_keyword TEXT DEFAULT '',
          ref_no TEXT DEFAULT '',
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL
        );
      `);

      const res = await client.query('SELECT COUNT(*) as count FROM categories');
      if (parseInt(res.rows[0].count, 10) === 0) {
        for (const cat of DEFAULT_CATEGORIES) {
          await client.query(
            'INSERT INTO categories (id, name, type, icon, color, keywords) VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING',
            [cat.id, cat.name, cat.type, cat.icon, cat.color, JSON.stringify(cat.keywords)]
          );
        }
      }
    } finally {
      client.release();
    }
  } else if (localDb) {
    // Local SQLite
    localDb.exec(`
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

    const countRow = localDb.prepare('SELECT COUNT(*) as count FROM categories').get();
    if (countRow.count === 0) {
      const insert = localDb.prepare(`
        INSERT INTO categories (id, name, type, icon, color, keywords)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      for (const cat of DEFAULT_CATEGORIES) {
        insert.run(cat.id, cat.name, cat.type, cat.icon, cat.color, JSON.stringify(cat.keywords));
      }
    }
  }
}

// Universal Database Adapter
const db = {
  isCloud: Boolean(pgPool),

  async getCategories() {
    await initDb();
    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM categories ORDER BY id ASC');
      return res.rows.map(r => ({
        ...r,
        keywords: JSON.parse(r.keywords || '[]')
      }));
    }
    if (localDb) {
      const rows = localDb.prepare('SELECT * FROM categories').all();
      return rows.map(r => ({
        ...r,
        keywords: JSON.parse(r.keywords || '[]')
      }));
    }
    return jsonState.categories.map(r => ({
      ...r,
      keywords: JSON.parse(r.keywords || '[]')
    }));
  },

  async addCategoryKeyword(id, keyword) {
    await initDb();
    const cleanKw = keyword.trim();
    if (!cleanKw) return [];

    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM categories WHERE id = $1', [id]);
      if (res.rows.length === 0) throw new Error('Category not found');
      const keywords = JSON.parse(res.rows[0].keywords || '[]');
      if (!keywords.some(k => k.toLowerCase() === cleanKw.toLowerCase())) {
        keywords.unshift(cleanKw);
        await pgPool.query('UPDATE categories SET keywords = $1 WHERE id = $2', [JSON.stringify(keywords), id]);
      }
      return keywords;
    }
    if (localDb) {
      const cat = localDb.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      if (!cat) throw new Error('Category not found');
      const keywords = JSON.parse(cat.keywords || '[]');
      if (!keywords.some(k => k.toLowerCase() === cleanKw.toLowerCase())) {
        keywords.unshift(cleanKw);
        localDb.prepare('UPDATE categories SET keywords = ? WHERE id = ?').run(JSON.stringify(keywords), id);
      }
      return keywords;
    }
    const cat = jsonState.categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found');
    const keywords = JSON.parse(cat.keywords || '[]');
    if (!keywords.some(k => k.toLowerCase() === cleanKw.toLowerCase())) {
      keywords.unshift(cleanKw);
      cat.keywords = JSON.stringify(keywords);
      saveJsonState(jsonState);
    }
    return keywords;
  },

  async deleteCategoryKeyword(id, keyword) {
    await initDb();
    if (pgPool) {
      const res = await pgPool.query('SELECT * FROM categories WHERE id = $1', [id]);
      if (res.rows.length === 0) throw new Error('Category not found');
      const keywords = JSON.parse(res.rows[0].keywords || '[]').filter(k => k !== keyword);
      await pgPool.query('UPDATE categories SET keywords = $1 WHERE id = $2', [JSON.stringify(keywords), id]);
      return keywords;
    }
    if (localDb) {
      const cat = localDb.prepare('SELECT * FROM categories WHERE id = ?').get(id);
      if (!cat) throw new Error('Category not found');
      const keywords = JSON.parse(cat.keywords || '[]').filter(k => k !== keyword);
      localDb.prepare('UPDATE categories SET keywords = ? WHERE id = ?').run(JSON.stringify(keywords), id);
      return keywords;
    }
    const cat = jsonState.categories.find(c => c.id === id);
    if (!cat) throw new Error('Category not found');
    const keywords = JSON.parse(cat.keywords || '[]').filter(k => k !== keyword);
    cat.keywords = JSON.stringify(keywords);
    saveJsonState(jsonState);
    return keywords;
  },

  async getTransactions(filters = {}) {
    await initDb();
    const { month, type, category_id, search } = filters;

    if (pgPool) {
      const conditions = [];
      const params = [];
      let paramIdx = 1;

      if (month && month !== 'all') {
        conditions.push(`t.date LIKE $${paramIdx++}`);
        params.push(`${month}%`);
      }
      if (type && type !== 'all') {
        conditions.push(`t.type = $${paramIdx++}`);
        params.push(type);
      }
      if (category_id && category_id !== 'all') {
        conditions.push(`t.category_id = $${paramIdx++}`);
        params.push(category_id);
      }
      if (search && search.trim()) {
        conditions.push(`(t.title ILIKE $${paramIdx} OR t.merchant ILIKE $${paramIdx} OR t.note ILIKE $${paramIdx} OR t.ocr_text ILIKE $${paramIdx})`);
        params.push(`%${search.trim()}%`);
        paramIdx++;
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT
          t.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
        ORDER BY t.date DESC, t.time DESC, t.id DESC
      `;
      const res = await pgPool.query(query, params);

      // Period rows for overall month summary
      const periodConditions = [];
      const periodParams = [];
      if (month && month !== 'all') {
        periodConditions.push('t.date LIKE $1');
        periodParams.push(`${month}%`);
      }
      const periodWhere = periodConditions.length > 0 ? `WHERE ${periodConditions.join(' AND ')}` : '';
      const periodRes = await pgPool.query(`
        SELECT
          t.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ${periodWhere}
      `, periodParams);

      return {
        transactions: res.rows.map(r => ({ ...r, amount: parseFloat(r.amount) })),
        periodRows: periodRes.rows.map(r => ({ ...r, amount: parseFloat(r.amount) }))
      };
    }

    if (localDb) {
      const conditions = [];
      const params = [];

      if (month && month !== 'all') {
        conditions.push("strftime('%Y-%m', t.date) = ?");
        params.push(month);
      }
      if (type && type !== 'all') {
        conditions.push('t.type = ?');
        params.push(type);
      }
      if (category_id && category_id !== 'all') {
        conditions.push('t.category_id = ?');
        params.push(category_id);
      }
      if (search && search.trim()) {
        conditions.push('(t.title LIKE ? OR t.merchant LIKE ? OR t.note LIKE ? OR t.ocr_text LIKE ?)');
        const q = `%${search.trim()}%`;
        params.push(q, q, q, q);
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
      const query = `
        SELECT
          t.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ${whereClause}
        ORDER BY t.date DESC, t.time DESC, t.id DESC
      `;
      const transactions = localDb.prepare(query).all(...params);

      const periodConditions = [];
      const periodParams = [];
      if (month && month !== 'all') {
        periodConditions.push("strftime('%Y-%m', t.date) = ?");
        periodParams.push(month);
      }
      const periodWhere = periodConditions.length > 0 ? `WHERE ${periodConditions.join(' AND ')}` : '';
      const periodRows = localDb.prepare(`
        SELECT
          t.*,
          c.name as category_name,
          c.icon as category_icon,
          c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        ${periodWhere}
      `).all(...periodParams);

      return { transactions, periodRows };
    }

    // JSON fallback
    let list = jsonState.transactions.map(tx => {
      const cat = jsonState.categories.find(c => c.id === tx.category_id) || {};
      return {
        ...tx,
        category_name: cat.name,
        category_icon: cat.icon,
        category_color: cat.color
      };
    });

    const periodRows = month && month !== 'all'
      ? list.filter(t => String(t.date || '').slice(0, 7) === month)
      : list;

    if (month && month !== 'all') {
      list = list.filter(t => String(t.date || '').slice(0, 7) === month);
    }
    if (type && type !== 'all') {
      list = list.filter(t => t.type === type);
    }
    if (category_id && category_id !== 'all') {
      list = list.filter(t => t.category_id === category_id);
    }
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(t =>
        `${t.title} ${t.merchant} ${t.note} ${t.ocr_text}`.toLowerCase().includes(q)
      );
    }

    list.sort((a, b) => {
      const d = String(b.date).localeCompare(String(a.date));
      if (d !== 0) return d;
      return String(b.time || '').localeCompare(String(a.time || ''));
    });

    return { transactions: list, periodRows };
  },

  async createTransaction(tx) {
    await initDb();
    const {
      type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no
    } = tx;

    if (pgPool) {
      const res = await pgPool.query(`
        INSERT INTO transactions (
          type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `, [type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no]);

      const inserted = res.rows[0];
      const catRes = await pgPool.query('SELECT * FROM categories WHERE id = $1', [inserted.category_id]);
      const cat = catRes.rows[0] || {};
      return {
        ...inserted,
        amount: parseFloat(inserted.amount),
        category_name: cat.name,
        category_icon: cat.icon,
        category_color: cat.color
      };
    }

    if (localDb) {
      const stmt = localDb.prepare(`
        INSERT INTO transactions (
          type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const info = stmt.run(
        type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no
      );
      return localDb.prepare(`
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
      `).get(info.lastInsertRowid);
    }

    const id = jsonState.nextId++;
    const newTx = {
      id, type, amount, category_id, title, merchant, date, time, note, slip_url, ocr_text, matched_keyword, ref_no,
      created_at: new Date().toISOString()
    };
    jsonState.transactions.push(newTx);
    saveJsonState(jsonState);

    const cat = jsonState.categories.find(c => c.id === category_id) || {};
    return {
      ...newTx,
      category_name: cat.name,
      category_icon: cat.icon,
      category_color: cat.color
    };
  },

  async updateTransaction(id, tx) {
    await initDb();
    if (pgPool) {
      await pgPool.query(`
        UPDATE transactions
        SET type = $1, amount = $2, category_id = $3, title = $4, merchant = $5, date = $6, time = $7, note = $8
        WHERE id = $9
      `, [tx.type, tx.amount, tx.category_id, tx.title, tx.merchant, tx.date, tx.time, tx.note, id]);

      const res = await pgPool.query(`
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = $1
      `, [id]);
      if (res.rows.length === 0) throw new Error('Transaction not found');
      return { ...res.rows[0], amount: parseFloat(res.rows[0].amount) };
    }

    if (localDb) {
      localDb.prepare(`
        UPDATE transactions
        SET type = ?, amount = ?, category_id = ?, title = ?, merchant = ?, date = ?, time = ?, note = ?
        WHERE id = ?
      `).run(tx.type, tx.amount, tx.category_id, tx.title, tx.merchant, tx.date, tx.time, tx.note, id);

      return localDb.prepare(`
        SELECT t.*, c.name as category_name, c.icon as category_icon, c.color as category_color
        FROM transactions t
        LEFT JOIN categories c ON t.category_id = c.id
        WHERE t.id = ?
      `).get(id);
    }

    const existing = jsonState.transactions.find(t => Number(t.id) === Number(id));
    if (!existing) throw new Error('Transaction not found');
    Object.assign(existing, tx);
    saveJsonState(jsonState);

    const cat = jsonState.categories.find(c => c.id === existing.category_id) || {};
    return {
      ...existing,
      category_name: cat.name,
      category_icon: cat.icon,
      category_color: cat.color
    };
  },

  async deleteTransaction(id) {
    await initDb();
    if (pgPool) {
      await pgPool.query('DELETE FROM transactions WHERE id = $1', [id]);
      return true;
    }
    if (localDb) {
      localDb.prepare('DELETE FROM transactions WHERE id = ?').run(id);
      return true;
    }
    jsonState.transactions = jsonState.transactions.filter(t => Number(t.id) !== Number(id));
    saveJsonState(jsonState);
    return true;
  },

  async getSetting(key) {
    await initDb();
    if (pgPool) {
      const res = await pgPool.query('SELECT value FROM settings WHERE key = $1', [key]);
      return res.rows.length > 0 ? res.rows[0].value : null;
    }
    if (localDb) {
      const row = localDb.prepare('SELECT value FROM settings WHERE key = ?').get(key);
      return row ? row.value : null;
    }
    return jsonState.settings[key] || null;
  },

  async setSetting(key, value) {
    await initDb();
    if (pgPool) {
      await pgPool.query(`
        INSERT INTO settings (key, value) VALUES ($1, $2)
        ON CONFLICT(key) DO UPDATE SET value = EXCLUDED.value
      `, [key, value]);
      return;
    }
    if (localDb) {
      localDb.prepare(`
        INSERT INTO settings (key, value) VALUES (?, ?)
        ON CONFLICT(key) DO UPDATE SET value = excluded.value
      `).run(key, value);
      return;
    }
    jsonState.settings[key] = value;
    saveJsonState(jsonState);
  },

  async countTransactions() {
    await initDb();
    if (pgPool) {
      const res = await pgPool.query('SELECT COUNT(*) as count FROM transactions');
      return parseInt(res.rows[0].count, 10);
    }
    if (localDb) {
      return localDb.prepare('SELECT COUNT(*) as count FROM transactions').get().count;
    }
    return jsonState.transactions.length;
  }
};

module.exports = {
  db,
  DEFAULT_CATEGORIES,
  isVercel,
  isCloudDb: Boolean(pgPool)
};
