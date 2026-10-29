import React, { useEffect } from 'react';
import {
  X,
  Printer,
  CheckCircle2,
  PlusCircle,
  FileText,
  Sliders,
} from 'lucide-react';
import { SaleResponse } from '../services/api';
import { useApp, ReceiptPaperWidth } from '../context';

interface ReceiptModalProps {
  isOpen: boolean;
  sale: SaleResponse | null;
  onClose: () => void;
  onNewBill?: () => void;
  title?: string;
  isReprint?: boolean;
}

/**
 * Format item quantity for print and on-screen receipts.
 * Shows fractional decimals (e.g. 1.500 kg, 0.750 litre) or whole integers (e.g. 2 pcs).
 */
export const formatQuantity = (qty: string | number, unit: string): string => {
  const num = Number(qty);
  if (isNaN(num)) return String(qty);
  const unitLower = (unit || '').toLowerCase().trim();
  const isFractionalUnit = ['kg', 'g', 'gram', 'grams', 'litre', 'ltr', 'liter', 'l', 'ml', 'meter', 'm'].includes(
    unitLower
  );
  if (isFractionalUnit || num % 1 !== 0) {
    return num.toFixed(3);
  }
  return String(Math.round(num));
};

export const ReceiptModal: React.FC<ReceiptModalProps> = ({
  isOpen,
  sale,
  onClose,
  onNewBill,
  title = 'Sale Completed Successfully',
  isReprint = false,
}) => {
  const { paperWidth, setPaperWidth } = useApp();

  // Keyboard shortcut: Ctrl+P / Cmd+P to print, Escape to close
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'p') {
        e.preventDefault();
        window.print();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !sale) return null;

  const handlePrint = () => {
    window.print();
  };

  const saleDate = new Date(sale.created_at);
  const formattedDate = saleDate.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  const formattedTime = saleDate.toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });

  const shop = sale.shop;

  // Compute container preview class based on paperWidth
  const previewWidthClass =
    paperWidth === '58mm'
      ? 'max-w-[330px]'
      : paperWidth === '80mm'
        ? 'max-w-[430px]'
        : 'max-w-[620px]';

  return (
    <div className="receipt-modal-backdrop fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#102A56]/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="receipt-modal-card bg-white border border-[#E2E8F0] rounded-3xl w-full max-w-3xl max-h-[94vh] overflow-y-auto shadow-2xl relative flex flex-col">
        {/* =================================================================== */}
        {/* MODAL TOP BAR (Controls & Paper-Width Selector - Hidden in Print)   */}
        {/* =================================================================== */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-[#E2E8F0] sticky top-0 bg-white/95 backdrop-blur-md z-10 no-print gap-3">
          <div className="flex items-center space-x-2 text-emerald-600">
            <CheckCircle2 className="w-5 h-5 flex-shrink-0" />
            <div>
              <span className="text-sm font-extrabold text-[#102A56] block sm:inline">
                {title}
              </span>
              {isReprint && (
                <span className="ml-2 text-[10px] px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 font-semibold uppercase">
                  Reprint Copy
                </span>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2.5">
            {/* Paper Width Selector Segmented Control */}
            <div className="flex items-center bg-[#F8FAFC] border border-[#E2E8F0] rounded-xl p-0.5 text-xs">
              <span className="text-[10px] font-semibold text-[#64748B] px-2 hidden md:inline">
                Paper:
              </span>
              <button
                type="button"
                onClick={() => setPaperWidth('58mm')}
                className={`px-2.5 py-1 rounded-lg font-medium transition text-[11px] ${
                  paperWidth === '58mm'
                    ? 'bg-[#1677F3] text-white font-bold shadow-sm'
                    : 'text-[#64748B] hover:text-[#102A56]'
                }`}
                title="58 mm (2 inch) Narrow Thermal Paper Roll"
              >
                58mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('80mm')}
                className={`px-2.5 py-1 rounded-lg font-medium transition text-[11px] ${
                  paperWidth === '80mm'
                    ? 'bg-[#1677F3] text-white font-bold shadow-sm'
                    : 'text-[#64748B] hover:text-[#102A56]'
                }`}
                title="80 mm (3 inch) Standard Thermal Paper Roll"
              >
                80mm
              </button>
              <button
                type="button"
                onClick={() => setPaperWidth('a4')}
                className={`px-2.5 py-1 rounded-lg font-medium transition text-[11px] ${
                  paperWidth === 'a4'
                    ? 'bg-[#1677F3] text-white font-bold shadow-sm'
                    : 'text-[#64748B] hover:text-[#102A56]'
                }`}
                title="Standard A4 Invoice Sheet Fallback"
              >
                A4
              </button>
            </div>

            {/* Print Action Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold transition shadow-md shadow-[#1677F3]/20"
              title="Print receipt via browser print dialog (Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
              <span>Print</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-xl text-[#64748B] hover:text-[#102A56] hover:bg-slate-100 transition"
              title="Close receipt preview (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* =================================================================== */}
        {/* RECEIPT PREVIEW CANVAS                                              */}
        {/* =================================================================== */}
        <div className="p-4 sm:p-6 bg-slate-950/60 overflow-y-auto flex items-center justify-center">
          {/* Authentic Printable Thermal Receipt Slip */}
          <div
            id="printable-receipt"
            data-paper-width={paperWidth}
            className={`receipt-container receipt-paper-${paperWidth} w-full ${previewWidthClass} bg-white text-black p-5 sm:p-6 shadow-2xl rounded-2xl border border-slate-200 transition-all duration-200 font-sans`}
          >
            {/* Shop Header */}
            <div className="receipt-header text-center space-y-1 pb-3 receipt-dashed-line border-b border-dashed border-gray-400 print:border-black">
              <h1 className="text-base sm:text-lg font-black text-black tracking-tight uppercase leading-snug">
                {shop?.name || 'VoiceBill Kirana'}
              </h1>
              {shop?.owner_name && (
                <p className="text-[11px] text-gray-700 print:text-black">
                  Prop: {shop.owner_name}
                </p>
              )}
              {(shop?.address || shop?.city || shop?.pincode) && (
                <p className="text-[10px] text-gray-600 print:text-black leading-tight">
                  {[
                    shop.address,
                    shop.city,
                    shop.pincode ? `PIN-${shop.pincode}` : null,
                  ]
                    .filter(Boolean)
                    .join(', ')}
                </p>
              )}
              {shop?.phone && (
                <p className="text-[10px] font-mono text-gray-700 print:text-black font-semibold">
                  Phone: {shop.phone}
                </p>
              )}
              {shop?.gst_number && (
                <p className="text-[10px] font-mono text-gray-800 print:text-black font-bold tracking-wider">
                  GSTIN: {shop.gst_number}
                </p>
              )}
            </div>

            {/* Receipt Metadata */}
            <div className="receipt-meta py-2 receipt-dashed-line border-b border-dashed border-gray-400 print:border-black text-[11px] font-mono leading-tight space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-gray-600 print:text-black font-sans">Receipt #:</span>
                <span className="font-bold text-black">{sale.receipt_number}</span>
              </div>
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-gray-600 print:text-black font-sans">Date:</span>
                <span className="text-black font-medium">{formattedDate}</span>
              </div>
              <div className="flex justify-between items-center text-[10.5px]">
                <span className="text-gray-600 print:text-black font-sans">Time:</span>
                <span className="text-black font-medium">{formattedTime}</span>
              </div>
              <div className="flex justify-between items-center pt-0.5">
                <span className="text-gray-600 print:text-black font-sans">Payment:</span>
                <span className="font-bold uppercase text-black">
                  {sale.payment_method} ({sale.payment_status})
                </span>
              </div>
            </div>

            {/* Purchased Items List */}
            <div className="py-2.5">
              {paperWidth === '58mm' ? (
                /* 58mm Thermal 2-line layout for high readability on 48mm printable roll */
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] font-mono font-bold text-gray-500 print:text-black uppercase border-b border-dashed border-gray-300 print:border-black pb-1">
                    <span>Item & Qty</span>
                    <span>Amount</span>
                  </div>
                  {sale.items.map((item, idx) => (
                    <div
                      key={item.id ?? idx}
                      className="receipt-item-row border-b border-dotted border-gray-200 print:border-gray-400 pb-1.5 last:border-b-0"
                    >
                      <div className="font-bold text-xs text-black leading-tight break-words">
                        {idx + 1}. {item.product_name}
                      </div>
                      <div className="flex items-center justify-between text-[11px] font-mono text-gray-800 print:text-black mt-0.5">
                        <span>
                          {formatQuantity(item.quantity, item.unit)} {item.unit} × ₹
                          {Number(item.unit_price).toFixed(2)}
                        </span>
                        <span className="font-bold text-black">
                          ₹{Number(item.line_total).toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                /* 80mm & A4 Structured 4-column Table */
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-dashed border-gray-400 print:border-black text-[10px] uppercase font-bold text-gray-600 print:text-black font-mono">
                      <th className="py-1 text-left"># Item</th>
                      <th className="py-1 text-center w-20">Qty</th>
                      <th className="py-1 text-right w-20">Rate</th>
                      <th className="py-1 text-right w-24">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-dotted divide-gray-200 print:divide-gray-400">
                    {sale.items.map((item, idx) => (
                      <tr key={item.id ?? idx} className="receipt-item-row text-black">
                        <td className="py-1.5 pr-2 font-medium break-words leading-tight">
                          <div className="font-bold">
                            {idx + 1}. {item.product_name}
                          </div>
                          <div className="text-[10px] text-gray-500 print:text-black font-mono">
                            Unit: {item.unit}
                          </div>
                        </td>
                        <td className="py-1.5 text-center font-mono whitespace-nowrap">
                          {formatQuantity(item.quantity, item.unit)}
                        </td>
                        <td className="py-1.5 text-right font-mono whitespace-nowrap">
                          ₹{Number(item.unit_price).toFixed(2)}
                        </td>
                        <td className="py-1.5 text-right font-mono font-bold whitespace-nowrap">
                          ₹{Number(item.line_total).toFixed(2)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Totals & Financial Breakdown */}
            <div className="receipt-totals pt-2 receipt-dashed-line border-t border-dashed border-gray-400 print:border-black space-y-1 text-xs">
              <div className="flex justify-between text-gray-700 print:text-black font-mono text-[11px]">
                <span className="font-sans">Total Items:</span>
                <span className="font-bold">{sale.items.length}</span>
              </div>

              <div className="flex justify-between text-gray-700 print:text-black font-mono text-[11px]">
                <span className="font-sans">Subtotal:</span>
                <span>₹{Number(sale.subtotal).toFixed(2)}</span>
              </div>

              {Number(sale.discount_amount) > 0 && (
                <div className="flex justify-between text-black font-mono text-[11px]">
                  <span className="font-sans">Discount:</span>
                  <span>-₹{Number(sale.discount_amount).toFixed(2)}</span>
                </div>
              )}

              {Number(sale.tax_amount) > 0 && (
                <div className="flex justify-between text-gray-700 print:text-black font-mono text-[11px]">
                  <span className="font-sans">Tax (GST):</span>
                  <span>+₹{Number(sale.tax_amount).toFixed(2)}</span>
                </div>
              )}

              {/* Grand Total */}
              <div className="flex justify-between items-center pt-2 receipt-double-line border-t-2 border-b-2 border-black my-1 py-1 font-mono font-black text-sm">
                <span className="font-sans uppercase tracking-tight">Grand Total:</span>
                <span className="text-base text-black">
                  ₹{Number(sale.total_amount).toFixed(2)}
                </span>
              </div>

              {/* Payment Details (Cash Tender / Change or UPI Reference) */}
              {sale.payment_method === 'cash' && sale.amount_received != null && (
                <div className="pt-1.5 text-[11px] font-mono text-gray-800 print:text-black space-y-0.5">
                  <div className="flex justify-between">
                    <span className="font-sans">Cash Received:</span>
                    <span>₹{Number(sale.amount_received).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span className="font-sans">Change Returned:</span>
                    <span>₹{Number(sale.change_due ?? 0).toFixed(2)}</span>
                  </div>
                </div>
              )}

              {sale.payment_method === 'upi' && sale.payment_reference && (
                <div className="pt-1.5 text-[11px] font-mono text-gray-800 print:text-black flex justify-between">
                  <span className="font-sans">UPI Ref / UTR:</span>
                  <span className="font-bold">{sale.payment_reference}</span>
                </div>
              )}
            </div>

            {/* Footer Thank You Note */}
            <div className="receipt-footer pt-3 mt-2 receipt-dashed-line border-t border-dashed border-gray-400 print:border-black text-center space-y-1">
              <p className="text-xs font-bold text-black uppercase tracking-wider">
                Thank You! Visit Again
              </p>
              <p className="text-[9.5px] font-mono text-gray-600 print:text-black">
                VoiceBill.AI Smart Retail Platform
              </p>
            </div>
          </div>
        </div>

        {/* =================================================================== */}
        {/* MODAL BOTTOM ACTION BAR (Hidden during Print)                       */}
        {/* =================================================================== */}
        <div className="p-4 border-t border-[#E2E8F0] bg-white flex flex-col sm:flex-row items-center justify-between no-print gap-3">
          <div className="flex items-center space-x-2 text-xs text-[#64748B]">
            <Sliders className="w-3.5 h-3.5 text-[#1677F3]" />
            <span>
              Format:{' '}
              <strong className="text-[#102A56]">
                {paperWidth === '58mm'
                  ? '58mm Thermal Roll (2")'
                  : paperWidth === '80mm'
                    ? '80mm Thermal Roll (3")'
                    : 'A4 Standard Invoice'}
              </strong>
            </span>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl border border-[#E2E8F0] hover:bg-[#F8FAFC] text-[#64748B] hover:text-[#102A56] text-xs font-semibold transition"
            >
              Close
            </button>

            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold transition shadow-md shadow-[#1677F3]/20"
              title="Open browser print dialog (Ctrl+P)"
            >
              <Printer className="w-4 h-4" />
              <span>Print Receipt</span>
            </button>

            {onNewBill && (
              <button
                type="button"
                onClick={onNewBill}
                className="inline-flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-[#EFF6FF] hover:bg-[#DBEAFE] text-[#1677F3] text-xs font-bold transition border border-[#BFDBFE]"
              >
                <PlusCircle className="w-4 h-4 text-[#1677F3]" />
                <span>New Bill</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ReceiptModal;
