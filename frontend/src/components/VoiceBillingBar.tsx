import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Mic,
  MicOff,
  Sparkles,
  Send,
  Loader2,
  AlertCircle,
  CheckCircle2,
  HelpCircle,
  Search,
  Globe,
  CornerDownLeft,
  X,
  Layers,
  ShoppingBag,
  Package,
} from 'lucide-react';
import {
  CartResponse,
  VoiceBillingParseResponse,
  VoiceBillingMatchedProduct,
  parseVoiceBillingCommand,
  addCartItem,
  extractErrorMessage,
} from '../services/api';

export type VoiceLanguage = 'en-IN' | 'hi-IN' | 'mr-IN';

interface LanguageOption {
  code: VoiceLanguage;
  name: string;
  nativeName: string;
  flag: string;
}

const SUPPORTED_LANGUAGES: LanguageOption[] = [
  { code: 'en-IN', name: 'English (India)', nativeName: 'English', flag: '🇮🇳' },
  { code: 'hi-IN', name: 'Hindi', nativeName: 'हिन्दी', flag: '🇮🇳' },
  { code: 'mr-IN', name: 'Marathi', nativeName: 'मराठी', flag: '🇮🇳' },
];

const EXAMPLE_SPOKEN_COMMANDS = [
  'Add sugar 2 kg',
  'Add five packets of biscuits',
  'Add 500 grams of turmeric',
  'Add two litres of cooking oil',
];

interface VoiceBillingBarProps {
  cart: CartResponse | null;
  onCartUpdated: (updatedCart: CartResponse) => void;
  onSetSearchQuery: (query: string) => void;
  onError: (msg: string) => void;
  onSuccess: (msg: string) => void;
  disabled?: boolean;
}

