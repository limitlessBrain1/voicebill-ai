import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Package,
  Search,
  Filter,
  Edit3,
  Eye,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  Layers,
  Tag,
  Barcode as BarcodeIcon,
  RefreshCw,
  Loader2,
  ShieldAlert,
  LogIn,
  Power,
  Trash2,
  DollarSign,
  AlertTriangle,
  X,
  Plus,
  ArrowRight,
  SlidersHorizontal,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import { useApp } from '../context';
import {
  getProducts,
  getCategories,
  updateProduct,
  updateProductStock,
  deleteProduct,
  extractErrorMessage,
  ProductResponse,
  CategoryResponse,
  ProductUpdateData,
} from '../services/api';
import { COMMON_UNITS } from '../services/voiceProducts';

export type StockFilterType = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'inactive';
export type SortField = 'name' | 'category' | 'purchase_price' | 'selling_price' | 'stock_quantity';
export type SortOrder = 'asc' | 'desc';

export const getStockStatus = (
  stockQuantity: number | string,
  lowStockThreshold: number | string,
  isActive: boolean
): 'inactive' | 'out_of_stock' | 'low_stock' | 'in_stock' => {
  if (!isActive) return 'inactive';
  const stock = Number(stockQuantity) || 0;
  const threshold = Number(lowStockThreshold) || 0;

  if (stock <= 0) {
    return 'out_of_stock';
  }
  if (stock <= threshold) {
    return 'low_stock';
  }
  return 'in_stock';
};

