import React from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Mic,
  Printer,
  LogOut,
  X,
  Globe,
} from 'lucide-react';
import { useApp, ReceiptPaperWidth } from '../context';
import logoImg from '../assets/logo.png';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const { user, logout, paperWidth, setPaperWidth, language, setLanguage, t } = useApp();
  const location = useLocation();
  const navigate = useNavigate();

  const handleCyclePaperWidth = () => {
    const nextWidth: Record<ReceiptPaperWidth, ReceiptPaperWidth> = {
      '58mm': '80mm',
      '80mm': 'a4',
      'a4': '58mm',
    };
    setPaperWidth(nextWidth[paperWidth]);
  };

  const navItems = [
    { to: '/',               label: t.navOverview,       icon: LayoutDashboard, badge: null },
    { to: '/billing',        label: t.navBilling,        icon: ShoppingCart,    badge: 'POS' },
    { to: '/sales',          label: t.navSales,          icon: Receipt,         badge: null },
    { to: '/inventory',      label: t.navInventory,      icon: Package,         badge: null },
    {
      to: '/products/voice',
      label: t.navVoiceProducts,
      icon: Mic,
      badge: language === 'mr' ? 'व्हॉइस/मॅन्युअल' : 'Voice/Manual',
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-[#E2E8F0] select-none">

      {/* ── Brand header ───────────────────────────────────────── */}
      <div className="h-16 flex items-center justify-between px-5 border-b border-[#E2E8F0] flex-shrink-0">
        <NavLink
          to="/"
          onClick={onMobileClose}
          className="flex items-center gap-3 group"
        >
          <img
            src={logoImg}
            alt="VoiceBill.AI Logo"
            className="w-9 h-9 object-contain rounded-lg group-hover:scale-105 transition-transform flex-shrink-0"
          />
          <div className="leading-tight">
            <span className="block font-extrabold text-[15px] text-[#102A56] tracking-tight">
              VoiceBill<span className="text-[#1677F3]">.AI</span>
            </span>
            <span className="block text-[11px] text-[#64748B] font-medium">
              {language === 'mr' ? 'स्मार्ट किराणा POS' : 'Smart Kirana POS'}
            </span>
          </div>
        </NavLink>

        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 flex-shrink-0"
            aria-label="Close navigation"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* ── Nav links ──────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onMobileClose}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-sm font-semibold transition group ${
                isActive
                  ? 'bg-[#1677F3] text-white shadow-sm shadow-[#1677F3]/25'
                  : 'text-[#475569] hover:bg-[#F8FAFC] hover:text-[#102A56]'
              }`}
            >
              <div className="flex items-center gap-3">
                <Icon
                  className={`w-4 h-4 flex-shrink-0 transition-colors ${
                    isActive ? 'text-white' : 'text-[#64748B] group-hover:text-[#1677F3]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </div>

              {item.badge && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* ── Footer controls ────────────────────────────────────── */}
      <div className="px-4 py-4 border-t border-[#E2E8F0] space-y-2.5 bg-[#F8FAFC]/60 flex-shrink-0">

        {/* Language switcher */}
        <div className="flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-[#E2E8F0]">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#102A56]">
            <Globe className="w-3.5 h-3.5 text-[#1677F3] flex-shrink-0" />
            <span>{t.language}</span>
          </div>
          <div className="flex items-center rounded-lg bg-[#F8FAFC] border border-[#CBD5E1] p-0.5 gap-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                language === 'en' ? 'bg-[#1677F3] text-white' : 'text-[#64748B] hover:text-[#102A56]'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('mr')}
              className={`px-2 py-0.5 rounded font-bold transition ${
                language === 'mr' ? 'bg-[#1677F3] text-white' : 'text-[#64748B] hover:text-[#102A56]'
              }`}
            >
              मराठी
            </button>
          </div>
        </div>

        {/* Receipt format */}
        <button
          type="button"
          onClick={handleCyclePaperWidth}
          className="w-full flex items-center justify-between px-3 py-2.5 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#BFDBFE] text-xs transition"
          title="Click to cycle receipt printer format"
        >
          <div className="flex items-center gap-2 text-[#102A56]">
            <Printer className="w-3.5 h-3.5 text-[#1677F3] flex-shrink-0" />
            <span className="font-semibold">{t.receiptFormat}</span>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE]">
            {paperWidth.toUpperCase()}
          </span>
        </button>

        {/* User profile + logout */}
        {user && (
          <div className="flex items-center justify-between pt-0.5">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#1677F3] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0 leading-tight">
                <p className="text-xs font-bold text-[#102A56] truncate">{user.name}</p>
                <span className="text-[10px] font-semibold text-[#64748B] capitalize">{user.role}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition flex-shrink-0"
              title={t.logout}
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop persistent sidebar — exactly 256px wide */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen z-30">
        {content}
      </aside>

      {/* Mobile drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm"
            onClick={onMobileClose}
          />
          <div className="relative w-72 max-w-[85vw] h-full shadow-2xl z-10 animate-in slide-in-from-left duration-200">
            {content}
          </div>
        </div>
      )}
    </>
  );
};

export default Sidebar;
