'use client';

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { DEFAULT_LOCALE, getMessages, isSupportedLocale, type SupportedLocale } from "@/lib/i18n";
import type { AppCopy } from "@/lib/i18n/zh-cn";

const LOCALE_STORAGE_KEY = "roadtotop.locale";

type LocaleContextValue = {
  locale: SupportedLocale;
  messages: AppCopy;
  setLocale: (locale: SupportedLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

function resolveInitialLocale(): SupportedLocale {
  if (typeof window === "undefined") {
    return DEFAULT_LOCALE;
  }

  const storedLocale = window.localStorage.getItem(LOCALE_STORAGE_KEY);

  if (isSupportedLocale(storedLocale)) {
    return storedLocale;
  }

  const browserLocale = window.navigator.language;

  if (isSupportedLocale(browserLocale)) {
    return browserLocale;
  }

  if (browserLocale.toLowerCase().startsWith("en")) {
    return "en-US";
  }

  return DEFAULT_LOCALE;
}

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(DEFAULT_LOCALE);

  useEffect(() => {
    setLocaleState(resolveInitialLocale());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem(LOCALE_STORAGE_KEY, locale);
    document.documentElement.lang = locale;
    document.title = getMessages(locale).app.title;
  }, [locale]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    messages: getMessages(locale),
    setLocale: setLocaleState,
  }), [locale]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);

  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      messages: getMessages(DEFAULT_LOCALE),
      setLocale: () => {},
    } satisfies LocaleContextValue;
  }

  return context;
}
