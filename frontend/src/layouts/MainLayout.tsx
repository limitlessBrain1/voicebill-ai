import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { Header, Footer, Sidebar } from '../components';
import { useApp } from '../context';
import logoImg from '../assets/logo.png';

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const { isAuthenticated, isLoadingAuth } = useApp();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isPublicMobileNavOpen, setIsPublicMobileNavOpen] = useState(false);

  // While checking auth, provide smooth light container
  if (isLoadingAuth) {
    return (
      <div className="min-h-screen bg-[#F5F8FC] flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <img src={logoImg} alt="VoiceBill.AI" className="w-12 h-12 object-contain animate-pulse" />
          <p className="text-xs font-semibold text-[#64748B]">Loading VoiceBill.AI...</p>
        </div>
      </div>
    );
  }

  // Authenticated Layout: Fixed Sidebar on desktop + Header + Main Area + Footer
  if (isAuthenticated) {
    return (
      <div className="h-screen flex bg-[#F5F8FC] text-[#102A56] overflow-hidden font-sans">
        {/* Desktop Sidebar (w-64) & Mobile Drawer */}
        <Sidebar
          isMobileOpen={isMobileOpen}
          onMobileClose={() => setIsMobileOpen(false)}
        />

        {/* Content Column: flex-1, fills height, no outer scroll */}
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {/* Sticky top header — h-16 matches sidebar brand row */}
          <Header onToggleMobile={() => setIsMobileOpen(!isMobileOpen)} />

          {/* Page content: scrollable area fills remaining height */}
          <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
            <div className="max-w-7xl mx-auto w-full">
              {children}
            </div>
          </main>

          {/* Footer pinned below scroll area, always visible at bottom */}
          <Footer />
        </div>
      </div>
    );
  }

  // Public / Unauthenticated Layout: Integrated Sticky Header + Full-Width Content + Editorial Footer
  return (
    <div className="min-h-screen flex flex-col bg-[#F5F8FC] text-[#102A56] font-sans">
      {/* Public Top Navbar */}
      <header className="h-16 bg-white border-b border-[#E2E8F0] sticky top-0 z-40">
        <div className="max-w-7xl mx-auto h-full px-4 sm:px-6 lg:px-8 flex items-center justify-between">
          {/* Left: Brand Logo & Wordmark */}
          <NavLink to="/" className="flex items-center space-x-3 group">
            <img
              src={logoImg}
              alt="VoiceBill.AI Logo"
              className="w-9 h-9 object-contain rounded-lg group-hover:scale-105 transition-transform"
            />
            <div>
              <span className="font-extrabold text-lg text-[#102A56] tracking-tight">
                VoiceBill<span className="text-[#1677F3]">.AI</span>
              </span>
              <p className="hidden sm:block text-[10px] text-[#64748B] font-medium leading-none">
                Smart Kirana Billing
              </p>
            </div>
          </NavLink>

          {/* Center: Section Links */}
          <nav className="hidden md:flex items-center space-x-8">
            <a
              href="/#product"
              className="text-xs font-semibold text-[#475569] hover:text-[#1677F3] transition"
            >
              Product
            </a>
            <a
              href="/#capabilities"
              className="text-xs font-semibold text-[#475569] hover:text-[#1677F3] transition"
            >
              Features
            </a>
            <a
              href="/#how-it-works"
              className="text-xs font-semibold text-[#475569] hover:text-[#1677F3] transition"
            >
              How It Works
            </a>
          </nav>

          {/* Desktop Actions */}
          <div className="hidden sm:flex items-center space-x-3">
            <NavLink
              to="/login"
              className="text-xs font-semibold text-[#102A56] hover:text-[#1677F3] px-3.5 py-2 rounded-lg transition"
            >
              Login
            </NavLink>
            <NavLink
              to="/register"
              className="px-5 py-2 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white text-xs font-bold transition shadow-sm shadow-[#1677F3]/25"
            >
              Sign Up
            </NavLink>
          </div>

          {/* Mobile Menu Toggle Button */}
          <div className="flex md:hidden items-center space-x-2">
            <NavLink
              to="/login"
              className="text-xs font-semibold text-[#102A56] hover:text-[#1677F3] px-2.5 py-1.5"
            >
              Login
            </NavLink>
            <button
              type="button"
              onClick={() => setIsPublicMobileNavOpen(!isPublicMobileNavOpen)}
              className="p-2 rounded-lg border border-[#E2E8F0] text-[#102A56] hover:bg-[#F8FAFC]"
              aria-label="Toggle navigation menu"
            >
              <svg
                className="w-5 h-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                {isPublicMobileNavOpen ? (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                ) : (
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                )}
              </svg>
            </button>
          </div>
        </div>

        {/* Mobile Dropdown Menu */}
        {isPublicMobileNavOpen && (
          <div className="md:hidden bg-white border-b border-[#E2E8F0] px-4 pt-2 pb-4 space-y-2 shadow-lg animate-in fade-in duration-150">
            <a
              href="/#product"
              onClick={() => setIsPublicMobileNavOpen(false)}
              className="block px-3 py-2 text-xs font-semibold text-[#475569] hover:text-[#1677F3] rounded-lg"
            >
              Product
            </a>
            <a
              href="/#capabilities"
              onClick={() => setIsPublicMobileNavOpen(false)}
              className="block px-3 py-2 text-xs font-semibold text-[#475569] hover:text-[#1677F3] rounded-lg"
            >
              Features
            </a>
            <a
              href="/#how-it-works"
              onClick={() => setIsPublicMobileNavOpen(false)}
              className="block px-3 py-2 text-xs font-semibold text-[#475569] hover:text-[#1677F3] rounded-lg"
            >
              How It Works
            </a>
            <div className="pt-2 border-t border-[#E2E8F0] flex gap-2">
              <NavLink
                to="/register"
                onClick={() => setIsPublicMobileNavOpen(false)}
                className="flex-1 text-center py-2.5 rounded-xl bg-[#1677F3] text-white text-xs font-bold"
              >
                Sign Up
              </NavLink>
            </div>
          </div>
        )}
      </header>

      {/* Main Public Content: Full width with children managing sections */}
      <main className="flex-1 w-full">
        {children}
      </main>

      <Footer />
    </div>
  );
};

export default MainLayout;
