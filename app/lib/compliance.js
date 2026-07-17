// Given a product's compliance record + the shop's active market languages,
// return its status and the precise list of what's missing. This powers the
// dashboard red/green, the scanner, and the pre-publish gate.

export function computeCompliance(record, requiredMarketLocales = [], opts = {}) {
  const missing = [];

  if (!record.responsiblePersonId) missing.push("Responsible Person");
  if (!record.manufacturerId) missing.push("Manufacturer");

  const hasIdentifier =
    record.gtin || record.modelNumber || record.batchNumber || record.serialNumber;
  if (!hasIdentifier) missing.push("Product identifier (GTIN, model, batch or serial)");

  // Warnings must exist in every active market language (GPSR buyer-language rule).
  const warnings = Array.isArray(record.warnings) ? record.warnings : [];
  const haveLocales = new Set(
    warnings.filter((w) => w && w.text && String(w.text).trim()).map((w) => w.locale)
  );
  for (const loc of requiredMarketLocales) {
    if (!haveLocales.has(loc)) missing.push(`Warning text (${loc.toUpperCase()})`);
  }

  // CE marking required by the applied template/category.
  if (opts.requiresCE && !record.ceMarked) missing.push("CE conformity marking");

  const status = missing.length === 0
    ? (record.status === "PUBLISHED" ? "PUBLISHED" : "READY")
    : "INCOMPLETE";

  return { status, missingFields: missing };
}

export const STATUS_META = {
  INCOMPLETE: { label: "Incomplete", tone: "critical" },
  READY: { label: "Ready", tone: "success" },
  PUBLISHED: { label: "Published", tone: "success" },
  NEEDS_REVIEW: { label: "Needs review", tone: "warning" },
};
