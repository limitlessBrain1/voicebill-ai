import React, { useState, useEffect, useRef } from 'react';
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
  Edit2,
  Check,
  X,
  FileText,
  FolderPlus,
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
  createCategory,
  createProduct,
  CategoryResponse,
  extractErrorMessage,
} from '../services/api';

const EXAMPLE_COMMANDS_EN = [
  'Add sugar, 1 kg, purchase price 40, selling price 45, stock 20 kg.',
  'Add normal salt, 4 kg, purchase price 22, selling price 28, stock 10 kg.',
  'Add turmeric powder, 500 g, purchase price 80, selling price 100, stock 20 kg.',
  'Add cooking oil, 1 litre, purchase price 100, selling price 120, stock 20 litre, category Grocery.',
];

const EXAMPLE_COMMANDS_MR = [
  'Add साखर, 1 kg, purchase price 40, selling price 45, stock 20 kg.',
  'Add तांदूळ, 5 kg, purchase price 200, selling price 240, stock 50 kg.',
  'Add गहू, 10 kg, purchase price 320, selling price 380, stock 30 kg.',
  'Add खाद्यतेल, 1 litre, purchase price 130, selling price 150, stock 15 litre.',
];

export const VoiceProductPage: React.FC = () => {
  const { user, isAuthenticated, isOwner, login, isLoadingAuth, language, t } = useApp();

  // Mode: 'voice' | 'manual'
  const [activeTab, setActiveTab] = useState<'voice' | 'manual'>('voice');

  // Command input state (Voice mode)
  const [command, setCommand] = useState<string>('');
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [parseSuccessMsg, setParseSuccessMsg] = useState<string | null>(null);

  // Manual Form State
  const [manualName, setManualName] = useState<string>('');
  const [manualCategoryId, setManualCategoryId] = useState<string>('');
  const [manualPurchasePrice, setManualPurchasePrice] = useState<string>('');
  const [manualSellingPrice, setManualSellingPrice] = useState<string>('');
  const [manualStockQty, setManualStockQty] = useState<string>('10');
  const [manualPackSize, setManualPackSize] = useState<string>('1');
  const [manualUnit, setManualUnit] = useState<string>('kg');
  const [manualLowStock, setManualLowStock] = useState<string>('5');
  const [manualBarcode, setManualBarcode] = useState<string>('');
  const [manualError, setManualError] = useState<string | null>(null);
  const [manualSuccess, setManualSuccess] = useState<string | null>(null);
  const [isDirectSaving, setIsDirectSaving] = useState<boolean>(false);

  // New Category Modal / Inline Input
  const [showNewCatInput, setShowNewCatInput] = useState<boolean>(false);
  const [newCatName, setNewCatName] = useState<string>('');
  const [isCreatingCat, setIsCreatingCat] = useState<boolean>(false);
  const [catError, setCatError] = useState<string | null>(null);

  // Pending products list state (staged before batch saving)
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

  // Load Categories
  const loadCategories = async () => {
    if (!isAuthenticated) return;
    setIsLoadingCategories(true);
    try {
      const cats = await getCategories();
      setCategories(cats);
    } catch {
      // Non-critical
    } finally {
      setIsLoadingCategories(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      loadCategories();
    }
  }, [isAuthenticated]);

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
  // VOICE PARSING HANDLER
  // -------------------------------------------------------------
  const handleParseCommand = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!command.trim() || isParsing) return;

    setIsParsing(true);
    setParseError(null);
    setParseSuccessMsg(null);

    try {
      const parsed = await parseVoiceProduct(command.trim());
      const newPendingItem: PendingVoiceProduct = {
        ...parsed,
        _tempId: `pending_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      };

      setPendingProducts((prev) => [newPendingItem, ...prev]);
      setParseSuccessMsg(
        language === 'mr'
          ? `उत्पादन "${parsed.name}" यशस्वीरित्या तपासले आणि यादीत जोडले.`
          : `Successfully parsed and staged "${parsed.name}".`
      );
      setCommand('');
    } catch (err) {
      setParseError(extractErrorMessage(err, 'Failed to parse voice command. Check format.'));
    } finally {
      setIsParsing(false);
    }
  };

  // -------------------------------------------------------------
  // MANUAL PRODUCT VALIDATION
  // -------------------------------------------------------------
  const validateManualForm = (): boolean => {
    setManualError(null);

    const name = manualName.trim();
    if (!name) {
      setManualError(t.nameRequired);
      return false;
    }

    const pPrice = parseFloat(manualPurchasePrice);
    if (isNaN(pPrice) || pPrice < 0) {
      setManualError(
        language === 'mr'
          ? 'कृपया वैध खरेदी किंमत प्रविष्ट करा (शून्य किंवा त्याहून अधिक).'
          : 'Please enter a valid non-negative purchase price.'
      );
      return false;
    }

    const sPrice = parseFloat(manualSellingPrice);
    if (isNaN(sPrice) || sPrice < 0) {
      setManualError(
        language === 'mr'
          ? 'कृपया वैध विक्री किंमत प्रविष्ट करा (शून्य किंवा त्याहून अधिक).'
          : 'Please enter a valid non-negative selling price.'
      );
      return false;
    }

    const stock = parseFloat(manualStockQty);
    if (isNaN(stock) || stock < 0) {
      setManualError(
        language === 'mr'
          ? 'कृपया वैध साठा संख्या प्रविष्ट करा (शून्य किंवा त्याहून अधिक).'
          : 'Please enter a valid non-negative stock quantity.'
      );
      return false;
    }

    const pack = parseFloat(manualPackSize);
    if (isNaN(pack) || pack <= 0) {
      setManualError(
        language === 'mr'
          ? 'पॅक साईझ शून्यापेक्षा जास्त असणे आवश्यक आहे (उदा. 1).'
          : 'Pack size must be greater than zero (e.g. 1).'
      );
      return false;
    }

    return true;
  };

  // -------------------------------------------------------------
  // ADD MANUAL PRODUCT TO REVIEW LIST (STAGING)
  // -------------------------------------------------------------
  const handleAddToStaging = () => {
    if (!validateManualForm()) return;

    let catName: string | null = null;
    if (manualCategoryId) {
      const found = categories.find((c) => c.id === Number(manualCategoryId));
      if (found) catName = found.name;
    }

    const stagedItem: PendingVoiceProduct = {
      _tempId: `manual_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      name: manualName.trim(), // Exact Unicode text preserved
      pack_size: parseFloat(manualPackSize) || 1,
      unit: manualUnit.trim().toLowerCase(),
      purchase_price: parseFloat(manualPurchasePrice) || 0,
      selling_price: parseFloat(manualSellingPrice) || 0,
      stock_quantity: parseFloat(manualStockQty) || 0,
      low_stock_threshold: manualLowStock ? parseFloat(manualLowStock) : 0,
      category_name: catName,
      barcode: manualBarcode.trim() || null,
    };

    setPendingProducts((prev) => [stagedItem, ...prev]);
    setManualSuccess(t.productAddedSuccess);

    // Reset manual form inputs
    handleClearManualForm();
  };

  // -------------------------------------------------------------
  // SAVE DIRECTLY TO DATABASE VIA POST /api/products
  // -------------------------------------------------------------
  const handleSaveDirectly = async () => {
    if (!validateManualForm()) return;

    setIsDirectSaving(true);
    setManualError(null);
    setManualSuccess(null);

    try {
      await createProduct({
        name: manualName.trim(), // Exact Unicode string (English or Marathi)
        category_id: manualCategoryId ? Number(manualCategoryId) : null,
        purchase_price: parseFloat(manualPurchasePrice) || 0,
        selling_price: parseFloat(manualSellingPrice) || 0,
        pack_size: parseFloat(manualPackSize) || 1,
        unit: manualUnit.trim().toLowerCase(),
        stock_quantity: parseFloat(manualStockQty) || 0,
        low_stock_threshold: manualLowStock ? parseFloat(manualLowStock) : 0,
        barcode: manualBarcode.trim() || null,
      });

      setManualSuccess(
        language === 'mr'
          ? `उत्पादन "${manualName.trim()}" थेट इन्व्हेंटरी डेटाबेसमध्ये जतन केले गेले!`
          : `Product "${manualName.trim()}" saved directly to your inventory database!`
      );

      handleClearManualForm();
    } catch (err) {
      setManualError(extractErrorMessage(err, 'Failed to save product to database.'));
    } finally {
      setIsDirectSaving(false);
    }
  };

  // Clear manual inputs
  const handleClearManualForm = () => {
    setManualName('');
    setManualCategoryId('');
    setManualPurchasePrice('');
    setManualSellingPrice('');
    setManualStockQty('10');
    setManualPackSize('1');
    setManualUnit('kg');
    setManualLowStock('5');
    setManualBarcode('');
    setManualError(null);
  };

  // -------------------------------------------------------------
  // CREATE NEW CATEGORY INLINE
  // -------------------------------------------------------------
  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCatName.trim() || isCreatingCat) return;

    setIsCreatingCat(true);
    setCatError(null);

    try {
      const created = await createCategory(newCatName.trim());
      setCategories((prev) => [...prev, created]);
      setManualCategoryId(String(created.id));
      setNewCatName('');
      setShowNewCatInput(false);
    } catch (err) {
      setCatError(extractErrorMessage(err, 'Failed to create category.'));
    } finally {
      setIsCreatingCat(false);
    }
  };

  // -------------------------------------------------------------
  // BATCH COMMIT PENDING PRODUCTS (Save All to PostgreSQL)
  // -------------------------------------------------------------
  const handleSaveAll = async () => {
    if (pendingProducts.length === 0 || isSaving) return;

    setIsSaving(true);
    setSaveError(null);
    setSaveSuccessMsg(null);

    try {
      const res = await createProductsBatch(pendingProducts);
      setSaveSuccessMsg(
        language === 'mr'
          ? `अभिनंदन! ${res.created_count} उत्पादने यशस्वीरीत्या इन्व्हेंटरीमध्ये जतन करण्यात आली.`
          : `Success! ${res.created_count} products committed to your store inventory.`
      );
      setPendingProducts([]);
    } catch (err) {
      setSaveError(extractErrorMessage(err, 'Batch save failed. Please review values.'));
    } finally {
      setIsSaving(false);
    }
  };

  // Staged item actions
  const handleRemovePending = (tempId: string) => {
    setPendingProducts((prev) => prev.filter((p) => p._tempId !== tempId));
  };

  const handleUpdatePendingField = (
    tempId: string,
    field: keyof PendingVoiceProduct,
    value: string | number | null
  ) => {
    setPendingProducts((prev) =>
      prev.map((p) => {
        if (p._tempId === tempId) {
          return { ...p, [field]: value };
        }
        return p;
      })
    );
  };

  return (
    <div className="space-y-8 max-w-6xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#E2E8F0]">
        <div>
          <div className="flex items-center space-x-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#1677F3]" />
            <p className="text-xs font-bold uppercase tracking-wider text-[#1677F3]">
              {language === 'mr' ? 'कॅटलॉग व्यवस्थापन' : 'Catalog Management'}
            </p>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-[#102A56] tracking-tight mt-1">
            {t.productEntryTitle}
          </h1>
          <p className="text-xs text-[#64748B] mt-0.5">
            {t.productEntrySubtitle}
          </p>
        </div>

        {/* Tab Toggle: Voice vs Manual */}
        <div className="flex items-center bg-[#EFF6FF] border border-[#BFDBFE] p-1 rounded-xl self-start sm:self-auto">
          <button
            type="button"
            onClick={() => setActiveTab('voice')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'voice'
                ? 'bg-[#1677F3] text-white shadow-sm'
                : 'text-[#102A56] hover:text-[#1677F3]'
            }`}
          >
            <Mic className="w-3.5 h-3.5" />
            <span>{t.tabVoiceEntry}</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('manual')}
            className={`inline-flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-bold transition ${
              activeTab === 'manual'
                ? 'bg-[#1677F3] text-white shadow-sm'
                : 'text-[#102A56] hover:text-[#1677F3]'
            }`}
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{t.tabManualEntry}</span>
          </button>
        </div>
      </div>

      {/* Auth Banner if not authenticated */}
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
                  ? 'इन्व्हेंटरी डेटा सुरक्षित ठेवण्यासाठी दुकान मालक म्हणून लॉग इन करा.'
                  : 'Products are strictly isolated per shop. Please log in as store owner to save items to inventory.'}
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
              <span>{isLoggingIn ? 'Logging In...' : 'Log In as Owner'}</span>
            </button>
            {loginError && <span className="text-xs text-rose-600 font-medium">{loginError}</span>}
          </form>
        </div>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 1: VOICE / SPEECH INPUT                                   */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'voice' && (
        <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-card p-6 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
              <Mic className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#102A56]">{t.tabVoiceEntry}</h2>
              <p className="text-xs text-[#64748B]">{t.voiceInputDesc}</p>
            </div>
          </div>

          {/* Feedback messages */}
          {parseError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}
          {parseSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{parseSuccessMsg}</span>
            </div>
          )}

          {/* Voice Command Input Form */}
          <form onSubmit={handleParseCommand} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">
                {language === 'mr' ? 'व्हॉइस किंवा टाईप केलेला मजकूर:' : 'Voice Command or Speech Transcript:'}
              </label>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={t.voicePlaceholder}
                rows={3}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl p-3.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] focus:ring-2 focus:ring-[#1677F3]/15 transition font-medium"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <button
                type="submit"
                disabled={isParsing || !command.trim()}
                className="inline-flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold shadow-md shadow-[#1677F3]/25 transition active:scale-95 disabled:opacity-50"
              >
                {isParsing ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>{t.parsing}</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>{t.parseTranscript}</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => setCommand('')}
                className="text-xs font-semibold text-[#64748B] hover:text-[#102A56]"
              >
                {t.clear}
              </button>
            </div>
          </form>

          {/* Example Command Pills */}
          <div className="space-y-2 pt-2 border-t border-[#E2E8F0]">
            <p className="text-[11px] font-bold text-[#64748B] uppercase tracking-wider">
              {t.exampleCommands} (Click to try):
            </p>
            <div className="flex flex-wrap gap-2">
              {(language === 'mr' ? EXAMPLE_COMMANDS_MR : EXAMPLE_COMMANDS_EN).map((ex, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setCommand(ex)}
                  className="text-left text-[11px] px-3 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] text-[#102A56] transition"
                >
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* TAB 2: MANUAL PRODUCT ENTRY FORM                              */}
      {/* ------------------------------------------------------------- */}
      {activeTab === 'manual' && (
        <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-card p-6 sm:p-8 space-y-6">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] flex items-center justify-center font-bold">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#102A56]">{t.manualFormTitle}</h2>
              <p className="text-xs text-[#64748B]">{t.manualFormSubtitle}</p>
            </div>
          </div>

          {/* Feedback Messages */}
          {manualError && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
              <span>{manualError}</span>
            </div>
          )}
          {manualSuccess && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <span>{manualSuccess}</span>
            </div>
          )}

          {/* Form Fields Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* 1. Product Name (Unicode Support: English & Marathi) */}
            <div className="sm:col-span-2 space-y-1.5">
              <label className="text-xs font-bold text-[#102A56] flex items-center justify-between">
                <span>{t.productName} *</span>
                <span className="text-[10px] text-[#1677F3] font-semibold">
                  {language === 'mr' ? 'मराठी / English' : 'English / Marathi'}
                </span>
              </label>
              <input
                type="text"
                value={manualName}
                onChange={(e) => setManualName(e.target.value)}
                placeholder={t.productNamePlaceholder}
                required
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] focus:ring-2 focus:ring-[#1677F3]/15 font-semibold"
              />
            </div>

            {/* 2. Category Select + New Category Button */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-bold text-[#102A56]">{t.category}</label>
                <button
                  type="button"
                  onClick={() => setShowNewCatInput(!showNewCatInput)}
                  className="text-[11px] text-[#1677F3] font-bold hover:underline"
                >
                  {t.addNewCategory}
                </button>
              </div>

              {showNewCatInput ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    placeholder={language === 'mr' ? 'नवीन श्रेणीचे नाव' : 'New category name'}
                    className="flex-1 bg-white border border-[#1677F3] rounded-lg px-2.5 py-1.5 text-xs text-[#102A56]"
                  />
                  <button
                    type="button"
                    onClick={handleCreateCategory}
                    disabled={isCreatingCat || !newCatName.trim()}
                    className="p-2 bg-[#1677F3] text-white rounded-lg text-xs font-bold disabled:opacity-50"
                  >
                    {isCreatingCat ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowNewCatInput(false)}
                    className="p-2 bg-slate-100 text-slate-500 rounded-lg text-xs"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <select
                  value={manualCategoryId}
                  onChange={(e) => setManualCategoryId(e.target.value)}
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-xs text-[#102A56] font-medium focus:outline-none focus:bg-white focus:border-[#1677F3]"
                >
                  <option value="">{t.noCategory}</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              )}
              {catError && <p className="text-[10px] text-rose-600">{catError}</p>}
            </div>

            {/* 3. Purchase Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.purchasePrice} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={manualPurchasePrice}
                onChange={(e) => setManualPurchasePrice(e.target.value)}
                placeholder="e.g. 40.00"
                required
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono"
              />
            </div>

            {/* 4. Selling Price */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.sellingPrice} *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={manualSellingPrice}
                onChange={(e) => setManualSellingPrice(e.target.value)}
                placeholder="e.g. 45.00"
                required
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono font-bold"
              />
            </div>

            {/* 5. Stock Quantity */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.stockQuantity} *</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={manualStockQty}
                onChange={(e) => setManualStockQty(e.target.value)}
                placeholder="e.g. 20"
                required
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono"
              />
            </div>

            {/* 6. Unit of Measure */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.unit} *</label>
              <select
                value={manualUnit}
                onChange={(e) => setManualUnit(e.target.value)}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3 py-2.5 text-xs text-[#102A56] font-medium focus:outline-none focus:bg-white focus:border-[#1677F3]"
              >
                {COMMON_UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* 7. Pack Size */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.packSize}</label>
              <input
                type="number"
                step="0.001"
                min="0.001"
                value={manualPackSize}
                onChange={(e) => setManualPackSize(e.target.value)}
                placeholder="Default: 1.000"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono"
              />
            </div>

            {/* 8. Low Stock Threshold */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.lowStockThreshold}</label>
              <input
                type="number"
                step="0.001"
                min="0"
                value={manualLowStock}
                onChange={(e) => setManualLowStock(e.target.value)}
                placeholder="Default: 5"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono"
              />
            </div>

            {/* 9. Barcode / SKU */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">{t.barcode}</label>
              <input
                type="text"
                value={manualBarcode}
                onChange={(e) => setManualBarcode(e.target.value)}
                placeholder={t.barcodePlaceholder}
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:border-[#1677F3] font-mono"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-[#E2E8F0]">
            <div className="flex flex-wrap items-center gap-3">
              {/* Add to Review List */}
              <button
                type="button"
                onClick={handleAddToStaging}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-white hover:bg-[#F8FAFC] border border-[#CBD5E1] text-[#102A56] text-xs font-bold shadow-xs transition active:scale-95"
              >
                <Plus className="w-4 h-4 text-[#1677F3]" />
                <span>{t.addToStaging}</span>
              </button>

              {/* Save Directly */}
              <button
                type="button"
                onClick={handleSaveDirectly}
                disabled={isDirectSaving}
                className="inline-flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold shadow-md shadow-[#1677F3]/25 transition active:scale-95 disabled:opacity-50"
              >
                {isDirectSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{t.saving}</span>
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    <span>{t.saveDirectly}</span>
                  </>
                )}
              </button>
            </div>

            {/* Clear Form */}
            <button
              type="button"
              onClick={handleClearManualForm}
              className="text-xs font-semibold text-[#64748B] hover:text-rose-600 transition"
            >
              {t.clearForm}
            </button>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- */}
      {/* REVIEW & CONFIRM TABLE (Staged Products before Batch Commit)  */}
      {/* ------------------------------------------------------------- */}
      <section className="bg-white border border-[#E2E8F0] rounded-2xl shadow-card overflow-hidden">
        <div className="p-5 border-b border-[#E2E8F0] flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-[#F8FAFC]">
          <div>
            <h2 className="text-sm font-bold text-[#102A56] flex items-center gap-2">
              <span>{t.stagedProductsTitle}</span>
              <span className="px-2 py-0.5 rounded-full bg-[#1677F3] text-white text-[10px] font-black">
                {pendingProducts.length}
              </span>
            </h2>
            <p className="text-xs text-[#64748B]">
              {language === 'mr'
                ? 'उत्पादने जतन करण्यापूर्वी तपशील तपासा किंवा संपादित करा.'
                : 'Review parsed or manually entered items before committing them into PostgreSQL inventory.'}
            </p>
          </div>

          <div className="flex items-center space-x-2">
            {pendingProducts.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => setPendingProducts([])}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold text-[#64748B] hover:text-rose-600 hover:bg-rose-50 transition"
                >
                  {t.clear}
                </button>
                <button
                  type="button"
                  onClick={handleSaveAll}
                  disabled={isSaving || !isAuthenticated}
                  className="inline-flex items-center space-x-2 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition disabled:opacity-50"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>{t.saving}</span>
                    </>
                  ) : (
                    <>
                      <Save className="w-3.5 h-3.5" />
                      <span>{t.saveAll}</span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Global Save Feedback */}
        {saveError && (
          <div className="m-4 p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0" />
            <span>{saveError}</span>
          </div>
        )}
        {saveSuccessMsg && (
          <div className="m-4 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            <span>{saveSuccessMsg}</span>
          </div>
        )}

        {/* Staged Table Content */}
        {pendingProducts.length === 0 ? (
          <div className="p-12 text-center space-y-2">
            <Package className="w-8 h-8 text-[#94A3B8] mx-auto" />
            <p className="text-xs font-semibold text-[#102A56]">{t.noStagedProducts}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-[#F8FAFC] border-b border-[#E2E8F0] text-[#64748B] font-bold uppercase text-[11px]">
                <tr>
                  <th className="py-3 px-4">{t.colName}</th>
                  <th className="py-3 px-3">{t.colCategory}</th>
                  <th className="py-3 px-3">{t.packSize}</th>
                  <th className="py-3 px-3">{t.colUnit}</th>
                  <th className="py-3 px-3">{t.colPurchasePrice}</th>
                  <th className="py-3 px-3">{t.colSellingPrice}</th>
                  <th className="py-3 px-3">{t.stockQuantity}</th>
                  <th className="py-3 px-4 text-right">{t.colActions}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0]">
                {pendingProducts.map((p) => (
                  <tr key={p._tempId} className="hover:bg-[#F8FAFC] transition">
                    {/* Name */}
                    <td className="py-2.5 px-4">
                      <input
                        type="text"
                        value={p.name}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'name', e.target.value)}
                        className="w-full bg-white border border-[#CBD5E1] rounded-lg px-2.5 py-1 text-xs font-bold text-[#102A56] focus:border-[#1677F3]"
                      />
                    </td>

                    {/* Category */}
                    <td className="py-2.5 px-3">
                      <input
                        type="text"
                        value={p.category_name || ''}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'category_name', e.target.value)}
                        placeholder="General"
                        className="w-24 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs text-[#102A56]"
                      />
                    </td>

                    {/* Pack Size */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.001"
                        value={p.pack_size}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'pack_size', parseFloat(e.target.value) || 1)}
                        className="w-16 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs font-mono"
                      />
                    </td>

                    {/* Unit */}
                    <td className="py-2.5 px-3">
                      <select
                        value={p.unit}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'unit', e.target.value)}
                        className="bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs font-medium"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u.value} value={u.value}>
                            {u.value}
                          </option>
                        ))}
                      </select>
                    </td>

                    {/* Purchase Price */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={p.purchase_price}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'purchase_price', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs font-mono"
                      />
                    </td>

                    {/* Selling Price */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.01"
                        value={p.selling_price}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'selling_price', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs font-mono font-bold text-[#102A56]"
                      />
                    </td>

                    {/* Stock Quantity */}
                    <td className="py-2.5 px-3">
                      <input
                        type="number"
                        step="0.001"
                        value={p.stock_quantity}
                        onChange={(e) => handleUpdatePendingField(p._tempId, 'stock_quantity', parseFloat(e.target.value) || 0)}
                        className="w-20 bg-white border border-[#CBD5E1] rounded-lg px-2 py-1 text-xs font-mono font-semibold"
                      />
                    </td>

                    {/* Remove Action */}
                    <td className="py-2.5 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => handleRemovePending(p._tempId)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
                        title={t.delete}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};

export default VoiceProductPage;
