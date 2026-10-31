import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Printer, PlusCircle } from 'lucide-react';
import { useApp, ReceiptPaperWidth } from '../context';
import logoImg from '../assets/logo.png';

interface HeaderProps {
  onToggleMobile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobile }) => {
  const { user, isAuthenticated, paperWidth, setPaperWidth, language, setLanguage, t } = useApp();
  const location = useLocation();

  const handleCyclePaperWidth = () => {
    const nextWidth: Record<ReceiptPaperWidth, ReceiptPaperWidth> = {
      '58mm': '80mm',
      '80mm': 'a4',
      'a4': '58mm',
    };
    setPaperWidth(nextWidth[paperWidth]);
  };

  const getPageTitle = () => {
    switch (location.pathname) {
      case '/':        return t.navOverview;
      case '/billing': return t.navBilling;
      case '/sales':   return t.navSales;
      case '/inventory': return t.navInventory;
      case '/products/voice': return t.productEntryTitle;
      default:         return 'VoiceBill.AI';
    }
  };

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] sticky top-0 z-20 flex items-center px-4 sm:px-6 select-none">
      {/* ── Left: mobile toggle + page title ───────────────────── */}
      <div className="flex items-center gap-3 min-w-0 flex-1">
        {/* Mobile hamburger */}
        {onToggleMobile && (
          <button
            type="button"
            onClick={onToggleMobile}
            className="md:hidden flex-shrink-0 p-2 rounded-xl text-slate-500 hover:text-[#102A56] hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Mobile-only logo (sidebar is hidden on mobile) */}
        <div className="md:hidden flex-shrink-0 flex items-center gap-2">
          <img src={logoImg} alt="VoiceBill.AI" className="w-7 h-7 object-contain" />
        </div>

        {/* Page title — shown on sm+ */}
        <h1 className="hidden sm:block text-base font-extrabold text-[#102A56] tracking-tight truncate">
          {getPageTitle()}
        </h1>
        {/* Page title — mobile */}
        <h1 className="sm:hidden text-sm font-extrabold text-[#102A56] truncate">
          {getPageTitle()}
        </h1>
      </div>

      {/* ── Right: controls ─────────────────────────────────────── */}
      <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">

        {/* Language selector */}
        <div className="flex items-center rounded-xl bg-[#F8FAFC] border border-[#CBD5E1] p-0.5 gap-0.5">
          <button
            type="button"
            onClick={() => setLanguage('en')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              language === 'en'
                ? 'bg-[#1677F3] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#102A56]'
            }`}
            title="English"
          >
            EN
          </button>
          <button
            type="button"
            onClick={() => setLanguage('mr')}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-bold transition whitespace-nowrap ${
              language === 'mr'
                ? 'bg-[#1677F3] text-white shadow-sm'
                : 'text-[#64748B] hover:text-[#102A56]'
            }`}
            title="मराठी"
          >
            मराठी
          </button>
        </div>

        {/* Receipt format toggle */}
        <button
          type="button"
          onClick={handleCyclePaperWidth}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] text-xs font-bold transition whitespace-nowrap"
          title={`${t.receiptFormat}: ${paperWidth.toUpperCase()} — click to cycle`}
        >
          <Printer className="w-3.5 h-3.5 text-[#1677F3] flex-shrink-0" />
          <span className="font-mono text-[#102A56]">{paperWidth.toUpperCase()}</span>
        </button>

        {/* New Bill CTA — hidden on /billing page */}
        {location.pathname !== '/billing' && (
          <NavLink
            to="/billing"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold transition shadow-md shadow-[#1677F3]/20 whitespace-nowrap"
          >
            <PlusCircle className="w-4 h-4 flex-shrink-0" />
            <span>{t.newBill}</span>
          </NavLink>
        )}

        {/* User badge */}
        {isAuthenticated && user && (
          <div className="hidden md:flex items-center gap-2.5 pl-3 border-l border-[#E2E8F0]">
            <div className="w-8 h-8 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1677F3] flex items-center justify-center font-bold text-xs flex-shrink-0">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-left leading-tight">
              <p className="text-xs font-bold text-[#102A56] whitespace-nowrap">{user.name}</p>
              <p className="text-[10px] text-[#64748B] capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

export default Header;
