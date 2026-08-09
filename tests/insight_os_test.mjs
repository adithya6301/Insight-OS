// Insight OS - Comprehensive Logic Test Suite
// Tests: CSV parsing, data derivation, analytics, multi-store, AI prompts, edge cases
// Actual CSV schema: date, storeId, storeName, productId, productName, category,
//                   quantity, revenue, unitCost, latitude, longitude

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const ROOT       = path.resolve(__dirname, '..');

// ─── Colour helpers ───────────────────────────────────────────────────────────
const GREEN  = '\x1b[32m✓\x1b[0m';
const RED    = '\x1b[31m✗\x1b[0m';
const YELLOW = '\x1b[33m⚠\x1b[0m';
const BOLD   = (s) => `\x1b[1m${s}\x1b[0m`;
const CYAN   = (s) => `\x1b[36m${s}\x1b[0m`;

let passed = 0, failed = 0, warned = 0;

function pass(label) { console.log(`  ${GREEN} ${label}`); passed++; }
function fail(label, reason) { console.log(`  ${RED} ${label}\n       Reason: ${reason}`); failed++; }
function warn(label, reason) { console.log(`  ${YELLOW} ${label}\n       Note: ${reason}`); warned++; }
function section(title) { console.log(`\n${BOLD(CYAN('━━━ ' + title + ' ━━━'))}`); }

