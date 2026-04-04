/**
 * Language Context for Guardian AI
 * Manages app language state with AsyncStorage persistence
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, Language, TranslationKey } from './translations';

const LANGUAGE_KEY = '@guardian_language';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => Promise<void>;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  isLanguageLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>('en');
  const [isLanguageLoaded, setIsLanguageLoaded] = useState(false);

  // Load saved language on mount
  useEffect(() => {
    const loadLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
        if (savedLanguage && (savedLanguage === 'en' || savedLanguage === 'ro')) {
          setLanguageState(savedLanguage);
        }
      } catch (error) {
        console.log('Error loading language:', error);
      } finally {
        setIsLanguageLoaded(true);
      }
    };
    loadLanguage();
  }, []);

  // Set and persist language
  const setLanguage = async (lang: Language) => {
    try {
      await AsyncStorage.setItem(LANGUAGE_KEY, lang);
      setLanguageState(lang);
    } catch (error) {
      console.log('Error saving language:', error);
    }
  };

  // Translation function with parameter support
  const t = (key: TranslationKey, params?: Record<string, string | number>): string => {
    let text = translations[language][key] || translations.en[key] || key;
    
    // Replace parameters like {count} with actual values
    if (params) {
      Object.entries(params).forEach(([paramKey, value]) => {
        text = text.replace(`{${paramKey}}`, String(value));
      });
    }
    
    return text;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, isLanguageLoaded }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
}

// Export a hook to check if language has been selected
export function useIsLanguageSelected() {
  const [isSelected, setIsSelected] = useState<boolean | null>(null);

  useEffect(() => {
    const checkLanguage = async () => {
      try {
        const savedLanguage = await AsyncStorage.getItem(LANGUAGE_KEY);
        setIsSelected(!!savedLanguage);
      } catch {
        setIsSelected(false);
      }
    };
    checkLanguage();
  }, []);

  return isSelected;
}
