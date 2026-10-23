const state = {
  categories: [],
  transactions: [],
  summary: {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
    byCategory: []
  },
  selectedType: 'expense',
  selectedCategoryId: 'food',
  selectedSlipFile: null,
  hasGeminiKey: false,
  filters: {
    month: new Date().toISOString().slice(0, 7),
    type: 'all',
    category_id: 'all',
    search: ''
  }
};

// Sample Slips Data for 1-click Testing
const SAMPLE_SLIPS = {
  amazon: {
    bankName: 'SCB EASY',
    bankColor: '#7c3aed',
    headerText: 'จ่ายเงินสำเร็จ',
    dateText: '23 ต.ค. 69 10:15 น.',
    merchant: 'บจก. ปตท. น้ำมันและการค้าปลีก (CAFE AMAZON)',
    amount: '65.00',
    refNo: 'SCB20261023101588',
    memo: 'กาแฟอเมซอน อเมริกาโน่เย็น'
  },
  seven: {
    bankName: 'TrueMoney / K PLUS',
    bankColor: '#f97316',
    headerText: 'ชำระเงินสำเร็จ',
    dateText: '23 ต.ค. 69 12:30 น.',
    merchant: 'บจก. ซีพี ออลล์ (7-ELEVEN สาขาอโศก)',
    amount: '142.00',
    refNo: '7ELEVEN202610231230',
    memo: 'ข้าวกล่องและเครื่องดื่ม เซเว่น'
  },
  pea: {
    bankName: 'Krungthai NEXT',
    bankColor: '#0284c7',
    headerText: 'จ่ายบิลสำเร็จ',
    dateText: '23 ต.ค. 69 14:00 น.',
    merchant: 'การไฟฟ้าส่วนภูมิภาค (PEA)',
    amount: '1,480.25',
    refNo: 'PEA20261023140099',
    memo: 'ชำระค่าไฟฟ้าประจำเดือน'
  },
  ptt: {
    bankName: 'K PLUS',
    bankColor: '#16a34a',
    headerText: 'สแกนจ่ายสำเร็จ',
    dateText: '23 ต.ค. 69 16:45 น.',
    merchant: 'PTT STATION ปั๊มน้ำมัน ปตท. รามอินทรา',
    amount: '900.00',
    refNo: 'KBANK202610231645',
    memo: 'เติมน้ำมันรถยนต์'
  },
  shopee: {
    bankName: 'Bangkok Bank',
    bankColor: '#1d4ed8',
    headerText: 'โอนเงินสำเร็จ',
    dateText: '23 ต.ค. 69 20:10 น.',
    merchant: 'SHOPEE (THAILAND) CO., LTD.',
    amount: '459.00',
    refNo: 'BBL20261023201055',
    memo: 'ช้อปปิ้งของใช้ในบ้าน Shopee'
  },
  salary: {
    bankName: 'K PLUS Payroll',
    bankColor: '#059669',
    headerText: 'รับเงินโอนสำเร็จ',
    dateText: '23 ต.ค. 69 08:30 น.',
    merchant: 'บริษัท สมาร์ทโซลูชั่น จำกัด (เงินเดือน)',
    amount: '45,000.00',
    refNo: 'PAYROLL202610230830',
    memo: 'เงินเดือนประจำเดือน Salary'
  }
};

// Format Currency
function formatTHB(num) {
  const val = Number(num) || 0;
  return val.toLocaleString('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
}

function showToast(message) {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3200);
}

// Initialize Month Picker
function initMonthPicker() {
  const select = document.getElementById('monthFilter');
  const thaiMonths = [
    'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
    'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
  ];

  const now = new Date();
  const currentYm = now.toISOString().slice(0, 7);
  state.filters.month = currentYm;

  let html = `<option value="all">📅 ทุกเดือนทั้งหมด</option>`;
  for (let i = -3; i <= 2; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const ym = `${yyyy}-${mm}`;
    const label = `${thaiMonths[d.getMonth()]} ${yyyy + 543}`;
    html += `<option value="${ym}" ${ym === currentYm ? 'selected' : ''}>📅 ${label}</option>`;
  }
  select.innerHTML = html;

  select.addEventListener('change', (e) => {
    state.filters.month = e.target.value;
    loadTransactions();
  });
}

// Initialize Date & Time defaults
function resetDateTimeInputs() {
  const now = new Date();
  document.getElementById('txDate').value = now.toISOString().slice(0, 10);
  document.getElementById('txTime').value = now.toTimeString().slice(0, 5);
}

// Load Categories & Settings
async function loadCategoriesAndSettings() {
  const [catRes, setRes] = await Promise.all([
    fetch('/api/categories'),
    fetch('/api/settings')
  ]);
  state.categories = await catRes.json();
  const settings = await setRes.json();
  state.hasGeminiKey = settings.hasGeminiKey;
  updateDbStatusBadge(settings.isCloudDb);

  const ocrBadge = document.getElementById('ocrModeBadge');
  if (state.hasGeminiKey) {
    ocrBadge.textContent = '✨ Gemini Vision AI + OCR';
  } else {
    ocrBadge.textContent = '🔍 Tesseract OCR ภาษาไทย';
  }

  renderCategorySelector();
  populateCategoryFilters();
  renderSettingsKeywords();
}

