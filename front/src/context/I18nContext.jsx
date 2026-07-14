import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import translations from '../i18n/translations';

const I18nContext = createContext({
  lang: 'fr',
  setLang: () => {},
  t: (key) => key,
  isRtl: false,
});

const STORAGE_KEY = 'app-lang';

// Added 'de' as a supported language
const SUPPORTED_LANGS = ['fr', 'en', 'ar', 'de'];

const normalizeLang = (value) => (SUPPORTED_LANGS.includes(value) ? value : 'fr');

const getValue = (obj, key) => {
  if (!obj || !key) return undefined;
  return key.split('.').reduce((acc, part) => (acc != null ? acc[part] : undefined), obj);
};

const format = (value, vars) => {
  if (typeof value !== 'string') return value;
  return value.replace(/\{\{(\w+)\}\}/g, (match, name) => {
    if (Object.prototype.hasOwnProperty.call(vars, name)) {
      return String(vars[name]);
    }
    return match;
  });
};

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    return normalizeLang(saved);
  });

  const setLang = useCallback((next) => {
    setLangState(normalizeLang(next));
  }, []);

  useEffect(() => {
    const normalized = normalizeLang(lang);
    window.localStorage.setItem(STORAGE_KEY, normalized);
    document.documentElement.setAttribute('lang', normalized);
    document.documentElement.setAttribute('dir', normalized === 'ar' ? 'rtl' : 'ltr');
  }, [lang]);

  const t = useCallback((key, vars = {}) => {
    const primary = getValue(translations[lang], key);
    const fallback = getValue(translations.fr, key);
    const value = primary ?? fallback ?? key;
    return format(value, vars);
  }, [lang]);

  const value = useMemo(() => ({
    lang,
    setLang,
    t,
    isRtl: lang === 'ar',
  }), [lang, setLang, t]);

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  );
}

export const useI18n = () => useContext(I18nContext);