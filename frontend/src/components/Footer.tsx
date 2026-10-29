import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="border-t border-[#E2E8F0] bg-white py-4 text-xs text-[#64748B]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2">
        <p className="font-medium text-[#102A56]">© 2026 VoiceBill.AI — Smart Kirana Billing Platform</p>
        <p className="text-[11px] text-[#64748B]">Designed for Indian Retail & Supermarket POS Operations</p>
      </div>
    </footer>
  );
};

