import React, { createContext, useContext, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations } from '../i18n/translations';

const I18nContext = createContext({ lang: 'fr', t: (k) => k, setLang: () => {} });

export const I18nProvider = ({ children }) => {
  const [lang, setLangState] = useState('fr');

  const setLang = async (l) => {
    setLangState(l);
    await AsyncStorage.setItem('lang', l);
  };

  const t = (key, vars = {}) => {
    const dict = translations[lang] || translations.fr;
    let str = dict[key] || translations.fr[key] || key;
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, v);
    });
    return str;
  };

  return (
    <I18nContext.Provider value={{ lang, t, setLang, isAr: lang === 'ar' }}>
      {children}
    </I18nContext.Provider>
  );
};

export const useI18n = () => useContext(I18nContext);
