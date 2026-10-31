import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ShoppingCart,
  Search,
  Filter,
  Plus,
  Minus,
  Trash2,
  RotateCcw,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Package,
  Barcode as BarcodeIcon,
  ShieldAlert,
  LogIn,
  Loader2,
  X,
  ArrowRight,
  Info,
  CreditCard,
  Receipt,
} from 'lucide-react';
import { VoiceBillingBar } from '../components/VoiceBillingBar';
import { CheckoutModal } from '../components/CheckoutModal';
import { ReceiptModal } from '../components/ReceiptModal';
import { useApp } from '../context';
import {
  getProducts,
  getCategories,
  getActiveCart,
  getCart,
  addCartItem,
  updateCartItemQuantity,
  removeCartItem,
  clearCart as clearCartApi,
  extractErrorMessage,
  ProductResponse,
  CategoryResponse,
  CartResponse,
  CartItemResponse,
  SaleResponse,
} from '../services/api';

const ACTIVE_CART_STORAGE_KEY = 'voicebill_billing_cart_id';

export const BillingPage: React.FC = () => {
  const { user, isAuthenticated, login, isLoadingAuth } = useApp();

  // Data states
  const [cart, setCart] = useState<CartResponse | null>(null);
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  // Loading & In-flight states
  const [isLoadingProducts, setIsLoadingProducts] = useState<boolean>(true);
  const [isLoadingCart, setIsLoadingCart] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [inFlightAction, setInFlightAction] = useState<string | null>(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  // Per-product custom add quantity in catalog
  const [customQuantities, setCustomQuantities] = useState<{ [productId: number]: string }>({});

  // Error & Notification states
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Clear cart protection modal
  const [showClearModal, setShowClearModal] = useState<boolean>(false);

  // Checkout & Receipt Modal states
  const [showCheckoutModal, setShowCheckoutModal] = useState<boolean>(false);
  const [showReceiptModal, setShowReceiptModal] = useState<boolean>(false);
  const [completedSale, setCompletedSale] = useState<SaleResponse | null>(null);

  // Quick cashier login state for testing/demo
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

  // Product map for quick reference
  const productMap = useMemo(() => {
    const map = new Map<number, ProductResponse>();
    products.forEach((p) => {
      map.set(p.id, p);
    });
    return map;
  }, [products]);

  // Load catalog products and categories (only active products from shop)
  const loadCatalog = useCallback(async (silent = false) => {
    if (!isAuthenticated) return;
    if (!silent) setIsLoadingProducts(true);
    else setIsRefreshing(true);
    setError(null);

    try {
      const [prods, cats] = await Promise.all([
        getProducts({ is_active: true }),
        getCategories(),
      ]);
      setProducts(prods);
      setCategories(cats);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to fetch shop products.'));
    } finally {
      setIsLoadingProducts(false);
      setIsRefreshing(false);
    }
  }, [isAuthenticated]);

  // Load or restore active cart from backend
  const loadCart = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingCart(true);
    setError(null);

    try {
      const savedCartId = localStorage.getItem(ACTIVE_CART_STORAGE_KEY);
      if (savedCartId && !isNaN(Number(savedCartId))) {
        try {
          const existingCart = await getCart(Number(savedCartId));
          if (existingCart && existingCart.status === 'draft') {
            setCart(existingCart);
            setIsLoadingCart(false);
            return;
          }
        } catch {
          // If stored cart ID belongs to other user or was deleted/closed, fall through
          localStorage.removeItem(ACTIVE_CART_STORAGE_KEY);
        }
      }

      // Fetch or create latest active draft cart
      const activeCart = await getActiveCart();
      setCart(activeCart);
      localStorage.setItem(ACTIVE_CART_STORAGE_KEY, String(activeCart.id));
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to load billing cart.'));
    } finally {
      setIsLoadingCart(false);
    }
  }, [isAuthenticated]);

  // Initial load
  useEffect(() => {
    if (isAuthenticated) {
      loadCatalog();
      loadCart();
    } else {
      setIsLoadingProducts(false);
      setIsLoadingCart(false);
    }
  }, [isAuthenticated, loadCatalog, loadCart]);

  // Handle Quick Owner / Cashier Login
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

  // Filtered products list for LEFT section
  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      // 1. Search Query Filter (name or barcode)
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

      return true;
    });
  }, [products, searchQuery, selectedCategory, categoryMap]);

  // Add Item to Cart
  const handleAddToCart = async (product: ProductResponse) => {
    if (!cart) return;

    // Check available stock
    const availableStock = Number(product.stock_quantity) || 0;
    if (availableStock <= 0) {
      setError(`Cannot add "${product.name}": Product is out of stock.`);
      return;
    }

    const qtyStr = customQuantities[product.id] || '1';
    const qty = Number(qtyStr);

    if (isNaN(qty) || qty <= 0) {
      setError('Quantity must be a positive number.');
      return;
    }

    // Check existing item in cart
    const existing = cart.items.find((item) => item.product_id === product.id);
    const existingQty = existing ? Number(existing.quantity) : 0;
    if (existingQty + qty > availableStock) {
      setError(
        `Insufficient stock for "${product.name}". Available: ${availableStock} ${product.unit}, currently requested: ${(
          existingQty + qty
        ).toFixed(3)} ${product.unit}.`
      );
      return;
    }

    setInFlightAction(`add_${product.id}`);
    setError(null);

    try {
      const updatedCart = await addCartItem(cart.id, product.id, qtyStr);
      setCart(updatedCart);
      localStorage.setItem(ACTIVE_CART_STORAGE_KEY, String(updatedCart.id));
      setSuccessMsg(`Added ${qty} ${product.unit} of "${product.name}" to cart.`);
      // Reset custom quantity to default
      setCustomQuantities((prev) => ({ ...prev, [product.id]: '1' }));
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      setError(extractErrorMessage(err, `Failed to add "${product.name}" to cart.`));
    } finally {
      setInFlightAction(null);
    }
  };

  // Update Cart Item Quantity
  const handleUpdateQuantity = async (item: CartItemResponse, newQuantity: number) => {
    if (!cart) return;

    if (newQuantity <= 0) {
      // If decreased to 0 or less, confirm removal
      handleRemoveItem(item);
      return;
    }

    // Validate available stock if known
    const prod = productMap.get(item.product_id);
    const maxStock = prod ? Number(prod.stock_quantity) : Number(item.stock_quantity ?? 999999);
    if (newQuantity > maxStock) {
      setError(
        `Insufficient stock for "${item.product_name}". Available: ${maxStock} ${item.unit}.`
      );
      return;
    }

    setInFlightAction(`update_${item.id}`);
    setError(null);

    try {
      const updatedCart = await updateCartItemQuantity(cart.id, item.id, newQuantity);
      setCart(updatedCart);
    } catch (err) {
      setError(extractErrorMessage(err, `Failed to update quantity for "${item.product_name}".`));
    } finally {
      setInFlightAction(null);
    }
  };

  // Remove Item from Cart
  const handleRemoveItem = async (item: CartItemResponse) => {
    if (!cart) return;

    setInFlightAction(`remove_${item.id}`);
    setError(null);

    try {
      const updatedCart = await removeCartItem(cart.id, item.id);
      setCart(updatedCart);
      setSuccessMsg(`Removed "${item.product_name}" from cart.`);
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err, `Failed to remove "${item.product_name}".`));
    } finally {
      setInFlightAction(null);
    }
  };

  // Clear Entire Cart
  const handleClearCart = async () => {
    if (!cart) return;

    setInFlightAction('clear_cart');
    setError(null);
    setShowClearModal(false);

    try {
      const updatedCart = await clearCartApi(cart.id);
      setCart(updatedCart);
      setSuccessMsg('Billing cart cleared successfully.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to clear cart.'));
    } finally {
      setInFlightAction(null);
    }
  };

  // Handle Checkout Success
  const handleCheckoutSuccess = async (sale: SaleResponse) => {
    setCompletedSale(sale);
    setShowCheckoutModal(false);
    setShowReceiptModal(true);

    // Refresh products catalog in background to update stock levels
    loadCatalog(true);

    // Clear saved cart ID from local storage as cart is now completed
    localStorage.removeItem(ACTIVE_CART_STORAGE_KEY);
  };

  // Handle Start New Bill
  const handleStartNewBill = async () => {
    setShowReceiptModal(false);
    setCompletedSale(null);

    // Fetch or create a fresh draft cart for next customer
    try {
      setIsLoadingCart(true);
      const newCart = await getActiveCart();
      setCart(newCart);
      localStorage.setItem(ACTIVE_CART_STORAGE_KEY, String(newCart.id));
      setSuccessMsg('Started new customer bill.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to start new bill.'));
    } finally {
      setIsLoadingCart(false);
    }
  };

  // Helper to determine step increment based on unit
  const getStepForUnit = (unit: string): number => {
    const u = unit.toLowerCase();
    if (['kg', 'litre', 'liter', 'g', 'ml'].includes(u)) {
      return 0.5;
    }
    return 1;
  };

  return (
    <div className="flex flex-col gap-3 max-w-7xl mx-auto min-h-0">
      {/* Authentication Notice Banner */}
      {!isLoadingAuth && !isAuthenticated && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900">Authentication Required for Billing</h3>
              <p className="text-xs text-amber-700 leading-relaxed">
                Cart data and stock validation are strictly isolated per store. Please log in to start billing customers.
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
              className="bg-white border border-amber-300 text-xs text-[#102A56] rounded-lg px-3 py-2 w-48 focus:outline-none focus:border-[#1677F3]"
            />
            <input
              type="password"
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              placeholder="Password"
              required
              className="bg-white border border-amber-300 text-xs text-[#102A56] rounded-lg px-3 py-2 w-36 focus:outline-none focus:border-[#1677F3]"
            />
            <button
              type="submit"
              disabled={isLoggingIn}
              className="inline-flex items-center space-x-1.5 px-4 py-2 bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-semibold rounded-lg transition disabled:opacity-50"
            >
              {isLoggingIn ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <LogIn className="w-3.5 h-3.5" />}
              <span>{isLoggingIn ? 'Logging In...' : 'Log In'}</span>
            </button>
            {loginError && <span className="text-xs text-rose-600 font-medium">{loginError}</span>}
          </form>
        </div>
      )}

      {/* Global Notifications */}
      {successMsg && (
        <div className="flex items-center space-x-3 p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold text-xs">{successMsg}</span>
        </div>
      )}

      {error && (
        <div className="flex items-start justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm animate-in fade-in duration-300">
          <div className="flex items-start space-x-3">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-rose-700">{error}</p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── AI Voice Billing — Hero Section ──────────────────────────── */}
      {isAuthenticated && (
        <div className="bg-gradient-to-br from-[#EFF6FF] to-[#F5F8FC] border border-[#BFDBFE] rounded-2xl px-5 pt-4 pb-3 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <div>
              <h1 className="text-lg font-extrabold text-[#102A56] tracking-tight flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-[#1677F3] flex items-center justify-center">
                  <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4M12 3a4 4 0 014 4v4a4 4 0 01-8 0V7a4 4 0 014-4z" />
                  </svg>
                </span>
                AI Voice Billing
              </h1>
              <p className="text-xs text-[#64748B] mt-0.5">
                Tap the microphone and speak — e.g. <span className="font-semibold text-[#1677F3]">"Add sugar 2 kg"</span> or <span className="font-semibold text-[#1677F3]">"साखर 2 किलो"</span>
              </p>
            </div>
            <button
              type="button"
              onClick={() => { loadCatalog(true); loadCart(); }}
              disabled={isLoadingProducts || isLoadingCart || isRefreshing}
              title="Refresh catalog and cart"
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white border border-[#BFDBFE] hover:bg-[#EFF6FF] text-[#1677F3] text-xs font-semibold transition shadow-sm disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>
          <VoiceBillingBar
            cart={cart}
            onCartUpdated={(updatedCart) => {
              setCart(updatedCart);
              localStorage.setItem(ACTIVE_CART_STORAGE_KEY, String(updatedCart.id));
            }}
            onSetSearchQuery={(query) => setSearchQuery(query)}
            onError={(msg) => setError(msg)}
            onSuccess={(msg) => {
              setSuccessMsg(msg);
              setTimeout(() => setSuccessMsg(null), 4000);
            }}
            disabled={!isAuthenticated || isLoadingCart}
          />
        </div>
      )}

      {/* MAIN TWO-SECTION BILLING WORKSPACE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* ── LEFT: Product catalog ──────────────────────────────────── */}
        <section className="lg:col-span-7 space-y-3">
          {/* Search + filter bar */}
          <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-extrabold uppercase tracking-wider text-[#102A56] flex items-center gap-2">
                <Search className="w-4 h-4 text-[#1677F3]" />
                <span>Search Products</span>
              </h2>
              <span className="text-[11px] text-[#64748B] font-semibold">
                {filteredProducts.length} items available
              </span>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Scan barcode or type product name..."
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-10 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] transition"
                  autoFocus
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <div className="relative min-w-[160px]">
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] font-medium focus:outline-none focus:bg-white focus:border-[#1677F3] transition appearance-none pr-8 cursor-pointer"
                >
                  <option value="all">All Categories ({categories.length})</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                  <option value="uncategorized">Uncategorized</option>
                </select>
                <Filter className="w-3 h-3 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          </div>

          {/* Product grid — scrolls inside, no overflow to the page */}
          {isLoadingProducts ? (
            <div className="rounded-2xl border border-[#E2E8F0] bg-white p-12 text-center space-y-3 shadow-sm">
              <Loader2 className="w-7 h-7 animate-spin text-[#1677F3] mx-auto" />
              <p className="text-xs text-[#64748B]">Loading catalog from store database...</p>
            </div>
          ) : filteredProducts.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-white p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#1677F3] mx-auto">
                <Package className="w-6 h-6" />
              </div>
              <h3 className="text-sm font-bold text-[#102A56]">No Matching Products</h3>
              <p className="text-xs text-[#64748B] max-w-xs mx-auto">
                {products.length === 0
                  ? 'Your store catalog is currently empty. Add products via voice or inventory management.'
                  : 'No active products match your search query or category filter.'}
              </p>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setSelectedCategory('all'); }}
                  className="text-xs text-[#1677F3] font-bold hover:underline pt-1 inline-block"
                >
                  Clear search filters
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[calc(100vh-26rem)] overflow-y-auto pr-1 pb-1">
              {filteredProducts.map((p) => {
                const stockNum = Number(p.stock_quantity) || 0;
                const thresholdNum = Number(p.low_stock_threshold) || 0;
                const isOutOfStock = stockNum <= 0;
                const isLowStock = !isOutOfStock && stockNum <= thresholdNum;
                const isAdding = inFlightAction === `add_${p.id}`;
                const cartItem = cart?.items.find((item) => item.product_id === p.id);
                const inCartQty = cartItem ? Number(cartItem.quantity) : 0;
                const customQtyVal = customQuantities[p.id] !== undefined ? customQuantities[p.id] : '1';

                return (
                  <div
                    key={p.id}
                    className={`rounded-2xl border p-4 transition flex flex-col justify-between shadow-subtle group ${
                      isOutOfStock
                        ? 'border-[#E2E8F0] bg-slate-50 opacity-60'
                        : 'border-[#E2E8F0] bg-white hover:border-[#BFDBFE] hover:shadow-card'
                    }`}
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h3 className="font-bold text-[#102A56] text-sm group-hover:text-[#1677F3] transition line-clamp-1">
                            {p.name}
                          </h3>
                          <div className="flex items-center space-x-2 text-[11px] text-[#64748B]">
                            <span>{p.category_id ? categoryMap.get(p.category_id) || 'General' : 'General'}</span>
                            {p.barcode && (
                              <>
                                <span className="text-slate-300">•</span>
                                <span className="font-mono text-slate-500 flex items-center gap-0.5">
                                  <BarcodeIcon className="w-3 h-3" />
                                  {p.barcode}
                                </span>
                              </>
                            )}
                          </div>
                        </div>

                        {isOutOfStock ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-rose-50 text-rose-700 border border-rose-200 whitespace-nowrap">Out of Stock</span>
                        ) : isLowStock ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200 whitespace-nowrap">Low Stock</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">In Stock</span>
                        )}
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2 border-t border-[#F1F5F9] text-xs">
                        <div>
                          <span className="text-[11px] text-[#64748B] block">Selling Price</span>
                          <span className="font-mono font-extrabold text-base text-[#1677F3]">
                            ₹{Number(p.selling_price).toFixed(2)}
                          </span>
                          <span className="text-[10px] text-[#64748B] ml-1">/ {p.unit}</span>
                        </div>
                        <div className="text-right">
                          <span className="text-[11px] text-[#64748B] block">Available Stock</span>
                          <span className={`font-mono font-bold text-sm ${isOutOfStock ? 'text-rose-600' : isLowStock ? 'text-amber-600' : 'text-[#102A56]'}`}>
                            {p.stock_quantity}
                          </span>
                          <span className="text-[10px] text-[#64748B] ml-1">{p.unit}</span>
                          {inCartQty > 0 && (
                            <span className="block text-[10px] text-[#1677F3] font-semibold">({inCartQty} in cart)</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 pt-3 mt-3 border-t border-[#F1F5F9]">
                      <div className="flex items-center space-x-1">
                        <label htmlFor={`qty-${p.id}`} className="sr-only">Quantity</label>
                        <input
                          id={`qty-${p.id}`}
                          type="number"
                          step={getStepForUnit(p.unit)}
                          min="0.001"
                          max={stockNum}
                          disabled={isOutOfStock || isAdding}
                          value={customQtyVal}
                          onChange={(e) =>
                            setCustomQuantities((prev) => ({ ...prev, [p.id]: e.target.value }))
                          }
                          className="w-16 bg-[#F8FAFC] border border-[#CBD5E1] text-center text-xs font-mono font-bold text-[#102A56] rounded-lg py-1.5 focus:outline-none focus:bg-white focus:border-[#1677F3] disabled:opacity-40"
                        />
                        <span className="text-[10px] text-[#64748B] font-mono">{p.unit}</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleAddToCart(p)}
                        disabled={isOutOfStock || isAdding || !isAuthenticated}
                        className="flex-1 inline-flex items-center justify-center space-x-1.5 py-1.5 px-3 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs shadow-sm transition disabled:opacity-40 disabled:cursor-not-allowed"
                      >
                        {isAdding ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <>
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* ── RIGHT: Cart panel — sticky, scrolls internally ─────────── */}
        <section className="lg:col-span-5 bg-white border border-[#E2E8F0] rounded-2xl p-5 shadow-card sticky top-0 flex flex-col max-h-[calc(100vh-8rem)] overflow-hidden">
          <div className="flex-1 overflow-y-auto space-y-4 pr-0.5">
            {/* Cart Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#E2E8F0]">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-xl bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE] flex items-center justify-center">
                  <ShoppingCart className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-[#102A56]">Current Cart</h2>
                  <p className="text-[11px] text-[#64748B]">
                    {cart?.items.length || 0} unique SKU{cart?.items.length === 1 ? '' : 's'} in order
                  </p>
                </div>
              </div>

              {cart && cart.items.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowClearModal(true)}
                  disabled={inFlightAction === 'clear_cart'}
                  className="inline-flex items-center space-x-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 border border-rose-200 transition disabled:opacity-50"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Clear</span>
                </button>
              )}
            </div>

            {/* Cart Items */}
            {isLoadingCart ? (
              <div className="py-12 text-center space-y-3">
                <Loader2 className="w-7 h-7 animate-spin text-[#1677F3] mx-auto" />
                <p className="text-xs text-[#64748B]">Loading your store cart...</p>
              </div>
            ) : !cart || cart.items.length === 0 ? (
              <div className="py-10 text-center space-y-3 border-2 border-dashed border-[#CBD5E1] rounded-2xl bg-[#F8FAFC]">
                <div className="w-12 h-12 rounded-2xl bg-white border border-[#E2E8F0] flex items-center justify-center text-[#1677F3] mx-auto">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <div className="space-y-1 max-w-xs mx-auto">
                  <h3 className="text-sm font-bold text-[#102A56]">Billing Cart is Empty</h3>
                  <p className="text-xs text-[#64748B] leading-relaxed">
                    Search kirana items from the left catalog and click &quot;Add&quot; to start ringing up products.
                  </p>
                </div>
              </div>
            ) : (
              <div className="space-y-2.5 divide-y divide-[#F1F5F9]">
                {cart.items.map((item) => {
                  const isItemBusy = inFlightAction === `update_${item.id}` || inFlightAction === `remove_${item.id}`;
                  const currentQty = Number(item.quantity);
                  const step = getStepForUnit(item.unit);

                  return (
                    <div key={item.id} className="pt-2.5 first:pt-0 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-0.5">
                          <h4 className="font-bold text-[#102A56] text-xs leading-snug">{item.product_name}</h4>
                          <div className="flex items-center space-x-1.5 text-[11px] text-[#64748B] font-mono">
                            <span>₹{Number(item.unit_price).toFixed(2)}</span>
                            <span>/ {item.unit}</span>
                          </div>
                        </div>
                        <span className="font-mono font-extrabold text-sm text-[#102A56]">
                          ₹{Number(item.line_total).toFixed(2)}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs pt-1">
                        <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-0.5">
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item, Number((currentQty - step).toFixed(3)))}
                            disabled={isItemBusy}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-[#102A56] transition disabled:opacity-40 shadow-xs"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="font-mono font-bold text-xs text-[#102A56] px-2 min-w-[48px] text-center">
                            {item.quantity}
                          </span>
                          <button
                            type="button"
                            onClick={() => handleUpdateQuantity(item, Number((currentQty + step).toFixed(3)))}
                            disabled={isItemBusy}
                            className="w-7 h-7 flex items-center justify-center rounded-lg bg-white hover:bg-slate-100 text-[#102A56] transition disabled:opacity-40 shadow-xs"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-[10px] text-[#64748B] font-mono pr-2">{item.unit}</span>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveItem(item)}
                          disabled={isItemBusy}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition disabled:opacity-40"
                        >
                          {inFlightAction === `remove_${item.id}` ? (
                            <Loader2 className="w-4 h-4 animate-spin text-rose-600" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Cart Summary — pinned to bottom of card */}
          {cart && (
            <div className="pt-4 mt-2 border-t border-[#E2E8F0] space-y-3 flex-shrink-0">
              <div className="space-y-1.5 text-xs text-[#64748B]">
                <div className="flex items-center justify-between">
                  <span>Subtotal</span>
                  <span className="font-mono font-semibold text-[#102A56]">₹{Number(cart.subtotal).toFixed(2)}</span>
                </div>
                {Number(cart.discount_amount) > 0 && (
                  <div className="flex items-center justify-between text-emerald-600 font-semibold">
                    <span>Discount</span>
                    <span className="font-mono">-₹{Number(cart.discount_amount).toFixed(2)}</span>
                  </div>
                )}
                {Number(cart.tax_amount) > 0 && (
                  <div className="flex items-center justify-between">
                    <span>Tax</span>
                    <span className="font-mono font-semibold">+₹{Number(cart.tax_amount).toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between pt-2 border-t border-[#E2E8F0] text-sm font-bold text-[#102A56]">
                  <span>Grand Total</span>
                  <span className="font-mono text-2xl text-[#102A56] font-black">
                    ₹{Number(cart.total).toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowCheckoutModal(true)}
                disabled={!cart || cart.items.length === 0 || inFlightAction !== null}
                className="w-full py-3 px-4 bg-[#1677F3] hover:bg-[#0755D9] disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white font-extrabold text-sm rounded-xl transition shadow-md shadow-[#1677F3]/25 flex items-center justify-center space-x-2"
              >
                <CreditCard className="w-4 h-4" />
                <span>Checkout (₹{Number(cart.total).toFixed(2)})</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <div className="p-3 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] text-[11px] text-[#64748B] flex items-start gap-2">
                <Info className="w-4 h-4 text-[#1677F3] flex-shrink-0 mt-0.5" />
                <span>Prices and line totals are authoritative and snapshotted from the database. Stock will be finalized upon checkout.</span>
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Clear cart confirmation modal */}
      {showClearModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#E2E8F0] p-6 space-y-4 shadow-2xl">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center flex-shrink-0">
                <Trash2 className="w-5 h-5" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-[#102A56]">Clear Billing Cart?</h3>
                <p className="text-xs text-[#64748B] leading-relaxed">
                  This will remove all {cart?.items.length || 0} item(s) from the current order. This action cannot be undone.
                </p>
              </div>
            </div>
            <div className="flex justify-end space-x-3 pt-2 border-t border-[#E2E8F0]">
              <button
                type="button"
                onClick={() => setShowClearModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-[#102A56] text-xs font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleClearCart}
                disabled={inFlightAction === 'clear_cart'}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition disabled:opacity-50"
              >
                {inFlightAction === 'clear_cart' ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Trash2 className="w-3.5 h-3.5" />
                )}
                <span>Clear Cart</span>
              </button>
            </div>
          </div>
        </div>
      )}

      <CheckoutModal
        isOpen={showCheckoutModal}
        cart={cart}
        onClose={() => setShowCheckoutModal(false)}
        onCheckoutSuccess={handleCheckoutSuccess}
      />

      <ReceiptModal
        isOpen={showReceiptModal}
        sale={completedSale}
        onClose={() => setShowReceiptModal(false)}
        onNewBill={handleStartNewBill}
      />
    </div>
  );
};

export default BillingPage;