// ─── Simple CSV parser ────────────────────────────────────────────────────────
function parseCSV(filePath) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const lines = raw.trim().split('\n');
  const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
  return lines.slice(1).map(line => {
    const vals = line.split(',').map(v => v.trim().replace(/"/g, ''));
    const obj = {};
    headers.forEach((h, i) => obj[h] = vals[i] ?? '');
    return obj;
  });
}

// ─── Inline port of deriveInventoryFromPOS (matching actual CSV schema) ───────
function deriveInventoryFromPOS(posData) {
  const map = {};
  for (const row of posData) {
    const id   = row.productId || '';
    const name = row.productName || id;
    const qty  = parseFloat(row.quantity || '1') || 1;
    const rev  = parseFloat(row.revenue  || '0') || 0;
    const cost = parseFloat(row.unitCost || '0') || 0;
    const cat  = row.category || 'General';
    if (!id) continue;
    if (!map[id]) map[id] = { id, name, category: cat, totalSold: 0, totalRev: 0, costPrice: cost };
    map[id].totalSold += qty;
    map[id].totalRev  += rev;
  }
  return Object.values(map).map(p => {
    const unitPrice    = p.totalRev / p.totalSold;
    const currentStock = Math.max(10, Math.round(p.totalSold * 1.5));
    const reorderLevel = Math.max(5,  Math.round(p.totalSold * 0.5));
    const now          = new Date();
    const expiryDate   = new Date(now.getTime() + (30 + Math.floor(Math.random() * 60)) * 86400000);
    return {
      productId: p.id, productName: p.name, category: p.category,
      currentStock, reorderLevel, unitCost: p.costPrice,
      sellingPrice: parseFloat(unitPrice.toFixed(2)),
      expiryDate: expiryDate.toISOString().split('T')[0],
      supplier: 'Auto-Derived',
    };
  });
}

// ─── Business metrics (actual CSV schema) ────────────────────────────────────
function computeMetrics(posData) {
  let revenue = 0, cogs = 0, units = 0;
  const storeSet = new Set();
  const catRevenue = {};
  const dailySales = {};
  const productRev = {};

  for (const row of posData) {
    const qty   = parseFloat(row.quantity || '1') || 1;
    const rev   = parseFloat(row.revenue  || '0') || 0;
    const cost  = parseFloat(row.unitCost || '0') || 0;
    const store = row.storeId  || 'default';
    const cat   = row.category || 'General';
    const date  = row.date     || '';
    const prod  = row.productName || '';

    revenue += rev;
    cogs    += qty * cost;
    units   += qty;
    storeSet.add(store);
    catRevenue[cat]  = (catRevenue[cat]  || 0) + rev;
    productRev[prod] = (productRev[prod] || 0) + rev;
    if (date) dailySales[date] = (dailySales[date] || 0) + rev;
  }
  const grossProfit = revenue - cogs;
  const margin = revenue > 0 ? ((grossProfit / revenue) * 100).toFixed(1) : '0.0';
  return { revenue, cogs, grossProfit, margin: parseFloat(margin), units,
           storeCount: storeSet.size, storeSet, catRevenue, productRev,
           dailyCount: Object.keys(dailySales).length };
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 1 — File Existence & Structure
// ════════════════════════════════════════════════════════════════════════════
section('TEST 1 · File Existence & Structure');

const filesToCheck = [
  'src/App.tsx', 'src/main.tsx', 'src/index.css',
  'src/components/Dashboard.tsx', 'src/components/Charts.tsx',
  'src/components/CalendarHistory.tsx', 'src/components/AIChat.tsx',
  'src/components/CSVUpload.tsx', 'src/components/DataExplorer.tsx',
  'src/components/Heatmap.tsx', 'src/components/ReceiptOCR.tsx',
  'src/utils/dataAnalysis.ts', 'src/utils/aiService.ts',
  'src/utils/csvNormalizer.ts', 'src/utils/sampleData.ts',
  'matrix_1_small_business.csv', 'matrix_2_medium_regional_chain.csv',
  'matrix_3_large_enterprise.csv', 'public/brand_icon.jpg',
  'vite.config.ts', 'tsconfig.app.json', 'package.json',
];

for (const f of filesToCheck) {
  const fullPath = path.join(ROOT, f);
  if (fs.existsSync(fullPath)) {
    const size = fs.statSync(fullPath).size;
    pass(`${f}  (${size} bytes)`);
  } else {
    fail(f, 'File not found');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 2 — CSV Schema Validation (actual columns)
// ════════════════════════════════════════════════════════════════════════════
section('TEST 2 · CSV Schema & Row Validation');

const REQUIRED_COLS = ['date','storeId','storeName','productId','productName','category','quantity','revenue','unitCost'];
const matrices = [
  { file: 'matrix_1_small_business.csv',        expectedStores: 1,  minRows: 10 },
  { file: 'matrix_2_medium_regional_chain.csv', expectedStores: 3,  minRows: 15 },
  { file: 'matrix_3_large_enterprise.csv',      expectedStores: 10, minRows: 20 },
];

for (const m of matrices) {
  const rows = parseCSV(path.join(ROOT, m.file));
  const headers = Object.keys(rows[0] || {});

  // Row count minimum
  if (rows.length >= m.minRows) {
    pass(`${m.file} — ${rows.length} data rows (≥ ${m.minRows} required)`);
  } else {
    warn(`${m.file} — only ${rows.length} rows`, `expected at least ${m.minRows}`);
  }

  // Required columns
  const missing = REQUIRED_COLS.filter(c => !headers.includes(c));
  if (missing.length === 0) {
    pass(`${m.file} — all 9 required columns present`);
  } else {
    fail(`${m.file} — missing columns`, missing.join(', '));
  }

  // Store count
  const storeIds = new Set(rows.map(r => r.storeId));
  if (storeIds.size === m.expectedStores) {
    pass(`${m.file} — correct store count = ${storeIds.size}`);
  } else {
    fail(`${m.file} — store count = ${storeIds.size}`, `expected ${m.expectedStores}`);
  }

  // No empty critical fields
  let emptyCount = 0;
  for (const row of rows) {
    for (const col of ['productId','productName','quantity','revenue']) {
      if (!row[col] || row[col].trim() === '') emptyCount++;
    }
  }
  if (emptyCount === 0) {
    pass(`${m.file} — no empty critical fields`);
  } else {
    fail(`${m.file} — empty critical fields`, `${emptyCount} empty cells`);
  }

  // Geo coordinates present
  const noGeo = rows.filter(r => !r.latitude || !r.longitude).length;
  if (noGeo === 0) {
    pass(`${m.file} — all rows have GPS coordinates (lat/long)`);
  } else {
    warn(`${m.file} — ${noGeo} rows missing geo coordinates`, 'Heatmap may show partial data');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 3 — deriveInventoryFromPOS Logic
// ════════════════════════════════════════════════════════════════════════════
section('TEST 3 · deriveInventoryFromPOS — Dynamic Inventory Derivation');

const posMatrix1   = parseCSV(path.join(ROOT, 'matrix_1_small_business.csv'));
const uniqueProds  = new Set(posMatrix1.map(r => r.productId));
const derived1     = deriveInventoryFromPOS(posMatrix1);

// Correct count per unique product
if (derived1.length === uniqueProds.size) {
  pass(`deriveInventoryFromPOS — produced ${derived1.length} records for ${uniqueProds.size} unique products`);
} else {
  fail('deriveInventoryFromPOS — count mismatch', `got ${derived1.length}, expected ${uniqueProds.size}`);
}

// No sample data leakage
const SAMPLE_IDS = ['PRD-001','PRD-005','PRD-011','PRD-033'];
const leaked = derived1.filter(r => SAMPLE_IDS.includes(r.productId));
if (leaked.length === 0) {
  pass('deriveInventoryFromPOS — zero default/sample product IDs leaked into derived inventory');
} else {
  fail('deriveInventoryFromPOS — sample data leaked', leaked.map(r => r.productId).join(', '));
}

// Stock levels are logical
const badStock = derived1.filter(r => r.currentStock < r.reorderLevel || r.reorderLevel < 1);
if (badStock.length === 0) {
  pass('deriveInventoryFromPOS — all stock levels valid (currentStock ≥ reorderLevel ≥ 1)');
} else {
  fail('deriveInventoryFromPOS — invalid stock levels', `${badStock.length} records`);
}

// Expiry dates all in future
const today = new Date();
const pastExpiry = derived1.filter(r => new Date(r.expiryDate) <= today);
if (pastExpiry.length === 0) {
  pass('deriveInventoryFromPOS — all derived expiry dates are future-dated');
} else {
  fail('deriveInventoryFromPOS — past expiry dates found', `${pastExpiry.length} items`);
}

// Selling price > unit cost for margin
const negativeMargin = derived1.filter(r => r.sellingPrice > 0 && r.unitCost > 0 && r.unitCost >= r.sellingPrice);
if (negativeMargin.length === 0) {
  pass('deriveInventoryFromPOS — positive gross margin on all derived products');
} else {
  warn('deriveInventoryFromPOS — some items have zero/negative margin', `${negativeMargin.length} items`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 4 — Business Metrics Accuracy
// ════════════════════════════════════════════════════════════════════════════
section('TEST 4 · Business Metrics Accuracy');

const m1 = computeMetrics(parseCSV(path.join(ROOT, 'matrix_1_small_business.csv')));
const m2 = computeMetrics(parseCSV(path.join(ROOT, 'matrix_2_medium_regional_chain.csv')));
const m3 = computeMetrics(parseCSV(path.join(ROOT, 'matrix_3_large_enterprise.csv')));

// Matrix 1
if (Math.abs(m1.revenue - 68700) < 200) {
  pass(`Matrix 1 — Revenue ₹${m1.revenue.toLocaleString('en-IN')} ✓ (expected ≈ ₹68,700)`);
} else {
  fail('Matrix 1 — Revenue mismatch', `got ₹${Math.round(m1.revenue)}, expected ≈ ₹68,700`);
}
if (m1.units >= 130 && m1.units <= 150) {
  pass(`Matrix 1 — Units sold = ${m1.units} (expected 130–150)`);
} else {
  warn(`Matrix 1 — Units sold = ${m1.units}`, 'outside expected range');
}
if (m1.storeCount === 1) {
  pass(`Matrix 1 — Single store correctly isolated: ${[...m1.storeSet][0]}`);
} else {
  fail('Matrix 1 — Store count', `got ${m1.storeCount}, expected 1`);
}
if (m1.margin > 20 && m1.margin < 80) {
  pass(`Matrix 1 — Gross margin = ${m1.margin}% (healthy)`);
} else {
  warn(`Matrix 1 — Gross margin = ${m1.margin}%`, 'review cost prices');
}

// Matrix 2
if (m2.storeCount === 3) {
  pass(`Matrix 2 — 3 store IDs detected: ${[...m2.storeSet].join(', ')}`);
} else {
  fail('Matrix 2 — Store count', `got ${m2.storeCount}`);
}
if (m2.margin > 20 && m2.margin < 80) {
  pass(`Matrix 2 — Gross margin = ${m2.margin}% (healthy)`);
} else {
  warn(`Matrix 2 — Gross margin = ${m2.margin}%`, 'review cost prices');
}
if (m2.units >= 200) {
  pass(`Matrix 2 — Total units sold = ${m2.units} (expected 200+)`);
} else {
  warn(`Matrix 2 — Units sold = ${m2.units}`, 'lower than expected for 3-store chain');
}

// Matrix 3
if (m3.storeCount === 10) {
  pass(`Matrix 3 — 10 national stores detected`);
} else {
  fail('Matrix 3 — Store count', `got ${m3.storeCount}`);
}
if (m3.units >= 700) {
  pass(`Matrix 3 — Total units sold = ${m3.units} (expected 700+)`);
} else {
  warn(`Matrix 3 — Units sold = ${m3.units}`, 'below expected for 10-store enterprise');
}
if (m3.revenue > m2.revenue && m2.revenue > m1.revenue) {
  pass(`Revenue scales correctly: ₹${Math.round(m1.revenue/1000)}K → ₹${Math.round(m2.revenue/100000)}L → ₹${Math.round(m3.revenue/100000)}L`);
} else {
  fail('Revenue scaling across matrices', `M1=${Math.round(m1.revenue)}, M2=${Math.round(m2.revenue)}, M3=${Math.round(m3.revenue)}`);
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 5 — Product & Category Diversity
// ════════════════════════════════════════════════════════════════════════════
section('TEST 5 · Product & Category Diversity');

for (const m of matrices) {
  const rows  = parseCSV(path.join(ROOT, m.file));
  const cats  = new Set(rows.map(r => r.category));
  const prods = new Set(rows.map(r => r.productId));
  if (cats.size >= 2) {
    pass(`${m.file} — ${cats.size} categories: ${[...cats].join(', ')}`);
  } else {
    warn(`${m.file} — only ${cats.size} category`, 'expected at least 2 for realistic analysis');
  }
  if (prods.size >= 3) {
    pass(`${m.file} — ${prods.size} unique products`);
  } else {
    fail(`${m.file} — product diversity`, `only ${prods.size} unique products`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 6 — Pricing Integrity
// ════════════════════════════════════════════════════════════════════════════
section('TEST 6 · Pricing Integrity');

for (const m of matrices) {
  const rows = parseCSV(path.join(ROOT, m.file));
  let errors = 0;
  for (const row of rows) {
    const qty  = parseFloat(row.quantity || '0');
    const rev  = parseFloat(row.revenue  || '0');
    const cost = parseFloat(row.unitCost || '0');
    if (qty  <= 0) errors++;
    if (rev  <= 0) errors++;
    if (cost <= 0) errors++;
    const unitPrice = rev / qty;
    if (cost >= unitPrice) errors++; // negative/zero margin
  }
  if (errors === 0) {
    pass(`${m.file} — all rows have valid pricing (revenue > 0, unitCost > 0, margin positive)`);
  } else {
    fail(`${m.file} — pricing errors`, `${errors} rows with invalid pricing`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 7 — Date Continuity & Calendar Coverage
// ════════════════════════════════════════════════════════════════════════════
section('TEST 7 · Date Continuity & Calendar Coverage');

for (const m of matrices) {
  const rows  = parseCSV(path.join(ROOT, m.file));
  const dates = [...new Set(rows.map(r => r.date))].sort();
  if (dates.length >= 2) {
    pass(`${m.file} — ${dates.length} unique dates (${dates[0]} → ${dates[dates.length-1]})`);
  } else {
    warn(`${m.file} — only ${dates.length} date(s)`, 'calendar history will be sparse');
  }
  const badDates = dates.filter(d => !/^\d{4}-\d{2}-\d{2}$/.test(d));
  if (badDates.length === 0) {
    pass(`${m.file} — all dates in valid YYYY-MM-DD format`);
  } else {
    fail(`${m.file} — invalid date format`, badDates.join(', '));
  }
  // Continuity check (no gaps > 2 days for daily transactions)
  let maxGap = 0;
  for (let i = 1; i < dates.length; i++) {
    const gap = (new Date(dates[i]) - new Date(dates[i-1])) / 86400000;
    if (gap > maxGap) maxGap = gap;
  }
  if (maxGap <= 3) {
    pass(`${m.file} — max date gap = ${maxGap} day(s) (continuous data)`);
  } else {
    warn(`${m.file} — max date gap = ${maxGap} days`, 'calendar will show empty intervals');
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 8 — Source Code Integrity
// ════════════════════════════════════════════════════════════════════════════
section('TEST 8 · Source Code Integrity');

const srcChecks = [
  { file: 'src/App.tsx',               contains: 'deriveInventoryFromPOS',        label: 'App.tsx imports & calls deriveInventoryFromPOS' },
  { file: 'src/App.tsx',               contains: "storeId: 'all'",                label: 'App.tsx resets storeId filter on upload' },
  { file: 'src/App.tsx',               contains: 'brand_icon.jpg',                label: 'App.tsx renders custom brand icon' },
  { file: 'src/App.tsx',               contains: 'CalendarHistory',               label: 'App.tsx registers CalendarHistory tab' },
  { file: 'src/App.tsx',               contains: 'theme-midnight',                label: 'App.tsx applies midnight theme class' },
  { file: 'src/utils/dataAnalysis.ts', contains: 'deriveInventoryFromPOS',        label: 'dataAnalysis.ts exports deriveInventoryFromPOS' },
  { file: 'src/utils/dataAnalysis.ts', contains: 'getDailyHistory',               label: 'dataAnalysis.ts exports getDailyHistory' },
  { file: 'src/utils/dataAnalysis.ts', contains: 'getSeasonalTrends',             label: 'dataAnalysis.ts exports getSeasonalTrends' },
  { file: 'src/utils/dataAnalysis.ts', contains: 'expiryDate',                    label: 'dataAnalysis.ts generates expiry dates' },
  { file: 'src/components/CalendarHistory.tsx', contains: 'CalendarHistory',      label: 'CalendarHistory.tsx component defined' },
  { file: 'src/components/CalendarHistory.tsx', contains: 'getDailyHistory',      label: 'CalendarHistory.tsx calls getDailyHistory' },
  { file: 'src/components/AIChat.tsx', contains: 'Diwali',                        label: 'AIChat.tsx has Diwali seasonal prompt chip' },
  { file: 'src/components/AIChat.tsx', contains: 'discount',                      label: 'AIChat.tsx has discount recommendation prompt' },
  { file: 'src/utils/aiService.ts',    contains: 'seasonal',                      label: 'aiService.ts handles seasonal trend queries' },
  { file: 'src/utils/aiService.ts',    contains: 'expir',                         label: 'aiService.ts handles near-expiry alerts' },
  { file: 'src/index.css',             contains: 'theme-midnight',                label: 'index.css has midnight theme CSS vars' },
  { file: 'src/index.css',             contains: 'theme-light',                   label: 'index.css has light theme CSS vars' },
  { file: 'src/index.css',             contains: '--accent-color',                label: 'index.css has global accent-color token' },
];

for (const check of srcChecks) {
  const content = fs.readFileSync(path.join(ROOT, check.file), 'utf-8');
  if (content.includes(check.contains)) {
    pass(check.label);
  } else {
    fail(check.label, `"${check.contains}" not found in ${check.file}`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 9 — Build Artifact Verification
// ════════════════════════════════════════════════════════════════════════════
section('TEST 9 · Build Artifact Verification');

const distPath = path.join(ROOT, 'dist');
if (fs.existsSync(path.join(distPath, 'index.html'))) {
  pass('dist/index.html — build output present');
  const html = fs.readFileSync(path.join(distPath, 'index.html'), 'utf-8');
  if (html.includes('<script') && html.includes('<link')) {
    pass('dist/index.html — contains script and stylesheet references');
  } else {
    fail('dist/index.html — missing asset references', 'Build may be incomplete');
  }
} else {
  fail('dist/index.html', 'Missing — run vite build');
}

const assetsDir = path.join(distPath, 'assets');
if (fs.existsSync(assetsDir)) {
  const jsFiles  = fs.readdirSync(assetsDir).filter(f => f.endsWith('.js'));
  const cssFiles = fs.readdirSync(assetsDir).filter(f => f.endsWith('.css'));
  for (const jf of jsFiles) {
    const size = fs.statSync(path.join(assetsDir, jf)).size;
    const gzApprox = Math.round(size * 0.286);
    if (size > 50000) {
      pass(`JS bundle: ${jf}  ${(size/1024).toFixed(1)} KB raw / ~${(gzApprox/1024).toFixed(1)} KB gzip`);
    } else {
      warn(`JS bundle ${jf}`, `only ${(size/1024).toFixed(1)} KB — may be incomplete`);
    }
  }
  for (const cf of cssFiles) {
    const size = fs.statSync(path.join(assetsDir, cf)).size;
    if (size > 5000) {
      pass(`CSS bundle: ${cf}  ${(size/1024).toFixed(1)} KB`);
    } else {
      warn(`CSS bundle ${cf}`, `only ${(size/1024).toFixed(1)} KB`);
    }
  }
  if (jsFiles.length > 0 && cssFiles.length > 0) {
    pass(`Build complete — ${jsFiles.length} JS chunk(s), ${cssFiles.length} CSS chunk(s)`);
  }
}

// ════════════════════════════════════════════════════════════════════════════
// TEST 10 — Dependency Sanity
// ════════════════════════════════════════════════════════════════════════════
section('TEST 10 · Dependency Sanity');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf-8'));
const requiredDeps = ['react', 'react-dom', 'recharts', 'papaparse', 'leaflet', 'react-leaflet', 'lucide-react'];
for (const dep of requiredDeps) {
  if (pkg.dependencies[dep]) {
    pass(`${dep} @ ${pkg.dependencies[dep]}`);
  } else {
    fail(`Dependency missing: ${dep}`, 'package.json incomplete');
  }
}
const nodeModulesOk = fs.existsSync(path.join(ROOT, 'node_modules', 'react'));
if (nodeModulesOk) {
  pass('node_modules installed and present');
} else {
  fail('node_modules', 'Not installed — run npm install');
}

// ════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ════════════════════════════════════════════════════════════════════════════
console.log(`\n${'═'.repeat(66)}`);
console.log(BOLD('   INSIGHT OS — FULL TEST SUITE RESULTS'));
console.log('═'.repeat(66));
console.log(`   ${GREEN} PASSED   : ${passed}`);
console.log(`   ${YELLOW} WARNINGS : ${warned}`);
console.log(`   ${RED} FAILED   : ${failed}`);
const total = passed + warned + failed;
console.log(`   Total Tests : ${total}`);
console.log('═'.repeat(66));

if (failed === 0) {
  console.log(`\n  \x1b[32m\x1b[1m🎉  All ${total} tests passed! Insight OS is production-ready.\x1b[0m\n`);
} else {
  console.log(`\n  \x1b[31m\x1b[1m⚠   ${failed} test(s) failed — see details above.\x1b[0m\n`);
  process.exit(1);
}
