import React, { useState, useEffect } from 'react';
import {
  Mic,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Save,
  RotateCcw,
  Package,
  Layers,
  Tag,
  DollarSign,
  TrendingUp,
  ShieldAlert,
  LogIn,
  Loader2,
  Barcode as BarcodeIcon,
} from 'lucide-react';
import { useApp } from '../context';
import {
  parseVoiceProduct,
  createProductsBatch,
  PendingVoiceProduct,
  COMMON_UNITS,
} from '../services/voiceProducts';
import {
  getCategories,
  CategoryResponse,
  extractErrorMessage,
} from '../services/api';

const EXAMPLE_COMMANDS = [
  'Add sugar, 1 kg, purchase price 40, selling price 45, stock 20 kg.',
  'Add normal salt, 4 kg, purchase price 22, selling price 28, stock 10 kg.',
  'Add turmeric powder, 500 g, purchase price 80, selling price 100, stock 20 kg.',
  'Add cooking oil, 1 litre, purchase price 100, selling price 120, stock 20 litre, category Grocery.',
];

export const VoiceProductPage: React.FC = () => {
  const { user, isAuthenticated, isOwner, login, isLoadingAuth } = useApp();

  // Command input state
  const [command, setCommand] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  // Ref guards to prevent accidental duplicate clicks / concurrent requests
  const isParsingRef = React.useRef<boolean>(false);
  const isSavingRef = React.useRef<boolean>(false);

  // Pending products list state (strictly frontend local state until Save All)
  const [pendingProducts, setPendingProducts] = useState<PendingVoiceProduct[]>([]);

  // Categories list for shop
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [isLoadingCategories, setIsLoadingCategories] = useState<boolean>(false);

  // Batch saving state
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Quick owner login state for testing/demo
  const [loginEmail, setLoginEmail] = useState<string>('rahul@example.com');
  const [loginPassword, setLoginPassword] = useState<string>('password123');
  const [isLoggingIn, setIsLoggingIn] = useState<boolean>(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Fetch shop categories when authenticated
  useEffect(() => {
    if (isAuthenticated) {
      setIsLoadingCategories(true);
      getCategories()
        .then((cats) => {
          setCategories(cats);
        })
        .catch(() => {
          // Non-critical if categories fail to load
        })
        .finally(() => {
          setIsLoadingCategories(false);
        });
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

  // Handle Parse Product (calls POST /api/voice/products/parse)
  const handleParse = async () => {
    if (isParsing || isParsingRef.current) {
      return;
    }

    const trimmed = command.trim();
    if (!trimmed) {
      setParseError('Please enter a voice command transcript first.');
      return;
    }

    isParsingRef.current = true;
    setIsParsing(true);
    setParseError(null);
    setParseSuccessMsg(null);
    setSaveSuccessMsg(null);

    try {
      const parsed = await parseVoiceProduct(trimmed);
      const newPendingItem: PendingVoiceProduct = {
        ...parsed,
        _tempId: `item_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      };

      setPendingProducts((prev) => [...prev, newPendingItem]);
      setCommand('');
      setParseSuccessMsg(`Parsed "${parsed.name}" and added to Pending list below.`);

      // Auto-clear success message after 4 seconds
      setTimeout(() => {
        setParseSuccessMsg(null);
      }, 4000);
    } catch (err) {
      setParseError(extractErrorMessage(err, 'Failed to parse voice command.'));
    } finally {
      isParsingRef.current = false;
      setIsParsing(false);
    }
  };

  // Handle key press in transcript box (Ctrl/Cmd + Enter to parse)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      if (!isParsing && !isParsingRef.current) {
        handleParse();
      }
    }
  };

  // Handle field edits on a pending product
  const handleFieldChange = (
    tempId: string,
    field: keyof PendingVoiceProduct,
    value: string | number | null
  ) => {
    setPendingProducts((prev) =>
      prev.map((item) => {
        if (item._tempId === tempId) {
          return {
            ...item,
            [field]: value,
          };
        }
        return item;
      })
    );
  };

  // Handle Remove product (frontend state only)
  const handleRemoveProduct = (tempId: string) => {
    setPendingProducts((prev) => prev.filter((p) => p._tempId !== tempId));
  };

  // Handle Clear All
  const handleClearAll = () => {
    if (window.confirm('Clear all pending products from the list?')) {
      setPendingProducts([]);
      setSaveError(null);
      setSaveSuccessMsg(null);
    }
  };

  // Handle Save All (calls POST /api/voice/products/create-batch)
  const handleSaveAll = async () => {
    if (isSaving || isSavingRef.current) {
      return;
    }

    if (pendingProducts.length === 0) {
      setSaveError('No pending products to save.');
      return;
    }

    // Client-side sanity check before sending
    for (let i = 0; i < pendingProducts.length; i++) {
      const p = pendingProducts[i];
      if (!p.name || p.name.trim() === '') {
        setSaveError(`Product #${i + 1} has an empty name.`);
        return;
      }
      if (p.purchase_price === '' || isNaN(Number(p.purchase_price)) || Number(p.purchase_price) < 0) {
        setSaveError(`Product "${p.name}" has an invalid or negative purchase price.`);
        return;
      }
      if (p.selling_price === '' || isNaN(Number(p.selling_price)) || Number(p.selling_price) < 0) {
        setSaveError(`Product "${p.name}" has an invalid or negative selling price.`);
        return;
      }
      if (p.pack_size === '' || isNaN(Number(p.pack_size)) || Number(p.pack_size) <= 0) {
        setSaveError(`Product "${p.name}" pack size must be greater than zero.`);
        return;
      }
      if (p.stock_quantity === '' || isNaN(Number(p.stock_quantity)) || Number(p.stock_quantity) < 0) {
        setSaveError(`Product "${p.name}" has negative stock quantity.`);
        return;
      }
      if (
        p.low_stock_threshold !== null &&
        p.low_stock_threshold !== '' &&
        (isNaN(Number(p.low_stock_threshold)) || Number(p.low_stock_threshold) < 0)
      ) {
        setSaveError(`Product "${p.name}" has a negative low stock threshold.`);
        return;
      }
    }

    isSavingRef.current = true;
    setIsSaving(true);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await createProductsBatch(pendingProducts);
      setSaveSuccessMsg(
        `Success! ${res.created_count} product${res.created_count === 1 ? '' : 's'} created and committed to store inventory.`
      );
      // Clear pending list ONLY on success!
      setPendingProducts([]);
      setCommand('');
    } catch (err) {
      // KEEP pending products on error so user doesn't lose their edits
      setSaveError(extractErrorMessage(err, 'Batch creation failed.'));
    } finally {
      isSavingRef.current = false;
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-[#E2E8F0]">
        <div>
          <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1677F3] text-xs font-semibold uppercase tracking-wider mb-2">
            <Sparkles className="w-3.5 h-3.5 text-[#1677F3]" />
            <span>New Product Batch Workflow</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A56] tracking-tight flex items-center gap-2">
            <span>Voice Product Creation</span>
          </h1>
          <p className="text-sm text-[#64748B] mt-1">
            Parse natural spoken transcripts into an editable pending queue. Review, adjust, and click{' '}
            <strong className="text-[#102A56]">Save All</strong> to commit to store inventory in one atomic step.
          </p>
        </div>

        {/* Status Pill */}
        <div className="flex items-center space-x-2 text-xs self-start sm:self-auto bg-white border border-[#E2E8F0] px-3.5 py-2 rounded-xl shadow-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span className="text-[#102A56] font-semibold">Batch Pipeline: Ready</span>
        </div>
      </div>

      {/* Authentication Notice Banner (if not logged in as owner) */}
      {!isLoadingAuth && (!isAuthenticated || !isOwner) && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5 space-y-4">
          <div className="flex items-start space-x-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-semibold text-amber-900">Store Owner Authentication Required</h3>
              <p className="text-xs text-amber-700 leading-relaxed">
                Voice product creation requires an active session with the <code className="bg-amber-100 px-1 py-0.5 rounded text-amber-800 font-mono">owner</code> role to scope products to your shop.
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
              <span>{isLoggingIn ? 'Logging In...' : 'Log in as Owner'}</span>
            </button>
            {loginError && <span className="text-xs text-rose-600 font-medium">{loginError}</span>}
          </form>
        </div>
      )}

      {/* Global Success / Save Banner */}
      {saveSuccessMsg && (
        <div className="flex items-center space-x-3 p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-sm animate-in fade-in duration-300">
          <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
          <span className="font-semibold">{saveSuccessMsg}</span>
        </div>
      )}

      {/* Global Error Banner */}
      {saveError && (
        <div className="flex items-start space-x-3 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-sm">
          <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="font-semibold text-rose-900">Batch Creation Failed</p>
            <p className="text-xs text-rose-700">{saveError}</p>
            <p className="text-xs text-rose-600 italic">
              Your pending products have been preserved. You can correct any invalid fields and try saving again.
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: VOICE / TRANSCRIPT INPUT */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1677F3] flex items-center justify-center font-bold text-sm">
              1
            </div>
            <div>
              <h2 className="text-base font-bold text-[#102A56]">Voice Transcript Input</h2>
              <p className="text-xs text-[#64748B]">
                Type or paste a speech-to-text transcript command. Press <kbd className="bg-slate-100 border border-slate-200 px-1 py-0.5 rounded text-slate-700 font-mono text-[10px]">Ctrl + Enter</kbd> to parse.
              </p>
            </div>
          </div>

          <div className="hidden sm:flex items-center space-x-1.5 text-xs text-[#64748B] bg-slate-50 px-2.5 py-1 rounded-md border border-[#E2E8F0]">
            <Mic className="w-3.5 h-3.5 text-[#1677F3]" />
            <span>STT Simulation Mode</span>
          </div>
        </div>

        {/* Textarea */}
        <div className="relative">
          <textarea
            value={command}
            onChange={(e) => setCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            rows={3}
            placeholder="e.g. Add sugar, 1 kg, purchase price 40, selling price 45, stock 20 kg."
            disabled={isParsing}
            className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-3.5 text-sm text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1677F3]/20 focus:border-[#1677F3] transition resize-none disabled:opacity-60"
          />
        </div>

        {/* Quick Example Suggestions */}
        <div className="space-y-1.5">
          <span className="text-xs font-semibold text-[#64748B]">Quick Test Examples (Click to insert):</span>
          <div className="flex flex-wrap gap-2">
            {EXAMPLE_COMMANDS.map((ex, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setCommand(ex)}
                disabled={isParsing}
                className="text-left text-xs px-3 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] text-[#1677F3] border border-[#E2E8F0] hover:border-[#BFDBFE] transition font-medium"
              >
                {ex}
              </button>
            ))}
          </div>
        </div>

        {/* Parse Action & Status */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-[#E2E8F0]">
          <div className="flex-1">
            {parseError && (
              <p className="text-xs text-rose-600 font-medium flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{parseError}</span>
              </p>
            )}
            {parseSuccessMsg && (
              <p className="text-xs text-emerald-600 font-semibold flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{parseSuccessMsg}</span>
              </p>
            )}
          </div>

          <div className="flex items-center space-x-2">
            {command && (
              <button
                type="button"
                onClick={() => setCommand('')}
                disabled={isParsing}
                className="px-3 py-2 text-xs font-medium text-slate-500 hover:text-slate-700 transition"
              >
                Clear
              </button>
            )}

            <button
              type="button"
              onClick={handleParse}
              disabled={isParsing || !command.trim()}
              className="inline-flex items-center space-x-2 px-5 py-2.5 bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs rounded-xl shadow-md shadow-[#1677F3]/20 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isParsing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Parsing Transcript...</span>
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4" />
                  <span>Parse Product</span>
                </>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* SECTION 2: PENDING PRODUCTS LIST */}
      <section className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-lg bg-[#EFF6FF] border border-[#BFDBFE] text-[#1677F3] flex items-center justify-center font-bold text-sm">
              2
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h2 className="text-lg font-bold text-[#102A56]">Pending Products for Review</h2>
                <span className="px-2.5 py-0.5 text-xs font-bold rounded-full bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE]">
                  {pendingProducts.length} {pendingProducts.length === 1 ? 'item' : 'items'}
                </span>
              </div>
              <p className="text-xs text-[#64748B]">
                Edit any field as needed. Changes remain in your browser until you click &quot;Save All Products&quot;.
              </p>
            </div>
          </div>

          {/* Quick Header Actions */}
          {pendingProducts.length > 0 && (
            <div className="flex items-center space-x-2">
              <button
                type="button"
                onClick={handleClearAll}
                disabled={isSaving}
                className="inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-white border border-[#E2E8F0] hover:bg-slate-50 text-slate-600 hover:text-slate-800 text-xs font-medium transition"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Clear List</span>
              </button>

              <button
                type="button"
                onClick={handleSaveAll}
                disabled={isSaving}
                className="inline-flex items-center space-x-2 px-4 py-1.5 rounded-lg bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold transition shadow-sm disabled:opacity-50"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                <span>Save All ({pendingProducts.length})</span>
              </button>
            </div>
          )}
        </div>

        {/* Empty State */}
        {pendingProducts.length === 0 && (
          <div className="rounded-2xl border-2 border-dashed border-[#CBD5E1] bg-white p-12 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EFF6FF] border border-[#BFDBFE] flex items-center justify-center text-[#1677F3] mx-auto">
              <Package className="w-7 h-7" />
            </div>
            <div className="space-y-1 max-w-sm mx-auto">
              <h3 className="text-base font-bold text-[#102A56]">No Pending Products</h3>
              <p className="text-xs text-[#64748B] leading-relaxed">
                Enter a product command above and click <span className="text-[#1677F3] font-semibold">Parse Product</span>. You can add multiple products in sequence before saving them all at once.
              </p>
            </div>
          </div>
        )}

        {/* Product Cards List */}
        {pendingProducts.length > 0 && (
          <div className="space-y-4">
            {pendingProducts.map((item, index) => {
              const purchaseNum = Number(item.purchase_price) || 0;
              const sellingNum = Number(item.selling_price) || 0;
              const margin = sellingNum - purchaseNum;
              const marginPct = purchaseNum > 0 ? ((margin / purchaseNum) * 100).toFixed(1) : '0';

              return (
                <div
                  key={item._tempId}
                  className="rounded-2xl bg-white border border-[#E2E8F0] p-5 space-y-4 shadow-sm hover:border-[#CBD5E1] transition"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between pb-3 border-b border-[#F1F5F9]">
                    <div className="flex items-center space-x-2.5">
                      <span className="w-6 h-6 rounded-md bg-[#EFF6FF] text-[#1677F3] text-xs font-bold flex items-center justify-center">
                        #{index + 1}
                      </span>
                      <span className="font-bold text-[#102A56] text-base">
                        {item.name || 'Unnamed Product'}
                      </span>
                      {margin > 0 && (
                        <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                          <TrendingUp className="w-3 h-3 text-emerald-600" />
                          <span>+₹{margin.toFixed(2)} ({marginPct}%)</span>
                        </span>
                      )}
                    </div>

                    <button
                      type="button"
                      onClick={() => handleRemoveProduct(item._tempId)}
                      className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-rose-600 hover:text-rose-700 hover:bg-rose-50 text-xs font-medium transition"
                      title="Remove from pending list"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span className="hidden sm:inline">Remove</span>
                    </button>
                  </div>

                  {/* Editable Fields Grid */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-xs">
                    {/* Product Name */}
                    <div className="lg:col-span-2 space-y-1">
                      <label className="text-slate-600 font-semibold flex items-center gap-1">
                        <Tag className="w-3.5 h-3.5 text-slate-400" />
                        <span>Product Name *</span>
                      </label>
                      <input
                        type="text"
                        value={item.name}
                        onChange={(e) => handleFieldChange(item._tempId, 'name', e.target.value)}
                        placeholder="e.g. Sugar, Tata Salt"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-medium"
                      />
                    </div>

                    {/* Pack Size */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold flex items-center gap-1">
                        <Package className="w-3.5 h-3.5 text-slate-400" />
                        <span>Pack Size *</span>
                      </label>
                      <input
                        type="number"
                        step="0.001"
                        min="0.001"
                        value={item.pack_size}
                        onChange={(e) => handleFieldChange(item._tempId, 'pack_size', e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono font-medium"
                      />
                    </div>

                    {/* Unit */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold flex items-center gap-1">
                        <Layers className="w-3.5 h-3.5 text-slate-400" />
                        <span>Unit *</span>
                      </label>
                      <select
                        value={item.unit}
                        onChange={(e) => handleFieldChange(item._tempId, 'unit', e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-medium"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Purchase Price */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-amber-500" />
                        <span>Purchase Price (₹) *</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.purchase_price}
                        onChange={(e) => handleFieldChange(item._tempId, 'purchase_price', e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono font-medium"
                      />
                    </div>

                    {/* Selling Price */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold flex items-center gap-1">
                        <DollarSign className="w-3.5 h-3.5 text-[#1677F3]" />
                        <span>Selling Price (₹) *</span>
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.selling_price}
                        onChange={(e) => handleFieldChange(item._tempId, 'selling_price', e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#1677F3] font-mono font-bold focus:outline-none focus:bg-white focus:border-[#1677F3]"
                      />
                    </div>

                    {/* Stock Quantity */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold">Initial Stock Quantity *</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={item.stock_quantity}
                        onChange={(e) => handleFieldChange(item._tempId, 'stock_quantity', e.target.value)}
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono font-medium"
                      />
                    </div>

                    {/* Low Stock Alert Threshold */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold">Low Stock Alert (Optional)</label>
                      <input
                        type="number"
                        step="0.001"
                        min="0"
                        value={item.low_stock_threshold ?? ''}
                        onChange={(e) =>
                          handleFieldChange(
                            item._tempId,
                            'low_stock_threshold',
                            e.target.value === '' ? null : e.target.value
                          )
                        }
                        placeholder="e.g. 5"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono placeholder-slate-400 font-medium"
                      />
                    </div>

                    {/* Category Selection */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold">Category</label>
                      <div className="flex gap-1.5">
                        <select
                          value={item.category_name || ''}
                          onChange={(e) =>
                            handleFieldChange(
                              item._tempId,
                              'category_name',
                              e.target.value === '' ? null : e.target.value
                            )
                          }
                          className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-medium"
                        >
                          <option value="">No Category</option>
                          {categories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                          {/* If parsed category is not in list, keep it visible */}
                          {item.category_name &&
                            !categories.some((c) => c.name.toLowerCase() === item.category_name?.toLowerCase()) && (
                              <option value={item.category_name}>
                                {item.category_name} (Parsed)
                              </option>
                            )}
                        </select>
                      </div>
                    </div>

                    {/* Barcode */}
                    <div className="space-y-1">
                      <label className="text-slate-600 font-semibold flex items-center gap-1">
                        <BarcodeIcon className="w-3.5 h-3.5 text-slate-400" />
                        <span>Barcode / SKU (Optional)</span>
                      </label>
                      <input
                        type="text"
                        value={item.barcode ?? ''}
                        onChange={(e) =>
                          handleFieldChange(
                            item._tempId,
                            'barcode',
                            e.target.value.trim() === '' ? null : e.target.value
                          )
                        }
                        placeholder="Optional SKU or code"
                        className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-3 py-2 text-[#102A56] focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono placeholder-slate-400 font-medium"
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bottom Save All Bar */}
            <div className="rounded-2xl bg-white border border-[#E2E8F0] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
              <div>
                <p className="text-base font-bold text-[#102A56] flex items-center gap-2">
                  <span>Ready to Create {pendingProducts.length} Product{pendingProducts.length === 1 ? '' : 's'}</span>
                </p>
                <p className="text-xs text-[#64748B] mt-0.5">
                  All items will be atomically verified and written to store inventory in a single transaction.
                </p>
              </div>

              <div className="flex items-center space-x-3">
                <button
                  type="button"
                  onClick={handleClearAll}
                  disabled={isSaving}
                  className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition"
                >
                  Clear All
                </button>

                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving}
                  className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-extrabold text-sm shadow-md shadow-[#1677F3]/25 transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin text-white" />
                      <span>Saving All to Database...</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>Save All Products</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};

export default VoiceProductPage;
