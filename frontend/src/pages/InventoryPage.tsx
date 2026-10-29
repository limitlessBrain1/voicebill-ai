import React, { useState, useEffect, useMemo } from 'react';
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
  DollarSign,
  AlertTriangle,
  X,
  Plus,
  ArrowRight,
  SlidersHorizontal,
} from 'lucide-react';
import { useApp } from '../context';
import {
  getProducts,
  getCategories,
  updateProduct,
  updateProductStock,
  updateProductStatus,
  extractErrorMessage,
  ProductResponse,
  CategoryResponse,
  ProductUpdateData,
} from '../services/api';
import { COMMON_UNITS } from '../services/voiceProducts';

export type StockFilterType = 'all' | 'in_stock' | 'low_stock' | 'out_of_stock' | 'inactive';

/**
 * Calculates stock status following VoiceBill.AI business rules:
 * - Inactive: product.is_active === false
 * - Out of stock: stock quantity <= 0
 * - Low stock: stock quantity > 0 && stock quantity <= low_stock_threshold
 * - In stock: stock quantity > low_stock_threshold
 */
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
  const { user, isAuthenticated, isOwner, login, isLoadingAuth } = useApp();

  // Data states
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Filter & Search states
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [stockFilter, setStockFilter] = useState<StockFilterType>('all');

  // Modals state
  const [viewProduct, setViewProduct] = useState<ProductResponse | null>(null);
  const [editProduct, setEditProduct] = useState<ProductResponse | null>(null);
  const [stockProduct, setStockProduct] = useState<ProductResponse | null>(null);

  // Edit form state
  const [editForm, setEditForm] = useState<ProductUpdateData>({});
  const [isSavingEdit, setIsSavingEdit] = useState<boolean>(false);
  const [editError, setEditError] = useState<string | null>(null);

  // Quick Stock form state
  const [newStockVal, setNewStockVal] = useState<string>('');
  const [isSavingStock, setIsSavingStock] = useState<boolean>(false);
  const [stockError, setStockError] = useState<string | null>(null);

  // Status toggle in progress
  const [togglingId, setTogglingId] = useState<number | null>(null);

  // Quick owner login state for testing/demo
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

  // Load products and categories from backend
  const loadData = async (silent = false) => {
    if (!isAuthenticated) return;
    if (!silent) setIsLoading(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [prods, cats] = await Promise.all([getProducts(), getCategories()]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch inventory from store.'));
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadData();
    } else {
      setIsLoading(false);
    }
  }, [isAuthenticated]);

  // Handle Quick Owner Login
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

  // Inventory Metrics from real backend data
  const metrics = useMemo(() => {
    let totalActive = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;
    let inStockCount = 0;
    let totalStockValue = 0;

    products.forEach((p) => {
      if (p.is_active) {
        totalActive += 1;
        const stock = Number(p.stock_quantity) || 0;
        const threshold = Number(p.low_stock_threshold) || 0;
        const cost = Number(p.purchase_price) || 0;

        totalStockValue += stock * cost;

        if (stock <= 0) {
          outOfStockCount += 1;
        } else if (stock <= threshold) {
          lowStockCount += 1;
        } else {
          inStockCount += 1;
        }
      }
    });

    return {
      totalActive,
      lowStockCount,
      outOfStockCount,
      inStockCount,
      totalStockValue,
    };
  }, [products]);

  // Filtered and searched product list
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query Filter
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const matchesName = p.name.toLowerCase().includes(query);
        const matchesBarcode = p.barcode ? p.barcode.toLowerCase().includes(query) : false;
        const catName = p.category_id ? (categoryMap.get(p.category_id) || '').toLowerCase() : '';
        const matchesCategory = catName.includes(query);

        if (!matchesName && !matchesBarcode && !matchesCategory) {
          return false;
        }
      }

      // 2. Category Filter
      if (selectedCategory !== 'all') {
        if (selectedCategory === 'uncategorized') {
          if (p.category_id !== null) return false;
        } else {
          const catId = Number(selectedCategory);
          if (p.category_id !== catId) return false;
        }
      }

      // 3. Stock Status Filter
      if (stockFilter !== 'all') {
        const status = getStockStatus(p.stock_quantity, p.low_stock_threshold, p.is_active);
        if (status !== stockFilter) {
          return false;
        }
      }

      return true;
    });
  }, [products, searchQuery, selectedCategory, stockFilter, categoryMap]);

  // Open Edit Modal
  const openEditModal = (product: ProductResponse) => {
    setEditProduct(product);
    setEditForm({
      name: product.name,
      category_id: product.category_id,
      purchase_price: product.purchase_price,
      selling_price: product.selling_price,
      pack_size: product.pack_size,
      unit: product.unit,
      low_stock_threshold: product.low_stock_threshold,
      barcode: product.barcode,
      is_active: product.is_active,
    });
    setEditError(null);
  };

  // Submit Edit Form
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editProduct) return;

    if (!editForm.name || !editForm.name.trim()) {
      setEditError('Product name cannot be empty.');
      return;
    }
    if (editForm.purchase_price === '' || Number(editForm.purchase_price) < 0) {
      setEditError('Purchase price must be a non-negative number.');
      return;
    }
    if (editForm.selling_price === '' || Number(editForm.selling_price) < 0) {
      setEditError('Selling price must be a non-negative number.');
      return;
    }
    if (editForm.pack_size === '' || Number(editForm.pack_size) <= 0) {
      setEditError('Pack size must be greater than zero.');
      return;
    }
    if (
      editForm.low_stock_threshold !== null &&
      editForm.low_stock_threshold !== '' &&
      Number(editForm.low_stock_threshold) < 0
    ) {
      setEditError('Low stock threshold cannot be negative.');
      return;
    }

    setIsSavingEdit(true);
    setEditError(null);

    try {
      const updated = await updateProduct(editProduct.id, {
        name: editForm.name.trim(),
        category_id: editForm.category_id !== undefined ? editForm.category_id : null,
        purchase_price: editForm.purchase_price,
        selling_price: editForm.selling_price,
        pack_size: editForm.pack_size,
        unit: editForm.unit ? editForm.unit.trim().toLowerCase() : editProduct.unit,
        low_stock_threshold:
          editForm.low_stock_threshold !== null && editForm.low_stock_threshold !== ''
            ? editForm.low_stock_threshold
            : '0.000',
        barcode:
          editForm.barcode && editForm.barcode.trim() !== ''
            ? editForm.barcode.trim()
            : null,
        is_active: editForm.is_active,
      });

      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setEditProduct(null);
      setSuccessMsg(`Product "${updated.name}" updated successfully.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setEditError(extractErrorMessage(err, 'Failed to update product.'));
    } finally {
      setIsSavingEdit(false);
    }
  };

  // Open Quick Stock Modal
  const openStockModal = (product: ProductResponse) => {
    setStockProduct(product);
    setNewStockVal(String(product.stock_quantity));
    setStockError(null);
  };

  // Submit Quick Stock Update
  const handleSaveStock = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockProduct) return;

    const val = Number(newStockVal);
    if (isNaN(val) || val < 0) {
      setStockError('Stock quantity must be a non-negative number.');
      return;
    }

    setIsSavingStock(true);
    setStockError(null);

    try {
      const updated = await updateProductStock(stockProduct.id, newStockVal);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setStockProduct(null);
      setSuccessMsg(`Stock for "${updated.name}" updated to ${updated.stock_quantity} ${updated.unit}.`);
      setTimeout(() => setSuccessMsg(null), 4000);
    } catch (err) {
      setStockError(extractErrorMessage(err, 'Failed to update stock quantity.'));
    } finally {
      setIsSavingStock(false);
    }
  };

  // Toggle Active Status
  const handleToggleStatus = async (product: ProductResponse) => {
    setTogglingId(product.id);
    try {
      const updated = await updateProductStatus(product.id, !product.is_active);
      setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setSuccessMsg(
        `Product "${updated.name}" is now ${updated.is_active ? 'Active' : 'Inactive'}.`
      );
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to toggle product status.'));
    } finally {
      setTogglingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1677F3] text-xs font-semibold uppercase tracking-wider mb-2">
            <Package className="w-3.5 h-3.5" />
            <span>Store Inventory Management</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-[#102A56] tracking-tight flex items-center gap-2">
            <span>Inventory Catalog</span>
          </h1>
          <p className="text-xs sm:text-sm text-[#64748B] mt-0.5">
            Real-time shop inventory, stock alerts, pricing, and catalog controls scoped to your store.
          </p>
        </div>

        <div className="flex items-center space-x-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => loadData(true)}
            disabled={isLoading || isRefreshing || !isAuthenticated}
            className="inline-flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#102A56] text-xs font-semibold transition disabled:opacity-50 shadow-subtle"
            title="Refresh inventory from database"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-[#1677F3]' : 'text-[#64748B]'}`} />
            <span>Refresh</span>
          </button>

          <Link
            to="/products/voice"
            className="inline-flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs shadow-sm transition"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add Products</span>
          </Link>
        </div>
      </div>

      {/* Authentication Notice Banner */}
      {!isLoadingAuth && (!isAuthenticated || !isOwner) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900">Store Owner Authentication Required</h3>
              <p className="text-xs text-amber-800 leading-relaxed">
                Inventory data is strictly isolated per shop. Please log in as the store owner to view and manage products.
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

      {/* Global Success Banner */}
      {successMsg && (
        <div className="flex items-center space-x-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {error && (
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Inventory Error</p>
            <p className="text-xs text-rose-700">{error}</p>
          </div>
        </div>
      )}

      {/* 1. METRICS DASHBOARD CARDS */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Active Products */}
        <button
          type="button"
          onClick={() => setStockFilter('all')}
          className={`text-left p-5 rounded-2xl bg-white border transition shadow-subtle ${
            stockFilter === 'all'
              ? 'border-[#1677F3] ring-2 ring-[#1677F3]/10'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Total Active Products</span>
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center">
              <Package className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-[#102A56]">{metrics.totalActive}</div>
            <p className="text-[11px] text-[#64748B]">Live active SKUs in shop catalog</p>
          </div>
        </button>

        {/* In Stock */}
        <button
          type="button"
          onClick={() => setStockFilter('in_stock')}
          className={`text-left p-5 rounded-2xl bg-white border transition shadow-subtle ${
            stockFilter === 'in_stock'
              ? 'border-emerald-500 ring-2 ring-emerald-500/10'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">In Stock</span>
            <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-emerald-600">{metrics.inStockCount}</div>
            <p className="text-[11px] text-[#64748B]">Above low stock threshold</p>
          </div>
        </button>

        {/* Low Stock Alerts */}
        <button
          type="button"
          onClick={() => setStockFilter('low_stock')}
          className={`text-left p-5 rounded-2xl bg-white border transition shadow-subtle ${
            stockFilter === 'low_stock'
              ? 'border-amber-500 ring-2 ring-amber-500/10'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Low Stock</span>
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-amber-600">{metrics.lowStockCount}</div>
            <p className="text-[11px] text-amber-700 font-medium">At or below reorder alert</p>
          </div>
        </button>

        {/* Out of Stock */}
        <button
          type="button"
          onClick={() => setStockFilter('out_of_stock')}
          className={`text-left p-5 rounded-2xl bg-white border transition shadow-subtle ${
            stockFilter === 'out_of_stock'
              ? 'border-rose-500 ring-2 ring-rose-500/10'
              : 'border-[#E2E8F0] hover:border-[#CBD5E1]'
          }`}
        >
          <div className="flex items-center justify-between pb-3">
            <span className="text-xs font-bold text-[#64748B] uppercase tracking-wider">Out of Stock</span>
            <div className="w-8 h-8 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
              <AlertCircle className="w-4 h-4" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="text-2xl font-black text-rose-600">{metrics.outOfStockCount}</div>
            <p className="text-[11px] text-rose-700 font-medium">Quantity is 0 or depleted</p>
          </div>
        </button>
      </section>

      {/* 2. SEARCH & FILTER CONTROLS */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 space-y-4 shadow-subtle">
        <div className="flex flex-col md:flex-row gap-3">
          {/* Search Box */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#94A3B8] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search product by name, barcode, or category..."
              className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#102A56] placeholder-[#94A3B8] focus:bg-white focus:outline-none focus:border-[#1677F3] focus:ring-2 focus:ring-[#1677F3]/10 transition"
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
          <div className="flex items-center space-x-2">
            <div className="relative">
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] font-medium focus:bg-white focus:outline-none focus:border-[#1677F3] transition appearance-none pr-8 cursor-pointer"
              >
                <option value="all">All Categories ({categories.length})</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
                <option value="uncategorized">Uncategorized</option>
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
                <option value="all">All Stock Statuses</option>
                <option value="in_stock">In Stock</option>
                <option value="low_stock">Low Stock</option>
                <option value="out_of_stock">Out of Stock</option>
                <option value="inactive">Inactive</option>
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
                Reset
              </button>
            )}
          </div>
        </div>

        {/* Results Counter and Active Filter Tags */}
        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B]">
          <div>
            Showing <strong className="text-[#102A56]">{filteredProducts.length}</strong> of{' '}
            <strong className="text-[#102A56]">{products.length}</strong> products
          </div>

          <div className="flex items-center space-x-2">
            {stockFilter !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-[#102A56] text-[11px] font-medium">
                Status: {stockFilter.replace('_', ' ')}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-rose-600"
                  onClick={() => setStockFilter('all')}
                />
              </span>
            )}
            {selectedCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[#F1F5F9] border border-[#E2E8F0] text-[#102A56] text-[11px] font-medium">
                Category: {categoryMap.get(Number(selectedCategory)) || 'Uncategorized'}
                <X
                  className="w-3 h-3 cursor-pointer hover:text-rose-600"
                  onClick={() => setSelectedCategory('all')}
                />
              </span>
            )}
          </div>
        </div>
      </section>

      {/* 3. PRODUCT TABLE / LIST VIEW */}
      <section className="space-y-4">
        {isLoading ? (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white p-16 text-center space-y-3 shadow-subtle">
            <Loader2 className="w-8 h-8 animate-spin text-[#1677F3] mx-auto" />
            <p className="text-sm text-[#64748B]">Loading products from your shop inventory...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-2xl border-2 border-dashed border-[#E2E8F0] bg-white p-16 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#F8FAFC] border border-[#E2E8F0] flex items-center justify-center text-[#94A3B8] mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-[#102A56]">No Products Found</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                {products.length === 0
                  ? 'Your store inventory is empty. Add your first product using natural voice commands or text entry.'
                  : 'No products match your active search or filter criteria. Try resetting filters.'}
              </p>
            </div>
            {products.length === 0 && (
              <Link
                to="/products/voice"
                className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs rounded-xl shadow-sm transition"
              >
                <Plus className="w-4 h-4" />
                <span>Add Products with Voice</span>
              </Link>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-[#E2E8F0] bg-white overflow-hidden shadow-subtle">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                {/* Table Header */}
                <thead className="bg-[#F8FAFC] text-[#64748B] font-semibold border-b border-[#E2E8F0] uppercase tracking-wider text-[11px]">
                  <tr>
                    <th scope="col" className="px-5 py-3.5">Product Name</th>
                    <th scope="col" className="px-4 py-3.5">Category</th>
                    <th scope="col" className="px-3 py-3.5">Pack Size</th>
                    <th scope="col" className="px-3 py-3.5">Unit</th>
                    <th scope="col" className="px-4 py-3.5">Purchase Price</th>
                    <th scope="col" className="px-4 py-3.5">Selling Price</th>
                    <th scope="col" className="px-4 py-3.5">Stock Quantity</th>
                    <th scope="col" className="px-4 py-3.5">Low-Stock Alert</th>
                    <th scope="col" className="px-4 py-3.5">Stock Status</th>
                    <th scope="col" className="px-5 py-3.5 text-right">Actions</th>
                  </tr>
                </thead>

                {/* Table Body */}
                <tbody className="divide-y divide-[#F1F5F9] text-[#102A56]">
                  {filteredProducts.map((p) => {
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
                        {/* Name & Barcode */}
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

                        {/* Category */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {p.category_id ? (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-md bg-[#F1F5F9] text-[#102A56] text-[11px] font-medium border border-[#E2E8F0]">
                              {categoryName}
                            </span>
                          ) : (
                            <span className="text-[#94A3B8] italic text-[11px]">Unassigned</span>
                          )}
                        </td>

                        {/* Pack Size */}
                        <td className="px-3 py-4 whitespace-nowrap font-mono text-[#64748B]">
                          {p.pack_size}
                        </td>

                        {/* Unit */}
                        <td className="px-3 py-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded bg-[#F1F5F9] text-[#102A56] font-medium text-[11px] border border-[#E2E8F0]">
                            {p.unit}
                          </span>
                        </td>

                        {/* Purchase Price */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[#64748B]">
                          ₹{Number(p.purchase_price).toFixed(2)}
                        </td>

                        {/* Selling Price & Margin */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="space-y-0.5">
                            <span className="font-mono font-bold text-[#102A56] block">
                              ₹{Number(p.selling_price).toFixed(2)}
                            </span>
                            {margin > 0 && (
                              <span className="text-[10px] text-emerald-600 font-semibold font-mono">
                                +₹{margin.toFixed(2)} ({marginPct}%)
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Current Stock Quantity */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center space-x-1.5">
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
                            <span className="text-[10px] text-[#64748B]">{p.unit}</span>
                          </div>
                        </td>

                        {/* Low Stock Alert Threshold */}
                        <td className="px-4 py-4 whitespace-nowrap font-mono text-[#64748B]">
                          {p.low_stock_threshold} {p.unit}
                        </td>

                        {/* Status Badge */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          {status === 'inactive' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]">
                              Inactive
                            </span>
                          )}
                          {status === 'out_of_stock' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200">
                              Out of Stock
                            </span>
                          )}
                          {status === 'low_stock' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">
                              Low Stock
                            </span>
                          )}
                          {status === 'in_stock' && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              In Stock
                            </span>
                          )}
                        </td>

                        {/* Action Buttons */}
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
                              title="Update Stock"
                            >
                              <span>Stock</span>
                            </button>

                            {/* Edit Product */}
                            <button
                              type="button"
                              onClick={() => openEditModal(p)}
                              className="p-1.5 rounded-lg text-[#64748B] hover:text-[#1677F3] hover:bg-[#F1F5F9] transition"
                              title="Edit Product"
                            >
                              <Edit3 className="w-4 h-4" />
                            </button>

                            {/* Toggle Active / Deactivate */}
                            <button
                              type="button"
                              onClick={() => handleToggleStatus(p)}
                              disabled={togglingId === p.id}
                              className={`p-1.5 rounded-lg transition ${
                                p.is_active
                                  ? 'text-[#94A3B8] hover:text-rose-600 hover:bg-rose-50'
                                  : 'text-[#94A3B8] hover:text-emerald-600 hover:bg-emerald-50'
                              }`}
                              title={p.is_active ? 'Deactivate Product' : 'Activate Product'}
                            >
                              {togglingId === p.id ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Power className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL 1: VIEW PRODUCT DETAILS (Strictly Read-Only)                         */}
      {/* ========================================================================= */}
      {viewProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-lg rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-6 shadow-2xl">
            <div className="flex items-start justify-between pb-4 border-b border-[#E2E8F0]">
              <div>
                <div className="flex items-center space-x-2">
                  <h3 className="text-xl font-bold text-[#102A56]">{viewProduct.name}</h3>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      viewProduct.is_active
                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                        : 'bg-[#F1F5F9] text-[#94A3B8] border border-[#E2E8F0]'
                    }`}
                  >
                    {viewProduct.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <p className="text-xs text-[#64748B] mt-0.5">
                  Shop ID: <strong className="text-[#102A56] font-mono">{viewProduct.shop_id}</strong> | Product ID:{' '}
                  <strong className="text-[#102A56] font-mono">#{viewProduct.id}</strong>
                </p>
              </div>

              <button
                type="button"
                onClick={() => setViewProduct(null)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#102A56] hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Category</span>
                <p className="text-[#102A56] font-bold text-sm">
                  {viewProduct.category_id ? categoryMap.get(viewProduct.category_id) || 'Assigned' : 'None'}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Pack Configuration</span>
                <p className="text-[#102A56] font-bold text-sm font-mono">
                  {Number(viewProduct.pack_size)} {viewProduct.unit}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Purchase Cost</span>
                <p className="text-[#102A56] font-bold text-sm font-mono">
                  ₹{Number(viewProduct.purchase_price).toFixed(2)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Selling Retail Price</span>
                <p className="text-[#1677F3] font-black text-sm font-mono">
                  ₹{Number(viewProduct.selling_price).toFixed(2)}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Current Stock</span>
                <p className="text-[#102A56] font-black text-sm font-mono">
                  {Number(viewProduct.stock_quantity)} {viewProduct.unit}
                </p>
              </div>

              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Low Stock Alert</span>
                <p className="text-[#64748B] font-semibold text-sm font-mono">
                  {Number(viewProduct.low_stock_threshold)} {viewProduct.unit}
                </p>
              </div>

              <div className="col-span-2 p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-1">
                <span className="text-[#64748B] font-medium">Barcode / SKU</span>
                <p className="text-[#102A56] font-mono font-medium">
                  {viewProduct.barcode || <span className="text-[#94A3B8] italic">No barcode assigned</span>}
                </p>
              </div>

              <div className="col-span-2 p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between text-[11px] text-[#64748B] font-mono">
                <span>Created: {new Date(viewProduct.created_at).toLocaleString()}</span>
                <span>Updated: {new Date(viewProduct.updated_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="flex justify-end pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setViewProduct(null)}
                className="px-4 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#102A56] text-xs font-semibold transition"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: EDIT PRODUCT ATTRIBUTES                                          */}
      {/* ========================================================================= */}
      {editProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200 overflow-y-auto">
          <div className="w-full max-w-xl rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center">
                  <Edit3 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102A56]">Edit Product</h3>
                  <p className="text-xs text-[#64748B]">Update catalog fields for {editProduct.name}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setEditProduct(null)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#102A56] hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{editError}</span>
              </div>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4 text-xs">
              {/* Product Name */}
              <div className="space-y-1">
                <label className="text-[#64748B] font-semibold">Product Name *</label>
                <input
                  type="text"
                  required
                  value={editForm.name || ''}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] font-medium focus:bg-white focus:outline-none focus:border-[#1677F3]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Category */}
                <div className="space-y-1">
                  <label className="text-[#64748B] font-semibold">Category</label>
                  <select
                    value={
                      editForm.category_id !== null && editForm.category_id !== undefined
                        ? editForm.category_id
                        : ''
                    }
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        category_id: e.target.value === '' ? null : Number(e.target.value),
                      })
                    }
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  >
                    <option value="">No Category</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Unit */}
                <div className="space-y-1">
                  <label className="text-[#64748B] font-semibold">Unit *</label>
                  <select
                    value={editForm.unit || ''}
                    onChange={(e) => setEditForm({ ...editForm, unit: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  >
                    {COMMON_UNITS.map((u) => (
                      <option key={u.value} value={u.value}>
                        {u.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Pack Size */}
                <div className="space-y-1">
                  <label className="text-[#64748B] font-semibold">Pack Size *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0.001"
                    required
                    value={editForm.pack_size || ''}
                    onChange={(e) => setEditForm({ ...editForm, pack_size: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] font-mono focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  />
                </div>

                {/* Barcode */}
                <div className="space-y-1">
                  <label className="text-[#64748B] font-semibold">Barcode / SKU</label>
                  <input
                    type="text"
                    value={editForm.barcode || ''}
                    onChange={(e) => setEditForm({ ...editForm, barcode: e.target.value })}
                    placeholder="Optional barcode"
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] font-mono focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  />
                </div>

                {/* Purchase Price */}
                <div className="space-y-1">
                  <label className="text-[#64748B] font-semibold">Purchase Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={
                      editForm.purchase_price !== undefined && editForm.purchase_price !== null
                        ? editForm.purchase_price
                        : ''
                    }
                    onChange={(e) => setEditForm({ ...editForm, purchase_price: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] font-mono focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  />
                </div>

                {/* Selling Price */}
                <div className="space-y-1">
                  <label className="text-[#64748B] font-semibold">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    required
                    value={
                      editForm.selling_price !== undefined && editForm.selling_price !== null
                        ? editForm.selling_price
                        : ''
                    }
                    onChange={(e) => setEditForm({ ...editForm, selling_price: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#1677F3] font-bold font-mono focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  />
                </div>

                {/* Low Stock Threshold */}
                <div className="col-span-2 space-y-1">
                  <label className="text-[#64748B] font-semibold">Low Stock Alert Threshold *</label>
                  <input
                    type="number"
                    step="0.001"
                    min="0"
                    required
                    value={
                      editForm.low_stock_threshold !== undefined && editForm.low_stock_threshold !== null
                        ? editForm.low_stock_threshold
                        : ''
                    }
                    onChange={(e) => setEditForm({ ...editForm, low_stock_threshold: e.target.value })}
                    className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] font-mono focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  />
                </div>

                {/* Active Status Checkbox */}
                <div className="col-span-2 flex items-center space-x-2 pt-1">
                  <input
                    type="checkbox"
                    id="edit_is_active"
                    checked={editForm.is_active ?? true}
                    onChange={(e) => setEditForm({ ...editForm, is_active: e.target.checked })}
                    className="rounded bg-white border-[#CBD5E1] text-[#1677F3] focus:ring-[#1677F3]"
                  />
                  <label htmlFor="edit_is_active" className="text-xs text-[#102A56] font-medium cursor-pointer">
                    Product is active and available for billing
                  </label>
                </div>
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setEditProduct(null)}
                  disabled={isSavingEdit}
                  className="px-4 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#102A56] font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingEdit}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold transition disabled:opacity-50"
                >
                  {isSavingEdit ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Changes</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: QUICK UPDATE STOCK                                               */}
      {/* ========================================================================= */}
      {stockProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-md rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center">
                  <Package className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-[#102A56]">Update Stock Quantity</h3>
                  <p className="text-xs text-[#64748B]">{stockProduct.name}</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setStockProduct(null)}
                className="p-1 rounded-lg text-[#94A3B8] hover:text-[#102A56] hover:bg-[#F1F5F9] transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {stockError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-600" />
                <span>{stockError}</span>
              </div>
            )}

            <form onSubmit={handleSaveStock} className="space-y-4 text-xs">
              <div className="p-3.5 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] flex justify-between items-center">
                <span className="text-[#64748B]">Current On-Hand:</span>
                <span className="font-mono font-bold text-[#102A56] text-sm">
                  {Number(stockProduct.stock_quantity)} {stockProduct.unit}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-[#64748B] font-semibold">New Stock Quantity ({stockProduct.unit}) *</label>
                <input
                  type="number"
                  step="0.001"
                  min="0"
                  required
                  value={newStockVal}
                  onChange={(e) => setNewStockVal(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-4 py-3 text-base text-[#102A56] font-mono font-bold focus:bg-white focus:outline-none focus:border-[#1677F3]"
                  placeholder="0.000"
                  autoFocus
                />
              </div>

              {/* Quick shortcut increments */}
              <div className="flex items-center space-x-2 pt-1">
                <span className="text-[11px] text-[#64748B]">Quick Add:</span>
                {[5, 10, 20, 50].map((inc) => (
                  <button
                    key={inc}
                    type="button"
                    onClick={() => {
                      const current = Number(newStockVal) || 0;
                      setNewStockVal(String(current + inc));
                    }}
                    className="px-2 py-1 rounded bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#102A56] text-[11px] font-mono font-semibold transition"
                  >
                    +{inc}
                  </button>
                ))}
              </div>

              <div className="flex justify-end space-x-3 pt-3 border-t border-[#E2E8F0]">
                <button
                  type="button"
                  onClick={() => setStockProduct(null)}
                  disabled={isSavingStock}
                  className="px-4 py-2 rounded-xl bg-[#F1F5F9] hover:bg-[#E2E8F0] text-[#102A56] font-semibold transition"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={isSavingStock}
                  className="inline-flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold transition disabled:opacity-50"
                >
                  {isSavingStock ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Updating...</span>
                    </>
                  ) : (
                    <span>Update Stock</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default InventoryPage;
