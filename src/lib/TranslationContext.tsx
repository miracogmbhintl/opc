import React, { createContext, useContext, useState, useEffect } from 'react';
import { Language, Translations, useTranslation as getTranslations } from './translations';

interface TranslationContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: Translations;
}

const TranslationContext = createContext<TranslationContextType | undefined>(undefined);

export function TranslationProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>('de');
  const t = getTranslations(language);

  console.log('🌐 TranslationProvider: Rendering', { language });

  // Load language from localStorage or user profile
  useEffect(() => {
    console.log('🌐 TranslationProvider: Loading saved language');
    try {
      const savedLanguage = localStorage.getItem('mco_language') as Language;
      if (savedLanguage && ['de', 'en', 'fr', 'es'].includes(savedLanguage)) {
        console.log('✅ Found saved language:', savedLanguage);
        setLanguageState(savedLanguage);
      } else {
        console.log('ℹ️ No saved language, using default: de');
      }
    } catch (error) {
      console.error('❌ Error loading language:', error);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('mco_language', lang);
  };

  return (
    <TranslationContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </TranslationContext.Provider>
  );
}

export function useTranslation() {
  const context = useContext(TranslationContext);
  if (context === undefined) {
    throw new Error('useTranslation must be used within a TranslationProvider');
  }
  return context;
}

