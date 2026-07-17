// Languages serve two purposes:
//  1. APP UI language — the merchant switches the dashboard to their own language.
//  2. PRODUCT WARNING language — GPSR requires safety text in the buyer's country language.
// Both draw from this same list.

// The 24 official languages of the EU (warnings legally required in these).
export const EU_OFFICIAL_LANGUAGES = [
  { code: "bg", name: "Bulgarian", native: "Български", country: "BG" },
  { code: "hr", name: "Croatian", native: "Hrvatski", country: "HR" },
  { code: "cs", name: "Czech", native: "Čeština", country: "CZ" },
  { code: "da", name: "Danish", native: "Dansk", country: "DK" },
  { code: "nl", name: "Dutch", native: "Nederlands", country: "NL" },
  { code: "en", name: "English", native: "English", country: "IE" },
  { code: "et", name: "Estonian", native: "Eesti", country: "EE" },
  { code: "fi", name: "Finnish", native: "Suomi", country: "FI" },
  { code: "fr", name: "French", native: "Français", country: "FR" },
  { code: "de", name: "German", native: "Deutsch", country: "DE" },
  { code: "el", name: "Greek", native: "Ελληνικά", country: "GR" },
  { code: "hu", name: "Hungarian", native: "Magyar", country: "HU" },
  { code: "ga", name: "Irish", native: "Gaeilge", country: "IE" },
  { code: "it", name: "Italian", native: "Italiano", country: "IT" },
  { code: "lv", name: "Latvian", native: "Latviešu", country: "LV" },
  { code: "lt", name: "Lithuanian", native: "Lietuvių", country: "LT" },
  { code: "mt", name: "Maltese", native: "Malti", country: "MT" },
  { code: "pl", name: "Polish", native: "Polski", country: "PL" },
  { code: "pt", name: "Portuguese", native: "Português", country: "PT" },
  { code: "ro", name: "Romanian", native: "Română", country: "RO" },
  { code: "sk", name: "Slovak", native: "Slovenčina", country: "SK" },
  { code: "sl", name: "Slovenian", native: "Slovenščina", country: "SI" },
  { code: "es", name: "Spanish", native: "Español", country: "ES" },
  { code: "sv", name: "Swedish", native: "Svenska", country: "SE" },
];

// Major non-EU European languages (for app UI reach + EEA/CH/UK/associated markets).
export const EUROPEAN_EXTRA_LANGUAGES = [
  { code: "nb", name: "Norwegian", native: "Norsk", country: "NO" },
  { code: "is", name: "Icelandic", native: "Íslenska", country: "IS" },
  { code: "sq", name: "Albanian", native: "Shqip", country: "AL" },
  { code: "sr", name: "Serbian", native: "Српски", country: "RS" },
  { code: "uk", name: "Ukrainian", native: "Українська", country: "UA" },
  { code: "tr", name: "Turkish", native: "Türkçe", country: "TR" },
  { code: "ru", name: "Russian", native: "Русский", country: "RU" },
];

// Full list the app UI language switcher offers (31 languages).
export const APP_UI_LANGUAGES = [...EU_OFFICIAL_LANGUAGES, ...EUROPEAN_EXTRA_LANGUAGES];

export const DEFAULT_LOCALE = "en";

export function languageByCode(code) {
  return APP_UI_LANGUAGES.find((l) => l.code === code) || null;
}

// Map an EU country code to the language its buyers must see warnings in.
export function warningLocaleForCountry(countryCode) {
  const hit = EU_OFFICIAL_LANGUAGES.find((l) => l.country === countryCode);
  return hit ? hit.code : "en";
}
