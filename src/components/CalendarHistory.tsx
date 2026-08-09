import { useState, useMemo } from 'react';
import { getDailyHistory } from '../utils/dataAnalysis';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ShoppingBag,
  Store,
  DollarSign,
  Package,
  AlertTriangle,
  Clock,
  Sparkles,
  Search,
  Filter,
} from 'lucide-react';

interface CalendarHistoryProps {
  posData: any[];
  inventoryData: any[];
}

export default function CalendarHistory({ posData, inventoryData }: CalendarHistoryProps) {
  // Extract unique dates present in POS data to highlight on calendar
  const activeDatesMap = useMemo(() => {
    const map = new Map<string, { revenue: number; count: number }>();
    posData.forEach((row) => {
      if (row.date) {
        const rev = parseFloat(row.revenue) || 0;
        const current = map.get(row.date) || { revenue: 0, count: 0 };
        map.set(row.date, {
          revenue: current.revenue + rev,
          count: current.count + 1,
        });
      }
    });
    return map;
  }, [posData]);

  // Default to the most recent date with sales data or current date
  const defaultDate = useMemo(() => {
    if (posData.length > 0) {
      const sortedDates = [...posData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return sortedDates[0].date;
    }
    return '2026-08-01';
  }, [posData]);

  const [selectedDate, setSelectedDate] = useState<string>(defaultDate);
  const [currentYear, setCurrentYear] = useState<number>(() => new Date(defaultDate).getFullYear() || 2026);
  const [currentMonth, setCurrentMonth] = useState<number>(() => new Date(defaultDate).getMonth() || 7); // 0-indexed (7 = Aug)
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Daily History Metrics for Selected Date
  const dailyMetrics = useMemo(() => {
    return getDailyHistory(posData, inventoryData, selectedDate);
  }, [posData, inventoryData, selectedDate]);

  // Calendar Days Calculation
  const calendarDays = useMemo(() => {
    const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
    const lastDayOfMonth = new Date(currentYear, currentMonth + 1, 0);

    const startDayOfWeek = firstDayOfMonth.getDay(); // 0 = Sun
    const totalDays = lastDayOfMonth.getDate();

    const days: ({ dateString: string; dayNumber: number; isCurrentMonth: boolean; hasData: boolean; revenue: number } | null)[] = [];

    // Previous month padding
    for (let i = 0; i < startDayOfWeek; i++) {
      days.push(null);
    }

    // Days of current month
    for (let d = 1; d <= totalDays; d++) {
      const monthStr = String(currentMonth + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateString = `${currentYear}-${monthStr}-${dayStr}`;
      const data = activeDatesMap.get(dateString);

      days.push({
        dateString,
        dayNumber: d,
        isCurrentMonth: true,
        hasData: !!data,
        revenue: data?.revenue || 0,
      });
    }

    return days;
  }, [currentYear, currentMonth, activeDatesMap]);

  const handlePrevMonth = () => {
    if (currentMonth === 0) {
      setCurrentMonth(11);
      setCurrentYear(currentYear - 1);
    } else {
      setCurrentMonth(currentMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 11) {
      setCurrentMonth(0);
      setCurrentYear(currentYear + 1);
    } else {
      setCurrentMonth(currentMonth + 1);
    }
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  // Filtered transactions for selected day search
  const filteredTransactions = useMemo(() => {
    if (!searchTerm) return dailyMetrics.transactions;
    const term = searchTerm.toLowerCase();
    return dailyMetrics.transactions.filter(
      (tx) =>
        tx.productName.toLowerCase().includes(term) ||
        tx.storeName.toLowerCase().includes(term) ||
        tx.category.toLowerCase().includes(term)
    );
  }, [dailyMetrics.transactions, searchTerm]);

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Header Banner */}
      <div className="webstacked-card rounded-3xl p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-[var(--accent-glow)] to-transparent rounded-full blur-3xl opacity-30 pointer-events-none" />

        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-2xl bg-[var(--accent-glow)] text-[var(--accent-color)] border border-[var(--accent-color)]/30">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div>
                <h2 className="text-2xl lg:text-3xl font-extrabold text-[var(--text-main)] tracking-tight">
                  Daily History &amp; Inventory Audit Calendar
                </h2>
                <p className="text-sm text-[var(--text-muted)] font-medium">
                  Select any date to inspect daily sales revenue, profit/loss history, units sold, and itemized POS transactions.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-4 py-2 rounded-xl bg-[var(--bg-input)] border border-[var(--border-color)] text-xs font-semibold text-[var(--text-muted)] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[var(--accent-color)]" />
              <span>Dates with POS History: <strong className="text-[var(--text-main)]">{activeDatesMap.size} Days</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Calendar Picker, Right Selected Day Dashboard */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Column: Interactive Calendar (4 cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="webstacked-card rounded-3xl p-6 space-y-6">
            
            {/* Month & Year Navigation Header */}
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-extrabold text-[var(--text-main)]">
                  {monthNames[currentMonth]} {currentYear}
                </h3>
                <p className="text-xs text-[var(--text-muted)]">Click on any highlighted date</p>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  onClick={handlePrevMonth}
                  className="p-2 rounded-xl bg-[var(--bg-input)] hover:opacity-80 text-[var(--text-main)] border border-[var(--border-color)] transition-all cursor-pointer"
                  title="Previous Month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  onClick={handleNextMonth}
                  className="p-2 rounded-xl bg-[var(--bg-input)] hover:opacity-80 text-[var(--text-main)] border border-[var(--border-color)] transition-all cursor-pointer"
                  title="Next Month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Days of Week Header */}
            <div className="grid grid-cols-7 text-center text-xs font-bold text-[var(--text-muted)] py-2 border-b border-[var(--border-color)]">
              <span>Sun</span>
              <span>Mon</span>
              <span>Tue</span>
              <span>Wed</span>
              <span>Thu</span>
              <span>Fri</span>
              <span>Sat</span>
            </div>

            {/* Calendar Grid */}
            <div className="grid grid-cols-7 gap-2">
              {calendarDays.map((day, idx) => {
                if (!day) {
                  return <div key={`empty-${idx}`} className="h-12 rounded-xl bg-transparent" />;
                }

                const isSelected = day.dateString === selectedDate;

                return (
                  <button
                    key={day.dateString}
                    onClick={() => setSelectedDate(day.dateString)}
                    className={`h-14 rounded-2xl p-1 flex flex-col items-center justify-between border transition-all duration-200 cursor-pointer ${
                      isSelected
                        ? 'bg-[var(--accent-color)] text-black border-[var(--accent-color)] shadow-lg shadow-[var(--accent-glow)] font-bold scale-105 z-10'
                        : day.hasData
                        ? 'bg-[var(--bg-input)] border-[var(--accent-color)]/40 hover:border-[var(--accent-color)] text-[var(--text-main)] hover:scale-102'
                        : 'bg-[var(--bg-card)] border-[var(--border-color)] text-[var(--text-muted)] opacity-60 hover:opacity-100'
                    }`}
                  >
                    <span className="text-xs font-bold">{day.dayNumber}</span>
                    {day.hasData && (
                      <span
                        className={`text-[9px] font-extrabold px-1 rounded-md max-w-full truncate ${
                          isSelected ? 'bg-black text-[var(--accent-color)]' : 'text-[var(--accent-color)]'
                        }`}
                      >
                        ₹{(day.revenue / 1000).toFixed(0)}k
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Calendar Legend */}
            <div className="flex items-center justify-between text-[11px] text-[var(--text-muted)] pt-2 border-t border-[var(--border-color)]">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--accent-color)] inline-block" />
                <span>Selected Date</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[var(--bg-input)] border border-[var(--accent-color)]/50 inline-block" />
                <span>Sales Recorded</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Selected Date Detailed History (7 cols) */}
        <div className="lg:col-span-7 space-y-6">
          
          {/* Day Title & Date Picker Display */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <span className="px-3 py-1 rounded-full text-xs font-extrabold webstacked-badge-lime uppercase tracking-wider">
                Daily Financial Audit
              </span>
              <h3 className="text-2xl font-extrabold text-[var(--text-main)] mt-1">
                Report for {new Date(selectedDate).toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
              </h3>
            </div>

            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              className="px-3 py-2 rounded-xl bg-[var(--bg-input)] text-[var(--text-main)] border border-[var(--border-color)] text-xs font-semibold focus:outline-none"
            />
          </div>

          {/* 4 Summary KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {/* 1. Total Revenue */}
            <div className="webstacked-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Total Sales</span>
                <DollarSign className="w-4 h-4 text-[var(--accent-color)]" />
              </div>
              <p className="text-xl font-extrabold text-[var(--text-main)]">
                ₹{dailyMetrics.totalRevenue.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                {dailyMetrics.transactionCount} Transaction lines
              </span>
            </div>

            {/* 2. Profit / Loss */}
            <div className="webstacked-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Net Profit / Loss</span>
                {dailyMetrics.totalProfit >= 0 ? (
                  <TrendingUp className="w-4 h-4 text-emerald-400" />
                ) : (
                  <TrendingDown className="w-4 h-4 text-rose-400" />
                )}
              </div>
              <p className={`text-xl font-extrabold ${dailyMetrics.totalProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                ₹{dailyMetrics.totalProfit.toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] font-bold text-emerald-400">
                {dailyMetrics.profitMargin.toFixed(1)}% Profit Margin
              </span>
            </div>

            {/* 3. Units Sold */}
            <div className="webstacked-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)] font-medium">Units Sold</span>
                <ShoppingBag className="w-4 h-4 text-sky-400" />
              </div>
              <p className="text-xl font-extrabold text-[var(--text-main)]">
                {dailyMetrics.totalUnitsSold} Units
              </p>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                Products Delivered
              </span>
            </div>

            {/* 4. Active Stores */}
            <div className="webstacked-card rounded-2xl p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[var(--text-muted)]">Active Stores</span>
                <Store className="w-4 h-4 text-purple-400" />
              </div>
              <p className="text-xl font-extrabold text-[var(--text-main)]">
                {dailyMetrics.activeStoresCount} Outlets
              </p>
              <span className="text-[10px] text-[var(--text-muted)] font-medium">
                Operational Outlets
              </span>
            </div>
          </div>

          {/* Daily AI Analysis Insight Box */}
          <div className="webstacked-card rounded-2xl p-5 border border-[var(--accent-color)]/30 bg-gradient-to-r from-[var(--bg-card)] to-[var(--bg-input)] space-y-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[var(--accent-color)]">
              <Sparkles className="w-4 h-4" />
              <span>AI Daily Intelligence Summary</span>
            </div>
            <p className="text-xs text-[var(--text-main)] leading-relaxed">
              {dailyMetrics.transactionCount > 0 ? (
                <>
                  On <strong>{selectedDate}</strong>, your stores generated <strong>₹{dailyMetrics.totalRevenue.toLocaleString('en-IN')}</strong> in revenue with a net profit of <strong>₹{dailyMetrics.totalProfit.toLocaleString('en-IN')}</strong> ({dailyMetrics.profitMargin.toFixed(1)}% margin). Total of <strong>{dailyMetrics.totalUnitsSold} units</strong> were sold across <strong>{dailyMetrics.activeStoresCount} active store location(s)</strong>.
                </>
              ) : (
                <>
                  No POS transactions recorded for <strong>{selectedDate}</strong> in the dataset. Select another date from the calendar to inspect historical transactions.
                </>
              )}
            </p>
          </div>

          {/* Detailed Itemized Transactions Table */}
          <div className="webstacked-card rounded-3xl p-6 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h4 className="text-lg font-extrabold text-[var(--text-main)]">
                  Itemized Daily POS Sales ({filteredTransactions.length})
                </h4>
                <p className="text-xs text-[var(--text-muted)]">Complete product breakdown for {selectedDate}</p>
              </div>

              {/* Search filter */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 absolute left-3 top-2.5 text-[var(--text-muted)]" />
                <input
                  type="text"
                  placeholder="Filter product, store..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-main)] border border-[var(--border-color)] text-xs focus:outline-none"
                />
              </div>
            </div>

            {filteredTransactions.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[var(--border-color)] text-[var(--text-muted)]">
                      <th className="pb-3 font-bold">Product Name</th>
                      <th className="pb-3 font-bold">Store Outlet</th>
                      <th className="pb-3 font-bold text-center">Qty</th>
                      <th className="pb-3 font-bold text-right">Revenue</th>
                      <th className="pb-3 font-bold text-right">Est Profit</th>
                      <th className="pb-3 font-bold text-right">Margin %</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--border-color)]">
                    {filteredTransactions.map((tx) => (
                      <tr key={tx.id} className="hover:bg-white/5 transition-colors">
                        <td className="py-3 font-semibold text-[var(--text-main)]">
                          {tx.productName}
                          <span className="block text-[10px] text-[var(--text-muted)] font-normal">{tx.category}</span>
                        </td>
                        <td className="py-3 text-[var(--text-muted)]">{tx.storeName}</td>
                        <td className="py-3 text-center font-bold text-[var(--text-main)]">{tx.quantity}</td>
                        <td className="py-3 text-right font-bold text-[var(--text-main)]">₹{tx.revenue.toLocaleString('en-IN')}</td>
                        <td className={`py-3 text-right font-bold ${tx.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          ₹{tx.profit.toLocaleString('en-IN')}
                        </td>
                        <td className="py-3 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${tx.profitMargin >= 20 ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'}`}>
                            {tx.profitMargin.toFixed(1)}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-8 text-[var(--text-muted)] text-xs space-y-2">
                <Package className="w-8 h-8 mx-auto opacity-40 text-[var(--accent-color)]" />
                <p>No POS sales transactions found on this date.</p>
              </div>
            )}
          </div>

          {/* Restock & Expiry History Snapshot */}
          {(dailyMetrics.inventoryRestocks.length > 0 || dailyMetrics.expiringItems.length > 0) && (
            <div className="webstacked-card rounded-3xl p-6 space-y-4">
              <h4 className="text-lg font-extrabold text-[var(--text-main)] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[var(--accent-color)]" />
                <span>Inventory Audit Log &amp; Expiry Events</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                {dailyMetrics.inventoryRestocks.map((inv, idx) => (
                  <div key={`restock-${idx}`} className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 space-y-1">
                    <div className="flex items-center justify-between font-bold text-emerald-400">
                      <span>Restock Event</span>
                      <Package className="w-4 h-4" />
                    </div>
                    <p className="font-extrabold text-[var(--text-main)]">{inv.productName}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Current Stock: {inv.currentStock} units | Supplier: {inv.supplier || 'Vendor'}</p>
                  </div>
                ))}

                {dailyMetrics.expiringItems.map((inv, idx) => (
                  <div key={`exp-${idx}`} className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 space-y-1">
                    <div className="flex items-center justify-between font-bold text-rose-400">
                      <span>Expiry Alert</span>
                      <AlertTriangle className="w-4 h-4" />
                    </div>
                    <p className="font-extrabold text-[var(--text-main)]">{inv.productName}</p>
                    <p className="text-[11px] text-[var(--text-muted)]">Expires: {inv.expiryDate} ({inv.currentStock} units on hand)</p>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
