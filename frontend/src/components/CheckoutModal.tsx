import React, { useState, useEffect, useMemo } from 'react';
import {
  X,
  CreditCard,
  Banknote,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Receipt,
  Sparkles,
} from 'lucide-react';
import {
  CartResponse,
  SaleResponse,
  checkoutCart,
  extractErrorMessage,
} from '../services/api';

interface CheckoutModalProps {
  isOpen: boolean;
  cart: CartResponse | null;
  onClose: () => void;
  onCheckoutSuccess: (sale: SaleResponse) => void;
}

export const CheckoutModal: React.FC<CheckoutModalProps> = ({
  isOpen,
  cart,
  onClose,
  onCheckoutSuccess,
}) => {
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'upi'>('cash');
  const [amountReceivedStr, setAmountReceivedStr] = useState<string>('');
  const [paymentReference, setPaymentReference] = useState<string>('');
  const [notes, setNotes] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const totalAmount = useMemo(() => {
    return cart ? Number(cart.total) : 0;
  }, [cart]);

  // Set default amount received to exact total when cart changes or modal opens
  useEffect(() => {
    if (isOpen && cart) {
      setAmountReceivedStr(Number(cart.total).toFixed(2));
      setPaymentReference('');
      setNotes('');
      setError(null);
    }
  }, [isOpen, cart]);

  if (!isOpen || !cart) return null;

  const numReceived = parseFloat(amountReceivedStr) || 0;
  const changeDue = Math.max(0, numReceived - totalAmount);
  const isShort = paymentMethod === 'cash' && numReceived < totalAmount;
  const shortAmount = Math.max(0, totalAmount - numReceived);

  const handleQuickTender = (amount: number) => {
    setAmountReceivedStr(amount.toFixed(2));
  };

  const handleSubmitCheckout = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;

    if (cart.items.length === 0) {
      setError('Cannot checkout an empty billing cart.');
      return;
    }

    if (paymentMethod === 'cash' && numReceived < totalAmount) {
      setError(`Insufficient cash received. Customer must pay at least ₹${totalAmount.toFixed(2)}.`);
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const sale = await checkoutCart(cart.id, {
        payment_method: paymentMethod,
        amount_received: paymentMethod === 'cash' ? numReceived : totalAmount,
        payment_reference: paymentReference.trim() || undefined,
        notes: notes.trim() || undefined,
      });

      onCheckoutSuccess(sale);
    } catch (err) {
      setError(extractErrorMessage(err, 'Checkout failed. Please review stock or payment details.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-white border border-[#E2E8F0] rounded-2xl w-full max-w-lg max-h-[92vh] overflow-y-auto shadow-2xl relative flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#E2E8F0] sticky top-0 bg-white/95 backdrop-blur-md z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE] flex items-center justify-center">
              <Receipt className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-[#102A56]">Complete Sale & Checkout</h2>
              <p className="text-xs text-[#64748B]">
                Cart #{cart.id} • {cart.items.length} {cart.items.length === 1 ? 'item' : 'items'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-xl text-[#94A3B8] hover:text-[#102A56] hover:bg-[#F1F5F9] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <form onSubmit={handleSubmitCheckout} className="p-5 space-y-5">
          {/* Financial Summary Card */}
          <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-2">
            <div className="flex justify-between items-center text-xs text-[#64748B]">
              <span>Items Total ({cart.items.length} products)</span>
              <span className="font-mono text-[#102A56] font-semibold">₹{Number(cart.subtotal).toFixed(2)}</span>
            </div>
            {Number(cart.discount_amount) > 0 && (
              <div className="flex justify-between items-center text-xs text-emerald-600 font-medium">
                <span>Discount Applied</span>
                <span className="font-mono font-bold">-₹{Number(cart.discount_amount).toFixed(2)}</span>
              </div>
            )}
            {Number(cart.tax_amount) > 0 && (
              <div className="flex justify-between items-center text-xs text-[#64748B]">
                <span>Estimated Tax (GST)</span>
                <span className="font-mono font-semibold">+₹{Number(cart.tax_amount).toFixed(2)}</span>
              </div>
            )}
            <div className="pt-2 border-t border-[#E2E8F0] flex justify-between items-center">
              <span className="text-sm font-bold text-[#102A56]">Total Amount Payable</span>
              <span className="text-2xl font-black text-[#102A56] font-mono">
                ₹{Number(cart.total).toFixed(2)}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-[#102A56] uppercase tracking-wider block">
              Payment Method
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3.5 rounded-xl border flex items-center space-x-3 transition-all ${
                  paymentMethod === 'cash'
                    ? 'border-[#1677F3] bg-[#EFF6FF] text-[#1677F3] ring-1 ring-[#1677F3]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#102A56]'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    paymentMethod === 'cash'
                      ? 'bg-[#1677F3] text-white font-bold'
                      : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                >
                  <Banknote className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#102A56]">Cash</div>
                  <div className="text-[11px] text-[#64748B]">Paper cash tender</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('upi')}
                className={`p-3.5 rounded-xl border flex items-center space-x-3 transition-all ${
                  paymentMethod === 'upi'
                    ? 'border-[#1677F3] bg-[#EFF6FF] text-[#1677F3] ring-1 ring-[#1677F3]'
                    : 'border-[#E2E8F0] bg-white text-[#64748B] hover:border-[#CBD5E1] hover:text-[#102A56]'
                }`}
              >
                <div
                  className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                    paymentMethod === 'upi'
                      ? 'bg-[#1677F3] text-white font-bold'
                      : 'bg-[#F1F5F9] text-[#64748B]'
                  }`}
                >
                  <QrCode className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <div className="text-xs font-bold text-[#102A56]">UPI QR</div>
                  <div className="text-[11px] text-[#64748B]">GPay, PhonePe, Paytm</div>
                </div>
              </button>
            </div>
          </div>

          {/* Cash Payment Details */}
          {paymentMethod === 'cash' && (
            <div className="space-y-3 p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] animate-in fade-in duration-150">
              <div>
                <label className="text-xs font-bold text-[#102A56] block mb-1">
                  Cash Received from Customer (₹)
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#64748B] font-bold">₹</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={amountReceivedStr}
                    onChange={(e) => setAmountReceivedStr(e.target.value)}
                    required
                    placeholder="0.00"
                    className="w-full bg-white border border-[#CBD5E1] rounded-xl pl-8 pr-4 py-2.5 text-base font-bold text-[#102A56] focus:outline-none focus:border-[#1677F3] focus:ring-1 focus:ring-[#1677F3] transition"
                  />
                </div>
              </div>

              {/* Quick Tender Suggestions */}
              <div>
                <span className="text-[11px] text-[#64748B] block mb-1.5 font-medium">Quick Amount Presets:</span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => handleQuickTender(totalAmount)}
                    className="px-2.5 py-1 text-xs rounded-lg bg-white hover:bg-[#F1F5F9] border border-[#CBD5E1] text-[#102A56] font-semibold transition font-mono"
                  >
                    Exact (₹{totalAmount.toFixed(2)})
                  </button>
                  {[
                    Math.ceil(totalAmount / 50) * 50,
                    Math.ceil(totalAmount / 100) * 100,
                    500,
                    1000,
                    2000,
                  ]
                    .filter((amt, idx, arr) => amt >= totalAmount && arr.indexOf(amt) === idx)
                    .slice(0, 4)
                    .map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => handleQuickTender(preset)}
                        className="px-2.5 py-1 text-xs rounded-lg bg-white hover:bg-[#EFF6FF] border border-[#CBD5E1] hover:border-[#1677F3] text-[#1677F3] font-bold transition font-mono"
                      >
                        ₹{preset.toFixed(2)}
                      </button>
                    ))}
                </div>
              </div>

              {/* Live Change Calculation Status */}
              <div className="pt-2 border-t border-[#E2E8F0]">
                {isShort ? (
                  <div className="flex items-center justify-between text-xs p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800">
                    <span className="font-semibold">Remaining balance needed:</span>
                    <span className="font-bold text-amber-900 font-mono">₹{shortAmount.toFixed(2)}</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-between text-xs p-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800">
                    <span className="font-semibold">Change to Return to Customer:</span>
                    <span className="text-xl font-black text-emerald-700 font-mono">₹{changeDue.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* UPI Payment Details */}
          {paymentMethod === 'upi' && (
            <div className="p-4 rounded-xl bg-[#F8FAFC] border border-[#E2E8F0] space-y-3 animate-in fade-in duration-150">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#102A56]">Scan QR on Counter Stand</span>
                <span className="text-sm text-[#1677F3] font-bold font-mono">₹{totalAmount.toFixed(2)}</span>
              </div>
              <div className="p-3 rounded-xl bg-white border border-[#E2E8F0] text-center space-y-1">
                <div className="text-xs text-[#102A56] font-semibold">Customer pays via any UPI app</div>
                <div className="text-[11px] text-[#64748B]">
                  Accepts Google Pay, PhonePe, Paytm, BHIM, Cred, and bank UPI apps
                </div>
              </div>
              <div>
                <label className="text-xs text-[#64748B] block mb-1 font-medium">
                  UPI UTR / Reference Number (Optional)
                </label>
                <input
                  type="text"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  placeholder="e.g. 12-digit UTR: 4289XXXXXXXX"
                  className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs text-[#102A56] focus:outline-none focus:border-[#1677F3] transition"
                />
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="text-xs text-[#64748B] block mb-1 font-medium">
              Cashier Notes (Optional)
            </label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="e.g. Counter 1, packing bag requested"
              className="w-full bg-white border border-[#CBD5E1] rounded-xl px-3 py-2 text-xs text-[#102A56] focus:outline-none focus:border-[#1677F3] transition"
            />
          </div>

          {/* Error Notice */}
          {error && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-start space-x-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 flex items-center justify-end space-x-2.5 border-t border-[#E2E8F0]">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2.5 rounded-xl border border-[#CBD5E1] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#102A56] text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting || isShort}
              className="inline-flex items-center space-x-2 px-6 py-2.5 bg-[#1677F3] hover:bg-[#0755D9] disabled:bg-[#E2E8F0] disabled:text-[#94A3B8] text-white text-xs font-bold rounded-xl transition shadow-sm"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Finalizing Sale...</span>
                </>
              ) : (
                <>
                  <span>Complete Checkout (₹{totalAmount.toFixed(2)})</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CheckoutModal;
