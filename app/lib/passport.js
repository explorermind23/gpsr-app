// Branded GPSR Product Safety Passport (PDF).
//
// Font note: pdf-lib's built-in fonts use WinAnsi encoding, which cannot encode
// Polish, Czech, Hungarian, Romanian, Baltic, Greek or Bulgarian characters —
// i.e. most of the languages this app exists to serve. We therefore embed
// DejaVu Sans (Latin + Latin Extended + Greek + Cyrillic) with subsetting, which
// keeps a typical passport around 15–25 KB.

import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";
import fs from "node:fs";
import { createRequire } from "node:module";
import { languageByCode } from "./languages";
import { PICTOGRAM_MAP } from "./pictograms";

const require = createRequire(import.meta.url);

let FONT_CACHE = null;
function loadFonts() {
  if (FONT_CACHE) return FONT_CACHE;
  FONT_CACHE = {
    regular: fs.readFileSync(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf")),
    bold: fs.readFileSync(require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf")),
  };
  return FONT_CACHE;
}

const A4 = { w: 595.28, h: 841.89 };
const M = { left: 48, right: 48, top: 54, bottom: 56 };
const INK = rgb(0.09, 0.09, 0.09);
const MUTED = rgb(0.42, 0.42, 0.40);
const HAIRLINE = rgb(0.84, 0.83, 0.80);

function hexToRgb(hex, fallback = rgb(0.11, 0.11, 0.11)) {
  if (!hex || typeof hex !== "string") return fallback;
  const m = hex.trim().replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return fallback;
  return rgb(
    parseInt(m.slice(0, 2), 16) / 255,
    parseInt(m.slice(2, 4), 16) / 255,
    parseInt(m.slice(4, 6), 16) / 255
  );
}

function sniffImageType(bytes) {
  if (bytes.length > 8 && bytes[0] === 0x89 && bytes[1] === 0x50) return "png";
  if (bytes.length > 3 && bytes[0] === 0xff && bytes[1] === 0xd8) return "jpg";
  return null;
}

async function fetchLogo(pdf, url) {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const bytes = new Uint8Array(await res.arrayBuffer());
    const kind = sniffImageType(bytes);
    if (kind === "png") return await pdf.embedPng(bytes);
    if (kind === "jpg") return await pdf.embedJpg(bytes);
    return null;
  } catch (e) {
    return null;
  }
}

// Greedy word wrap against the embedded font's real metrics.
function wrap(text, font, size, maxWidth) {
  const words = String(text || "").split(/\s+/).filter(Boolean);
  const lines = [];
  let line = "";
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(test, size) <= maxWidth) {
      line = test;
    } else {
      if (line) lines.push(line);
      // A single word longer than the line: hard-split it.
      if (font.widthOfTextAtSize(w, size) > maxWidth) {
        let chunk = "";
        for (const ch of w) {
          if (font.widthOfTextAtSize(chunk + ch, size) > maxWidth) {
            lines.push(chunk);
            chunk = ch;
          } else chunk += ch;
        }
        line = chunk;
      } else line = w;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

export async function buildPassportPdf({ product, record, rp, manufacturer, brand }) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);

  const { regular, bold } = loadFonts();
  const fRegular = await pdf.embedFont(regular, { subset: true });
  const fBold = await pdf.embedFont(bold, { subset: true });

  const accent = hexToRgb(brand?.accentHex);
  const logo = await fetchLogo(pdf, brand?.logoUrl);

  const contentW = A4.w - M.left - M.right;
  let page = pdf.addPage([A4.w, A4.h]);
  let y = A4.h - M.top;

  const newPage = () => {
    page = pdf.addPage([A4.w, A4.h]);
    y = A4.h - M.top;
  };
  const need = (h) => {
    if (y - h < M.bottom) newPage();
  };

  const text = (str, { size = 10, font = fRegular, color = INK, x = M.left, gap = 4 } = {}) => {
    const lines = wrap(str, font, size, contentW - (x - M.left));
    for (const ln of lines) {
      need(size + gap);
      page.drawText(ln, { x, y: y - size, size, font, color });
      y -= size + gap;
    }
  };

  const heading = (str) => {
    need(30);
    y -= 10;
    page.drawText(str, { x: M.left, y: y - 11, size: 11, font: fBold, color: accent });
    y -= 18;
    page.drawLine({
      start: { x: M.left, y },
      end: { x: A4.w - M.right, y },
      thickness: 0.5,
      color: HAIRLINE,
    });
    y -= 10;
  };

  const field = (label, value) => {
    if (!value) return;
    need(26);
    page.drawText(label, { x: M.left, y: y - 8, size: 8, font: fRegular, color: MUTED });
    y -= 12;
    text(String(value), { size: 10 });
    y -= 2;
  };

  // ── Header band ────────────────────────────────────────────────────
  page.drawRectangle({ x: 0, y: A4.h - 8, width: A4.w, height: 8, color: accent });

  let headerX = M.left;
  if (logo) {
    const maxH = 34;
    const scale = Math.min(maxH / logo.height, 120 / logo.width);
    const w = logo.width * scale;
    const h = logo.height * scale;
    page.drawImage(logo, { x: M.left, y: y - h + 6, width: w, height: h });
    headerX = M.left + w + 14;
  }

  page.drawText(brand?.shopName || "", {
    x: headerX, y: y - 12, size: 12, font: fBold, color: INK,
  });
  if (brand?.shopDomain) {
    page.drawText(brand.shopDomain, {
      x: headerX, y: y - 26, size: 9, font: fRegular, color: MUTED,
    });
  }
  y -= 52;

  page.drawText("GPSR Product Safety Passport", {
    x: M.left, y: y - 18, size: 18, font: fBold, color: INK,
  });
  y -= 26;
  page.drawText("Regulation (EU) 2023/988 on general product safety", {
    x: M.left, y: y - 10, size: 9, font: fRegular, color: MUTED,
  });
  y -= 22;

  // ── Product ────────────────────────────────────────────────────────
  heading("Product");
  field("Product name", product?.title);
  field("GTIN / barcode", record?.gtin);
  field("Model number", record?.modelNumber);
  field("Batch number", record?.batchNumber);
  field("Serial number", record?.serialNumber);

  // ── Responsible Person ─────────────────────────────────────────────
  heading("EU Responsible Person");
  if (rp) {
    field("Name", rp.companyName ? `${rp.legalName} (${rp.companyName})` : rp.legalName);
    field("Address", `${rp.streetAddress}, ${rp.city} ${rp.postalCode}, ${rp.country}`);
    field("Email", rp.email);
    field("Phone", rp.phone);
  } else {
    text("No Responsible Person assigned to this product.", { size: 10, color: MUTED });
  }

  // ── Manufacturer ───────────────────────────────────────────────────
  heading("Manufacturer");
  if (manufacturer) {
    field("Name", manufacturer.tradeName
      ? `${manufacturer.legalName} (${manufacturer.tradeName})`
      : manufacturer.legalName);
    field("Address", `${manufacturer.streetAddress}, ${manufacturer.city} ${manufacturer.postalCode}, ${manufacturer.country}`);
    field("Email", manufacturer.email);
    field("Phone", manufacturer.phone);
  } else {
    text("No manufacturer recorded for this product.", { size: 10, color: MUTED });
  }

  // ── Warnings ───────────────────────────────────────────────────────
  const warnings = Array.isArray(record?.warnings) ? record.warnings : [];
  heading(`Safety warnings (${warnings.length} language${warnings.length === 1 ? "" : "s"})`);
  if (warnings.length === 0) {
    text("No safety warnings recorded.", { size: 10, color: MUTED });
  } else {
    for (const w of warnings) {
      const lang = languageByCode(w.locale);
      const label = lang ? `${lang.native} (${lang.name})` : String(w.locale || "").toUpperCase();
      need(30);
      page.drawText(label, { x: M.left, y: y - 8, size: 8, font: fBold, color: MUTED });
      y -= 12;
      text(w.text, { size: 10 });
      y -= 4;
    }
  }

  // ── Pictograms & conformity ────────────────────────────────────────
  const picts = (record?.pictograms || []).map((k) => PICTOGRAM_MAP[k]).filter(Boolean);
  heading("Conformity");
  field("CE marking", record?.ceMarked ? "Yes — this product carries CE marking" : "Not declared");
  if (picts.length) field("Warning pictograms", picts.map((p) => p.label).join(" · "));
  field("EPR registration", record?.eprRegistrationNo);
  field("Care & usage instructions", record?.careInstructions);

  // ── Footer on every page ───────────────────────────────────────────
  const pages = pdf.getPages();
  const stamp = new Date().toISOString().slice(0, 10);
  pages.forEach((p, i) => {
    p.drawLine({
      start: { x: M.left, y: M.bottom - 14 },
      end: { x: A4.w - M.right, y: M.bottom - 14 },
      thickness: 0.5,
      color: HAIRLINE,
    });
    p.drawText(
      `Generated ${stamp} by ${brand?.shopName || "GPSR Compliance Hub"} · This document summarises stored compliance data and is not a certificate of conformity.`,
      { x: M.left, y: M.bottom - 26, size: 7, font: fRegular, color: MUTED }
    );
    p.drawText(`${i + 1} / ${pages.length}`, {
      x: A4.w - M.right - 24, y: M.bottom - 26, size: 7, font: fRegular, color: MUTED,
    });
  });

  return await pdf.save();
}
