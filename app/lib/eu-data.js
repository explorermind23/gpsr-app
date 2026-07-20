// EU member states — an EU Responsible Person must be established within the Union.
// Northern Ireland (NI) also qualifies under the Windsor/NI Protocol.
export const EU_COUNTRIES = [
  { code: "AT", name: "Austria" },
  { code: "BE", name: "Belgium" },
  { code: "BG", name: "Bulgaria" },
  { code: "HR", name: "Croatia" },
  { code: "CY", name: "Cyprus" },
  { code: "CZ", name: "Czechia" },
  { code: "DK", name: "Denmark" },
  { code: "EE", name: "Estonia" },
  { code: "FI", name: "Finland" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "GR", name: "Greece" },
  { code: "HU", name: "Hungary" },
  { code: "IE", name: "Ireland" },
  { code: "IT", name: "Italy" },
  { code: "LV", name: "Latvia" },
  { code: "LT", name: "Lithuania" },
  { code: "LU", name: "Luxembourg" },
  { code: "MT", name: "Malta" },
  { code: "NL", name: "Netherlands" },
  { code: "PL", name: "Poland" },
  { code: "PT", name: "Portugal" },
  { code: "RO", name: "Romania" },
  { code: "SK", name: "Slovakia" },
  { code: "SI", name: "Slovenia" },
  { code: "ES", name: "Spain" },
  { code: "SE", name: "Sweden" },
  { code: "XI", name: "Northern Ireland (NI Protocol)" },
];

// EEA EFTA states adopt GPSR-equivalent rules; offered as valid for EEA coverage.
export const EEA_EXTRA = [
  { code: "IS", name: "Iceland" },
  { code: "LI", name: "Liechtenstein" },
  { code: "NO", name: "Norway" },
];

export const UK_COUNTRY = [{ code: "GB", name: "United Kingdom" }];

// Switzerland is neither EU nor EEA — it has its own product-safety regime and,
// for certain goods, requires a CH-based authorised representative.
export const CH_COUNTRY = [{ code: "CH", name: "Switzerland" }];

export const EU_CODES = new Set([...EU_COUNTRIES, ...EEA_EXTRA].map((c) => c.code));

export function isValidRpCountry(role, code) {
  if (role === "UK_RESPONSIBLE_PERSON") return code === "GB";
  if (role === "CH_RESPONSIBLE_PERSON") return code === "CH";
  return EU_CODES.has(code);
}

// Provider directory. Merchants without an EU entity can appoint one of these
// companies as their Responsible Person. Prices shown are the providers' own
// published figures at the time of writing and change without notice — always
// confirm on their site. We take no commission and endorse no provider. The
// `ref` field exists only so referral tracking could be added later; if it ever
// is, the UI must disclose it.
export const RP_PROVIDERS = [
  {
    name: "EaseCert",
    blurb: "One-time fee per product type (published from ~€400), Responsible Person included. No annual renewal.",
    pricing: "One-time fee",
    regions: "EU-wide",
    url: "https://easecert.com",
    ref: null,
  },
  {
    name: "Eldris",
    blurb: "One-time fee per country (published from ~£195), with a compliance dashboard and authority liaison.",
    pricing: "One-time fee",
    regions: "EU-wide",
    url: "https://responsible.eldris.ai",
    ref: null,
  },
  {
    name: "EAS Project",
    blurb: "Estonia-based Authorised Representative service covering GPSR and wider EU product compliance.",
    pricing: "Annual agreement",
    regions: "EU-wide",
    url: "https://easproject.com/gpsr/",
    ref: null,
  },
  {
    name: "Obelis",
    blurb: "Long-established Brussels-based European Authorised Representative for regulated and general products.",
    pricing: "Annual agreement",
    regions: "EU / Belgium",
    url: "https://www.obelis.net",
    ref: null,
  },
  {
    name: "Certification Experts",
    blurb: "Netherlands-based full-service compliance house: Responsible Person plus technical file and testing support.",
    pricing: "Quote-based",
    regions: "EU / Netherlands",
    url: "https://certification-experts.com/gpsr-responsible-person/",
    ref: null,
  },
  {
    name: "Euverify",
    blurb: "Subscription platform with EU and UK representation, document storage and templates. Priced for larger catalogues.",
    pricing: "Monthly subscription",
    regions: "EU + UK",
    url: "https://euverify.com",
    ref: null,
  },
];
