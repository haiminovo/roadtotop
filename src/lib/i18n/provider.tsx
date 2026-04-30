'use client';

import { createContext, useContext, useMemo } from "react";
import { DEFAULT_LOCALE, getMessages, type SupportedLocale } from "@/lib/i18n";
import type { AppCopy } from "@/lib/i18n/zh-cn";

type LocaleContextValue = {
  locale: SupportedLocale;
  messages: AppCopy;
  setLocale: (locale: SupportedLocale) => void;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const value = useMemo<LocaleContextValue>(() => ({
    locale: DEFAULT_LOCALE,
    messages: getMessages(),
    setLocale: () => {},
  }), []);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useI18n() {
  const context = useContext(LocaleContext);

  if (!context) {
    return {
      locale: DEFAULT_LOCALE,
      messages: getMessages(),
      setLocale: () => {},
    } satisfies LocaleContextValue;
  }

  return context;
}
