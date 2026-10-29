import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Receipt,
  Search,
  Filter,
  Calendar,
  CreditCard,
  Banknote,
  QrCode,
  RefreshCw,
  Printer,
  Eye,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  CheckCircle2,
  Clock,
  AlertCircle,
  X,
  FileText,
  ShoppingCart,
  Package,
  Layers,
  ArrowRight,
  Loader2,
  ShieldAlert,
  LogIn,
} from 'lucide-react';
import { useApp } from '../context';
import {
  listSales,
  getSale,
  extractErrorMessage,
  SaleResponse,
  SalesListFilterParams,
} from '../services/api';
import { ReceiptModal } from '../components/ReceiptModal';

const PAGE_SIZE = 15;

export const SalesHistoryPage: React.FC = () => {
  const { user, isAuthenticated, login, isLoadingAuth } = useApp();

  // Sales data state
  const [sales, setSales] = useState<SaleResponse[]>([]);
  const [totalCount, setTotalCount] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Search and filter states
  const [receiptSearch, setReceiptSearch] = useState<string>('');
  const [appliedSearch, setAppliedSearch] = useState<string>('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);

  // Receipt Modal State
  const [selectedSale, setSelectedSale] = useState<SaleResponse | null>(null);
  const [isReceiptOpen, setIsReceiptOpen] = useState<boolean>(false);
  const [isLoadingReceipt, setIsLoadingReceipt] = useState<boolean>(false);
  const [isReprintAction, setIsReprintAction] = useState<boolean>(false);

  // Quick inline login state
  const [loginEmail, setLoginEmail] = useState<string>('rahul@example.com');
  const [loginPassword, setLoginPassword] = useState<string>('password123');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Fetch sales from authenticated API
  const fetchSales = useCallback(
    async (showRefreshIndicator = false) => {
      if (!isAuthenticated) {
        setIsLoading(false);
        return;
      }

      if (showRefreshIndicator) {
        setIsRefreshing(true);
      } else {
        setIsLoading(true);
      }
      setErrorMessage(null);

      try {
        const offset = (currentPage - 1) * PAGE_SIZE;
        const params: SalesListFilterParams = {
          limit: PAGE_SIZE,
          offset,
        };

        if (appliedSearch.trim()) {
          params.receipt_number = appliedSearch.trim();
        }
        if (paymentMethodFilter !== 'all') {
          params.payment_method = paymentMethodFilter;
        }
        if (paymentStatusFilter !== 'all') {
          params.payment_status = paymentStatusFilter;
        }
        if (startDate) {
          params.start_date = startDate;
        }
        if (endDate) {
          params.end_date = endDate;
        }

        const res = await listSales(params);
        setSales(res.sales);
        setTotalCount(res.total_count);
      } catch (err) {
        console.error('Failed to load sales history:', err);
        setErrorMessage(extractErrorMessage(err, 'Could not retrieve sales history.'));
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [
      isAuthenticated,
      currentPage,
      appliedSearch,
      paymentMethodFilter,
      paymentStatusFilter,
      startDate,
      endDate,
    ]
  );

  useEffect(() => {
    fetchSales();
  }, [fetchSales]);

  // Handle Receipt Search form submission
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    setAppliedSearch(receiptSearch);
  };

  const handleClearSearch = () => {
    setReceiptSearch('');
    setAppliedSearch('');
    setCurrentPage(1);
  };

  // Preset Date Range Helpers
  const setDatePreset = (preset: 'today' | 'yesterday' | '7days' | 'month' | 'all') => {
    setCurrentPage(1);
    const now = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    const toYMD = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    if (preset === 'all') {
      setStartDate('');
      setEndDate('');
      return;
    }

    if (preset === 'today') {
      const todayStr = toYMD(now);
      setStartDate(todayStr);
      setEndDate(todayStr);
      return;
    }

    if (preset === 'yesterday') {
      const yest = new Date(now);
      yest.setDate(now.getDate() - 1);
      const yestStr = toYMD(yest);
      setStartDate(yestStr);
      setEndDate(yestStr);
      return;
    }

    if (preset === '7days') {
      const past = new Date(now);
      past.setDate(now.getDate() - 6);
      setStartDate(toYMD(past));
      setEndDate(toYMD(now));
      return;
    }

    if (preset === 'month') {
      const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
      setStartDate(toYMD(firstDay));
      setEndDate(toYMD(now));
      return;
    }
  };

  // Reset all filters
  const handleResetFilters = () => {
    setReceiptSearch('');
    setAppliedSearch('');
    setPaymentMethodFilter('all');
    setPaymentStatusFilter('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);
  };

  const hasActiveFilters = Boolean(
    appliedSearch ||
    paymentMethodFilter !== 'all' ||
    paymentStatusFilter !== 'all' ||
    startDate ||
    endDate
  );

  // Open receipt details modal
  const handleViewReceipt = async (sale: SaleResponse) => {
    setIsReprintAction(false);
    setIsLoadingReceipt(true);
    try {
      // Re-fetch individual sale to ensure full relations are loaded
      const fullSale = await getSale(sale.id);
      setSelectedSale(fullSale);
      setIsReceiptOpen(true);
    } catch (err) {
      console.warn('Fallback to listed sale item:', err);
      setSelectedSale(sale);
      setIsReceiptOpen(true);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  // Direct Reprint handler
  const handleReprintReceipt = async (sale: SaleResponse) => {
    setIsReprintAction(true);
    setIsLoadingReceipt(true);
    try {
      const fullSale = await getSale(sale.id);
      setSelectedSale(fullSale);
      setIsReceiptOpen(true);
    } catch (err) {
      console.warn('Fallback to listed sale item:', err);
      setSelectedSale(sale);
      setIsReceiptOpen(true);
    } finally {
      setIsLoadingReceipt(false);
    }
  };

  // Quick inline login for dev / testing convenience
  const handleQuickLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setLoginError(extractErrorMessage(err, 'Login failed'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // Summary statistics computed for current view
  const metrics = useMemo(() => {
    let totalRevenue = 0;
    let cashTotal = 0;
    let upiTotal = 0;
    let cashCount = 0;
    let upiCount = 0;

    sales.forEach((s) => {
      const amt = Number(s.total_amount) || 0;
      totalRevenue += amt;
      if (s.payment_method === 'cash') {
        cashTotal += amt;
        cashCount += 1;
      } else if (s.payment_method === 'upi') {
        upiTotal += amt;
        upiCount += 1;
      }
    });

    return {
      totalRevenue,
      cashTotal,
      upiTotal,
      cashCount,
      upiCount,
      pageCount: sales.length,
    };
  }, [sales]);

  // Pagination calculation
  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
  const startItem = totalCount === 0 ? 0 : (currentPage - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(currentPage * PAGE_SIZE, totalCount);

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-200">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center text-brand-primary">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-navy tracking-tight flex items-center gap-2">
                Sales History & Receipts
              </h1>
              <p className="text-xs text-slate-500">
                Track real-time orders, browse customer receipts, and reprint tax invoices
              </p>
            </div>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center space-x-2.5">
          <button
            type="button"
            onClick={() => fetchSales(true)}
            disabled={isLoading || isRefreshing || !isAuthenticated}
            className="inline-flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition disabled:opacity-50"
            title="Refresh sales list from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-brand-primary' : ''}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/billing"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold transition shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Bill</span>
          </Link>

          <Link
            to="/inventory"
            className="inline-flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-sm transition"
          >
            <Package className="w-3.5 h-3.5 text-brand-primary" />
            <span>Inventory</span>
          </Link>
        </div>
      </div>

      {/* Authentication Banner (if user logged out) */}
      {!isLoadingAuth && !isAuthenticated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-5 space-y-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900">Store Authentication Required</h3>
              <p className="text-xs text-amber-700 leading-relaxed">
                Sales receipts and financial ledgers are strictly isolated per store. Log in to access your store's sales records.
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickLogin} className="flex flex-wrap items-center gap-3 pt-2">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Email"
              required
              className="bg-white border border-amber-300 text-xs text-navy rounded-lg px-3 py-2 w-48 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary placeholder-slate-400"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              required
              className="bg-white border border-amber-300 text-xs text-navy rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary placeholder-slate-400"
            />
            <button
              type="submit"
              disabled={isLoggingIn}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-brand-primary hover:bg-brand-hover text-white text-xs font-semibold rounded-lg transition disabled:opacity-50 shadow-sm"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isLoggingIn ? 'Logging In...' : 'Log In'}</span>
            </button>
            {loginError && <span className="text-xs text-rose-600">{loginError}</span>}
          </form>
        </div>
      )}

      {/* Summary Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Invoices */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Invoices
            </span>
            <div className="text-2xl font-black text-navy font-mono">
              {totalCount.toLocaleString()}
            </div>
            <p className="text-[11px] text-slate-400">
              {hasActiveFilters ? 'Filtered results' : 'Lifetime store sales'}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-primary">
            <FileText className="w-6 h-6" />
          </div>
        </div>

        {/* Current Page Volume */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Page Volume
            </span>
            <div className="text-2xl font-black text-brand-primary font-mono">
              ₹{metrics.totalRevenue.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400">
              Across {metrics.pageCount} visible sale{metrics.pageCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-center text-brand-primary">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        {/* Cash Collection */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Cash Collection
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono">
              ₹{metrics.cashTotal.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400">
              {metrics.cashCount} cash transaction{metrics.cashCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600">
            <Banknote className="w-6 h-6" />
          </div>
        </div>

        {/* UPI Collection */}
        <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-sm flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              UPI Collection
            </span>
            <div className="text-2xl font-black text-indigo-600 font-mono">
              ₹{metrics.upiTotal.toFixed(2)}
            </div>
            <p className="text-[11px] text-slate-400">
              {metrics.upiCount} UPI transaction{metrics.upiCount !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="w-12 h-12 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
            <QrCode className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Filter and Search Toolbar */}
      <div className="bg-white border border-slate-200/80 rounded-2xl p-4 sm:p-5 shadow-sm space-y-4">
        {/* Top search & selectors row */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Search by Receipt Number */}
          <form
            onSubmit={handleSearchSubmit}
            className="md:col-span-5 relative flex items-center"
          >
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
            <input
              type="text"
              value={receiptSearch}
              onChange={(e) => setReceiptSearch(e.target.value)}
              placeholder="Search receipt # (e.g. REC-2-...)"
              className="w-full pl-10 pr-20 py-2.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-navy placeholder-slate-400 focus:outline-none focus:bg-white focus:border-brand-primary focus:ring-1 focus:ring-brand-primary font-mono transition"
            />
            {receiptSearch && (
              <button
                type="button"
                onClick={handleClearSearch}
                className="absolute right-14 text-slate-400 hover:text-navy p-1"
                title="Clear"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="submit"
              className="absolute right-1.5 px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg transition"
            >
              Search
            </button>
          </form>

          {/* Payment Method Dropdown */}
          <div className="md:col-span-3">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <CreditCard className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={paymentMethodFilter}
                onChange={(e) => {
                  setPaymentMethodFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent text-xs text-navy focus:outline-none cursor-pointer"
              >
                <option value="all">All Payment Methods</option>
                <option value="cash">💵 Cash Only</option>
                <option value="upi">📱 UPI Only</option>
              </select>
            </div>
          </div>

          {/* Payment Status Dropdown */}
          <div className="md:col-span-2">
            <div className="flex items-center space-x-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2">
              <CheckCircle2 className="w-4 h-4 text-slate-400 flex-shrink-0" />
              <select
                value={paymentStatusFilter}
                onChange={(e) => {
                  setPaymentStatusFilter(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full bg-transparent text-xs text-navy focus:outline-none cursor-pointer"
              >
                <option value="all">All Statuses</option>
                <option value="completed">Completed</option>
                <option value="pending">Pending</option>
                <option value="failed">Failed</option>
              </select>
            </div>
          </div>

          {/* Reset Filters Action */}
          <div className="md:col-span-2 flex justify-end">
            <button
              type="button"
              onClick={handleResetFilters}
              disabled={!hasActiveFilters}
              className="w-full md:w-auto inline-flex items-center justify-center space-x-1.5 px-3 py-2 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-600 hover:text-navy text-xs font-semibold transition disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
            >
              <RotateCcwIcon className="w-3.5 h-3.5" />
              <span>Reset Filters</span>
            </button>
          </div>
        </div>

        {/* Date Filters Row */}
        <div className="pt-3 border-t border-slate-100 flex flex-col lg:flex-row lg:items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-500 font-semibold flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-primary" />
              Date Range:
            </span>

            <div className="flex items-center space-x-1.5">
              <input
                type="date"
                value={startDate}
                onChange={(e) => {
                  setStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:bg-white focus:border-brand-primary"
                title="Start Date"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => {
                  setEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-navy focus:outline-none focus:bg-white focus:border-brand-primary"
                title="End Date"
              />
            </div>
          </div>

          {/* Quick Date Range Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400 mr-1">Presets:</span>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-slate-600 transition text-[11px] font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('yesterday')}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-slate-600 transition text-[11px] font-medium"
            >
              Yesterday
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('7days')}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-slate-600 transition text-[11px] font-medium"
            >
              Last 7 Days
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('month')}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-slate-600 transition text-[11px] font-medium"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('all')}
              className="px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200 hover:border-brand-primary hover:text-brand-primary text-slate-600 transition text-[11px] font-medium"
            >
              All Time
            </button>
          </div>
        </div>
      </div>

      {/* Error Message Alert */}
      {errorMessage && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 flex items-center justify-between text-xs text-rose-800">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchSales()}
            className="underline font-semibold hover:text-rose-950"
          >
            Try Again
          </button>
        </div>
      )}

      {/* Sales Table / Responsive List Card */}
      <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-sm">
        {/* Loading Spinner */}
        {isLoading ? (
          <div className="py-24 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            <p className="text-xs font-medium">Loading sales records from database...</p>
          </div>
        ) : sales.length === 0 ? (
          /* Empty State */
          <div className="py-20 px-4 text-center space-y-3">
            <div className="w-14 h-14 mx-auto rounded-2xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-400">
              <Receipt className="w-7 h-7" />
            </div>
            <h3 className="text-base font-bold text-navy">No Sales Records Found</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              {hasActiveFilters
                ? 'No transactions matched your search or date criteria. Try adjusting or resetting your filters.'
                : 'Your store has no completed transactions yet. Start billing customers to generate sales history.'}
            </p>
            {hasActiveFilters ? (
              <button
                type="button"
                onClick={handleResetFilters}
                className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
              >
                <span>Clear All Filters</span>
              </button>
            ) : (
              <Link
                to="/billing"
                className="mt-2 inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-hover text-white text-xs font-bold transition shadow-sm"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>Go to Billing Counter</span>
              </Link>
            )}
          </div>
        ) : (
          /* Active Sales Table */
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase tracking-wider text-[11px] font-semibold">
                <tr>
                  <th scope="col" className="py-3.5 px-4 sm:px-6">Receipt #</th>
                  <th scope="col" className="py-3.5 px-4">Date & Time</th>
                  <th scope="col" className="py-3.5 px-4 text-center">Items</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Subtotal</th>
                  <th scope="col" className="py-3.5 px-4 text-right">Total Amount</th>
                  <th scope="col" className="py-3.5 px-4">Payment</th>
                  <th scope="col" className="py-3.5 px-4">Status</th>
                  <th scope="col" className="py-3.5 px-4 sm:px-6 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {sales.map((sale) => {
                  const saleDate = new Date(sale.created_at);
                  const formattedDate = saleDate.toLocaleDateString('en-IN', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                  });
                  const formattedTime = saleDate.toLocaleTimeString('en-IN', {
                    hour: '2-digit',
                    minute: '2-digit',
                    hour12: true,
                  });
                  const itemCount = sale.items?.length || 0;

                  return (
                    <tr
                      key={sale.id}
                      className="hover:bg-slate-50/60 transition group"
                    >
                      {/* Receipt Number */}
                      <td className="py-3.5 px-4 sm:px-6 font-mono font-semibold text-navy">
                        <div className="flex items-center space-x-1.5">
                          <span className="text-brand-primary font-bold">#</span>
                          <span>{sale.receipt_number}</span>
                        </div>
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                        <div className="font-medium text-navy">{formattedDate}</div>
                        <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-1 mt-0.5">
                          <Clock className="w-3 h-3 text-slate-400" />
                          <span>{formattedTime}</span>
                        </div>
                      </td>

                      {/* Items Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold text-[11px]">
                          {itemCount} {itemCount === 1 ? 'item' : 'items'}
                        </span>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3.5 px-4 text-right font-mono text-slate-500">
                        ₹{Number(sale.subtotal).toFixed(2)}
                      </td>

                      {/* Total Amount */}
                      <td className="py-3.5 px-4 text-right font-mono font-bold text-navy text-sm">
                        ₹{Number(sale.total_amount).toFixed(2)}
                      </td>

                      {/* Payment Method Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sale.payment_method === 'cash' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <Banknote className="w-3 h-3 text-emerald-600" />
                            <span>Cash</span>
                          </span>
                        ) : sale.payment_method === 'upi' ? (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                            <QrCode className="w-3 h-3 text-indigo-600" />
                            <span>UPI</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-md text-[11px] font-semibold bg-slate-100 text-slate-700">
                            <CreditCard className="w-3 h-3 text-slate-500" />
                            <span className="capitalize">{sale.payment_method}</span>
                          </span>
                        )}
                      </td>

                      {/* Payment Status Badge */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        {sale.payment_status === 'completed' ? (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-50 text-emerald-700 border border-emerald-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span>Completed</span>
                          </span>
                        ) : (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-amber-50 text-amber-700 border border-amber-200">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                            <span>{sale.payment_status}</span>
                          </span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 sm:px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end space-x-2">
                          {/* View Receipt */}
                          <button
                            type="button"
                            onClick={() => handleViewReceipt(sale)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                            title="View receipt snapshot"
                          >
                            <Eye className="w-3.5 h-3.5 text-slate-500" />
                            <span>View</span>
                          </button>

                          {/* Reprint Receipt */}
                          <button
                            type="button"
                            onClick={() => handleReprintReceipt(sale)}
                            className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-brand-primary border border-blue-200 text-xs font-semibold transition"
                            title="Print / Reprint receipt"
                          >
                            <Printer className="w-3.5 h-3.5 text-brand-primary" />
                            <span>Reprint</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination Bar */}
        {!isLoading && totalCount > 0 && (
          <div className="p-4 border-t border-slate-200 bg-slate-50/50 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500">
            <div>
              Showing <span className="font-semibold text-navy">{startItem}</span> to{' '}
              <span className="font-semibold text-navy">{endItem}</span> of{' '}
              <span className="font-semibold text-navy">{totalCount}</span> sales
            </div>

            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>

              <span className="px-2 text-slate-500 font-medium">
                Page <span className="text-navy font-bold">{currentPage}</span> of{' '}
                <span className="text-navy font-bold">{totalPages}</span>
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white hover:bg-slate-100 text-slate-700 disabled:opacity-40 disabled:cursor-not-allowed transition shadow-sm"
              >
                <span>Next</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Standalone Receipt Modal for Viewing & Reprinting */}
      <ReceiptModal
        isOpen={isReceiptOpen}
        sale={selectedSale}
        onClose={() => {
          setIsReceiptOpen(false);
          setSelectedSale(null);
          setIsReprintAction(false);
        }}
        title={
          isReprintAction
            ? `Reprint Receipt #${selectedSale?.receipt_number || ''}`
            : `Tax Invoice Receipt #${selectedSale?.receipt_number || ''}`
        }
        isReprint={isReprintAction}
      />
    </div>
  );
};

// Small helper component for Reset icon
const RotateCcwIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

export default SalesHistoryPage;
