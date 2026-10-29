import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider } from './context';
import { MainLayout } from './layouts';
import {
  HomePage,
  VoiceProductPage,
  InventoryPage,
  BillingPage,
  SalesHistoryPage,
  LoginPage,
  RegisterPage,
} from './pages';

export const App: React.FC = () => {
  return (
    <AppProvider>
      <Router>
        <MainLayout>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/billing" element={<BillingPage />} />
            <Route path="/sales" element={<SalesHistoryPage />} />
            <Route path="/inventory" element={<InventoryPage />} />
            <Route path="/products/voice" element={<VoiceProductPage />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </MainLayout>
      </Router>
    </AppProvider>
  );
};

export default App;
