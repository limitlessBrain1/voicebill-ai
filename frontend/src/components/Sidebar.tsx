import React, { useState } from 'react';
import { NavLink, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  ShoppingCart,
  Receipt,
  Package,
  Mic,
  Printer,
  LogOut,
  User as UserIcon,
  PlusCircle,
  Menu,
  X,
  Store,
  ChevronRight,
} from 'lucide-react';
import { useApp, ReceiptPaperWidth } from '../context';
import logoImg from '../assets/logo.png';

interface SidebarProps {
  isMobileOpen?: boolean;
  onMobileClose?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen = false, onMobileClose }) => {
  const { user, storeName, logout, paperWidth, setPaperWidth } = useApp();
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
    {
      to: '/',
      label: 'Overview',
      icon: LayoutDashboard,
      badge: null,
    },
    {
      to: '/billing',
      label: 'Billing Counter',
      icon: ShoppingCart,
      badge: 'Fast POS',
      isPrimaryAction: true,
    },
    {
      to: '/sales',
      label: 'Sales History',
      icon: Receipt,
      badge: null,
    },
    {
      to: '/inventory',
      label: 'Products & Inventory',
      icon: Package,
      badge: null,
    },
    {
      to: '/products/voice',
      label: 'Voice Product Entry',
      icon: Mic,
      badge: 'AI Batch',
    },
  ];

  const content = (
    <div className="flex flex-col h-full bg-white border-r border-[#E2E8F0] select-none">
      {/* Brand & Logo Header */}
      <div className="p-5 border-b border-[#E2E8F0] flex items-center justify-between">
        <NavLink
          to="/"
          onClick={onMobileClose}
          className="flex items-center space-x-3 group"
        >
          <img
            src={logoImg}
            alt="VoiceBill.AI Logo"
            className="w-9 h-9 object-contain rounded-lg group-hover:scale-105 transition-transform"
          />
          <div>
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-lg text-[#102A56] tracking-tight">
                VoiceBill<span className="text-[#1677F3]">.AI</span>
              </span>
            </div>
            <p className="text-[11px] text-[#64748B] font-medium leading-none">
              Smart Kirana POS
            </p>
          </div>
        </NavLink>

        {onMobileClose && (
          <button
            type="button"
            onClick={onMobileClose}
            className="md:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Prominent Action: New Bill CTA */}
      <div className="p-4 pb-2">
        <button
          type="button"
          onClick={() => {
            navigate('/billing');
            if (onMobileClose) onMobileClose();
          }}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-sm shadow-md shadow-[#1677F3]/20 transition-all hover:shadow-lg hover:shadow-[#1677F3]/30 active:scale-[0.98]"
        >
          <PlusCircle className="w-4 h-4" />
          <span>+ Start New Bill</span>
        </button>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-[10px] font-bold uppercase tracking-wider text-[#64748B] mb-2">
          Operations
        </p>
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = location.pathname === item.to;

          return (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onMobileClose}
              className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                isActive
                  ? 'bg-[#EFF6FF] text-[#1677F3] font-bold shadow-sm'
                  : 'text-[#102A56] hover:bg-[#F8FAFC] hover:text-[#1677F3]'
              }`}
            >
              <div className="flex items-center space-x-3">
                <Icon
                  className={`w-4 h-4 ${
                    isActive ? 'text-[#1677F3]' : 'text-[#64748B]'
                  }`}
                />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    isActive
                      ? 'bg-[#1677F3] text-white'
                      : 'bg-slate-100 text-[#64748B]'
                  }`}
                >
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Bottom Store & Device Controls */}
      <div className="p-4 border-t border-[#E2E8F0] space-y-3 bg-[#F8FAFC]">
        {/* Active Store Display */}
        <div className="flex items-center space-x-2.5 px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] shadow-subtle">
          <Store className="w-4 h-4 text-[#1677F3] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] text-[#64748B] font-medium leading-none">Active Store</p>
            <p className="text-xs font-bold text-[#102A56] truncate mt-0.5">
              {storeName || 'Apna Kirana Store'}
            </p>
          </div>
        </div>

        {/* Thermal Print Format Selector */}
        <button
          type="button"
          onClick={handleCyclePaperWidth}
          className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-white border border-[#E2E8F0] hover:border-[#BFDBFE] text-xs transition shadow-subtle"
          title="Click to cycle receipt printer format"
        >
          <div className="flex items-center space-x-2 text-[#102A56]">
            <Printer className="w-3.5 h-3.5 text-[#1677F3]" />
            <span className="font-semibold text-xs">Receipt Printer</span>
          </div>
          <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-[#EFF6FF] text-[#1677F3] border border-[#BFDBFE]">
            {paperWidth.toUpperCase()}
          </span>
        </button>

        {/* User Profile & Logout */}
        {user && (
          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center space-x-2.5 min-w-0">
              <div className="w-8 h-8 rounded-full bg-[#1677F3] text-white flex items-center justify-center font-bold text-xs flex-shrink-0">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold text-[#102A56] truncate leading-tight">
                  {user.name}
                </p>
                <span className="text-[10px] font-semibold text-[#64748B] capitalize">
                  {user.role}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition"
              title="Sign Out"
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
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex flex-col w-64 flex-shrink-0 sticky top-0 h-screen z-30">
        {content}
      </aside>

      {/* Mobile Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm transition-opacity"
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
