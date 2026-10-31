import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { UserResponse, getCurrentUser, loginUser } from '../services/api';
import { Language, Translations, translations } from '../i18n/translations';

export type ReceiptPaperWidth = '58mm' | '80mm' | 'a4';

interface AppContextType {
  storeName: string;
  setStoreName: (name: string) => void;
  user: UserResponse | null;
  token: string | null;
  isAuthenticated: boolean;
  isOwner: boolean;
  isLoadingAuth: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
  setTokenDirectly: (token: string) => void;
  paperWidth: ReceiptPaperWidth;
  setPaperWidth: (width: ReceiptPaperWidth) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [storeName, setStoreName] = useState<string>('');
  
  // Language State with persistence
  const [language, setLanguageState] = useState<Language>(() => {
    const saved = localStorage.getItem('voicebill_language');
    return (saved === 'mr' || saved === 'en') ? saved : 'en';
  });

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem('voicebill_language', lang);
    } catch (e) {
      console.warn('Failed to save language preference:', e);
    }
  };

  const t = translations[language];

  // Paper width state
  const [paperWidth, setPaperWidthState] = useState<ReceiptPaperWidth>(() => {
    const saved = localStorage.getItem('voicebill_receipt_paper_width');
    return (saved === '58mm' || saved === '80mm' || saved === 'a4') ? saved : '58mm';
  });

  const setPaperWidth = (width: ReceiptPaperWidth) => {
    setPaperWidthState(width);
    try {
      localStorage.setItem('voicebill_receipt_paper_width', width);
    } catch (e) {
      console.warn('Failed to save paper width preference:', e);
    }
  };

  const [user, setUser] = useState<UserResponse | null>(null);
  const [token, setToken] = useState<string | null>(() => {
    return localStorage.getItem('token') || localStorage.getItem('access_token');
  });
  const [isLoadingAuth, setIsLoadingAuth] = useState<boolean>(true);

  const refreshUser = useCallback(async () => {
    const currentToken = localStorage.getItem('token') || localStorage.getItem('access_token');
    if (!currentToken) {
      setUser(null);
      setIsLoadingAuth(false);
      return;
    }

    try {
      setIsLoadingAuth(true);
      const userData = await getCurrentUser();
      setUser(userData);
      setStoreName(userData.shop_name || '');
    } catch {
      setUser(null);
      setToken(null);
      localStorage.removeItem('token');
      localStorage.removeItem('access_token');
    } finally {
      setIsLoadingAuth(false);
    }
  }, []);

  useEffect(() => {
    refreshUser();
  }, [refreshUser]);

  const login = async (email: string, password: string) => {
    const res = await loginUser(email, password);
    setToken(res.access_token);
    setUser(res.user);
    setStoreName(res.user.shop_name || '');
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('access_token');
    setToken(null);
    setUser(null);
  };

  const setTokenDirectly = (newToken: string) => {
    localStorage.setItem('token', newToken);
    localStorage.setItem('access_token', newToken);
    setToken(newToken);
    refreshUser();
  };

  const isAuthenticated = !!token && !!user;
  const isOwner = user?.role === 'owner';

  return (
    <AppContext.Provider
      value={{
        storeName,
        setStoreName,
        user,
        token,
        isAuthenticated,
        isOwner,
        isLoadingAuth,
        login,
        logout,
        refreshUser,
        setTokenDirectly,
        paperWidth,
        setPaperWidth,
        language,
        setLanguage,
        t,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};

export default AppContext;
