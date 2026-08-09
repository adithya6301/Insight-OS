import { useState, useMemo } from 'react';
import { SAMPLE_POS_DATA, SAMPLE_INVENTORY_DATA } from './utils/sampleData';
import { analyzeBusinessData, analyzeStorePerformance, calculateMonthlySales, deriveInventoryFromPOS } from './utils/dataAnalysis';
import Dashboard from './components/Dashboard';
import Charts from './components/Charts';
import Heatmap from './components/Heatmap';
import AIChat from './components/AIChat';
import DataExplorer from './components/DataExplorer';
import CSVUpload from './components/CSVUpload';
import ReceiptOCR from './components/ReceiptOCR';
import CalendarHistory from './components/CalendarHistory';
import type { BusinessInsight, StorePerformance, FilterOptions } from './types';
import {
  BarChart3,
  MapPin,
  Bot,
  Database,
  LayoutDashboard,
  Upload,
  Filter,
  Sparkles,
  RefreshCw,
  Layers,
  ScanLine,
  Calendar,
  Moon,
  Sun,
  Palette,
  Menu,
  X,
} from 'lucide-react';

type TabId = 'dashboard' | 'charts' | 'heatmap' | 'ai' | 'explorer' | 'ocr' | 'calendar';
type ThemeMode = 'dark' | 'midnight' | 'light';

