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

// Provider directory (feature 27). Merchants who lack an EU entity can appoint one
// of these as their Responsible Person. Links open the provider's own site;
// affiliate/referral tracking can be layered on the `ref` field later.
export const RP_PROVIDERS = [
  {
    name: "Taxually (RP service)",
    blurb: "EU Responsible Person + documentation review, annual agreement.",
    regions: "EU-wide",
    url: "https://www.taxually.com",
    ref: null,
  },
  {
    name: "EaseCert",
    blurb: "One-time-fee GPSR certification and Responsible Person appointment.",
    regions: "EU-wide",
    url: "https://easecert.com",
    ref: null,
  },
  {
    name: "Complico Consulting (DE)",
    blurb: "Germany-based Authorised Representative and full technical file support.",
    regions: "EU / Germany",
    url: "https://complicoconsulting.com",
    ref: null,
  },
  {
    name: "EU Compliance Partner",
    blurb: "Responsible Person for non-food products, marketplace-focused.",
    regions: "EU-wide",
    url: "https://eucompliancepartner.com",
    ref: null,
  },
];