export const VoiceBillingBar: React.FC<VoiceBillingBarProps> = ({
  cart,
  onCartUpdated,
  onSetSearchQuery,
  onError,
  onSuccess,
  disabled = false,
}) => {
  // Speech API detection
  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
      : null;

  const isSpeechSupported = !!SpeechRecognitionAPI;

  // State management
  const [isListening, setIsListening] = useState<boolean>(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState<boolean>(false);
  const [selectedLanguage, setSelectedLanguage] = useState<VoiceLanguage>('en-IN');
  const [transcript, setTranscript] = useState<string>('');
  const [liveInterim, setLiveInterim] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [parseResult, setParseResult] = useState<VoiceBillingParseResponse | null>(null);
  const [barError, setBarError] = useState<string | null>(null);
  const [showExamples, setShowExamples] = useState<boolean>(false);

  // Per-candidate quantity adjustment in ambiguity selector
  const [candidateQuantities, setCandidateQuantities] = useState<{ [id: number]: string }>({});

  // Refs for audio recognition and duplicate execution protection
  const recognitionRef = useRef<any>(null);
  const isProcessingRef = useRef<boolean>(false);
  const inputRef = useRef<HTMLInputElement>(null);

  // Initialize SpeechRecognition instance
  const initRecognition = useCallback(() => {
    if (!SpeechRecognitionAPI) return null;

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = selectedLanguage;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setIsListening(true);
      setMicPermissionDenied(false);
      setBarError(null);
      setLiveInterim('');
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      let final = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const item = event.results[i];
        const text = item[0]?.transcript || '';
        if (item.isFinal) {
          final += text;
        } else {
          interim += text;
        }
      }

      if (final) {
        const fullFinal = final.trim();
        setTranscript(fullFinal);
        setLiveInterim('');
        // Automatically submit parsed final command
        handleProcessCommand(fullFinal);
      } else {
        setLiveInterim(interim.trim());
      }
    };

    recognition.onerror = (event: any) => {
      setIsListening(false);
      const err = event.error;
      if (err === 'not-allowed' || err === 'service-not-allowed') {
        setMicPermissionDenied(true);
        setBarError(
          'Microphone permission was denied. Please allow microphone access or use the text-input fallback below.'
        );
      } else if (err === 'no-speech') {
        setBarError('No speech detected. Please click the mic and speak clearly.');
      } else if (err === 'network') {
        setBarError('Network issue with speech recognition. Please use the text input.');
      } else if (err !== 'aborted') {
        setBarError(`Speech error (${err}). Please use the text fallback.`);
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    return recognition;
  }, [SpeechRecognitionAPI, selectedLanguage]);

  // Clean up recognition on unmount or language switch
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {
          // ignore
        }
      }
    };
  }, []);

  // Toggle listening
  const handleToggleListening = () => {
    if (disabled || !cart) {
      onError('Please ensure cart is loaded and ready before adding items.');
      return;
    }

    if (!isSpeechSupported) {
      setBarError(
        'Speech recognition is not supported in this browser. Please use the text input fallback below.'
      );
      inputRef.current?.focus();
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch {
          // ignore
        }
      }
      setIsListening(false);
      return;
    }

    // Start listening
    setBarError(null);
    setParseResult(null);

    try {
      const recognition = initRecognition();
      if (!recognition) return;
      recognitionRef.current = recognition;
      recognition.start();
    } catch (err) {
      setBarError('Could not start microphone. You can type the command directly below.');
    }
  };

  // Process and execute billing command
  const handleProcessCommand = async (commandToRun?: string) => {
    const rawCommand = commandToRun ?? transcript;
    const clean = rawCommand.trim();

    if (!clean) {
      setBarError('Please speak or type a billing command (e.g. "Add sugar 2 kg").');
      return;
    }

    if (!cart) {
      onError('No active cart found. Please refresh or create a cart.');
      return;
    }

    if (isProcessing || isProcessingRef.current) {
      return; // Prevent duplicate concurrent submissions
    }

    isProcessingRef.current = true;
    setIsProcessing(true);
    setBarError(null);
    setParseResult(null);

    // Stop listening if still active
    if (recognitionRef.current && isListening) {
      try {
        recognitionRef.current.stop();
      } catch {
        // ignore
      }
      setIsListening(false);
    }

    try {
      const response = await parseVoiceBillingCommand(clean);
      setParseResult(response);

      // Handle Result Match Types
      if (response.match_type === 'exact' && response.matches.length > 0) {
        const matchedProduct = response.matches[0];
        const reqQty = Number(response.resolved_quantity);

        // Check product active status
        if (!matchedProduct.is_active) {
          setBarError(`Product "${matchedProduct.name}" is marked inactive and cannot be billed.`);
          return;
        }

        // Validate stock
        const availStock = Number(matchedProduct.stock_quantity);
        const existingInCart = cart.items.find((i) => i.product_id === matchedProduct.id);
        const curInCartQty = existingInCart ? Number(existingInCart.quantity) : 0;

        if (curInCartQty + reqQty > availStock) {
          setBarError(
            `Insufficient stock for "${matchedProduct.name}". Available: ${availStock} ${matchedProduct.unit}, currently requested in total: ${(
              curInCartQty + reqQty
            ).toFixed(3)} ${matchedProduct.unit}.`
          );
          return;
        }

        // Add to billing cart using existing backend API
        const updatedCart = await addCartItem(cart.id, matchedProduct.id, response.resolved_quantity);
        onCartUpdated(updatedCart);
        onSuccess(
          `✓ Added ${response.resolved_quantity} ${matchedProduct.unit} of "${matchedProduct.name}" @ ₹${matchedProduct.selling_price} to cart.`
        );

        // Clear input transcript on successful addition
        setTranscript('');
        setParseResult(null);
      } else if (response.match_type === 'multiple') {
        // Initialize default quantities for multiple candidates
        const initQties: { [id: number]: string } = {};
        response.matches.forEach((p) => {
          initQties[p.id] = response.resolved_quantity;
        });
        setCandidateQuantities(initQties);
      } else if (response.match_type === 'none') {
        // Clear message stating product was not found (no product auto-created)
        setBarError(response.message);
      }
    } catch (err) {
      setBarError(extractErrorMessage(err, 'Failed to process voice command.'));
    } finally {
      isProcessingRef.current = false;
      setIsProcessing(false);
    }
  };

  // Add specific candidate from ambiguous options list
  const handleSelectCandidate = async (product: VoiceBillingMatchedProduct) => {
    if (!cart) return;

    const qtyStr = candidateQuantities[product.id] || parseResult?.resolved_quantity || '1';
    const qty = Number(qtyStr);

    if (isNaN(qty) || qty <= 0) {
      setBarError('Please enter a valid positive quantity.');
      return;
    }

    const availStock = Number(product.stock_quantity);
    const existingInCart = cart.items.find((i) => i.product_id === product.id);
    const curInCartQty = existingInCart ? Number(existingInCart.quantity) : 0;

    if (curInCartQty + qty > availStock) {
      setBarError(
        `Insufficient stock for "${product.name}". Available: ${availStock} ${product.unit}, currently requested: ${(
          curInCartQty + qty
        ).toFixed(3)} ${product.unit}.`
      );
      return;
    }

    setIsProcessing(true);
    setBarError(null);

    try {
      const updatedCart = await addCartItem(cart.id, product.id, qtyStr);
      onCartUpdated(updatedCart);
      onSuccess(`✓ Added ${qtyStr} ${product.unit} of "${product.name}" to cart.`);
      setParseResult(null);
      setTranscript('');
    } catch (err) {
      setBarError(extractErrorMessage(err, `Failed to add "${product.name}" to cart.`));
    } finally {
      setIsProcessing(false);
    }
  };

  // Fallback to manual product catalog search
  const handleManualSearchFallback = (term: string) => {
    onSetSearchQuery(term);
    setParseResult(null);
    setBarError(null);
    onSuccess(`Transferred "${term}" to catalog search filter.`);
  };

  return (
    <div className="bg-white border border-[#E2E8F0] rounded-2xl p-4 sm:p-5 shadow-sm space-y-3 relative overflow-hidden">
      {/* Top Header Row: Voice Billing Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all ${
              isListening
                ? 'bg-rose-500 text-white shadow-md shadow-rose-500/30 animate-pulse'
                : isProcessing
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-500/30'
                  : 'bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE]'
            }`}
          >
            {isListening ? (
              <Mic className="w-5 h-5 animate-bounce" />
            ) : isProcessing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Sparkles className="w-5 h-5" />
            )}
          </div>

          <div>
            <div className="flex items-center space-x-2">
              <h2 className="text-sm font-extrabold text-[#102A56] tracking-wide uppercase">
                AI Voice Billing Assistant
              </h2>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE]">
                Live Speech
              </span>
            </div>
            <p className="text-xs text-[#64748B]">
              Speak or type billing commands (e.g., &ldquo;Add sugar 2 kg&rdquo;)
            </p>
          </div>
        </div>

        {/* Language selector & Example Toggle */}
        <div className="flex items-center space-x-2 self-start sm:self-auto">
          {/* Language selector */}
          <div className="flex items-center space-x-1.5 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl px-2.5 py-1.5 text-xs text-[#102A56]">
            <Globe className="w-3.5 h-3.5 text-[#64748B]" />
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value as VoiceLanguage)}
              disabled={isListening || isProcessing}
              className="bg-transparent border-none text-xs text-[#102A56] font-medium focus:outline-none cursor-pointer pr-1"
              title="Select speech recognition language"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code} className="bg-white text-[#102A56]">
                  {lang.flag} {lang.nativeName} ({lang.name})
                </option>
              ))}
            </select>
          </div>

          {/* Quick Examples Toggle */}
          <button
            type="button"
            onClick={() => setShowExamples(!showExamples)}
            className="inline-flex items-center space-x-1 text-xs text-[#64748B] hover:text-[#1677F3] px-2.5 py-1.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] hover:bg-[#EFF6FF] transition font-medium"
            title="View example voice commands"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Examples</span>
          </button>
        </div>
      </div>

      {/* Examples Accordion */}
      {showExamples && (
        <div className="p-3 bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl space-y-2 text-xs">
          <p className="text-[#64748B] font-semibold">Try speaking or typing any of these formats:</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXAMPLE_SPOKEN_COMMANDS.map((eg, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => {
                  setTranscript(eg);
                  setShowExamples(false);
                  inputRef.current?.focus();
                }}
                className="text-left px-3 py-1.5 bg-white hover:bg-[#EFF6FF] hover:border-[#BFDBFE] border border-[#E2E8F0] rounded-lg text-[#1677F3] font-medium transition"
              >
                &ldquo;{eg}&rdquo;
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Main Interactive Mic & Command Bar */}
      <div className="space-y-2 relative z-10">
        <div className="flex items-center gap-2">
          {/* Big Microphone Button */}
          <button
            type="button"
            onClick={handleToggleListening}
            disabled={disabled || isProcessing}
            className={`relative flex items-center justify-center w-12 h-12 rounded-xl font-bold transition-all flex-shrink-0 ${
              isListening
                ? 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-600/30 ring-4 ring-rose-100'
                : !isSpeechSupported
                  ? 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200'
                  : 'bg-[#1677F3] hover:bg-[#0755D9] text-white shadow-md shadow-[#1677F3]/25 active:scale-95'
            }`}
            title={
              !isSpeechSupported
                ? 'Speech recognition not supported in this browser'
                : isListening
                  ? 'Click to stop listening'
                  : 'Click to start speaking'
            }
          >
            {isListening ? (
              <span className="relative flex h-5 w-5 items-center justify-center">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <Mic className="w-5 h-5 relative" />
              </span>
            ) : !isSpeechSupported ? (
              <MicOff className="w-5 h-5 text-slate-400" />
            ) : (
              <Mic className="w-5 h-5" />
            )}
          </button>

          {/* Transcript / Text Input Fallback Bar */}
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={isListening && liveInterim ? liveInterim : transcript}
              onChange={(e) => setTranscript(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleProcessCommand();
                }
              }}
              placeholder={
                isListening
                  ? 'Listening... speak command now...'
                  : !isSpeechSupported
                    ? 'Speech not supported. Type command e.g. "Add sugar 2 kg"...'
                    : 'Speak with mic or type command (e.g. "Add sugar 2 kg")...'
              }
              disabled={disabled || isProcessing}
              className={`w-full bg-[#F8FAFC] border rounded-xl pl-3.5 pr-24 py-3 text-sm text-[#102A56] placeholder-slate-400 focus:outline-none transition ${
                isListening
                  ? 'border-rose-400 bg-rose-50 ring-2 ring-rose-200'
                  : 'border-[#CBD5E1] focus:bg-white focus:border-[#1677F3] focus:ring-2 focus:ring-[#1677F3]/20'
              }`}
            />

            {/* Clear and Submit Buttons inside input */}
            <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center space-x-1.5">
              {transcript && (
                <button
                  type="button"
                  onClick={() => {
                    setTranscript('');
                    setParseResult(null);
                    setBarError(null);
                  }}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 transition"
                  title="Clear command"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleProcessCommand()}
                disabled={disabled || isProcessing || (!transcript.trim() && !liveInterim.trim())}
                className="inline-flex items-center space-x-1 px-3 py-1.5 bg-[#1677F3] hover:bg-[#0755D9] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg transition shadow-sm"
                title="Process billing command"
              >
                {isProcessing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <>
                    <span>Add</span>
                    <CornerDownLeft className="w-3 h-3 hidden sm:inline" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>

        {/* Live Listening Audio Waves / Status Banner */}
        {isListening && (
          <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-in fade-in duration-200">
            <div className="flex items-center space-x-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-rose-500" />
              </span>
              <span className="font-semibold">
                Listening in {SUPPORTED_LANGUAGES.find((l) => l.code === selectedLanguage)?.name}...
              </span>
              {liveInterim && (
                <span className="text-[#102A56] font-semibold italic bg-white px-2 py-0.5 rounded border border-rose-200">
                  &ldquo;{liveInterim}&rdquo;
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={handleToggleListening}
              className="text-[11px] font-bold text-rose-700 hover:text-rose-900 underline"
            >
              Stop Listening
            </button>
          </div>
        )}

        {/* Processing Indicator */}
        {isProcessing && (
          <div className="flex items-center space-x-2 px-3.5 py-2 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs animate-in fade-in duration-200">
            <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
            <span className="font-medium">Analyzing voice command and matching shop products...</span>
          </div>
        )}

        {/* Browser Unsupported Notice */}
        {!isSpeechSupported && (
          <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-700 text-xs">
            <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-[#102A56]">Browser Speech API Unavailable</p>
              <p className="text-[#64748B] text-[11px]">
                Your browser does not expose SpeechRecognition. You can still type billing commands directly above (e.g. &ldquo;Add sugar 2 kg&rdquo;).
              </p>
            </div>
          </div>
        )}

        {micPermissionDenied && (
          <div className="flex items-start space-x-2 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs">
            <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold text-rose-900">Microphone Permission Denied</p>
              <p className="text-rose-700 text-[11px]">
                Microphone access was blocked. Please click the site settings icon in your address bar to allow microphone access, or type your command above.
              </p>
            </div>
          </div>
        )}

        {/* Local Error Notice */}
        {barError && (
          <div className="flex items-start justify-between p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs animate-in fade-in duration-200">
            <div className="flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="font-medium">{barError}</p>
                {parseResult && parseResult.match_type === 'none' && parseResult.parsed_product_name && (
                  <button
                    type="button"
                    onClick={() => handleManualSearchFallback(parseResult.parsed_product_name)}
                    className="inline-flex items-center space-x-1 text-[#1677F3] hover:text-[#0755D9] font-bold underline text-[11px] pt-1"
                  >
                    <Search className="w-3 h-3" />
                    <span>Search for &ldquo;{parseResult.parsed_product_name}&rdquo; in shop catalog</span>
                  </button>
                )}
              </div>
            </div>
            <button
              type="button"
              onClick={() => setBarError(null)}
              className="text-slate-400 hover:text-slate-600 p-1 rounded"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* AMBIGUITY RESOLUTION & CANDIDATE PICKER */}
      {parseResult && parseResult.match_type === 'multiple' && (
        <div className="p-4 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3 animate-in fade-in duration-200">
          <div className="flex items-center justify-between pb-2 border-b border-amber-200">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-amber-600" />
              <h3 className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Multiple Matching Products Found
              </h3>
            </div>
            <span className="text-[11px] text-amber-800">
              Command: <strong className="text-[#102A56]">&ldquo;{parseResult.command}&rdquo;</strong>
            </span>
          </div>

          <p className="text-xs text-amber-900">
            We found {parseResult.matches.length} products matching{' '}
            <strong className="text-[#102A56]">&ldquo;{parseResult.parsed_product_name}&rdquo;</strong>.
            Please select the exact product to add to cart:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto pr-1">
            {parseResult.matches.map((product) => {
              const qtyVal = candidateQuantities[product.id] || parseResult.resolved_quantity;
              const isOut = Number(product.stock_quantity) <= 0;

              return (
                <div
                  key={product.id}
                  className="p-3 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#BFDBFE] flex flex-col justify-between space-y-2 transition shadow-subtle"
                >
                  <div>
                    <div className="flex items-start justify-between gap-1">
                      <h4 className="text-xs font-bold text-[#102A56] leading-tight">
                        {product.name}
                      </h4>
                      <span className="text-xs font-bold text-[#1677F3] whitespace-nowrap">
                        ₹{Number(product.selling_price).toFixed(2)}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mt-1 text-[11px] text-[#64748B]">
                      <span>Unit: {product.unit}</span>
                      <span>•</span>
                      <span className={isOut ? 'text-rose-600 font-bold' : 'text-[#64748B]'}>
                        Stock: {Number(product.stock_quantity).toFixed(1)} {product.unit}
                      </span>
                    </div>
                  </div>

                  {/* Quantity and Add Button */}
                  <div className="flex items-center gap-2 pt-1">
                    <div className="flex items-center space-x-1 bg-[#F8FAFC] border border-[#CBD5E1] rounded-lg px-2 py-1 w-24">
                      <input
                        type="number"
                        min="0.001"
                        step="any"
                        value={qtyVal}
                        onChange={(e) =>
                          setCandidateQuantities({
                            ...candidateQuantities,
                            [product.id]: e.target.value,
                          })
                        }
                        className="w-full bg-transparent text-xs text-[#102A56] font-medium text-center focus:outline-none"
                      />
                      <span className="text-[10px] text-[#64748B]">{product.unit}</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleSelectCandidate(product)}
                      disabled={isOut || isProcessing}
                      className="flex-1 py-1.5 px-3 bg-[#1677F3] hover:bg-[#0755D9] disabled:bg-slate-200 disabled:text-slate-400 text-white text-xs font-bold rounded-lg transition"
                    >
                      {isOut ? 'Out of Stock' : 'Add to Cart'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center justify-between pt-2 border-t border-amber-200 text-[11px]">
            <button
              type="button"
              onClick={() => handleManualSearchFallback(parseResult.parsed_product_name)}
              className="text-[#1677F3] hover:underline font-semibold transition"
            >
              Search &ldquo;{parseResult.parsed_product_name}&rdquo; in catalog
            </button>
            <button
              type="button"
              onClick={() => setParseResult(null)}
              className="text-[#64748B] hover:text-[#102A56] transition"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default VoiceBillingBar;
