// Build channel-specific export files from compliance records.
// Each marketplace wants the same underlying GPSR data in a different column layout.
// The merchant downloads the file and uploads it to that platform's compliance area.

function csvEscape(v) {
  const s = v == null ? "" : String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function toCsv(headers, rows) {
  const head = headers.map(csvEscape).join(",");
  const body = rows.map((r) => headers.map((h) => csvEscape(r[h])).join(",")).join("\n");
  return head + "\n" + body + "\n";
}

// Flatten warnings [{locale,text}] → "DE: ... | FR: ..."
function warningsToText(warnings) {
  if (!Array.isArray(warnings)) return "";
  return warnings
    .filter((w) => w && w.text)
    .map((w) => `${String(w.locale).toUpperCase()}: ${w.text}`)
    .join(" | ");
}

function identifierOf(rec) {
  return rec.gtin || rec.modelNumber || rec.batchNumber || rec.serialNumber || "";
}

// ── AMAZON — compliance flat-file style ──────────────────────────────────
export function buildAmazonCsv(items) {
  const headers = [
    "item_name", "external_product_id", "external_product_id_type",
    "eu_responsible_person_name", "eu_responsible_person_address",
    "eu_responsible_person_email", "eu_responsible_person_phone",
    "manufacturer_name", "manufacturer_address",
    "safety_warnings", "ce_marked", "country_of_origin", "care_instructions",
  ];
  const rows = items.map(({ rec, rp, mf }) => ({
    item_name: rec.productTitle || "",
    external_product_id: rec.gtin || "",
    external_product_id_type: rec.gtin ? "EAN" : "",
    eu_responsible_person_name: rp ? rp.legalName : "",
    eu_responsible_person_address: rp ? `${rp.streetAddress}, ${rp.city} ${rp.postalCode}, ${rp.country}` : "",
    eu_responsible_person_email: rp ? rp.email : "",
    eu_responsible_person_phone: rp ? rp.phone : "",
    manufacturer_name: mf ? mf.legalName : "",
    manufacturer_address: mf ? `${mf.streetAddress}, ${mf.city} ${mf.postalCode}, ${mf.country}` : "",
    safety_warnings: warningsToText(rec.warnings),
    ce_marked: rec.ceMarked ? "Yes" : "No",
    country_of_origin: rec.originCountry || "",
    care_instructions: rec.careInstructions || "",
  }));
  return toCsv(headers, rows);
}

// ── TIKTOK SHOP — Qualification Center (Manufacturer + Responsible Person) ─
export function buildTiktokCsv(items) {
  const headers = [
    "product_title", "product_identifier",
    "manufacturer_name", "manufacturer_address", "manufacturer_email",
    "responsible_person_name", "responsible_person_address",
    "responsible_person_email", "responsible_person_phone",
    "safety_warnings", "ce_marked",
  ];
  const rows = items.map(({ rec, rp, mf }) => ({
    product_title: rec.productTitle || "",
    product_identifier: identifierOf(rec),
    manufacturer_name: mf ? mf.legalName : "",
    manufacturer_address: mf ? `${mf.streetAddress}, ${mf.city} ${mf.postalCode}, ${mf.country}` : "",
    manufacturer_email: mf ? (mf.email || "") : "",
    responsible_person_name: rp ? rp.legalName : "",
    responsible_person_address: rp ? `${rp.streetAddress}, ${rp.city} ${rp.postalCode}, ${rp.country}` : "",
    responsible_person_email: rp ? rp.email : "",
    responsible_person_phone: rp ? rp.phone : "",
    safety_warnings: warningsToText(rec.warnings),
    ce_marked: rec.ceMarked ? "Yes" : "No",
  }));
  return toCsv(headers, rows);
}

// ── GENERIC — eBay / Etsy / Temu / spreadsheet ───────────────────────────
export function buildGenericCsv(items) {
  const headers = [
    "product_title", "gtin", "model_number", "batch_number", "serial_number",
    "responsible_person_name", "responsible_person_address",
    "responsible_person_email", "responsible_person_phone",
    "manufacturer_name", "manufacturer_address",
    "warnings", "ce_marked", "epr_registration", "care_instructions",
  ];
  const rows = items.map(({ rec, rp, mf }) => ({
    product_title: rec.productTitle || "",
    gtin: rec.gtin || "", model_number: rec.modelNumber || "",
    batch_number: rec.batchNumber || "", serial_number: rec.serialNumber || "",
    responsible_person_name: rp ? rp.legalName : "",
    responsible_person_address: rp ? `${rp.streetAddress}, ${rp.city} ${rp.postalCode}, ${rp.country}` : "",
    responsible_person_email: rp ? rp.email : "",
    responsible_person_phone: rp ? rp.phone : "",
    manufacturer_name: mf ? mf.legalName : "",
    manufacturer_address: mf ? `${mf.streetAddress}, ${mf.city} ${mf.postalCode}, ${mf.country}` : "",
    warnings: warningsToText(rec.warnings),
    ce_marked: rec.ceMarked ? "Yes" : "No",
    epr_registration: rec.eprRegistrationNo || "",
    care_instructions: rec.careInstructions || "",
  }));
  return toCsv(headers, rows);
}

export const CHANNEL_META = {
  amazon: { label: "Amazon (EU)", format: "amazon-flatfile", build: buildAmazonCsv, filename: "gpsr-amazon-export.csv" },
  tiktok: { label: "TikTok Shop (EU)", format: "tiktok-qualification", build: buildTiktokCsv, filename: "gpsr-tiktok-export.csv" },
  ebay: { label: "eBay", format: "csv", build: buildGenericCsv, filename: "gpsr-ebay-export.csv" },
  etsy: { label: "Etsy", format: "csv", build: buildGenericCsv, filename: "gpsr-etsy-export.csv" },
  temu: { label: "Temu", format: "csv", build: buildGenericCsv, filename: "gpsr-temu-export.csv" },
};
