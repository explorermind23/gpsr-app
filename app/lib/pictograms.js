// Standard product-safety pictograms merchants can attach via templates or per product.
// Inline SVG so they render anywhere (admin, storefront, PDF passport) with no assets.

export const PICTOGRAMS = [
  {
    key: "age_0_3",
    label: "Not for under 3 years",
    category: "toys",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><circle cx="24" cy="24" r="21" fill="#fff" stroke="#D0021B" stroke-width="3"/><text x="24" y="29" font-family="Arial" font-size="15" font-weight="bold" text-anchor="middle" fill="#111">0-3</text><line x1="9" y1="39" x2="39" y2="9" stroke="#D0021B" stroke-width="3"/></svg>`,
  },
  {
    key: "choking_small_parts",
    label: "Choking hazard — small parts",
    category: "toys",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 5 L45 42 H3 Z" fill="#FDE000" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/><rect x="22" y="18" width="4" height="13" fill="#111"/><rect x="22" y="34" width="4" height="4" fill="#111"/></svg>`,
  },
  {
    key: "suffocation_bag",
    label: "Suffocation — keep bag from children",
    category: "packaging",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="12" y="8" width="24" height="32" rx="2" fill="#fff" stroke="#111" stroke-width="2"/><path d="M18 8 Q24 2 30 8" fill="none" stroke="#111" stroke-width="2"/><line x1="12" y1="40" x2="36" y2="8" stroke="#D0021B" stroke-width="3"/></svg>`,
  },
  {
    key: "ce_mark",
    label: "CE marking",
    category: "conformity",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M22 12 a12 12 0 1 0 0 24 M20 24 h9" fill="none" stroke="#111" stroke-width="3"/><path d="M40 12 a12 12 0 1 0 0 24 M38 24 h9 M38 13 h9 M38 35 h9" fill="none" stroke="#111" stroke-width="3"/></svg>`,
  },
  {
    key: "flammable",
    label: "Flammable",
    category: "hazard",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 4 L44 24 L24 44 L4 24 Z" fill="#fff" stroke="#D0021B" stroke-width="2.5"/><path d="M24 12 c4 6 8 8 8 14 a8 8 0 0 1-16 0 c0-4 3-6 4-9 c1 3 3 3 4 5 c1-3 0-7 0-10z" fill="#D0021B"/></svg>`,
  },
  {
    key: "irritant",
    label: "Irritant / harmful (GHS)",
    category: "hazard",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 4 L44 24 L24 44 L4 24 Z" fill="#fff" stroke="#D0021B" stroke-width="2.5"/><rect x="22" y="15" width="4" height="14" fill="#111"/><rect x="22" y="32" width="4" height="4" fill="#111"/></svg>`,
  },
  {
    key: "electrical",
    label: "Electrical hazard",
    category: "hazard",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><path d="M24 5 L45 42 H3 Z" fill="#FDE000" stroke="#111" stroke-width="2.5" stroke-linejoin="round"/><path d="M26 16 L18 30 h6 l-2 8 l10-16 h-6 z" fill="#111"/></svg>`,
  },
  {
    key: "weee_bin",
    label: "Do not bin (WEEE)",
    category: "disposal",
    svg: `<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg"><rect x="14" y="14" width="20" height="22" rx="2" fill="#fff" stroke="#111" stroke-width="2"/><rect x="12" y="10" width="24" height="4" fill="#111"/><line x1="20" y1="19" x2="20" y2="31" stroke="#111" stroke-width="2"/><line x1="28" y1="19" x2="28" y2="31" stroke="#111" stroke-width="2"/><rect x="8" y="38" width="32" height="3" fill="#111"/></svg>`,
  },
];

export const PICTOGRAM_MAP = Object.fromEntries(PICTOGRAMS.map((p) => [p.key, p]));
