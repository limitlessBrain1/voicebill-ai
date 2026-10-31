import React, { useState, useEffect, useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingCart,
  Receipt,
  Package,
  AlertTriangle,
  TrendingUp,
  PlusCircle,
  Eye,
  CheckCircle2,
  AlertCircle,
  Store,
  Mic,
  ArrowRight,
  ShieldCheck,
  Clock,
  Printer,
  ChevronRight,
  BarChart3,
  Layers,
  Sparkles,
  Search,
  FileText,
  Check,
  Zap,
} from 'lucide-react';
import { useApp } from '../context';
import {
  getProducts,
  listSales,
  SaleResponse,
  ProductResponse,
  extractErrorMessage,
} from '../services/api';
import { ReceiptModal } from '../components/ReceiptModal';
import logoImg from '../assets/logo.png';

export const HomePage: React.FC = () => {
  const { user, isAuthenticated, storeName } = useApp();
  const navigate = useNavigate();

  // -------------------------------------------------------------
  // AUTHENTICATED OPERATIONAL OVERVIEW STATE
  // -------------------------------------------------------------
  const [isLoadingDashboard, setIsLoadingDashboard] = useState<boolean>(true);
  const [dashboardError, setDashboardError] = useState<string | null>(null);

  const [todaySalesTotal, setTodaySalesTotal] = useState<number>(0);
  const [todayBillsCount, setTodayBillsCount] = useState<number>(0);
  const [lowStockCount, setLowStockCount] = useState<number>(0);
  const [totalProductsCount, setTotalProductsCount] = useState<number>(0);
  const [recentSales, setRecentSales] = useState<SaleResponse[]>([]);

  // Receipt Modal State for recent sales reprint/view
  const [selectedReceiptSale, setSelectedReceiptSale] = useState<SaleResponse | null>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState<boolean>(false);

  const fetchDashboardData = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingDashboard(true);
    setDashboardError(null);

    try {
      // 1. Fetch products to get stock counts
      const products = await getProducts();
      setTotalProductsCount(products.length);

      const lowStockItems = products.filter((p: ProductResponse) => {
        const qty = Number(p.stock_quantity) || 0;
        const threshold = p.low_stock_threshold !== null && p.low_stock_threshold !== undefined
          ? Number(p.low_stock_threshold)
          : 5;
        return qty <= threshold;
      });
      setLowStockCount(lowStockItems.length);

      // 2. Fetch sales (recent 15 for today's summary and table)
      const todayStr = new Date().toISOString().split('T')[0];
      const salesRes = await listSales({ limit: 15 });
      const allSales: SaleResponse[] = salesRes.sales || [];
      setRecentSales(allSales.slice(0, 5));

      // Calculate today's sales
      const todaySales = allSales.filter((s: SaleResponse) => {
        const saleDate = s.created_at ? s.created_at.split('T')[0] : '';
        return saleDate === todayStr && s.payment_status === 'completed';
      });

      const todaySum = todaySales.reduce((acc: number, s: SaleResponse) => acc + (Number(s.total_amount) || 0), 0);
      setTodaySalesTotal(todaySum);
      setTodayBillsCount(todaySales.length);
    } catch (err) {
      setDashboardError(extractErrorMessage(err, 'Failed to load dashboard operational data.'));
    } finally {
      setIsLoadingDashboard(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchDashboardData();
    }
  }, [isAuthenticated, fetchDashboardData]);

  // =============================================================
  // RENDER: AUTHENTICATED OPERATIONAL OVERVIEW
  // =============================================================
  if (isAuthenticated) {
    return (
      <div className="space-y-5 max-w-6xl mx-auto pb-2">
        {/* Top Operational Action Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0]">
          <div>
            {storeName && (
              <h1 className="text-2xl font-extrabold text-[#102A56] tracking-tight">
                {storeName}
              </h1>
            )}
          </div>

          <div className="flex items-center space-x-3">
            <button
              type="button"
              onClick={() => navigate('/billing')}
              className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-sm font-bold shadow-md shadow-[#1677F3]/25 transition active:scale-95"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Start New Bill</span>
            </button>
          </div>
        </div>

        {/* Error Banner if API error */}
        {dashboardError && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{dashboardError}</span>
            </div>
            <button
              onClick={fetchDashboardData}
              className="underline font-bold hover:text-rose-900"
            >
              Retry
            </button>
          </div>
        )}

        {/* Key Operational Metric Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Card 1: Today's Revenue */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Today's Sales</span>
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center">
                <TrendingUp className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-[#102A56] tracking-tight font-mono">
                {isLoadingDashboard ? '...' : `₹${todaySalesTotal.toFixed(2)}`}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Completed bills today</p>
            </div>
          </div>

          {/* Card 2: Bills Count */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Today's Bills</span>
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center">
                <Receipt className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-[#102A56] tracking-tight font-mono">
                {isLoadingDashboard ? '...' : todayBillsCount}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Transactions processed</p>
            </div>
          </div>

          {/* Card 3: Total Products in Catalog */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Active Products</span>
              <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center">
                <Package className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className="text-2xl font-black text-[#102A56] tracking-tight font-mono">
                {isLoadingDashboard ? '...' : totalProductsCount}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Items in store database</p>
            </div>
          </div>

          {/* Card 4: Low Stock Warnings */}
          <div className="p-5 rounded-2xl bg-white border border-[#E2E8F0] shadow-card">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#64748B] uppercase tracking-wider">Low Stock Alert</span>
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${lowStockCount > 0 ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                <AlertTriangle className="w-4 h-4" />
              </div>
            </div>
            <div className="mt-3">
              <p className={`text-2xl font-black tracking-tight font-mono ${lowStockCount > 0 ? 'text-amber-600' : 'text-[#102A56]'}`}>
                {isLoadingDashboard ? '...' : lowStockCount}
              </p>
              <p className="text-[11px] text-[#64748B] mt-0.5">Items at or below threshold</p>
            </div>
          </div>
        </div>

        {/* Quick Launchpad Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => navigate('/billing')}
            className="p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#1677F3] hover:shadow-subtle transition flex items-center space-x-3 group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center group-hover:bg-[#1677F3] group-hover:text-white transition">
              <ShoppingCart className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#102A56]">Open Billing Counter</p>
              <p className="text-[11px] text-[#64748B]">Scan barcodes or select items to bill</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/inventory')}
            className="p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#1677F3] hover:shadow-subtle transition flex items-center space-x-3 group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center group-hover:bg-[#1677F3] group-hover:text-white transition">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#102A56]">Manage Store Inventory</p>
              <p className="text-[11px] text-[#64748B]">Update prices, stock & low-stock limits</p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => navigate('/sales')}
            className="p-4 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#1677F3] hover:shadow-subtle transition flex items-center space-x-3 group text-left"
          >
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center group-hover:bg-[#1677F3] group-hover:text-white transition">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs font-bold text-[#102A56]">View Sales & Reprint</p>
              <p className="text-[11px] text-[#64748B]">Audit previous bills and print 80mm receipts</p>
            </div>
          </button>
        </div>

        {/* Recent Transactions Table */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-card overflow-hidden">
          <div className="px-6 py-4 border-b border-[#E2E8F0] flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#102A56]">Recent Store Sales</h2>
              <p className="text-xs text-[#64748B]">Latest completed bills from your counter</p>
            </div>
            <button
              onClick={() => navigate('/sales')}
              className="text-xs font-bold text-[#1677F3] hover:underline"
            >
              View Full History →
            </button>
          </div>

          {isLoadingDashboard ? (
            <div className="p-8 text-center text-xs text-[#64748B]">Loading latest sales...</div>
          ) : recentSales.length === 0 ? (
            <div className="p-8 text-center space-y-2">
              <Receipt className="w-8 h-8 text-[#CBD5E1] mx-auto" />
              <p className="text-xs font-semibold text-[#102A56]">No sales recorded yet today.</p>
              <p className="text-[11px] text-[#64748B]">Click "+ Start New Bill" to begin serving customers.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-64 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="sticky top-0">
                  <tr className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold">
                    <th className="py-3 px-4">Receipt #</th>
                    <th className="py-3 px-4">Time</th>
                    <th className="py-3 px-4">Items</th>
                    <th className="py-3 px-4">Payment</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                    <th className="py-3 px-4 text-center">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E2E8F0]">
                  {recentSales.map((sale) => (
                    <tr key={sale.id} className="hover:bg-[#F8FAFC] transition">
                      <td className="py-3 px-4 font-mono font-bold text-[#102A56]">
                        {sale.receipt_number}
                      </td>
                      <td className="py-3 px-4 text-[#64748B]">
                        {new Date(sale.created_at).toLocaleString('en-IN', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="py-3 px-4 text-[#102A56] font-medium">
                        {sale.items?.length || 0} items
                      </td>
                      <td className="py-3 px-4">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                          sale.payment_method === 'upi'
                            ? 'bg-purple-50 text-purple-700 border border-purple-200'
                            : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        }`}>
                          {sale.payment_method}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-[#102A56]">
                        ₹{Number(sale.total_amount).toFixed(2)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedReceiptSale(sale);
                            setIsReceiptModalOpen(true);
                          }}
                          className="p-1.5 rounded-lg text-[#1677F3] hover:bg-[#EFF6FF] transition inline-flex items-center space-x-1 font-semibold text-[11px]"
                          title="View thermal receipt"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Receipt</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Receipt Modal for Recent Sales */}
        {selectedReceiptSale && (
          <ReceiptModal
            isOpen={isReceiptModalOpen}
            onClose={() => {
              setIsReceiptModalOpen(false);
              setSelectedReceiptSale(null);
            }}
            sale={selectedReceiptSale}
          />
        )}
      </div>
    );
  }

  // =============================================================
  // RENDER: UNAUTHENTICATED PUBLIC EDITORIAL LANDING PAGE
  // =============================================================
  return (
    <div className="w-full flex flex-col">
      {/* 1. HERO SECTION (Light Cyan #BFEAF5 background, asymmetrical editorial layout) */}
      <section id="product" className="relative w-full bg-gradient-to-b from-[#BFEAF5] via-[#BFEAF5]/35 to-[#F5F8FC] border-b border-[#BFEAF5]/80 pt-10 sm:pt-16 pb-16 lg:pb-24 overflow-hidden">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-10 items-center">
            
            {/* LEFT COLUMN: Editorial Typography & Actions */}
            <div className="lg:col-span-6 space-y-6 sm:space-y-8">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/90 border border-[#1677F3]/25 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-[#1677F3]" />
                <span className="text-[11px] sm:text-xs font-black uppercase tracking-widest text-[#0755D9]">
                  Smart Billing for Kirana Stores
                </span>
              </div>

              {/* Editorial Headline */}
              <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black text-[#101828] tracking-tight leading-[1.08]">
                Your shop runs better when billing gets simpler.
              </h1>

              {/* Supporting Editorial Paragraph */}
              <p className="text-base sm:text-lg text-[#475569] leading-relaxed max-w-xl font-normal">
                VoiceBill.AI brings billing, voice-assisted item entry, inventory management, and sales history together in one workspace built for everyday retail operations.
              </p>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
                <Link
                  to="/register"
                  className="px-7 py-3.5 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-sm font-bold shadow-lg shadow-[#1677F3]/25 transition active:scale-95 text-center inline-flex items-center justify-center gap-2"
                >
                  <span>Get Started</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>

                <a
                  href="#capabilities"
                  className="px-6 py-3.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#101828] text-sm font-bold shadow-xs transition active:scale-95 text-center inline-flex items-center justify-center gap-2"
                >
                  <span>Explore the Product</span>
                  <ChevronRight className="w-4 h-4 text-[#64748B]" />
                </a>
              </div>

              {/* Understated Supporting Line */}
              <div className="pt-2 flex flex-wrap items-center gap-y-2 gap-x-6 text-xs text-[#475569]">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Engineered for high-volume kirana counters</span>
                </div>
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Works on any laptop, tablet, or desktop</span>
                </div>
                <div className="flex items-center gap-2">
                  <Printer className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Instant 80mm & 58mm thermal receipts</span>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Large Polished Realistic Billing Experience Preview */}
            <div className="lg:col-span-6">
              <div className="bg-white rounded-2xl border border-[#CBD5E1]/90 shadow-2xl overflow-hidden ring-1 ring-black/5">
                {/* Simulated Store Status Top Bar */}
                <div className="bg-[#102A56] px-5 py-3.5 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
                    <div>
                      <p className="text-xs font-bold tracking-tight">Sai Kirana & General Store</p>
                      <p className="text-[10px] text-slate-300">Counter 01 • Active Shift</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-white/10 text-[10px] font-semibold text-slate-200">
                      <Printer className="w-3 h-3 text-emerald-400" />
                      80mm Thermal Ready
                    </span>
                  </div>
                </div>

                {/* Subtle Voice Entry Indicator */}
                <div className="bg-[#EFF6FF] border-b border-[#DBEAFE] px-4 py-2.5 flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-[#0755D9] font-medium truncate">
                    <span className="flex h-2 w-2 relative">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#1677F3] opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-[#1677F3]"></span>
                    </span>
                    <Mic className="w-3.5 h-3.5 text-[#1677F3] flex-shrink-0" />
                    <span className="font-semibold text-[#102A56]">Voice Assistant:</span>
                    <span className="italic text-[#1677F3] truncate">"2 packets amul butter, 1kg tata salt, 5kg chakki atta"</span>
                  </div>
                  <span className="hidden sm:inline-flex px-2 py-0.5 rounded text-[10px] font-bold bg-[#DBEAFE] text-[#0755D9]">
                    Auto-Parsed
                  </span>
                </div>

                {/* Realistic Line Items Table */}
                <div className="p-4 sm:p-5 space-y-4">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-[#E2E8F0] text-[#64748B] font-bold">
                          <th className="pb-2">Item Description</th>
                          <th className="pb-2 text-center">Qty</th>
                          <th className="pb-2 text-right">Price</th>
                          <th className="pb-2 text-right">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F1F5F9]">
                        <tr>
                          <td className="py-2.5">
                            <p className="font-bold text-[#102A56]">Amul Butter (500g)</p>
                            <span className="text-[10px] text-[#64748B]">Dairy • Barcode: 8901262010</span>
                          </td>
                          <td className="py-2.5 text-center font-bold text-[#102A56]">2</td>
                          <td className="py-2.5 text-right text-[#475569]">₹275.00</td>
                          <td className="py-2.5 text-right font-black text-[#102A56]">₹550.00</td>
                        </tr>
                        <tr>
                          <td className="py-2.5">
                            <p className="font-bold text-[#102A56]">Tata Salt Vacuum Evaporated (1kg)</p>
                            <span className="text-[10px] text-[#64748B]">Staples • Barcode: 8901030018</span>
                          </td>
                          <td className="py-2.5 text-center font-bold text-[#102A56]">1</td>
                          <td className="py-2.5 text-right text-[#475569]">₹28.00</td>
                          <td className="py-2.5 text-right font-black text-[#102A56]">₹28.00</td>
                        </tr>
                        <tr>
                          <td className="py-2.5">
                            <p className="font-bold text-[#102A56]">Aashirvaad Shudh Chakki Atta (5kg)</p>
                            <span className="text-[10px] text-[#64748B]">Flour • Barcode: 8901725132</span>
                          </td>
                          <td className="py-2.5 text-center font-bold text-[#102A56]">1</td>
                          <td className="py-2.5 text-right text-[#475569]">₹245.00</td>
                          <td className="py-2.5 text-right font-black text-[#102A56]">₹245.00</td>
                        </tr>
                        <tr>
                          <td className="py-2.5">
                            <p className="font-bold text-[#102A56]">Maggi 2-Minute Noodles (4-Pack)</p>
                            <span className="text-[10px] text-[#64748B]">Instant Food</span>
                          </td>
                          <td className="py-2.5 text-center font-bold text-[#102A56]">2</td>
                          <td className="py-2.5 text-right text-[#475569]">₹56.00</td>
                          <td className="py-2.5 text-right font-black text-[#102A56]">₹112.00</td>
                        </tr>
                        <tr>
                          <td className="py-2.5">
                            <p className="font-bold text-[#102A56]">Fortune Sunlite Sunflower Oil (1L)</p>
                            <span className="text-[10px] text-[#64748B]">Edible Oils</span>
                          </td>
                          <td className="py-2.5 text-center font-bold text-[#102A56]">1</td>
                          <td className="py-2.5 text-right text-[#475569]">₹145.00</td>
                          <td className="py-2.5 text-right font-black text-[#102A56]">₹145.00</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  {/* Bill Summary Calculations */}
                  <div className="pt-3 border-t border-[#E2E8F0] space-y-1.5 text-xs">
                    <div className="flex justify-between text-[#64748B]">
                      <span>Total Items:</span>
                      <span className="font-semibold text-[#102A56]">7 items (5 products)</span>
                    </div>
                    <div className="flex justify-between text-[#64748B]">
                      <span>Subtotal:</span>
                      <span>₹1,080.00</span>
                    </div>
                    <div className="flex justify-between text-emerald-600 font-semibold">
                      <span>Store Promo Discount:</span>
                      <span>-₹30.00</span>
                    </div>
                    <div className="pt-2 border-t border-[#CBD5E1] flex justify-between items-baseline">
                      <span className="text-sm font-extrabold text-[#102A56]">Grand Total:</span>
                      <span className="text-2xl font-black text-[#102A56] tracking-tight">₹1,050.00</span>
                    </div>
                  </div>

                  {/* Simulated Action Button */}
                  <div className="pt-1">
                    <div className="w-full py-3 rounded-xl bg-[#1677F3] text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md">
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Complete Sale & Print Thermal Receipt [F2]</span>
                    </div>
                  </div>

                  {/* Explanatory Disclaimers */}
                  <p className="text-[10px] text-slate-400 text-center">
                    * Illustrative retail preview based on real VoiceBill.AI counter workflow.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* 2. CONTRASTING BRAND STATEMENT SECTION (Deep Navy #102A56, white typography) */}
      <section className="w-full bg-[#102A56] text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
        <div className="max-w-5xl mx-auto text-center space-y-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 text-xs font-bold text-[#BFEAF5] uppercase tracking-wider">
            Operational Focus
          </div>

          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight max-w-4xl mx-auto">
            Less time managing bills. More time serving customers.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-2xl mx-auto leading-relaxed">
            VoiceBill.AI consolidates point-of-sale billing, product catalog management, and sales records into a single clean system designed for high-pace retail stores.
          </p>

          {/* 3 Value Highlight Blocks */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-10 text-left">
            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#1677F3] text-white flex items-center justify-center font-bold shadow-sm">
                <Zap className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Fast Checkout Workflow</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Reduce checkout queue times with rapid item search, voice command input, and instantaneous bill calculations.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#1677F3] text-white flex items-center justify-center font-bold shadow-sm">
                <Layers className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Live Inventory Sync</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Stock counts deduct automatically as sales occur, warning you when essential grocery staples reach low inventory levels.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-white/5 border border-white/10 space-y-3">
              <div className="w-10 h-10 rounded-xl bg-[#1677F3] text-white flex items-center justify-center font-bold shadow-sm">
                <Printer className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-white">Print-Ready Receipts</h3>
              <p className="text-xs text-slate-300 leading-relaxed">
                Standard 80mm and 58mm thermal receipts with store header, invoice numbers, itemized rows, and payment status.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 3. PRODUCT CAPABILITIES SECTION (Alternating Editorial Showcase) */}
      <section id="capabilities" className="w-full bg-[#F5F8FC] py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-[#E2E8F0]">
        <div className="max-w-7xl mx-auto space-y-20">
          
          {/* Section Heading */}
          <div className="text-center max-w-3xl mx-auto space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#1677F3]/20 text-[11px] font-extrabold uppercase tracking-wider text-[#0755D9]">
              Product Capabilities
            </div>
            <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-[#101828] tracking-tight">
              Everything You Need to Run Your Shop
            </h2>
            <p className="text-sm sm:text-base text-[#475569] leading-relaxed">
              Four cohesive retail modules built specifically for kirana counters and daily store operations.
            </p>
          </div>

          {/* Capability 1: Billing Counter (Text Left, Image Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-bold text-[#1677F3]">
                <ShoppingCart className="w-3.5 h-3.5" />
                <span>Feature 01 • Point of Sale</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#101828] tracking-tight">
                Make everyday billing straightforward.
              </h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Select products from your catalog, scan barcodes, quickly adjust quantities, review totals in real time, and complete sales using the streamlined checkout workflow.
              </p>
              <ul className="space-y-2.5 text-xs text-[#102A56] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Real-time price, discount, and tax calculation</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Support for Cash, UPI QR code, and Card payment methods</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Instant thermal receipt printing directly from the checkout modal</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
                      <ShoppingCart className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#102A56]">Active Billing Cart</p>
                      <p className="text-[10px] text-[#64748B]">Checkout Counter Mode</p>
                    </div>
                  </div>
                  <span className="text-xs font-black text-[#1677F3]">₹1,050.00</span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="flex justify-between p-2 rounded-lg bg-[#F8FAFC]">
                    <span className="font-semibold text-[#102A56]">Amul Butter 500g (x2)</span>
                    <span className="font-bold text-[#102A56]">₹550.00</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-[#F8FAFC]">
                    <span className="font-semibold text-[#102A56]">Aashirvaad Atta 5kg (x1)</span>
                    <span className="font-bold text-[#102A56]">₹245.00</span>
                  </div>
                  <div className="flex justify-between p-2 rounded-lg bg-[#F8FAFC]">
                    <span className="font-semibold text-[#102A56]">Tata Salt 1kg (x1)</span>
                    <span className="font-bold text-[#102A56]">₹28.00</span>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className="p-2 rounded-lg border border-[#1677F3] bg-[#EFF6FF] text-center text-xs font-bold text-[#1677F3]">
                    Cash
                  </div>
                  <div className="p-2 rounded-lg border border-[#E2E8F0] bg-white text-center text-xs font-bold text-[#64748B]">
                    UPI QR
                  </div>
                  <div className="p-2 rounded-lg border border-[#E2E8F0] bg-white text-center text-xs font-bold text-[#64748B]">
                    Card
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Capability 2: Voice Product Entry (Image Left, Text Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
                      <Mic className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#102A56]">Voice Product Recognition</p>
                      <p className="text-[10px] text-[#64748B]">Speech-to-Inventory Engine</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Parsed Successfully
                  </span>
                </div>
                <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs text-[#102A56] space-y-1">
                  <p className="font-bold text-[#1677F3] text-[11px] uppercase tracking-wider">Voice Input Transcription</p>
                  <p className="italic text-[#475569]">"Add Fortune Sunflower Oil 1 Litre price 145 stock 30 bottles"</p>
                </div>
                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-[#64748B]">
                    <span>Item Name:</span>
                    <span className="font-bold text-[#102A56]">Fortune Sunlite Sunflower Oil 1L</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Detected Price:</span>
                    <span className="font-bold text-[#102A56]">₹145.00</span>
                  </div>
                  <div className="flex justify-between text-[#64748B]">
                    <span>Initial Stock:</span>
                    <span className="font-bold text-[#102A56]">30 Units</span>
                  </div>
                </div>
                <div className="w-full py-2.5 rounded-xl bg-[#1677F3] text-white text-xs font-bold text-center">
                  + Add to Product Catalog
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-bold text-[#1677F3]">
                <Mic className="w-3.5 h-3.5" />
                <span>Feature 02 • Voice Assisted</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#102A56] tracking-tight">
                Add products with less manual typing.
              </h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Add new products quickly using voice-assisted entry and batch product creation. VoiceBill.AI captures product details so you spend less time manually filling forms.
              </p>
              <ul className="space-y-2.5 text-xs text-[#102A56] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Speech-to-text item extraction for fast counter operations</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Auto-population of item name, category, price, and stock levels</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Bulk batch import interface for stocking multiple items quickly</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Capability 3: Inventory Management (Text Left, Image Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 space-y-5">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-bold text-[#1677F3]">
                <Package className="w-3.5 h-3.5" />
                <span>Feature 03 • Stock Ledger</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#102A56] tracking-tight">
                Keep your product catalog organized.
              </h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Maintain accurate stock counts, view selling margins, and monitor low-stock thresholds. Every sale at the counter automatically updates inventory balances in real time.
              </p>
              <ul className="space-y-2.5 text-xs text-[#102A56] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Automatic stock deduction on every completed bill</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Configurable low-stock alerts to prevent stocking outages</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Barcode search and rapid price updates whenever costs change</span>
                </li>
              </ul>
            </div>

            <div className="lg:col-span-6">
              <div className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#102A56]">Store Inventory Catalog</p>
                      <p className="text-[10px] text-[#64748B]">Real-Time Stock Quantities</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                    1 Low Stock Alert
                  </span>
                </div>
                <div className="space-y-2.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div>
                      <p className="font-bold text-[#102A56]">Amul Butter (500g)</p>
                      <span className="text-[10px] text-emerald-600 font-semibold">In Stock: 42 units</span>
                    </div>
                    <span className="font-bold text-[#102A56]">₹275.00</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-amber-50/60 border border-amber-200">
                    <div>
                      <p className="font-bold text-[#102A56]">Tata Salt (1kg)</p>
                      <span className="text-[10px] text-amber-700 font-semibold">Low Stock: 3 units left</span>
                    </div>
                    <span className="font-bold text-[#102A56]">₹28.00</span>
                  </div>
                  <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                    <div>
                      <p className="font-bold text-[#102A56]">Aashirvaad Atta (5kg)</p>
                      <span className="text-[10px] text-emerald-600 font-semibold">In Stock: 18 units</span>
                    </div>
                    <span className="font-bold text-[#102A56]">₹245.00</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Capability 4: Sales History (Image Left, Text Right) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
            <div className="lg:col-span-6 order-2 lg:order-1">
              <div className="p-6 rounded-2xl bg-white border border-[#E2E8F0] shadow-xl space-y-4">
                <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
                      <Receipt className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#102A56]">Daily Sales Ledger</p>
                      <p className="text-[10px] text-[#64748B]">Audited Transaction Records</p>
                    </div>
                  </div>
                  <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                    Today: ₹8,420
                  </span>
                </div>
                <div className="space-y-2 text-xs">
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#102A56]">Bill #VB-2026-1049</p>
                      <p className="text-[10px] text-[#64748B]">5 items • UPI • 14:32 PM</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[#102A56]">₹1,050.00</p>
                      <span className="text-[10px] font-bold text-[#1677F3] inline-flex items-center gap-1">
                        <Printer className="w-3 h-3" /> Reprint
                      </span>
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-between">
                    <div>
                      <p className="font-bold text-[#102A56]">Bill #VB-2026-1048</p>
                      <p className="text-[10px] text-[#64748B]">2 items • Cash • 14:18 PM</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-[#102A56]">₹320.00</p>
                      <span className="text-[10px] font-bold text-[#1677F3] inline-flex items-center gap-1">
                        <Printer className="w-3 h-3" /> Reprint
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-6 space-y-5 order-1 lg:order-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-white border border-[#E2E8F0] text-xs font-bold text-[#1677F3]">
                <Receipt className="w-3.5 h-3.5" />
                <span>Feature 04 • Sales Records</span>
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-[#102A56] tracking-tight">
                Find previous sales when you need them.
              </h3>
              <p className="text-sm text-[#475569] leading-relaxed">
                Search completed bills in seconds, view original itemized receipts, and reprint thermal copies anytime customers ask without altering historical inventory records.
              </p>
              <ul className="space-y-2.5 text-xs text-[#102A56] font-medium">
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Instant bill search by invoice number or date</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Item snapshot preservation so older receipts remain completely accurate</span>
                </li>
                <li className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
                  <span>Safe thermal reprinting without altering database inventory counts</span>
                </li>
              </ul>
            </div>
          </div>

        </div>
      </section>

      {/* 4. HOW IT WORKS SECTION (Simple 3-step sequence) */}
      <section id="how-it-works" className="w-full bg-white py-20 lg:py-28 px-4 sm:px-6 lg:px-8 border-b border-[#E2E8F0]">
        <div className="max-w-5xl mx-auto space-y-16">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#1677F3]/20 text-[11px] font-extrabold uppercase tracking-wider text-[#0755D9]">
              Workflow
            </div>
            <h2 className="text-3xl sm:text-4xl font-black text-[#102A56] tracking-tight">
              Get Started in Three Simple Steps
            </h2>
            <p className="text-sm sm:text-base text-[#475569] max-w-xl mx-auto">
              Ready to use in minutes with no hardware changes or complex setup required.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
              <span className="text-3xl font-black text-[#1677F3]">01</span>
              <h3 className="text-lg font-bold text-[#102A56]">Set up your shop and products</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Create your store profile, specify your thermal receipt details, and enter your grocery items manually or with voice-assisted entry.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
              <span className="text-3xl font-black text-[#1677F3]">02</span>
              <h3 className="text-lg font-bold text-[#102A56]">Create bills using the billing workflow</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Ring up customers during peak rush hours, select items quickly, record Cash or UPI payments, and print sharp thermal receipts.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-4">
              <span className="text-3xl font-black text-[#1677F3]">03</span>
              <h3 className="text-lg font-bold text-[#102A56]">Review inventory and sales records</h3>
              <p className="text-xs text-[#475569] leading-relaxed">
                Monitor automatic stock deductions, receive low-stock alerts, and look up past transactions whenever customers request a reprint.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* 5. FINAL CALL TO ACTION (Bold Full-Width Brand Navy Section) */}
      <section className="w-full bg-[#102A56] text-white py-16 sm:py-24 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center space-y-6">
          <h2 className="text-3xl sm:text-4xl lg:text-5xl font-black text-white tracking-tight leading-tight">
            Make your next bill simpler.
          </h2>

          <p className="text-base sm:text-lg text-slate-300 max-w-xl mx-auto leading-relaxed">
            Bring your daily billing, voice item entry, and inventory workflow into one place with VoiceBill.AI.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-4">
            <Link
              to="/register"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-sm font-bold shadow-lg shadow-[#1677F3]/30 transition active:scale-95 text-center"
            >
              Create Your Account
            </Link>

            <Link
              to="/login"
              className="w-full sm:w-auto px-8 py-3.5 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-sm font-bold transition text-center"
            >
              Login
            </Link>
          </div>

          <p className="text-xs text-slate-400 pt-2">
            No credit card required • Instant store setup • Built for everyday retail operations
          </p>
        </div>
      </section>
    </div>
  );
};

export default HomePage;
