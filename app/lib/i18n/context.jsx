import { createContext, useContext, useMemo } from "react";
import { dictionaries } from "./dictionaries";

const I18nContext = createContext({ locale: "en" });

// Core translate: try the active locale, fall back to English, then to the key itself.
export function translate(locale, key, vars) {
  const dict = dictionaries[locale] || {};
  let str = dict[key] ?? dictionaries.en[key] ?? key;
  if (vars) {
    for (const k of Object.keys(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(vars[k]));
    }
  }
  return str;
}

export function I18nProvider({ locale = "en", children }) {
  const value = useMemo(() => ({ locale }), [locale]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

// Hook returning a bound t() for the current locale.
export function useT() {
  const { locale } = useContext(I18nContext);
  return useMemo(() => (key, vars) => translate(locale, key, vars), [locale]);
}

export function useLocale() {
  return useContext(I18nContext).locale;
}
