import type { 
  StorePerformance, 
  BusinessProblem, 
  BusinessInsight, 
  ProductPerformance, 
  CategoryPerformance,
  FilterOptions
} from '../types';

export function filterPOSData(posData: any[], filters?: FilterOptions): any[] {
  if (!posData || posData.length === 0) return [];
  let filtered = [...posData];

  if (filters?.storeId && filters.storeId !== 'all') {
    filtered = filtered.filter((row) => row.storeId === filters.storeId);
  }

  if (filters?.category && filters.category !== 'all') {
    filtered = filtered.filter((row) => row.category === filters.category);
  }

  if (filters?.dateRange && filters.dateRange !== 'all') {
    const dates = filtered.map(r => new Date(r.date).getTime()).filter(d => !isNaN(d));
    if (dates.length > 0) {
      const maxDate = Math.max(...dates);
      let days = 365;
      if (filters.dateRange === '7d') days = 7;
      if (filters.dateRange === '30d') days = 30;
      if (filters.dateRange === '90d') days = 90;
      if (filters.dateRange === 'year') days = 365;

      const cutoff = maxDate - days * 24 * 60 * 60 * 1000;
      filtered = filtered.filter((row) => new Date(row.date).getTime() >= cutoff);
    }
  }

  return filtered;
}

export function deriveInventoryFromPOS(posData: any[]): any[] {
  if (!posData || posData.length === 0) return [];

  const map = new Map<string, any>();
  const dates = posData.map(r => new Date(r.date).getTime()).filter(d => !isNaN(d));
  const latestTime = dates.length > 0 ? Math.max(...dates) : new Date('2026-08-09').getTime();
  const latestDateStr = new Date(latestTime).toISOString().slice(0, 10);

  posData.forEach((row, idx) => {
    const productId = row.productId || `PRD-${idx + 1}`;
    const productName = row.productName || `Product ${productId}`;
    const category = row.category || 'General';
    const quantity = parseFloat(row.quantity) || 1;
    const revenue = parseFloat(row.revenue) || 0;
    const unitCost = row.unitCost ? parseFloat(row.unitCost) : (revenue * 0.6 / Math.max(1, quantity));

    if (!map.has(productId)) {
      map.set(productId, {
        productId,
        productName,
        category,
        totalQty: 0,
        unitCost,
        lastRestocked: row.date || latestDateStr,
      });
    }

    const item = map.get(productId);
    item.totalQty += quantity;
    if (row.date && row.date > item.lastRestocked) {
      item.lastRestocked = row.date;
    }
  });

  const perishableCategories = ['grocery', 'food', 'confectionery', 'dairy', 'beverage', 'apparel', 'home decor'];

  return Array.from(map.values()).map((item, idx) => {
    const isLowStock = idx % 4 === 0;
    const currentStock = isLowStock
      ? Math.max(2, Math.round(item.totalQty * 0.25))
      : Math.round(item.totalQty * 2.2);
    const reorderLevel = Math.max(4, Math.round(item.totalQty * 0.45));

    let expiryDate: string | undefined = undefined;
    const isPerishable = perishableCategories.some(c => item.category.toLowerCase().includes(c));
    if (isPerishable || idx % 2 === 0) {
      const daysToAdd = 8 + ((idx * 7) % 20); // 8 to 27 days after dataset date
      const expTime = latestTime + daysToAdd * 24 * 60 * 60 * 1000;
      expiryDate = new Date(expTime).toISOString().slice(0, 10);
    }

    return {
      productId: item.productId,
      productName: item.productName,
      category: item.category,
      currentStock,
      reorderLevel,
      unitCost: item.unitCost,
      supplier: `${item.category} Vendor Co`,
      lastRestocked: item.lastRestocked,
      expiryDate,
    };
  });
}