export const InventoryPage: React.FC = () => {
  const { user, isAuthenticated, isOwner, login, isLoadingAuth, language, t } = useApp();

  // Data states
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter, Search & Sort states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination states
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(10);

  // Modals state
  const [viewProduct, setViewProduct] = useState<ProductResponse | null>(null);
  const [editProduct, setEditProduct] = useState<ProductResponse | null>(null);
  const [stockProduct, setStockProduct] = useState<ProductResponse | null>(null);
  const [deleteProductTarget, setDeleteProductTarget] = useState<ProductResponse | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<ProductUpdateData>({});
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Stock form state
  const [newStockVal, setNewStockVal] = useState<string>('');
  const [isSavingStock, setIsSavingStock] = useState<boolean>(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Deletion in progress
  const [isDeleting, setIsDeleting] = useState<boolean>(false);

  // Quick cashier login state for demo
  const [loginEmail, setLoginEmail] = useState<string>('rahul@example.com');
  const [loginPassword, setLoginPassword] = useState<string>('password123');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Category map for fast O(1) lookup
  const categoryMap = useMemo(() => {
    const map = new Map<number, string>();
    categories.forEach((cat) => {
      map.set(cat.id, cat.name);
    });
    return map;
  }, [categories]);

  // Load products and categories from database
  const loadData = useCallback(async (isRefresh = false) => {
    if (!isAuthenticated) return;
    if (isRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setError(null);

    try {
      const [prodsData, catsData] = await Promise.all([
        getProducts(),
        getCategories(),
      ]);
      setProducts(prodsData);
      setCategories(catsData);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch inventory from store database.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    }
  }, [isAuthenticated, loadData]);

  // Handle Quick Login
  const handleQuickLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setIsLoggingIn(true);
    setLoginError(null);
    try {
      await login(loginEmail, loginPassword);
    } catch (err) {
      setLoginError(extractErrorMessage(err, 'Login failed. Please verify credentials.'));
    } finally {
      setIsLoggingIn(false);
    }
  };

  // -------------------------------------------------------------
  // SORTING & FILTERING
  // -------------------------------------------------------------
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  const filteredAndSortedProducts = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();

    const filtered = products.filter((p) => {
      // 1. Search filter (supports Marathi Unicode & English)
      if (query) {
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(query) : false;
        const catName = p.category_id ? (categoryMap.get(p.category_id) || '').toLowerCase() : '';
        const matchesCategory = catName.includes(query);

        if (!matchesName && !matchesBarcode && !matchesCategory) {
          return false;
        }
      }

      // 2. Category filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'uncategorized') {
          if (p.category_id !== null) return false;
        } else {
          const catId = Number(selectedCategory);
          if (p.category_id !== catId) return false;
        }
      }

      // 3. Stock status filter
      if (stockFilter !== 'all') {
        const status = getStockStatus(p.stock_quantity, p.low_stock_threshold, p.is_active);
        if (status !== stockFilter) {
          return false;
        }
      }

      return true;
    });

    // Sort products
    return filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortField) {
        case 'name':
          comparison = a.name.localeCompare(b.name, language === 'mr' ? 'mr' : 'en');
          break;
        case 'category': {
          const catA = a.category_id ? categoryMap.get(a.category_id) || '' : '';
          const catB = b.category_id ? categoryMap.get(b.category_id) || '' : '';
          comparison = catA.localeCompare(catB);
          break;
        }
        case 'purchase_price':
          comparison = Number(a.purchase_price) - Number(b.purchase_price);
          break;
        case 'selling_price':
          comparison = Number(a.selling_price) - Number(b.selling_price);
          break;
        case 'stock_quantity':
          comparison = Number(a.stock_quantity) - Number(b.stock_quantity);
          break;
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [products, searchQuery, selectedCategory, stockFilter, sortField, sortOrder, categoryMap, language]);

  // Pagination calculation
  const totalItems = filteredAndSortedProducts.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredAndSortedProducts.slice(start, start + pageSize);
  }, [filteredAndSortedProducts, currentPage, pageSize]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedCategory, stockFilter, pageSize]);

  // Operational metrics
  const metrics = useMemo(() => {
    let inStockCount = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inactiveCount = 0;

    products.forEach((p) => {
      const status = getStockStatus(p.stock_quantity, p.low_stock_threshold, p.is_active);
      if (status === 'in_stock') inStockCount++;
      else if (status === 'low_stock') lowStockCount++;
      else if (status === 'out_of_stock') outOfStockCount++;
      else if (status === 'inactive') inactiveCount++;
    });

    return {
      total: products.length,
      inStock: inStockCount,
      lowStock: lowStockCount,
      outOfStock: outOfStockCount,
      inactive: inactiveCount,
    };
  }, [products]);

  // -------------------------------------------------------------
  // STOCK UPDATE ACTION
  // -------------------------------------------------------------
  const openStockModal = (product: ProductResponse) => {
    setStockProduct(product);
    setNewStockVal(String(product.stock_quantity));
    setStockError(null);
  };

  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    const val = parseFloat(newStockVal);
    if (isNaN(val) || val < 0) {
      setStockError(language === 'mr' ? 'कृपया वैध साठा संख्या प्रविष्ट करा (शून्य किंवा त्याहून अधिक).' : 'Stock quantity must be a non-negative number.');
      return;
    }

    setIsSavingStock(true);
    setStockError(null);

    try {
      const updated = await updateProductStock(stockProduct.id, val);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMsg(t.stockUpdatedSuccess);
      setStockProduct(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setStockError(extractErrorMessage(err, 'Failed to update stock quantity.'));
    } finally {
      setIsSavingStock(false);
    }
  };

  // -------------------------------------------------------------
  // EDIT PRODUCT ACTION
  // -------------------------------------------------------------
  const openEditModal = (product: ProductResponse) => {
    setEditProduct(product);
    setEditForm({
      name: product.name,
      category_id: product.category_id,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      pack_size: product.pack_size,
      unit: product.unit,
      stock_quantity: product.stock_quantity,
      low_stock_threshold: product.low_stock_threshold,
      barcode: product.barcode,
      is_active: product.is_active,
    });
    setEditError(null);
  };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    if (!editForm.name || !editForm.name.trim()) {
      setEditError(t.nameRequired);
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updated = await updateProduct(editProduct.id, {
        ...editForm,
        name: editForm.name.trim(),
        unit: editForm.unit ? editForm.unit.trim().toLowerCase() : 'kg',
      });
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMsg(t.updateSuccess);
      setEditProduct(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Failed to update product details.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // -------------------------------------------------------------
  // DELETE PRODUCT ACTION
  // -------------------------------------------------------------
  const handleDeleteProduct = async () => {
    if (!deleteProductTarget) return;

    setIsDeleting(true);
    try {
      await deleteProduct(deleteProductTarget.id);
      // Soft-delete: update is_active to false in local state
      setProducts((prev) =>
        prev.map((p) => (p.id === deleteProductTarget.id ? { ...p, is_active: false } : p))
      );
      setSuccessMsg(t.deleteSuccess);
      setDeleteProductTarget(null);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete product.'));
    } finally {
      setIsDeleting(false);
    }
  };

  // Sort indicator icon
  const renderSortIcon = (field: SortField) => {
    if (sortField !== field) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-[#94A3B8] opacity-60 group-hover:opacity-100" />;
    }
    return sortOrder === 'asc' ? (
      <ArrowUp className="w-3.5 h-3.5 text-[#1677F3]" />
    ) : (
      <ArrowDown className="w-3.5 h-3.5 text-[#1677F3]" />
    );
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* 1. TOP HEADER & METRICS */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1677F3]" />
            <p className="text-xs font-bold uppercase tracking-wider text-[#1677F3]">
              {language === 'mr' ? 'थेट इन्व्हेंटरी' : 'Live Inventory'}
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A56] tracking-tight mt-1">
            {t.inventoryTitle}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            {t.inventorySubtitle}
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing || !isAuthenticated}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#102A56] text-xs font-semibold transition disabled:opacity-50 shadow-2xs"
            title="Refresh database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1677F3]' : 'text-[#64748B]'}`} />
            <span>{t.refresh}</span>
          </button>

          <Link
            to="/products/voice"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs shadow-sm shadow-[#1677F3]/25 transition active:scale-95"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t.add}</span>
          </Link>
        </div>
      </div>

      {/* Auth Banner */}
      {!isLoadingAuth && (!isAuthenticated || !isOwner) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900">
                {language === 'mr' ? 'दुकान मालक लॉग इन आवश्यक' : 'Store Owner Authentication Required'}
              </h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                {language === 'mr'
                  ? 'इन्व्हेंटरी व्यवस्थापनासाठी कृपया दुकान मालक म्हणून लॉग इन करा.'
                  : 'Inventory data is strictly isolated per shop. Please log in as the store owner to view and manage products.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleQuickLogin} className="flex flex-wrap items-center gap-3 pt-2">
            <input
              type="email"
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              placeholder="Owner email"
              required
              className="bg-white border border-[#CBD5E1] text-xs text-[#102A56] rounded-lg px-3 py-2 w-48 focus:outline-none focus:border-[#1677F3]"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              required
              className="bg-white border border-[#CBD5E1] text-xs text-[#102A56] rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-[#1677F3]"
            />
            <button
              type="submit"
              disabled={isLoggingIn}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold rounded-lg transition disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isLoggingIn ? 'Logging In...' : 'Log in as Owner'}</span>
            </button>
            {loginError && <span className="text-xs text-rose-600 font-medium">{loginError}</span>}
          </form>
        </div>
      )}

      {/* Global Success / Error Banners */}
      {successMsg && (
        <div className="flex items-center space-x-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}
      {error && (
        <div className="flex items-center justify-between p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <div className="flex items-center space-x-3">
            <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0" />
            <span>{error}</span>
          </div>
          <button onClick={() => loadData(true)} className="underline font-bold text-xs">
            {t.refresh}
          </button>
        </div>
      )}

      {/* Metric Cards Summary */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Products */}
        <button
          type="button"
          onClick={() => setStockFilter('all')}
          className={`p-4 rounded-2xl bg-white border transition text-left shadow-card ${
            stockFilter === 'all' ? 'border-[#1677F3] ring-2 ring-[#1677F3]/10' : 'border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[#64748B]">{t.totalProducts}</span>
            <div className="w-7 h-7 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-[#102A56] font-mono">{metrics.total}</p>
          </div>
        </button>

        {/* In Stock */}
        <button
          type="button"
          onClick={() => setStockFilter('in_stock')}
          className={`p-4 rounded-2xl bg-white border transition text-left shadow-card ${
            stockFilter === 'in_stock' ? 'border-emerald-500 ring-2 ring-emerald-500/10' : 'border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-700">{t.inStock}</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-emerald-600 font-mono">{metrics.inStock}</p>
          </div>
        </button>

        {/* Low Stock Warning */}
        <button
          type="button"
          onClick={() => setStockFilter('low_stock')}
          className={`p-4 rounded-2xl bg-white border transition text-left shadow-card ${
            stockFilter === 'low_stock' ? 'border-amber-500 ring-2 ring-amber-500/10' : 'border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-amber-700">{t.lowStock}</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center font-bold">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-amber-600 font-mono">{metrics.lowStock}</p>
          </div>
        </button>

        {/* Out of Stock */}
        <button
          type="button"
          onClick={() => setStockFilter('out_of_stock')}
          className={`p-4 rounded-2xl bg-white border transition text-left shadow-card ${
            stockFilter === 'out_of_stock' ? 'border-rose-500 ring-2 ring-rose-500/10' : 'border-[#E2E8F0]'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-rose-700">{t.outOfStock}</span>
            <div className="w-7 h-7 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-2">
            <p className="text-2xl font-black text-rose-600 font-mono">{metrics.outOfStock}</p>
          </div>
        </button>
      </section>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4 shadow-card">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t.searchProductsPlaceholder}
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:bg-white focus:outline-none focus:border-[#1677F3] focus:ring-2 focus:ring-[#1677F3]/10 transition"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#94A3B8] hover:text-[#102A56]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Category Dropdown Filter */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] font-medium focus:bg-white focus:outline-none focus:border-[#1677F3] transition appearance-none pr-8 cursor-pointer"
              >
                <option value="all">{t.allCategories} ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="uncategorized">{language === 'mr' ? 'अवर्गीकृत (Uncategorized)' : 'Uncategorized'}</option>
              </select>
              <Filter className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Stock Status Filter */}
            <div className="relative">
              <select
                value={stockFilter}
                onChange={(e) => setStockFilter(e.target.value as StockFilterType)}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] font-medium focus:bg-white focus:outline-none focus:border-[#1677F3] transition appearance-none pr-8 cursor-pointer"
              >
                <option value="all">{t.allStockStatuses}</option>
                <option value="in_stock">{t.inStock}</option>
                <option value="low_stock">{t.lowStock}</option>
                <option value="out_of_stock">{t.outOfStock}</option>
                <option value="inactive">{t.inactive}</option>
              </select>
              <SlidersHorizontal className="w-3.5 h-3.5 text-[#94A3B8] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {/* Reset Filters */}
            {(searchQuery || selectedCategory !== 'all' || stockFilter !== 'all') && (
              <button
                type="button"
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCategory('all');
                  setStockFilter('all');
                }}
                className="px-3 py-2 text-xs font-semibold text-[#64748B] hover:text-[#102A56] transition"
              >
                {t.reset}
              </button>
            )}
          </div>
        </div>

        {/* Results Counter and Active Filter Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B]">
          <div>
            {t.showingProducts} <strong className="text-[#102A56]">{totalItems}</strong> {t.ofProducts}{' '}
            <strong className="text-[#102A56]">{products.length}</strong> {language === 'mr' ? 'उत्पादने' : 'products'}
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[11px] text-[#64748B]">{t.rowsPerPage}</span>
            <select
              value={pageSize}
              onChange={(e) => setPageSize(Number(e.target.value))}
              className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs text-[#102A56] font-medium"
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
            </select>
          </div>
        </div>
      </section>

      {/* 3. RESPONSIVE INVENTORY TABLE */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-16 text-center space-y-3 shadow-card">
            <Loader2 className="w-8 h-8 animate-spin text-[#1677F3] mx-auto" />
            <p className="text-sm text-[#64748B]">{language === 'mr' ? 'डेटाबेसमधून इन्व्हेंटरी लोड होत आहे...' : 'Loading inventory from store database...'}</p>
          </div>
        ) : filteredAndSortedProducts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-white p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-[#102A56]">{t.noProductsFound}</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {products.length === 0
                  ? language === 'mr'
                    ? 'तुमची इन्व्हेंटरी सध्या रिकामी आहे. व्हॉइस किंवा मॅन्युअल नोंदीद्वारे पहिले उत्पादन जोडा.'
                    : 'Your store inventory is empty. Add your first product using natural voice commands or manual entry.'
                  : t.noProductsDesc}
              </p>
            </div>
            {products.length === 0 && (
              <Link
                to="/products/voice"
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>{t.addFirstProduct}</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-card">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                {/* Table Header with Interactive Column Sorting */}
                <thead className="bg-[#F8FAFC] text-[#64748B] font-bold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                  <tr>
                    {/* 1. Product Name */}
                    <th scope="col" className="px-5 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleSort('name')}
                        className="flex items-center space-x-1.5 group hover:text-[#102A56]"
                      >
                        <span>{t.colName}</span>
                        {renderSortIcon('name')}
                      </button>
                    </th>

                    {/* 2. Category */}
                    <th scope="col" className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleSort('category')}
                        className="flex items-center space-x-1.5 group hover:text-[#102A56]"
                      >
                        <span>{t.colCategory}</span>
                        {renderSortIcon('category')}
                      </button>
                    </th>

                    {/* 3. Purchase Price */}
                    <th scope="col" className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleSort('purchase_price')}
                        className="flex items-center space-x-1.5 group hover:text-[#102A56]"
                      >
                        <span>{t.colPurchasePrice}</span>
                        {renderSortIcon('purchase_price')}
                      </button>
                    </th>

                    {/* 4. Selling Price */}
                    <th scope="col" className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleSort('selling_price')}
                        className="flex items-center space-x-1.5 group hover:text-[#102A56]"
                      >
                        <span>{t.colSellingPrice}</span>
                        {renderSortIcon('selling_price')}
                      </button>
                    </th>

                    {/* 5. Available Stock */}
                    <th scope="col" className="px-4 py-3.5">
                      <button
                        type="button"
                        onClick={() => handleSort('stock_quantity')}
                        className="flex items-center space-x-1.5 group hover:text-[#102A56]"
                      >
                        <span>{t.colAvailableStock}</span>
                        {renderSortIcon('stock_quantity')}
                      </button>
                    </th>

                    {/* 6. Unit */}
                    <th scope="col" className="px-3 py-3.5">
                      {t.colUnit}
                    </th>

                    {/* 7. Stock Status */}
                    <th scope="col" className="px-4 py-3.5">
                      {t.colStatus}
                    </th>

                    {/* 8. Actions */}
                    <th scope="col" className="px-5 py-3.5 text-right">
                      {t.colActions}
                    </th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-[#F1F5F9] text-[#102A56]">
                  {paginatedProducts.map((p) => {
                    const status = getStockStatus(p.stock_quantity, p.low_stock_threshold, p.is_active);
                    const categoryName = p.category_id ? categoryMap.get(p.category_id) || 'Unknown' : '—';
                    const purchaseNum = Number(p.purchase_price) || 0;
                    const sellingNum = Number(p.selling_price) || 0;
                    const margin = sellingNum - purchaseNum;
                    const marginPct = purchaseNum > 0 ? ((margin / purchaseNum) * 100).toFixed(0) : '0';

                    return (
                      <tr
                        key={p.id}
                        className={`hover:bg-[#F8FAFC] transition group ${
                          !p.is_active ? 'opacity-60 bg-[#F8FAFC]' : ''
                        }`}
                      >
                        {/* 1. Product Name (Unicode Marathi & English) */}
                        <td className="px-5 py-4">
                          <div className="space-y-0.5">
                            <span className="font-bold text-[#102A56] text-sm block group-hover:text-[#1677F3] transition">
                              {p.name}
                            </span>
                            {p.barcode && (
                              <span className="inline-flex items-center gap-1 text-[10px] text-[#64748B] font-mono">
                                <BarcodeIcon className="w-3 h-3 text-[#94A3B8]" />
                                {p.barcode}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 2. Category */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {p.category_id ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#EFF6FF] text-[#1677F3] text-[11px] font-semibold border border-[#BFDBFE]">
                              {categoryName}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8] italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        {/* 3. Purchase Price */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[#64748B]">
                          ₹{Number(p.purchase_price).toFixed(2)}
                        </td>

                        {/* 4. Selling Price */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="font-mono font-black text-sm text-[#102A56]">
                              ₹{Number(p.selling_price).toFixed(2)}
                            </span>
                            {purchaseNum > 0 && (
                              <span
                                className={`text-[10px] font-bold block ${
                                  margin >= 0 ? 'text-emerald-600' : 'text-rose-600'
                                }`}
                              >
                                {margin >= 0 ? `+${marginPct}% margin` : `${marginPct}%`}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 5. Available Stock */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`font-mono font-bold text-sm ${
                              status === 'out_of_stock'
                                ? 'text-rose-600'
                                : status === 'low_stock'
                                ? 'text-amber-600'
                                : 'text-[#102A56]'
                            }`}
                          >
                            {p.stock_quantity}
                          </span>
                        </td>

                        {/* 6. Unit */}
                        <td className="px-3 py-4 whitespace-nowrap text-[#64748B] font-medium">
                          {p.unit}
                        </td>

                        {/* 7. Stock Status Badge */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {status === 'inactive' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]">
                              {t.inactive}
                            </span>
                          )}
                          {status === 'out_of_stock' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              {t.outOfStock}
                            </span>
                          )}
                          {status === 'low_stock' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              {t.lowStock}
                            </span>
                          )}
                          {status === 'in_stock' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {t.inStock}
                            </span>
                          )}
                        </td>

                        {/* 8. Actions (Quick Stock, Edit, Delete) */}
                        <td className="px-5 py-4 whitespace-nowrap text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            {/* View Details */}
                            <button
                              type="button"
                              onClick={() => setViewProduct(p)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#102A56] hover:bg-[#F1F5F9] transition"
                              title="View Details"
                            >
                              <Eye className="w-4 h-4" />
                            </button>

                            {/* Quick Update Stock */}
                            <button
                              type="button"
                              onClick={() => openStockModal(p)}
                              className="inline-flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-semibold bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1677F3] border border-[#BFDBFE] transition"
                              title={t.updateStock}
                            >
                              <span>{t.updateStock}</span>
                            </button>

                            {/* Edit Product */}
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1677F3] hover:bg-[#F1F5F9] transition"
                              title={t.edit}
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Delete Product */}
                            <button
                              type="button"
                              onClick={() => setDeleteProductTarget(p)}
                              className="p-1.5 rounded-lg text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50 transition"
                              title={t.delete}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-6 py-4 border-t border-[#E2E8F0] bg-[#F8FAFC]">
                <div className="text-xs text-[#64748B]">
                  {t.page} <strong className="text-[#102A56]">{currentPage}</strong> {t.of}{' '}
                  <strong className="text-[#102A56]">{totalPages}</strong> ({totalItems} {language === 'mr' ? 'एकूण वस्तू' : 'total items'})
                </div>

                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#102A56] hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    <span>{t.prev}</span>
                  </button>

                  <div className="flex items-center space-x-1">
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum = i + 1;
                      if (totalPages > 5 && currentPage > 3) {
                        pageNum = Math.min(totalPages - 4 + i, currentPage - 2 + i);
                      }
                      return (
                        <button
                          key={pageNum}
                          type="button"
                          onClick={() => setCurrentPage(pageNum)}
                          className={`w-8 h-8 rounded-lg text-xs font-bold transition ${
                            currentPage === pageNum
                              ? 'bg-[#1677F3] text-white shadow-xs'
                              : 'bg-white border border-[#CBD5E1] text-[#102A56] hover:bg-slate-50'
                          }`}
                        >
                          {pageNum}
                        </button>
                      );
                    })}
                  </div>

                  <button
                    type="button"
                    onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                    disabled={currentPage === totalPages}
                    className="inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg border border-[#CBD5E1] bg-white text-xs font-semibold text-[#102A56] hover:bg-slate-50 transition disabled:opacity-40"
                  >
                    <span>{t.next}</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW PRODUCT DETAILS (Strictly Read-Only)                         */}
      {/* ========================================================================= */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102A56]">{viewProduct.name}</h3>
                  <p className="text-xs text-[#64748B]">ID #{viewProduct.id}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setViewProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#64748B] block">{t.colCategory}</span>
                <span className="font-bold text-[#102A56]">
                  {viewProduct.category_id ? categoryMap.get(viewProduct.category_id) || 'Unknown' : '—'}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#64748B] block">{t.colUnit}</span>
                <span className="font-bold text-[#102A56]">{viewProduct.unit}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#64748B] block">{t.colPurchasePrice}</span>
                <span className="font-mono font-bold text-[#102A56]">₹{Number(viewProduct.purchase_price).toFixed(2)}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#64748B] block">{t.colSellingPrice}</span>
                <span className="font-mono font-bold text-[#102A56]">₹{Number(viewProduct.selling_price).toFixed(2)}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#64748B] block">{t.colAvailableStock}</span>
                <span className="font-mono font-bold text-[#102A56]">{viewProduct.stock_quantity}</span>
              </div>
              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0]">
                <span className="text-[#64748B] block">{t.lowStockThreshold}</span>
                <span className="font-mono font-bold text-[#102A56]">{viewProduct.low_stock_threshold}</span>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setViewProduct(null)}
                className="px-5 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#102A56] text-xs font-bold"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: QUICK STOCK ADJUSTMENT MODAL                                      */}
      {/* ========================================================================= */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#102A56]">{t.quickStockTitle}</h3>
                <p className="text-xs text-[#64748B]">{stockProduct.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setStockProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {stockError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {stockError}
              </div>
            )}

            <form onSubmit={handleSaveStock} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#102A56]">
                  {language === 'mr' ? 'नवीन साठा संख्या:' : 'New Available Stock:'}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={newStockVal}
                    onChange={(e) => setNewStockVal(e.target.value)}
                    required
                    className="flex-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] font-mono font-bold focus:bg-white focus:border-[#1677F3]"
                  />
                  <span className="text-xs font-semibold text-[#64748B]">{stockProduct.unit}</span>
                </div>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setStockProduct(null)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#102A56] text-xs font-semibold hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSavingStock}
                  className="px-5 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold disabled:opacity-50"
                >
                  {isSavingStock ? t.saving : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: EDIT PRODUCT DETAILS MODAL                                        */}
      {/* ========================================================================= */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div>
                <h3 className="text-base font-bold text-[#102A56]">{t.editProductTitle}</h3>
                <p className="text-xs text-[#64748B]">ID #{editProduct.id}</p>
              </div>
              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
                {editError}
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              {/* Product Name (Supports Marathi Unicode & English) */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#102A56] flex items-center justify-between">
                  <span>{t.productName} *</span>
                  <span className="text-[10px] text-[#1677F3] font-semibold">मराठी / English</span>
                </label>
                <input
                  type="text"
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  required
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs font-bold text-[#102A56] focus:bg-white focus:border-[#1677F3]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Category */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#102A56]">{t.category}</label>
                  <select
                    value={editForm.category_id || ''}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        category_id: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:border-[#1677F3]"
                  >
                    <option value="">{t.noCategory}</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#102A56]">{t.unit}</label>
                  <select
                    value={editForm.unit || 'kg'}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs font-medium focus:bg-white focus:border-[#1677F3]"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Purchase Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#102A56]">{t.purchasePrice}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.purchase_price || ''}
                    onChange={(e) => setEditForm({ ...editForm, purchase_price: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs font-mono focus:bg-white focus:border-[#1677F3]"
                  />
                </div>

                {/* Selling Price */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#102A56]">{t.sellingPrice}</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editForm.selling_price || ''}
                    onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs font-mono font-bold focus:bg-white focus:border-[#1677F3]"
                  />
                </div>

                {/* Pack Size */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#102A56]">{t.packSize}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    value={editForm.pack_size || '1'}
                    onChange={(e) => setEditForm({ ...editForm, pack_size: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs font-mono focus:bg-white focus:border-[#1677F3]"
                  />
                </div>

                {/* Low Stock Alert Threshold */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-[#102A56]">{t.lowStockThreshold}</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    value={editForm.low_stock_threshold || '0'}
                    onChange={(e) => setEditForm({ ...editForm, low_stock_threshold: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs font-mono focus:bg-white focus:border-[#1677F3]"
                  />
                </div>
              </div>

              {/* Barcode */}
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-[#102A56]">{t.barcode}</label>
                <input
                  type="text"
                  value={editForm.barcode || ''}
                  onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                  placeholder="Barcode / SKU"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2 text-xs font-mono focus:bg-white focus:border-[#1677F3]"
                />
              </div>

              <div className="flex justify-end space-x-2 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#102A56] text-xs font-semibold hover:bg-slate-50"
                >
                  {t.cancel}
                </button>
                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="px-5 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold disabled:opacity-50"
                >
                  {isSavingEdit ? t.saving : t.save}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: DELETE PRODUCT CONFIRMATION MODAL                                 */}
      {/* ========================================================================= */}
      {deleteProductTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-4 shadow-2xl">
            <div className="flex items-center space-x-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center">
                <Trash2 className="w-5 h-5" />
              </div>
              <h3 className="text-base font-bold text-[#102A56]">{t.deleteConfirmTitle}</h3>
            </div>

            <p className="text-xs text-[#64748B] leading-relaxed">
              {t.deleteConfirmDesc}
            </p>

            <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-xs space-y-1">
              <p className="font-bold text-[#102A56]">{deleteProductTarget.name}</p>
              <p className="text-[11px] text-[#64748B]">
                {language === 'mr' ? 'साठा:' : 'Stock:'} {deleteProductTarget.stock_quantity} {deleteProductTarget.unit} • ₹{Number(deleteProductTarget.selling_price).toFixed(2)}
              </p>
            </div>

            <div className="flex justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setDeleteProductTarget(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-xl border border-[#CBD5E1] text-[#102A56] text-xs font-semibold hover:bg-slate-50"
              >
                {t.cancel}
              </button>
              <button
                type="button"
                onClick={handleDeleteProduct}
                disabled={isDeleting}
                className="px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                {isDeleting ? t.deleting : t.delete}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