function updateDbStatusBadge(isCloud) {
  state.isCloudDb = Boolean(isCloud);
  const badge = document.getElementById('dbStatusBadge');
  const box = document.getElementById('dbModalStatusBox');
  const icon = document.getElementById('dbModalStatusIcon');
  const title = document.getElementById('dbModalStatusTitle');
  const desc = document.getElementById('dbModalStatusDesc');

  if (!badge) return;

  if (isCloud) {
    badge.className = 'badge badge-db-status db-connected';
    badge.innerHTML = '☁️ ซิงค์ Cloud DB แล้ว';
    badge.title = 'ฐานข้อมูลกลางเชื่อมต่อแล้ว ข้อมูลตรงกันทุกเครื่อง';
    badge.onclick = () => {
      document.getElementById('settingsModal').classList.remove('hidden');
    };
    if (box) {
      box.className = 'db-modal-status-box db-connected-box';
      if (icon) icon.textContent = '✅';
      if (title) title.textContent = 'เชื่อมต่อ Cloud Database สำเร็จแล้ว';
      if (desc) desc.textContent = 'ข้อมูลจะซิงค์ตรงกันทันที 100% ทุกอุปกรณ์ (ทั้งบนมือถือและคอมพิวเตอร์)';
    }
  } else {
    badge.className = 'badge badge-db-status db-offline';
    badge.innerHTML = '⚠️ ยังไม่ซิงค์ข้ามเครื่อง (คลิกดูวิธี)';
    badge.title = 'คลิกเพื่อดูวิธีเชื่อมต่อ Cloud Database ฟรีสำหรับซิงค์มือถือและคอม';
    badge.onclick = () => {
      document.getElementById('settingsModal').classList.remove('hidden');
    };
    if (box) {
      box.className = 'db-modal-status-box db-offline-box';
      if (icon) icon.textContent = '⚠️';
      if (title) title.textContent = 'ยังไม่ได้เชื่อมต่อ Cloud Database';
      if (desc) desc.textContent = 'ขณะนี้แอปทำงานในโหมดเครื่องเดี่ยว หากต้องการให้ข้อมูลในมือถือและคอมพิวเตอร์เป็นอันเดียวกันตลอดเวลา กรุณาใส่ DATABASE_URL ใน Vercel';
    }
  }
}