export function analyzeBusinessData(
  rawPOS: any[],
  rawInventory: any[],
  filters?: FilterOptions
): BusinessInsight {
  const problems: BusinessProblem[] = [];
  const opportunities: BusinessProblem[] = [];
  const trends: any[] = [];

  const posData = filterPOSData(rawPOS, filters);
  const inventoryData = rawInventory.filter(row => row.productId);

  // Map inventory cost per product
  const inventoryCostMap = new Map<string, number>();
  inventoryData.forEach(item => {
    if (item.productId && item.unitCost) {
      inventoryCostMap.set(item.productId, parseFloat(item.unitCost) || 0);
    }
  });

  // Calculate Product Performance
  const productPerformance = analyzeProductSales(posData, inventoryData);
  
  // Inventory Risk & Expiry Analysis
  let outOfStockCount = 0;
  let lowStockCount = 0;
  let expiringItemsCount = 0;

  const referenceDate = new Date('2026-08-09').getTime();

  inventoryData.forEach((item: any, idx: number) => {
    const currentStock = parseFloat(item.currentStock) || 0;
    const reorderLevel = parseFloat(item.reorderLevel) || 0;
    const unitCost = parseFloat(item.unitCost) || 0;
    const matchedProduct = productPerformance.find(p => p.productId === item.productId);
    const estLoss = matchedProduct ? matchedProduct.totalRevenue / Math.max(1, matchedProduct.totalQuantity) * reorderLevel : unitCost * 10;

    // Expiry Date Evaluation
    if (item.expiryDate) {
      const expTime = new Date(item.expiryDate).getTime();
      if (!isNaN(expTime)) {
        const daysLeft = Math.ceil((expTime - referenceDate) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 15 && currentStock > 0) {
          expiringItemsCount++;
          const recAmount = currentStock * unitCost * 0.6;
          problems.push({
            id: `prob-expiry-critical-${item.productId}-${idx}`,
            type: 'expiry',
            severity: 'high',
            title: `CRITICAL EXPIRY RISK: ${item.productName}`,
            description: `${item.productName} (${currentStock} units) expires in ${daysLeft} days (${item.expiryDate}). Without intervention, stock value of ₹${(currentStock * unitCost).toLocaleString('en-IN')} will be lost.`,
            financialImpact: `Estimated capital recovery: ~₹${recAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} via 40% Flash Discount`,
            affectedProducts: [item.productId],
            recommendation: `Apply 40% Flash Clearance Discount immediately on POS to liquidate stock before expiry date.`,
            recommendedDiscount: 40,
            actionSteps: [
              `Apply 40% clearance discount flag on store POS terminals`,
              `Place promotional end-cap banner near store entrance`,
              `Send push notification or SMS alert to local loyalty members`
            ],
            timestamp: new Date().toISOString(),
          });
        } else if (daysLeft > 15 && daysLeft <= 45 && currentStock > 0) {
          expiringItemsCount++;
          const recAmount = currentStock * unitCost * 0.8;
          problems.push({
            id: `prob-expiry-warning-${item.productId}-${idx}`,
            type: 'expiry',
            severity: 'medium',
            title: `Near Expiry Warning: ${item.productName}`,
            description: `${item.productName} (${currentStock} units on-hand) is approaching expiry in ${daysLeft} days (${item.expiryDate}).`,
            financialImpact: `Estimated capital recovery: ~₹${recAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })} via 20% Bundle Discount`,
            affectedProducts: [item.productId],
            recommendation: `Apply 20% Promotional Bundle Discount with fast-moving complementary items.`,
            recommendedDiscount: 20,
            actionSteps: [
              `Bundle item with high-volume Class-A products at 20% discount`,
              `Monitor daily sell-through rate over next 7 days`
            ],
            timestamp: new Date().toISOString(),
          });
        }
      }
    }

    if (currentStock === 0) {
      outOfStockCount++;
      problems.push({
        id: `prob-stockout-${item.productId}-${idx}`,
        type: 'inventory',
        severity: 'high',
        title: `CRITICAL: Stockout on ${item.productName}`,
        description: `Product ${item.productName} (${item.category || 'General'}) is completely out of stock with zero inventory remaining.`,
        financialImpact: `Estimated lost revenue: ~₹${estLoss.toLocaleString('en-IN', { maximumFractionDigits: 0 })}/period`,
        affectedProducts: [item.productId],
        recommendation: `Issue urgent restock purchase order to supplier (${item.supplier || 'Primary Supplier'}).`,
        actionSteps: [
          `Contact supplier ${item.supplier || 'vendor'} for rush delivery`,
          `Set emergency reorder buffer for high-velocity items`,
          `Notify affected store managers to adjust displays`
        ],
        timestamp: new Date().toISOString(),
      });
    } else if (currentStock <= reorderLevel) {
      lowStockCount++;
      problems.push({
        id: `prob-lowstock-${item.productId}-${idx}`,
        type: 'inventory',
        severity: 'medium',
        title: `Low Stock Warning: ${item.productName}`,
        description: `Current stock (${currentStock} units) is below reorder threshold (${reorderLevel} units).`,
        financialImpact: `Risk of stockout within ${matchedProduct?.daysOfSupply || 3} days based on sales velocity.`,
        affectedProducts: [item.productId],
        recommendation: `Initiate standard reorder of at least ${reorderLevel * 2} units.`,
        actionSteps: [
          `Review reorder lead times with supplier`,
          `Reallocate stock from nearby overstocked store if available`
        ],
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Analyze store performance
  const storePerformance = analyzeStorePerformance(posData, inventoryCostMap);
  const totalRevenue = storePerformance.reduce((sum, s) => sum + s.totalRevenue, 0);
  const totalProfit = storePerformance.reduce((sum, s) => sum + s.totalProfit, 0);
  const totalUnitsSold = storePerformance.reduce((sum, s) => sum + s.totalSales, 0);
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  const avgRevenue = storePerformance.length > 0 ? totalRevenue / storePerformance.length : 0;

  storePerformance.forEach((store, idx) => {
    if (store.profitMargin < 15 && store.totalRevenue > 0) {
      problems.push({
        id: `prob-margin-${store.storeId}-${idx}`,
        type: 'profitability',
        severity: 'high',
        title: `Low Profit Margin at ${store.storeName}`,
        description: `${store.storeName} has a low profit margin of ${store.profitMargin.toFixed(1)}% (below target 20%).`,
        financialImpact: `Profit loss of ~₹${(store.totalRevenue * 0.1).toLocaleString('en-IN', { maximumFractionDigits: 0 })} compared to benchmark stores.`,
        affectedStores: [store.storeId],
        recommendation: `Review discount policies, high-cost merchandise mix, and local overheads.`,
        actionSteps: [
          `Audit localized product pricing and discounts`,
          `Promote higher-margin accessories and premium items`
        ],
        timestamp: new Date().toISOString(),
      });
    }

    if (store.totalRevenue < avgRevenue * 0.7 && storePerformance.length > 1) {
      problems.push({
        id: `prob-underperform-${store.storeId}-${idx}`,
        type: 'store',
        severity: 'medium',
        title: `Underperforming Store: ${store.storeName}`,
        description: `Revenue (₹${store.totalRevenue.toLocaleString('en-IN')}) is 30% below store chain average (₹${avgRevenue.toLocaleString('en-IN')}).`,
        financialImpact: `Underperforming average by ₹${(avgRevenue - store.totalRevenue).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`,
        affectedStores: [store.storeId],
        recommendation: `Audit foot traffic, store layout, staff training, and inventory localized fit.`,
        timestamp: new Date().toISOString(),
      });
    }

    if (store.growthRate > 0.15) {
      opportunities.push({
        id: `opp-growth-${store.storeId}-${idx}`,
        type: 'opportunity',
        severity: 'high',
        title: `High Growth Store: ${store.storeName}`,
        description: `Store is expanding rapidly with a ${(store.growthRate * 100).toFixed(1)}% sales surge.`,
        financialImpact: `Generates +₹${(store.totalProfit * 0.25).toLocaleString('en-IN', { maximumFractionDigits: 0 })} extra monthly profit`,
        affectedStores: [store.storeId],
        recommendation: `Capitalize on high demand by increasing inventory allocation and running cross-promotions.`,
        actionSteps: [
          `Increase stock cap for top 5 category items at this location`,
          `Document best-practice store merchandising to replicate chain-wide`
        ],
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Category Performance Analysis
  const categoryBreakdown = analyzeCategoryPerformance(posData, inventoryCostMap, totalRevenue);

  // Top Category Opportunity
  if (categoryBreakdown.length > 0) {
    const topCat = categoryBreakdown[0];
    opportunities.push({
      id: `opp-cat-${topCat.category}`,
      type: 'opportunity',
      severity: 'medium',
      title: `Dominant Category: ${topCat.category}`,
      description: `${topCat.category} represents ${topCat.shareOfRevenue.toFixed(1)}% of total business revenue (₹${topCat.totalRevenue.toLocaleString('en-IN')}).`,
      financialImpact: `High margin sector generating ₹${topCat.totalProfit.toLocaleString('en-IN')} net profit`,
      recommendation: `Expand product depth in ${topCat.category} with premium variants and accessory bundles.`,
      timestamp: new Date().toISOString(),
    });
  }

  // Sales Trend Analysis
  const monthlySales = calculateMonthlySales(posData);
  if (monthlySales.length >= 2) {
    const recent = monthlySales[monthlySales.length - 1].total;
    const previous = monthlySales[monthlySales.length - 2].total;
    const growth = previous > 0 ? ((recent - previous) / previous) * 100 : 0;

    trends.push({
      metric: 'Total Revenue',
      direction: growth > 0.5 ? 'up' : growth < -0.5 ? 'down' : 'stable',
      value: growth,
      period: 'Period Comparison',
    });
  }

  // Top Products Opportunities
  const topProducts = productPerformance.filter(p => p.abcClass === 'A');
  const bottomProducts = productPerformance.filter(p => p.abcClass === 'C');

  if (topProducts.length > 0) {
    opportunities.push({
      id: `opp-top-prd-${topProducts[0].productId}`,
      type: 'opportunity',
      severity: 'high',
      title: `Hero Product: ${topProducts[0].productName}`,
      description: `Class-A revenue generator with ₹${topProducts[0].totalRevenue.toLocaleString('en-IN')} in gross sales (${topProducts[0].totalQuantity} units).`,
      financialImpact: `Generates ₹${topProducts[0].totalProfit.toLocaleString('en-IN')} in total gross profit`,
      affectedProducts: [topProducts[0].productId],
      recommendation: `Protect safety stock and run featured marketing banner campaigns.`,
      timestamp: new Date().toISOString(),
    });
  }

  const summary = generateSummary(problems, opportunities, storePerformance, totalRevenue, totalProfit);

  return {
    summary,
    totalRevenue,
    totalProfit,
    profitMargin,
    totalUnitsSold,
    outOfStockCount,
    lowStockCount,
    expiringItemsCount,
    problems,
    opportunities,
    trends,
    categoryBreakdown,
    topProducts: productPerformance.slice(0, 10),
    bottomProducts: bottomProducts.slice(-10),
  };
}

export function analyzeStorePerformance(
  posData: any[],
  inventoryCostMap?: Map<string, number>
): StorePerformance[] {
  const storeMap = new Map<string, any>();

  posData.forEach((row) => {
    const storeId = row.storeId || 'STR-00';
    const storeName = row.storeName || `Store ${storeId}`;
    const revenue = parseFloat(row.revenue) || 0;
    const quantity = parseFloat(row.quantity) || 0;
    const unitCost = row.unitCost 
      ? parseFloat(row.unitCost) 
      : (inventoryCostMap?.get(row.productId) || revenue * 0.6 / Math.max(1, quantity));
    const cost = unitCost * quantity;
    const profit = revenue - cost;

    if (!storeMap.has(storeId)) {
      storeMap.set(storeId, {
        storeId,
        storeName,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
        totalSales: 0,
        transactions: 0,
        categories: new Map<string, number>(),
        latitude: row.latitude ? parseFloat(row.latitude) : undefined,
        longitude: row.longitude ? parseFloat(row.longitude) : undefined,
      });
    }

    const store = storeMap.get(storeId);
    store.totalRevenue += revenue;
    store.totalCost += cost;
    store.totalProfit += profit;
    store.totalSales += quantity;
    store.transactions += 1;

    if (store.latitude === undefined && row.latitude !== undefined && !isNaN(parseFloat(row.latitude))) {
      store.latitude = parseFloat(row.latitude);
    }
    if (store.longitude === undefined && row.longitude !== undefined && !isNaN(parseFloat(row.longitude))) {
      store.longitude = parseFloat(row.longitude);
    }

    if (row.category) {
      store.categories.set(row.category, (store.categories.get(row.category) || 0) + revenue);
    }
  });

  const stores = Array.from(storeMap.values()).map((store) => {
    const profitMargin = store.totalRevenue > 0 ? (store.totalProfit / store.totalRevenue) * 100 : 0;
    const averageOrderValue = store.transactions > 0 ? store.totalRevenue / store.transactions : 0;
    const unitsPerTransaction = store.transactions > 0 ? store.totalSales / store.transactions : 0;
    const growthRate = calculateGrowthRate(posData, store.storeId);

    // Top Category
    let topCategory = 'General';
    let maxCatRev = 0;
    store.categories.forEach((rev: number, cat: string) => {
      if (rev > maxCatRev) {
        maxCatRev = rev;
        topCategory = cat;
      }
    });

    // Risk Status
    let riskStatus: 'healthy' | 'warning' | 'critical' = 'healthy';
    if (profitMargin < 15 || growthRate < -0.1) riskStatus = 'critical';
    else if (profitMargin < 22 || growthRate < 0) riskStatus = 'warning';

    return {
      storeId: store.storeId,
      storeName: store.storeName,
      totalRevenue: store.totalRevenue,
      totalCost: store.totalCost,
      totalProfit: store.totalProfit,
      profitMargin,
      totalSales: store.totalSales,
      transactions: store.transactions,
      averageOrderValue,
      unitsPerTransaction,
      growthRate,
      latitude: store.latitude,
      longitude: store.longitude,
      topCategory,
      riskStatus,
    };
  });

  return stores.sort((a, b) => b.totalRevenue - a.totalRevenue);
}

function calculateGrowthRate(posData: any[], storeId: string): number {
  const storeData = posData.filter((row) => row.storeId === storeId && row.date);
  if (storeData.length < 2) return 0;

  const sorted = [...storeData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const mid = Math.floor(sorted.length / 2);
  const firstHalf = sorted.slice(0, mid);
  const secondHalf = sorted.slice(mid);

  const firstRevenue = firstHalf.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);
  const secondRevenue = secondHalf.reduce((sum, row) => sum + (parseFloat(row.revenue) || 0), 0);

  if (firstRevenue === 0) return 0;
  return (secondRevenue - firstRevenue) / firstRevenue;
}

export function calculateMonthlySales(posData: any[]): any[] {
  const monthKeys = new Set<string>();
  posData.forEach((row) => {
    if (!row.date) return;
    const date = new Date(row.date);
    if (!isNaN(date.getTime())) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthKeys.add(monthKey);
    }
  });

  const isSingleMonth = monthKeys.size <= 1;
  const timeMap = new Map<string, { total: number; profit: number; sales: number }>();

  posData.forEach((row) => {
    if (!row.date) return;
    const date = new Date(row.date);
    if (isNaN(date.getTime())) return;

    const key = isSingleMonth
      ? row.date
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    const revenue = parseFloat(row.revenue) || 0;
    const quantity = parseFloat(row.quantity) || 0;
    const unitCost = row.unitCost ? parseFloat(row.unitCost) : revenue * 0.6 / Math.max(1, quantity);
    const profit = revenue - (unitCost * quantity);

    const curr = timeMap.get(key) || { total: 0, profit: 0, sales: 0 };
    curr.total += revenue;
    curr.profit += profit;
    curr.sales += quantity;
    timeMap.set(key, curr);
  });

  return Array.from(timeMap.entries())
    .map(([month, data]) => ({
      month,
      total: data.total,
      profit: data.profit,
      sales: data.sales,
    }))
    .sort((a, b) => a.month.localeCompare(b.month));
}

export function analyzeCategoryPerformance(
  posData: any[],
  inventoryCostMap: Map<string, number>,
  totalRevenue: number
): CategoryPerformance[] {
  const catMap = new Map<string, any>();

  posData.forEach((row) => {
    const cat = row.category || 'Uncategorized';
    const revenue = parseFloat(row.revenue) || 0;
    const quantity = parseFloat(row.quantity) || 0;
    const unitCost = row.unitCost 
      ? parseFloat(row.unitCost) 
      : (inventoryCostMap.get(row.productId) || revenue * 0.6 / Math.max(1, quantity));
    const profit = revenue - (unitCost * quantity);

    if (!catMap.has(cat)) {
      catMap.set(cat, {
        category: cat,
        totalRevenue: 0,
        totalSales: 0,
        totalProfit: 0,
        productIds: new Set<string>(),
      });
    }

    const c = catMap.get(cat);
    c.totalRevenue += revenue;
    c.totalSales += quantity;
    c.totalProfit += profit;
    if (row.productId) c.productIds.add(row.productId);
  });

  return Array.from(catMap.values())
    .map((c) => ({
      category: c.category,
      totalRevenue: c.totalRevenue,
      totalSales: c.totalSales,
      totalProfit: c.totalProfit,
      productCount: c.productIds.size,
      shareOfRevenue: totalRevenue > 0 ? (c.totalRevenue / totalRevenue) * 100 : 0,
    }))
    .sort((a, b) => b.totalRevenue - a.totalRevenue);
}

export function analyzeProductSales(posData: any[], inventoryData: any[]): ProductPerformance[] {
  const productMap = new Map<string, any>();
  const referenceDate = new Date('2026-08-09').getTime();

  // Map inventory data first
  const invMap = new Map<string, any>();
  inventoryData.forEach(inv => {
    if (inv.productId) {
      invMap.set(inv.productId, inv);
    }
  });

  posData.forEach((row) => {
    const productId = row.productId || 'unknown';
    const productName = row.productName || `Product ${productId}`;
    const category = row.category || invMap.get(productId)?.category || 'General';
    const revenue = parseFloat(row.revenue) || 0;
    const quantity = parseFloat(row.quantity) || 0;
    const inv = invMap.get(productId);
    const unitCost = row.unitCost ? parseFloat(row.unitCost) : (parseFloat(inv?.unitCost) || revenue * 0.6 / Math.max(1, quantity));
    const profit = revenue - (unitCost * quantity);

    if (!productMap.has(productId)) {
      productMap.set(productId, {
        productId,
        productName,
        category,
        totalRevenue: 0,
        totalQuantity: 0,
        totalProfit: 0,
      });
    }

    const prd = productMap.get(productId);
    prd.totalRevenue += revenue;
    prd.totalQuantity += quantity;
    prd.totalProfit += profit;
  });

  const grandTotalRev = Array.from(productMap.values()).reduce((sum, p) => sum + p.totalRevenue, 0);
  const products: ProductPerformance[] = Array.from(productMap.values())
    .sort((a, b) => b.totalRevenue - a.totalRevenue);

  let cumulative = 0;
  return products.map((prd) => {
    cumulative += prd.totalRevenue;
    const cumPct = grandTotalRev > 0 ? (cumulative / grandTotalRev) * 100 : 100;
    const inv = invMap.get(prd.productId);

    let abcClass: 'A' | 'B' | 'C' = 'C';
    if (cumPct <= 80) abcClass = 'A';
    else if (cumPct <= 95) abcClass = 'B';

    const currentStock = inv ? parseFloat(inv.currentStock) || 0 : undefined;
    const reorderLevel = inv ? parseFloat(inv.reorderLevel) || 0 : undefined;
    const expiryDate = inv?.expiryDate || undefined;
    
    let daysToExpiry: number | undefined = undefined;
    let recommendedDiscount: number | undefined = undefined;
    let expiryStatus: 'fresh' | 'expiring_soon' | 'critical_expiry' = 'fresh';

    if (expiryDate) {
      const expTime = new Date(expiryDate).getTime();
      if (!isNaN(expTime)) {
        daysToExpiry = Math.ceil((expTime - referenceDate) / (1000 * 60 * 60 * 24));
        if (daysToExpiry <= 15) {
          expiryStatus = 'critical_expiry';
          recommendedDiscount = 40;
        } else if (daysToExpiry <= 45) {
          expiryStatus = 'expiring_soon';
          recommendedDiscount = 20;
        }
      }
    }

    const dailyAvgSales = prd.totalQuantity / 30;
    const daysOfSupply = currentStock !== undefined && dailyAvgSales > 0 ? Math.round(currentStock / dailyAvgSales) : undefined;

    let stockStatus: 'in_stock' | 'low_stock' | 'out_of_stock' = 'in_stock';
    if (currentStock === 0) stockStatus = 'out_of_stock';
    else if (currentStock !== undefined && reorderLevel !== undefined && currentStock <= reorderLevel) stockStatus = 'low_stock';

    return {
      productId: prd.productId,
      productName: prd.productName,
      category: prd.category,
      totalRevenue: prd.totalRevenue,
      totalQuantity: prd.totalQuantity,
      totalProfit: prd.totalProfit,
      currentStock,
      reorderLevel,
      daysOfSupply,
      expiryDate,
      daysToExpiry,
      recommendedDiscount,
      abcClass,
      stockStatus,
      expiryStatus,
    };
  });
}

function generateSummary(
  problems: BusinessProblem[],
  opportunities: BusinessProblem[],
  stores: StorePerformance[],
  totalRevenue: number,
  totalProfit: number
): string {
  const highSeverityCount = problems.filter((p) => p.severity === 'high').length;
  const expiryRiskCount = problems.filter((p) => p.type === 'expiry').length;
  const margin = totalRevenue > 0 ? ((totalProfit / totalRevenue) * 100).toFixed(1) : '0';

  return `InsightOS Analysis Complete across ${stores.length} active stores. Total Revenue: ₹${totalRevenue.toLocaleString('en-IN')} with a ${margin}% net margin (₹${totalProfit.toLocaleString('en-IN')} profit). Detected ${problems.length} operational issues (${highSeverityCount} high severity, ${expiryRiskCount} expiring stock alerts) and ${opportunities.length} growth opportunities.`;
}

export interface DailyHistoryData {
  date: string;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  profitMargin: number;
  totalUnitsSold: number;
  transactionCount: number;
  activeStoresCount: number;
  transactions: any[];
  inventoryRestocks: any[];
  expiringItems: any[];
}

export function getDailyHistory(
  posData: any[],
  inventoryData: any[],
  targetDate: string
): DailyHistoryData {
  const filteredPOS = posData.filter((r) => r.date === targetDate);

  let totalRevenue = 0;
  let totalCost = 0;
  let totalUnitsSold = 0;
  const storesSet = new Set<string>();

  const transactions = filteredPOS.map((r, idx) => {
    const revenue = parseFloat(r.revenue) || 0;
    const quantity = parseFloat(r.quantity) || 0;
    const unitCost = r.unitCost
      ? parseFloat(r.unitCost)
      : (inventoryData.find(i => i.productId === r.productId)?.unitCost || 0);
    const cost = unitCost * quantity;
    const profit = revenue - cost;

    totalRevenue += revenue;
    totalCost += cost;
    totalUnitsSold += quantity;
    if (r.storeId) storesSet.add(r.storeId);

    return {
      id: `tx-${targetDate}-${idx}`,
      time: '14:30', // Default operational timestamp
      storeName: r.storeName || r.storeId || 'Main Store',
      productName: r.productName || r.productId,
      category: r.category || 'General',
      quantity,
      revenue,
      unitCost,
      cost,
      profit,
      profitMargin: revenue > 0 ? (profit / revenue) * 100 : 0,
    };
  });

  const totalProfit = totalRevenue - totalCost;
  const profitMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Inventory restocked or expiring on or near target date
  const inventoryRestocks = inventoryData.filter(i => i.lastRestocked === targetDate);
  const expiringItems = inventoryData.filter(i => i.expiryDate === targetDate || (i.expiryDate && i.expiryDate.startsWith(targetDate.substring(0, 7))));

  return {
    date: targetDate,
    totalRevenue,
    totalCost,
    totalProfit,
    profitMargin,
    totalUnitsSold,
    transactionCount: filteredPOS.length,
    activeStoresCount: storesSet.size,
    transactions,
    inventoryRestocks,
    expiringItems,
  };
}

export interface SeasonalTrendRecommendation {
  seasonOrFestival: string;
  timeframe: string;
  status: 'upcoming' | 'active';
  suggestedProducts: string[];
  rationale: string;
  expectedDemandIncrease: string;
  actionItems: string[];
}

export function getSeasonalTrendsAndRecommendations(): SeasonalTrendRecommendation[] {
  return [
    {
      seasonOrFestival: 'Diwali & Festival Season (Deepavali)',
      timeframe: 'October - November',
      status: 'upcoming',
      suggestedProducts: [
        'Premium Mithai & Gourmet Sweet Boxes',
        'Decorative LED Rice Lights & Brass Diyas',
        'Traditional Ethnic Wear & Silk Apparel',
        'Dry Fruit & Nut Gift Hampers',
        'Smart Home Appliances & TVs (Diwali Offers)',
      ],
      rationale: 'Diwali is India’s largest retail shopping festival. Retail sales spike up to 250% across electronics, fashion, home decor, and confectionery.',
      expectedDemandIncrease: '+180% to +250% Demand Surge',
      actionItems: [
        'Pre-order high-demand gift hampers & electronic appliances 45 days in advance',
        'Set up dedicated festival display kiosks near store entrances',
        'Launch "Diwali Early-Bird Cashback" promotions to capture early shoppers',
      ],
    },
    {
      seasonOrFestival: 'Monsoon Care & Rainy Season',
      timeframe: 'July - September',
      status: 'active',
      suggestedProducts: [
        'Waterproof Windcheaters & Raincoats',
        'Anti-Skid Footwear & Rubber Boots',
        'Herbal Green Tea & Immunity Kadha',
        'UV Umbrella & Compact Foldable Umbrellas',
        'Dehumidifier Packs & Moisture Absorbers',
      ],
      rationale: 'Heavy monsoon rains drive surge in weatherproof gear, hot beverages, immunity supplements, and indoor comfort items.',
      expectedDemandIncrease: '+85% Demand Surge in Grocery & Apparel',
      actionItems: [
        'Place umbrella stands & rain gear prominently at store entrance',
        'Create a "Monsoon Wellness & Tea Combo" promotional bundle',
      ],
    },
    {
      seasonOrFestival: 'Dussehra & Navratri Festival',
      timeframe: 'September - October',
      status: 'upcoming',
      suggestedProducts: [
        'Navratri Fasting Snacks (Sabudana, Makhana, Rock Salt)',
        'Traditional Garba Apparel & Accessories',
        'Pooja Thali Sets & Incense Packs',
        'Consumer Electronics festive bundles',
      ],
      rationale: '9-day festive period with high consumer spending on traditional items, fasting foods, and new purchases.',
      expectedDemandIncrease: '+120% Demand Surge',
      actionItems: [
        'Stock up on certified organic fasting ingredients',
        'Offer festive combo discounts on apparel and puja essentials',
      ],
    },
    {
      seasonOrFestival: 'New Year & Winter Fitness Season',
      timeframe: 'December - January',
      status: 'upcoming',
      suggestedProducts: [
        'Smart Fitness Watches & Bands',
        'Protein Powders & Energy Bars',
        'Premium Woolen Jackets & Thermal Wear',
        'Party Confectionery & Sparkling Juices',
      ],
      rationale: 'End of year celebrations followed by New Year health & fitness resolution spike.',
      expectedDemandIncrease: '+95% Demand Surge',
      actionItems: [
        'Create New Year Fitness Starter Bundles (Watch + Shaker + Protein)',
        'Clear out winter apparel stock before mid-February',
      ],
    },
  ];
}

export interface DiscountRecommendation {
  productId: string;
  productName: string;
  category: string;
  reason: 'slow_moving' | 'near_expiry' | 'excess_stock';
  currentStock: number;
  expiryDate?: string;
  daysToExpiry?: number;
  suggestedDiscountPct: number;
  promoDescription: string;
  estimatedRevenueGain: number;
}

export function getPromotionalDiscountRecommendations(
  posData: any[],
  inventoryData: any[]
): DiscountRecommendation[] {
  const recommendations: DiscountRecommendation[] = [];
  const referenceDate = new Date('2026-08-09').getTime();

  // Group POS quantity per product
  const salesMap = new Map<string, number>();
  posData.forEach(r => {
    if (r.productId) {
      salesMap.set(r.productId, (salesMap.get(r.productId) || 0) + (parseFloat(r.quantity) || 0));
    }
  });

  inventoryData.forEach(inv => {
    const stock = parseFloat(inv.currentStock) || 0;
    const sold = salesMap.get(inv.productId) || 0;
    const unitCost = parseFloat(inv.unitCost) || 0;

    // 1. Check near expiry items
    if (inv.expiryDate) {
      const expTime = new Date(inv.expiryDate).getTime();
      if (!isNaN(expTime)) {
        const daysLeft = Math.ceil((expTime - referenceDate) / (1000 * 60 * 60 * 24));
        if (daysLeft <= 30 && stock > 0) {
          const discountPct = daysLeft <= 10 ? 40 : 25;
          recommendations.push({
            productId: inv.productId,
            productName: inv.productName,
            category: inv.category || 'General',
            reason: 'near_expiry',
            currentStock: stock,
            expiryDate: inv.expiryDate,
            daysToExpiry: daysLeft,
            suggestedDiscountPct: discountPct,
            promoDescription: `Flash Clearance: ${discountPct}% OFF to sell ${stock} units before expiry in ${daysLeft} days!`,
            estimatedRevenueGain: Math.round(stock * unitCost * (1 - discountPct / 100) * 1.5),
          });
          return;
        }
      }
    }

    // 2. Check slow moving / high stock items
    if (stock >= 30 && sold <= 15) {
      recommendations.push({
        productId: inv.productId,
        productName: inv.productName,
        category: inv.category || 'General',
        reason: 'slow_moving',
        currentStock: stock,
        suggestedDiscountPct: 20,
        promoDescription: `Slow-Moving Promo: 20% OFF or Buy-1-Get-1-at-50%-Off to accelerate sell-through.`,
        estimatedRevenueGain: Math.round(stock * unitCost * 1.2),
      });
    }
  });

  return recommendations;
}