export default function App() {
  const [posData, setPosData] = useState<any[]>(SAMPLE_POS_DATA);
  const [inventoryData, setInventoryData] = useState<any[]>(SAMPLE_INVENTORY_DATA);
  const [activeTab, setActiveTab] = useState<TabId>('dashboard');
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>('dark');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Global Filter State
  const [filters, setFilters] = useState<FilterOptions>({
    storeId: 'all',
    category: 'all',
    dateRange: 'all',
  });

  // Calculate Enriched Analytics Context
  const insight: BusinessInsight | null = useMemo(() => {
    if (posData.length === 0 && inventoryData.length === 0) return null;
    return analyzeBusinessData(posData, inventoryData, filters);
  }, [posData, inventoryData, filters]);

  const storePerformance: StorePerformance[] = useMemo(() => {
    return analyzeStorePerformance(posData);
  }, [posData]);

  const monthlyData = useMemo(() => {
    return calculateMonthlySales(posData);
  }, [posData]);

  // Unique stores & categories for filter bar — now reactive to uploaded data
  const storeOptions = useMemo(() => {
    const map = new Map<string, string>();
    posData.forEach((r: any) => {
      if (r.storeId && r.storeName) map.set(r.storeId, r.storeName);
    });
    return Array.from(map.entries());
  }, [posData]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>();
    posData.forEach((r: any) => r.category && set.add(r.category));
    inventoryData.forEach((r: any) => r.category && set.add(r.category));
    return Array.from(set);
  }, [posData, inventoryData]);

  const handleDataLoaded = (newPosData: any[], newInventoryData: any[]) => {
    if (newPosData.length > 0) {
      setPosData(newPosData);
      if (newInventoryData.length > 0) {
        setInventoryData(newInventoryData);
      } else {
        const derived = deriveInventoryFromPOS(newPosData);
        setInventoryData(derived);
      }
    } else if (newInventoryData.length > 0) {
      setInventoryData(newInventoryData);
    }
    setFilters({ storeId: 'all', category: 'all', dateRange: 'all' });
  };

  const handleResetData = () => {
    setPosData(SAMPLE_POS_DATA);
    setInventoryData(SAMPLE_INVENTORY_DATA);
    setFilters({ storeId: 'all', category: 'all', dateRange: 'all' });
  };

  const handleAddPosTransaction = (transaction: any) => {
    setPosData((prev) => [...prev, transaction]);
  };

  const cycleTheme = () => {
    if (theme === 'dark') setTheme('midnight');
    else if (theme === 'midnight') setTheme('light');
    else setTheme('dark');
  };

  const tabs = [
    { id: 'dashboard' as TabId, label: 'Dashboard',       icon: <LayoutDashboard className="w-4 h-4" /> },
    { id: 'charts'    as TabId, label: 'Analytics Studio', icon: <BarChart3 className="w-4 h-4" /> },
    { id: 'calendar'  as TabId, label: 'Daily History',    icon: <Calendar className="w-4 h-4" /> },
    { id: 'heatmap'   as TabId, label: 'Store Heatmap',   icon: <MapPin className="w-4 h-4" /> },
    { id: 'ai'        as TabId, label: 'AI Copilot',       icon: <Bot className="w-4 h-4" /> },
    { id: 'explorer'  as TabId, label: 'Data Matrix',      icon: <Database className="w-4 h-4" /> },
    { id: 'ocr'       as TabId, label: 'Receipt OCR',      icon: <ScanLine className="w-4 h-4" /> },
  ];

  return (
    <div className={`min-h-screen ${theme === 'midnight' ? 'theme-midnight' : theme === 'light' ? 'theme-light' : ''} selection:bg-[var(--accent-color)] selection:text-black transition-colors duration-300`}>
      {/* Floating Navbar */}
      <header className="sticky top-0 z-40 bg-[var(--bg-header)] backdrop-blur-xl border-b border-[var(--border-color)] px-4 lg:px-8 py-3.5 shadow-2xl">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">

          {/* Logo & Platform Tag */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl p-0.5 bg-gradient-to-br from-[var(--accent-color)] via-cyan-400 to-emerald-500 shadow-lg shadow-[var(--accent-glow)] flex items-center justify-center overflow-hidden">
              <img
                src="/brand_icon.jpg"
                alt="Insight OS Icon"
                className="w-full h-full object-cover rounded-[9px]"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-extrabold text-lg text-[var(--text-main)] tracking-tight font-['Geist']">
                  Insight<span className="text-[var(--accent-color)]">OS</span>
                </h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold webstacked-badge-lime uppercase tracking-wider">
                  v2.5 Pro
                </span>
              </div>
              <p className="text-[11px] text-[var(--text-muted)] font-medium hidden sm:block">Intelligent Retail Operations &amp; AI Intelligence Platform</p>
            </div>
          </div>

          {/* Desktop Navigation Tabs */}
          <nav className="hidden lg:flex items-center gap-1 bg-[var(--bg-input)] p-1.5 rounded-2xl border border-[var(--border-color)] shadow-inner text-xs">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-semibold transition-all duration-200 ${
                  activeTab === tab.id
                    ? 'bg-[var(--accent-color)] text-black shadow-lg shadow-[var(--accent-glow)] scale-[1.02]'
                    : 'text-[var(--text-muted)] hover:text-[var(--text-main)] hover:bg-white/5'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
              </button>
            ))}
          </nav>

          {/* Right Actions Toolbar */}
          <div className="flex items-center gap-2">
            {/* Theme Toggle Button */}
            <button
              onClick={cycleTheme}
              className="p-2.5 rounded-xl bg-[var(--bg-input)] hover:opacity-80 text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] text-xs transition-all flex items-center gap-1.5 cursor-pointer"
              title={`Current Theme: ${theme.toUpperCase()}. Click to switch theme.`}
            >
              {theme === 'dark' && <Moon className="w-4 h-4 text-lime-400" />}
              {theme === 'midnight' && <Palette className="w-4 h-4 text-sky-400" />}
              {theme === 'light' && <Sun className="w-4 h-4 text-amber-500" />}
              <span className="text-[11px] font-bold uppercase hidden xl:inline">{theme}</span>
            </button>

            <button
              onClick={() => setIsUploadOpen(true)}
              className="px-3.5 py-2 rounded-xl webstacked-button-primary text-xs flex items-center gap-2 font-bold cursor-pointer"
            >
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload CSV</span>
            </button>
            <button
              onClick={handleResetData}
              className="p-2.5 rounded-xl bg-[var(--bg-input)] hover:opacity-80 text-[var(--text-muted)] hover:text-[var(--text-main)] border border-[var(--border-color)] text-xs transition-colors cursor-pointer"
              title="Reset to Preset Indian Retail Dataset"
            >
              <RefreshCw className="w-4 h-4" />
            </button>

            {/* Mobile Menu Toggle */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="lg:hidden p-2.5 rounded-xl bg-[var(--bg-input)] text-[var(--text-main)] border border-[var(--border-color)]"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Mobile Navigation Drawer */}
        {isMobileMenuOpen && (
          <div className="lg:hidden mt-3 pt-3 border-t border-[var(--border-color)] animate-fade-in">
            <div className="grid grid-cols-2 gap-2 text-xs">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id);
                    setIsMobileMenuOpen(false);
                  }}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-xl font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-[var(--accent-color)] text-black font-bold'
                      : 'bg-[var(--bg-input)] text-[var(--text-muted)] hover:text-[var(--text-main)]'
                  }`}
                >
                  {tab.icon}
                  <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* Global Filter Control Bar — hidden on OCR tab */}
      {activeTab !== 'ocr' && (
        <div className="bg-[var(--bg-filter)] border-b border-[var(--border-color)] px-4 lg:px-8 py-3">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4 text-xs">

            <div className="flex items-center gap-2 text-[var(--text-muted)] font-semibold">
              <Filter className="w-4 h-4 text-[var(--accent-color)]" />
              <span>Global Slice &amp; Dice Filters:</span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Store Dropdown */}
              <div className="flex items-center gap-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl">
                <span className="text-[var(--text-muted)]">Store:</span>
                <select
                  value={filters.storeId}
                  onChange={(e) => setFilters((f) => ({ ...f, storeId: e.target.value }))}
                  className="bg-transparent text-[var(--text-main)] font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[var(--bg-input)] text-[var(--text-main)]">All Indian Outlets (5)</option>
                  {storeOptions.map(([id, name]) => (
                    <option key={id} value={id} className="bg-[var(--bg-input)] text-[var(--text-main)]">
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              {/* Category Dropdown */}
              <div className="flex items-center gap-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl">
                <span className="text-[var(--text-muted)]">Category:</span>
                <select
                  value={filters.category}
                  onChange={(e) => setFilters((f) => ({ ...f, category: e.target.value }))}
                  className="bg-transparent text-[var(--text-main)] font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[var(--bg-input)] text-[var(--text-main)]">All Categories</option>
                  {categoryOptions.map((cat) => (
                    <option key={cat} value={cat} className="bg-[var(--bg-input)] text-[var(--text-main)]">
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              {/* Date Range Dropdown */}
              <div className="flex items-center gap-1.5 bg-[var(--bg-input)] border border-[var(--border-color)] px-3 py-1.5 rounded-xl">
                <span className="text-[var(--text-muted)]">Period:</span>
                <select
                  value={filters.dateRange}
                  onChange={(e) => setFilters((f) => ({ ...f, dateRange: e.target.value as any }))}
                  className="bg-transparent text-[var(--text-main)] font-medium focus:outline-none cursor-pointer"
                >
                  <option value="all" className="bg-[var(--bg-input)] text-[var(--text-main)]">All Transactions</option>
                  <option value="7d"  className="bg-[var(--bg-input)] text-[var(--text-main)]">Last 7 Days</option>
                  <option value="30d" className="bg-[var(--bg-input)] text-[var(--text-main)]">Last 30 Days</option>
                  <option value="90d" className="bg-[var(--bg-input)] text-[var(--text-main)]">Last 90 Days</option>
                </select>
              </div>

              {(filters.storeId !== 'all' || filters.category !== 'all' || filters.dateRange !== 'all') && (
                <button
                  onClick={() => setFilters({ storeId: 'all', category: 'all', dateRange: 'all' })}
                  className="text-[11px] text-[var(--accent-color)] hover:underline font-semibold"
                >
                  Reset Filters
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 text-[11px] text-[var(--text-muted)] font-medium">
              <Sparkles className="w-3.5 h-3.5 text-[var(--accent-color)]" />
              <span>Active POS records: <strong className="text-[var(--text-main)]">{posData.length}</strong></span>
            </div>

          </div>
        </div>
      )}

      {/* Main View Container */}
      <main key={activeTab} className="max-w-7xl mx-auto p-4 lg:p-8 space-y-8 animate-fade-in">
        {activeTab === 'dashboard' && (
          <Dashboard
            insight={insight}
            storePerformance={storePerformance}
            posData={posData}
            inventoryData={inventoryData}
            onOpenUpload={() => setIsUploadOpen(true)}
          />
        )}

        {activeTab === 'charts' && (
          <Charts
            storePerformance={storePerformance}
            monthlyData={monthlyData}
            inventoryData={inventoryData}
            categoryBreakdown={insight?.categoryBreakdown || []}
            posData={posData}
            categoryFilter={filters.category}
          />
        )}

        {activeTab === 'calendar' && (
          <CalendarHistory
            posData={posData}
            inventoryData={inventoryData}
          />
        )}

        {activeTab === 'heatmap' && (
          <Heatmap storePerformance={storePerformance} />
        )}

        {activeTab === 'ai' && (
          <AIChat
            insight={insight}
            storePerformance={storePerformance}
            monthlyData={monthlyData}
          />
        )}

        {activeTab === 'explorer' && (
          <DataExplorer
            posData={posData}
            inventoryData={inventoryData}
            productPerformance={insight?.topProducts || []}
          />
        )}

        {activeTab === 'ocr' && (
          <ReceiptOCR onAddPosTransaction={handleAddPosTransaction} />
        )}
      </main>

      {/* Upload Modal */}
      <CSVUpload
        isOpen={isUploadOpen}
        onClose={() => setIsUploadOpen(false)}
        onDataLoaded={handleDataLoaded}
      />
    </div>
  );
}