// Render Visual Category Grid in Form
function renderCategorySelector() {
  const grid = document.getElementById('categorySelectorGrid');
  const filteredCats = state.categories.filter(c => c.type === state.selectedType);

  // Ensure selectedCategoryId belongs to current type
  if (!filteredCats.some(c => c.id === state.selectedCategoryId) && filteredCats.length > 0) {
    state.selectedCategoryId = filteredCats[0].id;
  }

  grid.innerHTML = filteredCats.map(cat => {
    const isSelected = cat.id === state.selectedCategoryId;
    return `
      <div class="cat-option ${isSelected ? 'selected' : ''}" data-cat-id="${cat.id}">
        <span class="cat-option-icon">${cat.icon}</span>
        <span class="cat-option-name">${cat.name}</span>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.cat-option').forEach(el => {
    el.addEventListener('click', () => {
      state.selectedCategoryId = el.dataset.catId;
      document.getElementById('autoMatchBadge').classList.add('hidden');
      renderCategorySelector();
    });
  });
}

function setFormType(type) {
  state.selectedType = type;
  const btnExp = document.getElementById('btnTypeExpense');
  const btnInc = document.getElementById('btnTypeIncome');
  if (type === 'expense') {
    btnExp.className = 'type-btn active-expense';
    btnInc.className = 'type-btn';
  } else {
    btnExp.className = 'type-btn';
    btnInc.className = 'type-btn active-income';
  }
  renderCategorySelector();
}

function populateCategoryFilters() {
  const catFilter = document.getElementById('categoryFilter');
  const currentVal = catFilter.value || 'all';
  catFilter.innerHTML = `<option value="all">ทุกหมวดหมู่</option>` +
    state.categories.map(c => `<option value="${c.id}">${c.icon} ${c.name}</option>`).join('');
  catFilter.value = currentVal;

  const ruleCatSelect = document.getElementById('ruleCategorySelect');
  if (ruleCatSelect) {
    ruleCatSelect.innerHTML = state.categories.map(c =>
      `<option value="${c.id}">${c.icon} ${c.name} (${c.type === 'expense' ? 'รายจ่าย' : 'รายรับ'})</option>`
    ).join('');
  }
}

// Fetch Transactions & Update Dashboard
async function loadTransactions() {
  const params = new URLSearchParams(state.filters);
  const res = await fetch(`/api/transactions?${params.toString()}`);
  const data = await res.json();

  state.transactions = data.transactions || [];
  if (data.isCloudDb !== undefined) {
    updateDbStatusBadge(data.isCloudDb);
  }
  state.summary = data.summary || {
    totalIncome: 0,
    totalExpense: 0,
    balance: 0,
    transactionCount: 0,
    byCategory: []
  };

  renderSummaryCards();
  renderCategoryBreakdown();
  renderTransactionList();
}

function formatShortNum(num) {
  const n = Math.abs(num);
  if (n >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (num / 1000).toFixed(0) + 'K';
  return num.toString();
}

function renderPillars() {
  const { totalIncome, totalExpense, balance, byCategory } = state.summary;
  
  // Pillar 1: รู้นิสัยใช้จ่าย
  const pBal = document.getElementById('pillarBalance');
  if (pBal) pBal.textContent = `${balance < 0 ? '-' : ''}฿${formatTHB(Math.abs(balance))}`;
  const pInc = document.getElementById('pillarIncome');
  if (pInc) pInc.textContent = `฿${formatTHB(totalIncome)}`;
  const pExp = document.getElementById('pillarExpense');
  if (pExp) pExp.textContent = `฿${formatTHB(totalExpense)}`;

  // Calculate Today's Expenses
  const todayStr = new Date().toISOString().slice(0, 10);
  const todayExpense = state.transactions
    .filter(t => t.type === 'expense' && (t.date === todayStr))
    .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const dailyTarget = parseFloat(localStorage.getItem('ican_daily_target')) || 300;
  const pTodayExp = document.getElementById('pillarTodayExpense');
  if (pTodayExp) pTodayExp.textContent = `฿${Math.round(todayExpense).toLocaleString('th-TH')}`;
  
  const pDailyTarget = document.getElementById('pillarDailyTarget');
  if (pDailyTarget) pDailyTarget.textContent = `฿${dailyTarget.toLocaleString('th-TH')}`;

  const gaugeFill = document.getElementById('dailyGaugeFill');
  const pDailyStatus = document.getElementById('pillarDailyStatus');
  if (gaugeFill) {
    const circ = 264;
    const ratio = Math.min(todayExpense / dailyTarget, 1);
    gaugeFill.style.strokeDashoffset = circ - (circ * ratio);
    if (todayExpense > dailyTarget) {
      gaugeFill.style.stroke = 'var(--expense)';
      if (pDailyStatus) {
        pDailyStatus.textContent = `เกินเป้าหมายวันนี้ (${Math.round((todayExpense / dailyTarget) * 100)}%)`;
        pDailyStatus.className = 'gauge-status-tag tag-warn';
      }
    } else {
      gaugeFill.style.stroke = 'var(--primary)';
      if (pDailyStatus) {
        pDailyStatus.textContent = `อยู่ในงบประมาณ (${Math.round((todayExpense / dailyTarget) * 100)}%)`;
        pDailyStatus.className = 'gauge-status-tag tag-safe';
      }
    }
  }

  // Pillar 2: วางแผนปรับลดค่าใช้จ่าย
  const pTopCat = document.getElementById('pillarTopCat');
  const pTopCatBar = document.getElementById('pillarTopCatBar');
  if (pTopCat && pTopCatBar) {
    if (byCategory && byCategory.length > 0) {
      const top = byCategory[0];
      pTopCat.textContent = `${top.category_icon} ${top.category_name} (${top.percentage}%)`;
      pTopCatBar.style.width = `${top.percentage}%`;
      pTopCatBar.style.backgroundColor = top.category_color || 'var(--primary)';
    } else {
      pTopCat.textContent = 'ยังไม่มีข้อมูล';
      pTopCatBar.style.width = '0%';
    }
  }

  // Pillar 3: รู้สถานะการเงิน (Net Worth)
  const assets = parseFloat(localStorage.getItem('ican_assets')) || 568000;
  const liabilities = parseFloat(localStorage.getItem('ican_liabilities')) || 350000;
  const netWorth = assets - liabilities;

  const pNetWorth = document.getElementById('pillarNetWorth');
  if (pNetWorth) pNetWorth.textContent = `${netWorth < 0 ? '-' : ''}฿${formatTHB(Math.abs(netWorth))}`;
  const pAssets = document.getElementById('pillarAssets');
  if (pAssets) pAssets.textContent = `฿${formatTHB(assets)}`;
  const pLiab = document.getElementById('pillarLiabilities');
  if (pLiab) pLiab.textContent = `฿${formatTHB(liabilities)}`;

  // Bar chart
  const maxVal = Math.max(assets, liabilities, Math.abs(netWorth), 1);
  const barAssetFill = document.getElementById('barAssetFill');
  const barLiabFill = document.getElementById('barLiabFill');
  const barNetFill = document.getElementById('barNetFill');
  const barAssetVal = document.getElementById('barAssetVal');
  const barLiabVal = document.getElementById('barLiabVal');
  const barNetVal = document.getElementById('barNetVal');

  if (barAssetFill) barAssetFill.style.height = `${Math.max(12, (assets / maxVal) * 80)}px`;
  if (barLiabFill) barLiabFill.style.height = `${Math.max(12, (liabilities / maxVal) * 80)}px`;
  if (barNetFill) barNetFill.style.height = `${Math.max(12, (Math.max(0, netWorth) / maxVal) * 80)}px`;

  if (barAssetVal) barAssetVal.textContent = formatShortNum(assets);
  if (barLiabVal) barLiabVal.textContent = formatShortNum(liabilities);
  if (barNetVal) barNetVal.textContent = formatShortNum(netWorth);

  // Pillar 4: วิเคราะห์สุขภาพการเงิน (0.0 - 10.0)
  let score = 5.0; // Base score
  let advice = '';

  if (totalIncome > 0) {
    const savingsRatio = (totalIncome - totalExpense) / totalIncome;
    if (savingsRatio >= 0.3) score += 3.0;
    else if (savingsRatio >= 0.2) score += 2.2;
    else if (savingsRatio >= 0.1) score += 1.4;
    else if (savingsRatio >= 0) score += 0.5;
    else score -= 2.0;
  }

  if (assets > 0) {
    const debtRatio = liabilities / assets;
    if (debtRatio <= 0.3) score += 2.0;
    else if (debtRatio <= 0.5) score += 1.0;
    else if (debtRatio > 0.8) score -= 1.5;
  }

  score = Math.max(1.0, Math.min(9.8, score));
  const scoreRounded = score.toFixed(1);

  const pScore = document.getElementById('pillarHealthScore');
  const pRating = document.getElementById('pillarHealthRating');
  const pAdvice = document.getElementById('pillarHealthAdvice');
  const needleGroup = document.getElementById('healthNeedleGroup');

  if (pScore) pScore.textContent = scoreRounded;

  if (needleGroup) {
    const angle = -90 + (score / 10) * 180;
    needleGroup.style.transform = `rotate(${angle}deg)`;
  }

  if (score >= 8.0) {
    if (pRating) {
      pRating.textContent = 'ยอดเยี่ยม';
      pRating.className = 'health-status-badge status-good';
    }
    advice = '🎉 วินัยการเงินและอัตราส่วนการออมดีเยี่ยม! ควรกระจายเงินส่วนเกินไปลงทุนเพื่อสร้าง Passive Income ต่อไป';
  } else if (score >= 6.0) {
    if (pRating) {
      pRating.textContent = 'ดี';
      pRating.className = 'health-status-badge status-good';
    }
    advice = '👍 สภาพคล่องอยู่ในเกณฑ์น่าพอใจ แนะนำพยายามคุมค่าใช้จ่ายผันแปรและสร้างเงินสำรองฉุกเฉินให้ได้ 6 เดือน';
  } else if (score >= 4.0) {
    if (pRating) {
      pRating.textContent = 'ปานกลาง';
      pRating.className = 'health-status-badge';
    }
    advice = '⚠️ ค่าใช้จ่ายเริ่มใกล้เคียงรายได้ ลองใช้กราฟสลิปแยกหมวดหมู่เพื่อตัดรายจ่ายฟุ่มเฟือยที่ไม่จำเป็นออก';
  } else {
    if (pRating) {
      pRating.textContent = 'ต้องระวัง';
      pRating.className = 'health-status-badge status-warning';
    }
    advice = '🚨 รายจ่ายสูงกว่ารายรับหรือมีภาระหนี้สูง ควรรีบวางแผนปรับลดค่าใช้จ่ายและชะลอการก่อหนี้ใหม่ทันที';
  }

  if (pAdvice) pAdvice.textContent = advice;
}

function renderSummaryCards() {
  const { totalIncome, totalExpense, balance, transactionCount, byCategory } = state.summary;
  const balEl = document.getElementById('sumBalance');
  balEl.textContent = `${balance < 0 ? '-' : ''}฿${formatTHB(Math.abs(balance))}`;
  document.getElementById('sumIncome').textContent = `+฿${formatTHB(totalIncome)}`;
  document.getElementById('sumExpense').textContent = `-฿${formatTHB(totalExpense)}`;
  document.getElementById('sumTxCount').textContent = `${transactionCount} รายการในเดือนที่เลือก`;

  const topHint = document.getElementById('topCategoryHint');
  if (byCategory.length > 0) {
    const top = byCategory[0];
    topHint.textContent = `จ่ายสูงสุด: ${top.category_icon} ${top.category_name} (${top.percentage}%)`;
  } else {
    topHint.textContent = 'ยังไม่มีรายจ่ายในเดือนนี้';
  }

  renderPillars();
}

// Render SVG Donut Chart & Category Breakdown Bars
function renderCategoryBreakdown() {
  const { totalExpense, byCategory } = state.summary;
  const svg = document.getElementById('categoryDonutSvg');
  const centerTotal = document.getElementById('donutCenterTotal');
  const listEl = document.getElementById('categoryBreakdownList');
  const resetBtn = document.getElementById('btnResetCatFilter');

  if (state.filters.category_id !== 'all') {
    resetBtn.classList.remove('hidden');
  } else {
    resetBtn.classList.add('hidden');
  }

  centerTotal.textContent = `฿${Number(totalExpense || 0).toLocaleString('th-TH', { maximumFractionDigits: 0 })}`;

  const radius = 60;
  const circumference = 2 * Math.PI * radius;

  if (!byCategory || byCategory.length === 0) {
    svg.innerHTML = `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="#e2e8f0" stroke-width="22" />`;
    listEl.innerHTML = `<div class="empty-state">ยังไม่มีข้อมูลรายจ่ายแยกหมวดหมู่</div>`;
    return;
  }

  let cumulativePercent = 0;
  const circles = byCategory.map(item => {
    const pct = item.percentage / 100;
    const strokeDasharray = `${pct * circumference} ${circumference}`;
    const strokeDashoffset = -cumulativePercent * circumference;
    cumulativePercent += pct;
    return `<circle cx="80" cy="80" r="${radius}" fill="none" stroke="${item.category_color}" stroke-width="22" stroke-dasharray="${strokeDasharray}" stroke-dashoffset="${strokeDashoffset}" />`;
  }).join('');

  svg.innerHTML = circles;

  listEl.innerHTML = byCategory.map(item => {
    const isActive = state.filters.category_id === item.category_id;
    return `
      <div class="breakdown-item ${isActive ? 'active-filter' : ''}" data-cat-id="${item.category_id}">
        <div class="breakdown-item-top">
          <div class="breakdown-cat-label">
            <span>${item.category_icon}</span>
            <span>${item.category_name}</span>
            <span style="font-size:11.5px; color:#64748b;">(${item.count} สลิป)</span>
          </div>
          <div class="breakdown-cat-stats">
            <strong>฿${formatTHB(item.total)}</strong>
            <span class="breakdown-pct">${item.percentage}%</span>
          </div>
        </div>
        <div class="breakdown-bar-bg">
          <div class="breakdown-bar-fill" style="width: ${Math.max(item.percentage, 3)}%; background: ${item.category_color};"></div>
        </div>
      </div>
    `;
  }).join('');

  listEl.querySelectorAll('.breakdown-item').forEach(el => {
    el.addEventListener('click', () => {
      const clickedCat = el.dataset.catId;
      state.filters.category_id = state.filters.category_id === clickedCat ? 'all' : clickedCat;
      document.getElementById('categoryFilter').value = state.filters.category_id;
      loadTransactions();
    });
  });
}

// Render Transaction History List
function renderTransactionList() {
  const listEl = document.getElementById('transactionList');
  if (state.transactions.length === 0) {
    listEl.innerHTML = `
      <div class="empty-state">
        <p style="font-size: 32px; margin-bottom: 6px;">🧾</p>
        <p>ไม่พบรายการที่ตรงกับเงื่อนไข</p>
      </div>
    `;
    return;
  }

  listEl.innerHTML = state.transactions.map(tx => {
    const isExpense = tx.type === 'expense';
    const sign = isExpense ? '-' : '+';
    const amountClass = isExpense ? 'text-expense' : 'text-income';
    const color = tx.category_color || '#64748b';
    const bgSoft = `${color}18`;

    const kwBadge = tx.matched_keyword
      ? `<span class="tx-kw-pill" title="คำที่ระบบตรวจพบในสลิป">🔍 "${escapeHtml(tx.matched_keyword)}"</span>`
      : '';

    const slipButton = tx.slip_url
      ? `<button type="button" class="btn-slip-badge" data-view-slip="${tx.id}">🧾 ดูสลิป</button>`
      : '';

    const metaParts = [tx.date, tx.time].filter(Boolean).join(' • ');
    const merchantInfo = tx.merchant ? ` • ${escapeHtml(tx.merchant)}` : '';
    const noteInfo = tx.note ? ` (${escapeHtml(tx.note)})` : '';

    return `
      <div class="tx-card">
        <div class="tx-left">
          <div class="tx-cat-avatar" style="background: ${bgSoft}; color: ${color};">
            ${tx.category_icon || '📦'}
          </div>
          <div class="tx-details">
            <div class="tx-title-row">
              <span class="tx-title">${escapeHtml(tx.title)}</span>
              <span class="tx-cat-pill" style="background: ${bgSoft}; color: ${color};">
                ${tx.category_icon || ''} ${escapeHtml(tx.category_name || 'ไม่ระบุ')}
              </span>
              ${kwBadge}
            </div>
            <div class="tx-meta">
              ${metaParts}${merchantInfo}${noteInfo}
            </div>
          </div>
        </div>

        <div class="tx-right">
          ${slipButton}
          <div class="tx-amount ${amountClass}">
            ${sign}฿${formatTHB(tx.amount)}
          </div>
          <button type="button" class="btn-delete-tx" data-delete-id="${tx.id}" title="ลบรายการ">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // Bind View Slip modal
  listEl.querySelectorAll('[data-view-slip]').forEach(btn => {
    btn.addEventListener('click', () => {
      const txId = Number(btn.dataset.viewSlip);
      const tx = state.transactions.find(t => t.id === txId);
      if (tx) openSlipModal(tx);
    });
  });

  // Bind Delete button
  listEl.querySelectorAll('[data-delete-id]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const txId = Number(btn.dataset.deleteId);
      await fetch(`/api/transactions/${txId}`, { method: 'DELETE' });
      showToast('ลบรายการเรียบร้อยแล้ว');
      loadTransactions();
    });
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Slip Upload & OCR Processing Flow
async function processSlipFile(file, preKnownText = '') {
  state.selectedSlipFile = file;

  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    document.getElementById('slipPreviewImg').src = e.target.result;
  };
  reader.readAsDataURL(file);

  document.getElementById('dropZonePrompt').classList.add('hidden');
  document.getElementById('slipPreviewArea').classList.remove('hidden');
  document.getElementById('ocrProgressWrap').classList.remove('hidden');
  document.getElementById('detectedCategoryCard').classList.add('hidden');

  const statusText = document.getElementById('ocrStatusText');
  const progressBar = document.getElementById('ocrProgressBar');
  progressBar.style.width = '15%';
  statusText.textContent = 'กำลังอ่านข้อมูลจากรูปสลิป...';

  let ocrText = preKnownText;

  try {
    // Run Tesseract OCR if we don't have pre-known text and aren't relying solely on Gemini
    if (!ocrText && window.Tesseract && !state.hasGeminiKey) {
      const result = await window.Tesseract.recognize(file, 'tha+eng', {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            const pct = Math.max(15, Math.round((m.progress || 0) * 100));
            progressBar.style.width = `${pct}%`;
            statusText.textContent = `กำลังอ่านข้อความภาษาไทยจากสลิป (${pct}%)...`;
          }
        }
      });
      ocrText = result?.data?.text || '';
    } else {
      progressBar.style.width = '75%';
      statusText.textContent = 'กำลังวิเคราะห์หมวดหมู่ค่าใช้จ่าย...';
    }

    // Send image + OCR text to backend analyzer
    const formData = new FormData();
    formData.append('slip', file);
    formData.append('ocr_text', ocrText);
    formData.append('use_gemini', state.hasGeminiKey ? 'true' : 'false');

    const res = await fetch('/api/slips/analyze', {
      method: 'POST',
      body: formData
    });
    const analysis = await res.json();

    document.getElementById('ocrProgressWrap').classList.add('hidden');
    applySlipAnalysisToForm(analysis);
  } catch (err) {
    console.error('Slip analysis error:', err);
    document.getElementById('ocrProgressWrap').classList.add('hidden');
    showToast('อ่านสลิปไม่สำเร็จ คุณสามารถกรอกข้อมูลเพิ่มเติมได้');
  }
}

