// EU Safety Gate (RAPEX) recall alerts.
//
// Source: Safety Gate open data feed (JSON). We cache alerts globally in
// RecallAlert, then match them against each shop's catalog and store hits in
// RecallMatch. Matching is deliberately CONSERVATIVE — a false "your product
// was recalled" alarm is worse for a merchant than a missed low-confidence one.

import prisma from "../db.server";

const FEED_URL =
  "https://public.opendatasoft.com/api/explore/v2.1/catalog/datasets/healthref-europe-rapex-en/records";

const PAGE_SIZE = 100;
const MAX_PAGES = 5;          // up to 500 recent alerts
const LOOKBACK_DAYS = 120;
const SYNC_INTERVAL_HOURS = 12;

function isoDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().slice(0, 10);
}

/** Pull recent alerts from the Safety Gate feed into our global cache. */
export async function syncRecallFeed({ force = false } = {}) {
  const newest = await prisma.recallAlert.findFirst({ orderBy: { fetchedAt: "desc" } });
  if (!force && newest) {
    const hoursSince = (Date.now() - new Date(newest.fetchedAt).getTime()) / 36e5;
    if (hoursSince < SYNC_INTERVAL_HOURS) return { skipped: true, reason: "recently synced" };
  }

  let imported = 0;
  for (let page = 0; page < MAX_PAGES; page++) {
    const params = new URLSearchParams({
      limit: String(PAGE_SIZE),
      offset: String(page * PAGE_SIZE),
      order_by: "alert_date desc",
      where: `alert_date >= date'${isoDaysAgo(LOOKBACK_DAYS)}'`,
    });

    let results = [];
    try {
      const res = await fetch(`${FEED_URL}?${params.toString()}`, {
        headers: { Accept: "application/json" },
      });
      if (!res.ok) break;
      const body = await res.json();
      results = body.results || [];
    } catch (e) {
      console.error("[gpsr] recall feed fetch failed:", e?.message || e);
      break;
    }
    if (results.length === 0) break;

    for (const r of results) {
      if (!r.alert_number) continue;
      const data = {
        alertLevel: r.alert_level || null,
        alertCountry: r.alert_country || null,
        alertDate: r.alert_date ? new Date(r.alert_date) : null,
        productName: r.product_name || null,
        productBrand: r.product_brand || null,
        productType: r.product_type || null,
        productCategory: r.product_category || null,
        productBarcode: r.product_barcode || null,
        description: r.alert_description || null,
        riskType: Array.isArray(r.alert_type) ? r.alert_type.join(", ") : r.alert_type || null,
        rapexUrl: r.rapex_url || null,
        imageUrl: r.product_image || null,
        fetchedAt: new Date(),
      };
      try {
        await prisma.recallAlert.upsert({
          where: { alertNumber: r.alert_number },
          create: { alertNumber: r.alert_number, ...data },
          update: data,
        });
        imported += 1;
      } catch (e) { /* skip malformed row */ }
    }
    if (results.length < PAGE_SIZE) break;
  }
  return { imported };
}

// ── Matching ───────────────────────────────────────────────────────────

const STOP = new Set([
  "the", "and", "for", "with", "from", "your", "our", "new", "set", "pack",
  "size", "color", "colour", "kids", "baby", "product", "products", "item",
]);

function norm(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(s) {
  return new Set(norm(s).split(" ").filter((w) => w.length > 3 && !STOP.has(w)));
}

function overlapCount(a, b) {
  let n = 0;
  for (const t of a) if (b.has(t)) n += 1;
  return n;
}

const CATEGORY_HINTS = {
  toys: ["toy", "toys", "game", "games", "puzzle", "doll"],
  cosmetics: ["cosmetic", "cosmetics", "cream", "lotion", "serum", "shampoo", "perfume", "makeup"],
  "electrical appliances and equipment": ["lamp", "light", "charger", "cable", "adapter", "electronic", "appliance"],
  "chemical products": ["chemical", "cleaner", "detergent", "vape", "liquid"],
  jewellery: ["jewellery", "jewelry", "ring", "necklace", "bracelet", "earring"],
  "clothing, textiles and fashion items": ["shirt", "dress", "jacket", "trousers", "clothing", "textile", "shoe", "shoes"],
};

function categoryMatches(alertCategory, productType, productTitle) {
  if (!alertCategory) return false;
  const key = alertCategory.toLowerCase();
  const hay = `${norm(productType)} ${norm(productTitle)}`;
  if (hay.includes(norm(alertCategory))) return true;
  const hints = CATEGORY_HINTS[key];
  if (!hints) return false;
  return hints.some((h) => hay.includes(h));
}

/**
 * Score a single (product, alert) pair. Returns null when there is no
 * defensible reason to warn the merchant.
 *
 * product: { id, title, vendor, productType, barcodes: [] }
 */
export function scoreMatch(product, alert) {
  const barcodes = (product.barcodes || []).filter(Boolean).map((b) => b.trim());
  if (alert.productBarcode && barcodes.includes(alert.productBarcode.trim())) {
    return { score: 100, reason: "Barcode/GTIN matches the recalled product exactly" };
  }

  const vendor = norm(product.vendor);
  const brand = norm(alert.productBrand);
  const brandMatch = vendor.length >= 3 && brand.length >= 3 && vendor === brand;
  const catMatch = categoryMatches(alert.productCategory, product.productType, product.title);

  if (brandMatch && catMatch) {
    return { score: 90, reason: `Same brand (${alert.productBrand}) and product category as the recalled item` };
  }
  if (brandMatch) {
    return { score: 75, reason: `Same brand (${alert.productBrand}) as the recalled item` };
  }

  const titleTokens = tokenSet(product.title);
  const alertTokens = tokenSet(`${alert.productName} ${alert.productType}`);
  const overlap = overlapCount(titleTokens, alertTokens);
  if (overlap >= 2 && catMatch) {
    return { score: 65, reason: "Product name and category closely resemble the recalled item" };
  }
  return null;
}

const MIN_SCORE = 65;

/**
 * Match cached alerts against a shop's catalog and persist new hits.
 * products: array of { id, title, vendor, productType, barcodes: [] }
 */
export async function matchAlertsForShop(shopId, products) {
  const alerts = await prisma.recallAlert.findMany({
    orderBy: { alertDate: "desc" },
    take: 500,
  });

  let created = 0;
  for (const product of products) {
    for (const alert of alerts) {
      const hit = scoreMatch(product, alert);
      if (!hit || hit.score < MIN_SCORE) continue;
      try {
        await prisma.recallMatch.create({
          data: {
            shopId,
            alertId: alert.id,
            shopifyProductId: product.id,
            productTitle: product.title,
            matchReason: hit.reason,
            matchScore: hit.score,
          },
        });
        created += 1;
      } catch (e) {
        // unique constraint — already matched previously, leave its status alone
      }
    }
  }
  return { created };
}

export async function countNewRecallMatches(shopId) {
  return prisma.recallMatch.count({ where: { shopId, status: "NEW" } });
}
