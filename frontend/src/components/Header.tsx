import React from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { Menu, Printer, ShieldCheck, ShoppingCart } from 'lucide-react';
import { useApp, ReceiptPaperWidth } from '../context';
import logoImg from '../assets/logo.png';

interface HeaderProps {
  onToggleMobile?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ onToggleMobile }) => {
  const { user, isAuthenticated, paperWidth, setPaperWidth, storeName } = useApp();
  const location = useLocation();

  const handleCyclePaperWidth = () => {
    const nextWidth: Record<ReceiptPaperWidth, ReceiptPaperWidth> = {
      '58mm': '80mm',
      '80mm': 'a4',
      'a4': '58mm',
    };
    setPaperWidth(nextWidth[paperWidth]);
  };

  const getPageInfo = () => {
    switch (location.pathname) {
      case '/':
        return { title: 'Overview', subtitle: 'Store performance & quick actions' };
      case '/billing':
        return { title: 'Billing Counter', subtitle: 'Fast retail cart & instant checkout' };
      case '/sales':
        return { title: 'Sales History', subtitle: 'Audit ledger & customer thermal receipts' };
      case '/inventory':
        return { title: 'Products & Inventory', subtitle: 'Stock quantities, pricing & catalog' };
      case '/products/voice':
        return { title: 'Voice Product Entry', subtitle: 'Batch product creation from speech commands' };
      default:
        return { title: 'VoiceBill.AI', subtitle: 'Retail POS & Kirana Billing' };
    }
  };

  const pageInfo = getPageInfo();

  return (
    <header className="h-16 bg-white border-b border-[#E2E8F0] sticky top-0 z-20 flex items-center justify-between px-4 sm:px-6 lg:px-8 select-none">
      {/* Left: Mobile Menu Toggle & Page Context */}
      <div className="flex items-center space-x-3 sm:space-x-4">
        {onToggleMobile && (
          <button
            type="button"
            onClick={onToggleMobile}
            className="md:hidden p-2 rounded-xl text-slate-500 hover:text-[#102A56] hover:bg-slate-100 transition"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        {/* Small Logo for mobile if sidebar is hidden */}
        <div className="flex items-center space-x-2 md:hidden">
          <img src={logoImg} alt="VoiceBill.AI" className="w-7 h-7 object-contain" />
        </div>

        {/* Breadcrumb / Page Title */}
        <div className="hidden sm:block">
          <div className="flex items-center space-x-2">
            <h1 className="text-base font-extrabold text-[#102A56] tracking-tight">
              {pageInfo.title}
            </h1>
            <span className="text-slate-300">/</span>
            <span className="text-xs text-[#64748B] font-medium hidden lg:inline">
              {pageInfo.subtitle}
            </span>
          </div>
        </div>

        <div className="sm:hidden">
          <h1 className="text-sm font-extrabold text-[#102A56] truncate">
            {pageInfo.title}
          </h1>
        </div>
      </div>

      {/* Right: Operational Status & Controls */}
      <div className="flex items-center space-x-3">
        {/* System Status Pill */}
        <div className="hidden sm:flex items-center space-x-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>System Connected</span>
        </div>

        {/* Quick Receipt Printer Toggle */}
        <button
          type="button"
          onClick={handleCyclePaperWidth}
          className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-[#F8FAFC] hover:bg-[#EFF6FF] border border-[#E2E8F0] hover:border-[#BFDBFE] text-xs transition"
          title={`Active Receipt Format: ${paperWidth.toUpperCase()} (Click to toggle)`}
        >
          <Printer className="w-3.5 h-3.5 text-[#1677F3]" />
          <span className="font-mono font-bold text-[#102A56]">{paperWidth.toUpperCase()}</span>
        </button>

        {/* Fast New Bill Link on smaller screens if not on /billing */}
        {location.pathname !== '/billing' && (
          <NavLink
            to="/billing"
            className="hidden sm:inline-flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold transition shadow-sm"
          >
            <ShoppingCart className="w-3.5 h-3.5" />
            <span>New Bill</span>
          </NavLink>
        )}

        {/* User Badge if authenticated */}
        {isAuthenticated && user && (
          <div className="hidden md:flex items-center space-x-2 pl-2 border-l border-[#E2E8F0]">
            <div className="w-7 h-7 rounded-full bg-[#EFF6FF] border border-[#BFDBFE] text-[#1677F3] flex items-center justify-center font-bold text-xs">
              {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="text-left">
              <p className="text-xs font-bold text-[#102A56] leading-none">{user.name}</p>
              <p className="text-[10px] text-[#64748B] capitalize">{user.role}</p>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};