function applySlipAnalysisToForm(analysis) {
  if (!analysis) return;

  // Set type & category
  setFormType(analysis.type || 'expense');
  if (analysis.category_id) {
    state.selectedCategoryId = analysis.category_id;
    renderCategorySelector();
  }

  // Fill fields
  if (analysis.amount && analysis.amount > 0) {
    document.getElementById('txAmount').value = analysis.amount.toFixed(2);
  }
  if (analysis.title) {
    document.getElementById('txTitle').value = analysis.title;
  }
  if (analysis.merchant) {
    document.getElementById('txMerchant').value = analysis.merchant;
  }
  if (analysis.date) {
    document.getElementById('txDate').value = analysis.date;
  }
  if (analysis.time) {
    document.getElementById('txTime').value = analysis.time;
  }

  document.getElementById('txExistingSlipUrl').value = analysis.slip_url || '';
  document.getElementById('txOcrText').value = analysis.ocr_text || '';
  document.getElementById('txMatchedKeyword').value = analysis.matched_keyword || '';
  document.getElementById('txRefNo').value = analysis.ref_no || '';

  // Show Detected Category Card
  const card = document.getElementById('detectedCategoryCard');
  card.classList.remove('hidden');
  document.getElementById('detectedCatIcon').textContent = analysis.category_icon || '🍜';
  document.getElementById('detectedCatName').textContent = analysis.category_name || 'หมวดหมู่อัตโนมัติ';

  const reasonEl = document.getElementById('detectedReason');
  if (analysis.matched_keyword) {
    reasonEl.textContent = `ตรวจพบคำว่า "${analysis.matched_keyword}" ในสลิป • ยอด ฿${formatTHB(analysis.amount)}`;
  } else {
    reasonEl.textContent = `ดึงยอดเงิน ฿${formatTHB(analysis.amount)} จากสลิปเรียบร้อย`;
  }

  const autoBadge = document.getElementById('autoMatchBadge');
  autoBadge.classList.remove('hidden');
  autoBadge.textContent = analysis.matched_keyword
    ? `✨ จัดหมวดอัตโนมัติจากคำว่า "${analysis.matched_keyword}"`
    : '✨ จัดหมวดอัตโนมัติ';

  showToast(`สแกนสลิปสำเร็จ! จัดเข้าหมวด "${analysis.category_name}"`);
}

