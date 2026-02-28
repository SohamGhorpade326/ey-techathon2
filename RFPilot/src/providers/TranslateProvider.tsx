import React, { createContext, useContext, useEffect, useRef, useState } from "react";

type Translations = { [key: string]: string };

interface TranslateContextValue {
  lang: string;
  setLang: (l: string) => void;
  t: (key: string, fallback?: string) => string;
  translateNow: (text: string) => Promise<string>;
  registerText: (key: string, englishText: string) => void;
  prefetch: (l: string) => Promise<void>;
}

const TranslateContext = createContext<TranslateContextValue | null>(null);

const API_BASE = (import.meta as any).env?.VITE_API_URL || "http://127.0.0.1:8000";

const STORAGE_LANG = "app_lang";
const STORAGE_CACHE = "translation_cache";
const STORAGE_ORIGINALS = "original_texts";

const normalizeKey = (s: string) => (s || "").replace(/\s+/g, " ").trim();

export const TranslateProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const saved = typeof window !== "undefined" ? localStorage.getItem(STORAGE_LANG) : null;
  const [lang, setLangState] = useState<string>(saved || "en");

  const initialOriginals = (() => {
    try {
      const raw = localStorage.getItem(STORAGE_ORIGINALS) || "{}";
      return JSON.parse(raw);
    } catch (e) {
      return {} as Record<string, string>;
    }
  })();

  // original English texts: key -> english
  const originalsRef = useRef<Record<string, string>>(initialOriginals);

  // translation cache: lang -> { key -> translated }
  const [translationCache, setTranslationCache] = useState<Record<string, Translations>>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_CACHE) || "{}";
      return JSON.parse(raw);
    } catch (e) {
      return {} as Record<string, Translations>;
    }
  });

  // in-flight requests to prevent duplicate API calls
  const pendingRequests = useRef<Record<string, Promise<string>>>({});

  // persist lang
  useEffect(() => {
    try { localStorage.setItem(STORAGE_LANG, lang); } catch (e) {}
  }, [lang]);

  // save cache when it changes
  useEffect(() => {
    try { localStorage.setItem(STORAGE_CACHE, JSON.stringify(translationCache)); } catch (e) {}
  }, [translationCache]);

  // save originals when they change (we mutate originalsRef.current via registerText)
  const saveOriginals = () => {
    try { localStorage.setItem(STORAGE_ORIGINALS, JSON.stringify(originalsRef.current)); } catch (e) {}
  };

  const setLang = (l: string) => setLangState(l);

  const saveCache = (updater: (prev: Record<string, Translations>) => Record<string, Translations>) => {
    setTranslationCache(prev => {
      const next = updater(prev);
      try { localStorage.setItem(STORAGE_CACHE, JSON.stringify(next)); } catch (e) {}
      return next;
    });
  };

  const translateAPI = async (text: string, targetLang: string) => {
    try {
      const resp = await fetch(`${API_BASE}/translate`, { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify({ text, lang: targetLang }) });
      const d = await resp.json();
      return d.translated || text;
    } catch (e) {
      return text;
    }
  };

  const translateKey = async (key: string, text: string) => {
    const k = normalizeKey(key);
    if (lang === 'en') return text;
    // use cache
    if (translationCache[lang] && translationCache[lang][k]) return translationCache[lang][k];

    const pendingKey = `${lang}::${k}`;
    if (pendingRequests.current[pendingKey]) return pendingRequests.current[pendingKey];

    const p = (async () => {
      const translated = await translateAPI(text, lang);
      saveCache(prev => {
        const next = { ...(prev || {}) };
        next[lang] = next[lang] || {};
        next[lang][k] = translated;
        return next;
      });
      delete pendingRequests.current[pendingKey];
      return translated;
    })();
    pendingRequests.current[pendingKey] = p;
    return p;
  };

  const registerText = (key: string, englishText: string) => {
    const k = normalizeKey(key);
    if (!originalsRef.current[k]) {
      originalsRef.current[k] = englishText;
      saveOriginals();
    }
    // if current language is non-English, ensure missing translation is fetched (but don't block render)
    if (lang !== 'en') {
      const exists = translationCache[lang] && translationCache[lang][k];
      if (!exists) {
        // fire and forget
        translateKey(k, originalsRef.current[k] || englishText).catch(() => {});
      }
    }
  };

  const translateNow = async (text: string) => {
    if (!text) return text;
    if (lang === 'en') return text;
    return translateAPI(text, lang);
  };

  const t = (key: string, fallback?: string) => {
    const k = normalizeKey(key);
    // auto-register fallback as original if not already registered
    if (!originalsRef.current[k] && fallback) {
      originalsRef.current[k] = fallback;
      saveOriginals();
      // kick off background translation for current language if needed
      if (lang !== 'en') {
        translateKey(k, fallback).catch(() => {});
      }
    }

    if (lang === 'en') return originalsRef.current[k] || fallback || key;

    return (translationCache[lang] && translationCache[lang][k]) || originalsRef.current[k] || fallback || key;
  };

  const prefetch = async (l: string) => {
    if (!l || l === 'en') return;
    try {
      const resp = await fetch(`/locales/${l}.json`);
      if (!resp.ok) return;
      const json = await resp.json();
      // normalize keys and merge without overwriting existing cache
      const norm: Record<string, string> = {};
      Object.keys(json || {}).forEach(k => { norm[normalizeKey(k)] = json[k]; });
      saveCache(prev => {
        const next = { ...(prev || {}) };
        next[l] = { ...(next[l] || {}), ...norm };
        return next;
      });
    } catch (e) {
      // ignore
    }
  };

  // when lang changes to a non-English language, prefetch static locales and ensure translations for registered keys
  useEffect(() => {
    if (lang === 'en') return;
    (async () => {
      await prefetch(lang);
      // translate missing registered originals using a batched backend endpoint to avoid many small requests
      const originals = { ...(originalsRef.current || {}) };
      const keys = Object.keys(originals || {});
      const missing = keys.filter(k => !(translationCache[lang] && translationCache[lang][k]));
      if (!missing.length) return;

      try {
        const items = missing.map(k => ({ key: k, text: originals[k] }));
        const resp = await fetch(`${API_BASE}/translate-batch`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ items, lang })
        });
        if (resp.ok) {
          const json = await resp.json();
          const translations = json.translations || {};
          saveCache(prev => {
            const next = { ...(prev || {}) };
            next[lang] = { ...(next[lang] || {}) };
            Object.keys(translations).forEach(k => { next[lang][k] = translations[k]; });
            return next;
          });
        } else {
          // fallback to per-key translation if batch fails
          for (const k of missing) translateKey(k, originals[k]).catch(() => {});
        }
      } catch (e) {
        // network or other error: fallback to individual translations
        for (const k of missing) translateKey(k, originals[k]).catch(() => {});
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lang]);

  const ctx: TranslateContextValue = {
    lang,
    setLang,
    t,
    translateNow,
    registerText,
    prefetch
  };

  return (
    <TranslateContext.Provider value={ctx}>
      {children}
    </TranslateContext.Provider>
  );
};

export const useTranslateProvider = () => {
  const ctx = useContext(TranslateContext);
  if (!ctx) throw new Error("useTranslate must be used within TranslateProvider");
  return ctx;
};
