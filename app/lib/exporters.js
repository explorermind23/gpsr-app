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

// Flatten warnings [{locale,text}] -> "DE: ... | FR: ..."
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

function fullAddress(x) {
  if (!x) return "";
  return `${x.streetAddress}, ${x.city} ${x.postalCode}, ${x.country}`;
}

// ─────── AMAZON — EU GPSR compliance data sheet ───────
// Amazon deprecates its flat-file GPSR templates without notice and generates
// them per product category inside Seller Central, so no fixed column set stays
// valid. This sheet therefore uses stable, human-readable headers and is a
// DATA WORKSHEET the seller maps into their freshly-downloaded Amazon template
// (Catalog > Add products via upload). It is never uploaded to Amazon directly,
// so Amazon schema changes cannot break it. Every GPSR value Amazon asks for is
// present; the seller copies each column into the matching template field.
export function buildAmazonCsv(items) {
  const headers = [
    "seller_sku_or_gtin",
    "product_identifier_type",
    "item_name",
    "manufacturer_name",
    "manufacturer_address",
    "manufacturer_email",
    "responsible_person_details",
    "gpsr_safety_attestation",
    "safety_warning_language",
    "safety_warnings_text",
  ];
  const rows = items.map(({ rec, rp, mf }) => {
    const firstWarnLocale = Array.isArray(rec.warnings) && rec.warnings[0]
      ? String(rec.warnings[0].locale).toLowerCase()
      : "";
    return {
      seller_sku_or_gtin: rec.gtin || "",
      product_identifier_type: rec.gtin ? "EAN" : "",
      item_name: rec.productTitle || "",
      manufacturer_name: mf ? mf.legalName : "",
      manufacturer_address: fullAddress(mf),
      manufacturer_email: mf ? (mf.email || "") : "",
      responsible_person_details: rp
        ? `${rp.legalName}, ${fullAddress(rp)}, ${rp.email}, ${rp.phone}`
        : "",
      gpsr_safety_attestation: "TRUE",
      safety_warning_language: firstWarnLocale
        ? `${firstWarnLocale}_${(rp?.country || "DE").toUpperCase()}`
        : "",
      safety_warnings_text: warningsToText(rec.warnings),
    };
  });
  return toCsv(headers, rows);
}

// ─────── TIKTOK SHOP — Qualification Center prep sheet ───────
// TikTok has NO CSV import for GPSR data: Manufacturer and Responsible
// Person are records the seller creates once in Seller Center >
// Qualification Center, then attaches to listings. This sheet collects
// everything they need to copy in, using TikTok's field names
// (manufacturer.*, responsible_person.*_01).
export function buildTiktokCsv(items) {
  const headers = [
    "product_title",
    "product_identifier",
    "manufacturer.name",
    "manufacturer.registered_trade_name",
    "manufacturer.address",
    "manufacturer.email",
    "manufacturer.phone_number",
    "responsible_person.name_01",
    "responsible_person.address_01",
    "responsible_person.email_01",
    "responsible_person.phone_number_01",
    "safety_warnings",
    "ce_marked",
  ];
  const rows = items.map(({ rec, rp, mf }) => ({
    product_title: rec.productTitle || "",
    product_identifier: identifierOf(rec),
    "manufacturer.name": mf ? mf.legalName : "",
    "manufacturer.registered_trade_name": mf ? (mf.tradeName || "") : "",
    "manufacturer.address": fullAddress(mf),
    "manufacturer.email": mf ? (mf.email || "") : "",
    "manufacturer.phone_number": mf ? (mf.phone || "") : "",
    "responsible_person.name_01": rp ? rp.legalName : "",
    "responsible_person.address_01": fullAddress(rp),
    "responsible_person.email_01": rp ? rp.email : "",
    "responsible_person.phone_number_01": rp ? rp.phone : "",
    safety_warnings: warningsToText(rec.warnings),
    ce_marked: rec.ceMarked ? "Yes" : "No",
  }));
  return toCsv(headers, rows);
}

// ─────── GENERIC — eBay / Etsy / Temu / bol.com / Cdiscount / Kaufland / Zalando spreadsheet ───────
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
    responsible_person_address: fullAddress(rp),
    responsible_person_email: rp ? rp.email : "",
    responsible_person_phone: rp ? rp.phone : "",
    manufacturer_name: mf ? mf.legalName : "",
    manufacturer_address: fullAddress(mf),
    warnings: warningsToText(rec.warnings),
    ce_marked: rec.ceMarked ? "Yes" : "No",
    epr_registration: rec.eprRegistrationNo || "",
    care_instructions: rec.careInstructions || "",
  }));
  return toCsv(headers, rows);
}

// ─────── ALLEGRO — EU marketplace sheet ───────
// Allegro requires an extra per-offer flag: whether the product was placed on
// the EU market BEFORE 13 Dec 2024 (when GPSR took effect). We can't know this
// per product, so we emit the column with a blank the seller fills in, and add
// Allegro's "safety information" columns alongside the standard GPSR fields.
export function buildAllegroCsv(items) {
  const headers = [
    "offer_title", "signature", // signature = GTIN/EAN/identifier on Allegro
    "placed_on_market_before_2024_12_13",
    "responsible_person_name", "responsible_person_address",
    "responsible_person_email", "responsible_person_phone",
    "manufacturer_name", "manufacturer_address", "manufacturer_email",
    "safety_information", "ce_marked",
  ];
  const rows = items.map(({ rec, rp, mf }) => ({
    offer_title: rec.productTitle || "",
    signature: identifierOf(rec),
    placed_on_market_before_2024_12_13: "", // seller completes: Yes/No
    responsible_person_name: rp ? rp.legalName : "",
    responsible_person_address: fullAddress(rp),
    responsible_person_email: rp ? rp.email : "",
    responsible_person_phone: rp ? rp.phone : "",
    manufacturer_name: mf ? mf.legalName : "",
    manufacturer_address: fullAddress(mf),
    manufacturer_email: mf ? (mf.email || "") : "",
    safety_information: warningsToText(rec.warnings),
    ce_marked: rec.ceMarked ? "Yes" : "No",
  }));
  return toCsv(headers, rows);
}

export const CHANNEL_META = {
  amazon: { label: "Amazon (EU)", format: "data-sheet", build: buildAmazonCsv, filename: "gpsr-amazon-data-sheet.csv" },
  tiktok: { label: "TikTok Shop (EU)", format: "tiktok-qualification", build: buildTiktokCsv, filename: "gpsr-tiktok-qualification-prep.csv" },
  ebay: { label: "eBay", format: "csv", build: buildGenericCsv, filename: "gpsr-ebay-export.csv" },
  etsy: { label: "Etsy", format: "csv", build: buildGenericCsv, filename: "gpsr-etsy-export.csv" },
  temu: { label: "Temu", format: "csv", build: buildGenericCsv, filename: "gpsr-temu-export.csv" },
  allegro: { label: "Allegro", format: "csv", build: buildAllegroCsv, filename: "gpsr-allegro-export.csv" },
  kaufland: { label: "Kaufland", format: "csv", build: buildGenericCsv, filename: "gpsr-kaufland-export.csv" },
  zalando: { label: "Zalando", format: "csv", build: buildGenericCsv, filename: "gpsr-zalando-export.csv" },
  bol: { label: "bol.com", format: "csv", build: buildGenericCsv, filename: "gpsr-bol-export.csv" },
  cdiscount: { label: "Cdiscount", format: "csv", build: buildGenericCsv, filename: "gpsr-cdiscount-export.csv" },
};