function clearSlipAttachment() {
  state.selectedSlipFile = null;
  document.getElementById('slipInput').value = '';
  document.getElementById('txExistingSlipUrl').value = '';
  document.getElementById('txOcrText').value = '';
  document.getElementById('txMatchedKeyword').value = '';
  document.getElementById('txRefNo').value = '';
  document.getElementById('dropZonePrompt').classList.remove('hidden');
  document.getElementById('slipPreviewArea').classList.add('hidden');
  document.getElementById('detectedCategoryCard').classList.add('hidden');
  document.getElementById('autoMatchBadge').classList.add('hidden');
}

// Generate Realistic Sample Slip Image on Canvas for Instant Testing
function generateSampleSlipAndScan(sampleKey) {
  const sample = SAMPLE_SLIPS[sampleKey];
  if (!sample) return;

  const canvas = document.createElement('canvas');
  canvas.width = 480;
  canvas.height = 600;
  const ctx = canvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Header Banner
  ctx.fillStyle = `${sample.bankColor}18`;
  ctx.fillRect(0, 0, canvas.width, 130);

  // Check Circle
  ctx.fillStyle = sample.bankColor;
  ctx.beginPath();
  ctx.arc(60, 65, 28, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(48, 65);
  ctx.lineTo(57, 74);
  ctx.lineTo(73, 55);
  ctx.stroke();

  // Header Text
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 24px Prompt, sans-serif';
  ctx.fillText(sample.headerText, 105, 60);

  ctx.fillStyle = '#64748b';
  ctx.font = '15px Prompt, sans-serif';
  ctx.fillText(`${sample.dateText} • ${sample.bankName}`, 105, 88);

  // Body lines
  ctx.fillStyle = '#64748b';
  ctx.font = '15px Prompt, sans-serif';
  ctx.fillText('จาก', 36, 180);
  ctx.fillStyle = '#1e293b';
  ctx.font = 'bold 17px Prompt, sans-serif';
  ctx.fillText('นาย สายเปย์ เก็บออมเก่ง', 130, 180);

  ctx.fillStyle = '#64748b';
  ctx.font = '15px Prompt, sans-serif';
  ctx.fillText('ไปยัง', 36, 250);
  ctx.fillStyle = '#0f172a';
  ctx.font = 'bold 18px Prompt, sans-serif';
  ctx.fillText(sample.merchant, 130, 250);

  // Divider
  ctx.strokeStyle = '#e2e8f0';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(36, 305);
  ctx.lineTo(444, 305);
  ctx.stroke();

  // Amount
  ctx.fillStyle = '#475569';
  ctx.font = '18px Prompt, sans-serif';
  ctx.fillText('จำนวนเงิน', 36, 360);

  ctx.fillStyle = sample.bankColor;
  ctx.font = 'bold 30px Prompt, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillText(`${sample.amount} บาท`, 444, 362);
  ctx.textAlign = 'left';

  // Ref No & Memo
  ctx.fillStyle = '#64748b';
  ctx.font = '15px Prompt, sans-serif';
  ctx.fillText(`เลขที่รายการ: ${sample.refNo}`, 36, 430);

  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(36, 465, 408, 75);
  ctx.fillStyle = '#334155';
  ctx.font = 'bold 16px Prompt, sans-serif';
  ctx.fillText(`บันทึกช่วยจำ: ${sample.memo}`, 52, 510);

  const simulatedOcrText = [
    sample.headerText,
    sample.dateText,
    `ไปยัง ${sample.merchant}`,
    `จำนวนเงิน ${sample.amount} บาท`,
    `เลขที่รายการ ${sample.refNo}`,
    `บันทึกช่วยจำ ${sample.memo}`
  ].join('\n');

  canvas.toBlob((blob) => {
    if (!blob) return;
    const file = new File([blob], `sample_${sampleKey}.png`, { type: 'image/png' });
    processSlipFile(file, simulatedOcrText);
  }, 'image/png');
}

// Open Slip Detail Modal
function openSlipModal(tx) {
  const modal = document.getElementById('slipModal');
  document.getElementById('slipModalTitle').textContent = tx.title;
  document.getElementById('slipModalImg').src = tx.slip_url;

  const badge = document.getElementById('slipModalCategoryBadge');
  const color = tx.category_color || '#2563eb';
  badge.style.background = `${color}18`;
  badge.style.color = color;
  badge.innerHTML = `<span>${tx.category_icon || '📦'}</span> <span>หมวด: ${escapeHtml(tx.category_name || 'ไม่ระบุ')}</span>`;

  document.getElementById('slipModalAmount').textContent = `฿${formatTHB(tx.amount)}`;
  document.getElementById('slipModalMerchant').textContent = tx.merchant || '-';
  document.getElementById('slipModalDateTime').textContent = `${tx.date} ${tx.time || ''}`;
  document.getElementById('slipModalKeyword').textContent = tx.matched_keyword
    ? `"${tx.matched_keyword}"`
    : 'เลือกด้วยตนเอง';
  document.getElementById('slipModalRef').textContent = tx.ref_no || '-';
  document.getElementById('slipModalOcrText').textContent = tx.ocr_text || 'ไม่มีข้อความ OCR';

  modal.classList.remove('hidden');
}

// Render Settings Modal Keywords
function renderSettingsKeywords() {
  const container = document.getElementById('categoryKeywordsContainer');
  if (!container) return;

  container.innerHTML = state.categories.map(cat => {
    const tags = (cat.keywords || []).map(kw => `
      <span class="kw-tag">
        ${escapeHtml(kw)}
        <button type="button" data-del-cat="${cat.id}" data-del-kw="${escapeHtml(kw)}" title="ลบคำค้นหานี้">✕</button>
      </span>
    `).join('');

    return `
      <div class="cat-kw-group">
        <div class="cat-kw-header">${cat.icon} ${escapeHtml(cat.name)}</div>
        <div class="cat-kw-tags">${tags}</div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-del-cat]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const catId = btn.dataset.delCat;
      const keyword = btn.dataset.delKw;
      await fetch(`/api/categories/${catId}/keywords`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword })
      });
      await loadCategoriesAndSettings();
      showToast(`ลบคำค้นหา "${keyword}" แล้ว`);
    });
  });
}

// Export CSV
function exportTransactionsToCsv() {
  if (state.transactions.length === 0) {
    showToast('ไม่มีรายการให้ส่งออก');
    return;
  }

  const headers = ['วันที่', 'เวลา', 'ประเภท', 'หมวดหมู่', 'ชื่อรายการ', 'ร้านค้า/ผู้รับโอน', 'จำนวนเงิน', 'คำที่ตรวจพบ', 'บันทึก'];
  const rows = state.transactions.map(t => [
    t.date,
    t.time,
    t.type === 'income' ? 'รายรับ' : 'รายจ่าย',
    t.category_name,
    t.title,
    t.merchant,
    t.amount,
    t.matched_keyword,
    t.note
  ]);

  const csvContent = '\uFEFF' + [headers, ...rows]
    .map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
    .join('\r\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `slipsense_report_${state.filters.month}.csv`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('ดาวน์โหลดไฟล์ CSV เรียบร้อยแล้ว');
}

// Bind All Event Listeners
function initEvents() {
  const dropZone = document.getElementById('dropZone');
  const slipInput = document.getElementById('slipInput');

  document.getElementById('btnBrowseSlip').addEventListener('click', (e) => {
    e.stopPropagation();
    slipInput.click();
  });

  dropZone.addEventListener('click', (e) => {
    if (e.target.closest('#slipPreviewArea')) return;
    slipInput.click();
  });

  slipInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
      processSlipFile(e.target.files[0]);
    }
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });

  dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processSlipFile(e.dataTransfer.files[0]);
    }
  });

  document.getElementById('btnRemoveSlip').addEventListener('click', (e) => {
    e.stopPropagation();
    clearSlipAttachment();
  });

  // Sample Slips Buttons
  document.querySelectorAll('[data-sample]').forEach(btn => {
    btn.addEventListener('click', () => {
      generateSampleSlipAndScan(btn.dataset.sample);
    });
  });

  // Type toggle buttons
  document.getElementById('btnTypeExpense').addEventListener('click', () => setFormType('expense'));
  document.getElementById('btnTypeIncome').addEventListener('click', () => setFormType('income'));

  // Live Auto-Categorize when typing Title or Merchant
  let classifyTimer = null;
  const triggerLiveClassify = () => {
    clearTimeout(classifyTimer);
    classifyTimer = setTimeout(async () => {
      const title = document.getElementById('txTitle').value.trim();
      const merchant = document.getElementById('txMerchant').value.trim();
      if (!title && !merchant) return;

      const res = await fetch('/api/classify-text', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: `${title} ${merchant}` })
      });
      const data = await res.json();
      if (data.matched_keyword) {
        setFormType(data.type);
        state.selectedCategoryId = data.category_id;
        renderCategorySelector();
        document.getElementById('txMatchedKeyword').value = data.matched_keyword;
        const autoBadge = document.getElementById('autoMatchBadge');
        autoBadge.classList.remove('hidden');
        autoBadge.textContent = `✨ ตรงกับคำว่า "${data.matched_keyword}"`;
      }
    }, 280);
  };

  document.getElementById('txTitle').addEventListener('input', triggerLiveClassify);
  document.getElementById('txMerchant').addEventListener('input', triggerLiveClassify);

  // Submit Transaction Form
  document.getElementById('txForm').addEventListener('submit', async (e) => {
    e.preventDefault();

    const amount = document.getElementById('txAmount').value;
    const title = document.getElementById('txTitle').value.trim();
    const merchant = document.getElementById('txMerchant').value.trim();
    const date = document.getElementById('txDate').value;
    const time = document.getElementById('txTime').value;
    const note = document.getElementById('txNote').value.trim();
    const existingSlipUrl = document.getElementById('txExistingSlipUrl').value;
    const ocrText = document.getElementById('txOcrText').value;
    const matchedKeyword = document.getElementById('txMatchedKeyword').value;
    const refNo = document.getElementById('txRefNo').value;
    const learnKeyword = document.getElementById('chkLearnKeyword').checked;

    const formData = new FormData();
    formData.append('type', state.selectedType);
    formData.append('amount', amount);
    formData.append('category_id', state.selectedCategoryId);
    formData.append('title', title);
    formData.append('merchant', merchant);
    formData.append('date', date);
    formData.append('time', time);
    formData.append('note', note);
    formData.append('existing_slip_url', existingSlipUrl);
    formData.append('ocr_text', ocrText);
    formData.append('matched_keyword', matchedKeyword || (learnKeyword ? title : ''));
    formData.append('ref_no', refNo);

    if (state.selectedSlipFile && !existingSlipUrl) {
      formData.append('slip', state.selectedSlipFile);
    }

    const res = await fetch('/api/transactions', {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json();
      showToast(err.error || 'เกิดข้อผิดพลาดในการบันทึก');
      return;
    }

    // Optionally teach the category keyword if checked and merchant/title is meaningful
    if (learnKeyword && title.length >= 2) {
      await fetch(`/api/categories/${state.selectedCategoryId}/keywords`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: title })
      });
      await loadCategoriesAndSettings();
    }

    // Reset Form
    document.getElementById('txAmount').value = '';
    document.getElementById('txTitle').value = '';
    document.getElementById('txMerchant').value = '';
    document.getElementById('txNote').value = '';
    clearSlipAttachment();
    resetDateTimeInputs();

    showToast('✅ บันทึกรายการและสลิปเรียบร้อยแล้ว!');
    loadTransactions();
  });

  // Filters
  document.getElementById('searchInput').addEventListener('input', (e) => {
    state.filters.search = e.target.value;
    loadTransactions();
  });

  document.getElementById('typeFilter').addEventListener('change', (e) => {
    state.filters.type = e.target.value;
    loadTransactions();
  });

  document.getElementById('categoryFilter').addEventListener('change', (e) => {
    state.filters.category_id = e.target.value;
    loadTransactions();
  });

  document.getElementById('btnResetCatFilter').addEventListener('click', () => {
    state.filters.category_id = 'all';
    document.getElementById('categoryFilter').value = 'all';
    loadTransactions();
  });

  // Modals
  document.getElementById('btnCloseSlipModal').addEventListener('click', () => {
    document.getElementById('slipModal').classList.add('hidden');
  });

  document.getElementById('btnManageRules').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.remove('hidden');
  });

  document.getElementById('btnCloseSettingsModal').addEventListener('click', () => {
    document.getElementById('settingsModal').classList.add('hidden');
  });

  // Save Gemini API Key
  document.getElementById('btnSaveApiKey').addEventListener('click', async () => {
    const key = document.getElementById('geminiKeyInput').value.trim();
    const res = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gemini_api_key: key })
    });
    const data = await res.json();
    state.hasGeminiKey = data.hasGeminiKey;
    document.getElementById('apiKeyStatusText').textContent = data.hasGeminiKey
      ? `✅ บันทึก Gemini API Key แล้ว (${data.maskedKey})`
      : 'ใช้โหมด Tesseract OCR บนเครื่องฟรี';
    document.getElementById('geminiKeyInput').value = '';
    await loadCategoriesAndSettings();
    showToast('บันทึกการตั้งค่า AI เรียบร้อย');
  });

  // Add Custom Keyword Rule
  document.getElementById('btnAddKeyword').addEventListener('click', async () => {
    const catId = document.getElementById('ruleCategorySelect').value;
    const kwInput = document.getElementById('newKeywordInput');
    const keyword = kwInput.value.trim();
    if (!keyword) return;

    await fetch(`/api/categories/${catId}/keywords`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword })
    });
    kwInput.value = '';
    await loadCategoriesAndSettings();
    showToast(`เพิ่มคำว่า "${keyword}" เรียบร้อยแล้ว`);
  });

  // Export CSV
  document.getElementById('btnExportCsv').addEventListener('click', exportTransactionsToCsv);

  // Edit Daily Target
  const btnEditTarget = document.getElementById('btnEditDailyTarget');
  if (btnEditTarget) {
    btnEditTarget.addEventListener('click', () => {
      const current = localStorage.getItem('ican_daily_target') || '300';
      const input = prompt('🎯 กำหนดเป้าหมายค่าใช้จ่ายต่อวัน (บาท):', current);
      if (input !== null) {
        const val = parseFloat(input);
        if (!isNaN(val) && val > 0) {
          localStorage.setItem('ican_daily_target', val.toString());
          renderPillars();
          showToast(`อัปเดตเป้าหมายรายวันเป็น ฿${val.toLocaleString('th-TH')} เรียบร้อย`);
        }
      }
    });
  }

  // Net Worth Modal Handlers
  const nwModal = document.getElementById('netWorthModal');
  const openNw = () => {
    if (!nwModal) return;
    const assets = localStorage.getItem('ican_assets') || '568000';
    const liab = localStorage.getItem('ican_liabilities') || '350000';
    const aInput = document.getElementById('nwAssetsInput');
    const lInput = document.getElementById('nwLiabilitiesInput');
    if (aInput) aInput.value = assets;
    if (lInput) lInput.value = liab;
    updateNwPreview();
    nwModal.classList.remove('hidden');
  };

  const closeNw = () => {
    if (nwModal) nwModal.classList.add('hidden');
  };

  const updateNwPreview = () => {
    const a = parseFloat(document.getElementById('nwAssetsInput')?.value) || 0;
    const l = parseFloat(document.getElementById('nwLiabilitiesInput')?.value) || 0;
    const nw = a - l;
    const previewEl = document.getElementById('nwPreviewCalc');
    if (previewEl) {
      previewEl.textContent = `${nw < 0 ? '-' : ''}฿${formatTHB(Math.abs(nw))}`;
      previewEl.className = nw >= 0 ? 'text-cyan' : 'text-expense';
    }
  };

  document.getElementById('btnOpenNetWorthModal')?.addEventListener('click', openNw);
  document.getElementById('btnEditNetWorthPillar')?.addEventListener('click', openNw);
  document.getElementById('btnCloseNetWorthModal')?.addEventListener('click', closeNw);

  document.getElementById('nwAssetsInput')?.addEventListener('input', updateNwPreview);
  document.getElementById('nwLiabilitiesInput')?.addEventListener('input', updateNwPreview);

  document.getElementById('netWorthForm')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const a = parseFloat(document.getElementById('nwAssetsInput')?.value) || 0;
    const l = parseFloat(document.getElementById('nwLiabilitiesInput')?.value) || 0;
    localStorage.setItem('ican_assets', a.toString());
    localStorage.setItem('ican_liabilities', l.toString());
    closeNw();
    renderPillars();
    showToast('💾 อัปเดตสถานะการเงิน (สินทรัพย์ & หนี้สิน) สำเร็จ!');
  });
}

// Update package.json start script & Bootstrap App
async function bootstrap() {
  initMonthPicker();
  resetDateTimeInputs();
  initEvents();
  await loadCategoriesAndSettings();
  await loadTransactions();
}

document.addEventListener('DOMContentLoaded', bootstrap);
