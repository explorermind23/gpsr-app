// Plan limits + lifetime product ledger enforcement.
// The ledger (ProductLedgerEntry) records every unique product that ever had
// compliance data. Entries survive product/compliance deletion, so cycling
// products cannot reset the free allowance.

import prisma from "../db.server";

export const BILLING_PLANS = ["STARTER_MONTHLY", "STARTER_ANNUAL", "PRO_MONTHLY", "PRO_ANNUAL"];

// Test charges until BILLING_LIVE=true is set on Railway (required for dev stores).
export const IS_TEST_BILLING = process.env.BILLING_LIVE !== "true";

export const PLAN_LIMITS = {
  FREE: 10,      // lifetime unique products
  STARTER: 250,  // lifetime unique products
  PRO: Infinity,
};

export const PLAN_PRICING = {
  STARTER: { monthly: 9.95, annual: 89.55 },
  PRO: { monthly: 24.95, annual: 224.55 },
};

export function planFromBillingCheck(appSubscriptions) {
  // Maps an active Shopify subscription name back to { plan, interval }.
  const active = (appSubscriptions || []).find((s) => s.status === "ACTIVE") || (appSubscriptions || [])[0];
  if (!active) return { plan: "FREE", interval: "MONTHLY" };
  const name = active.name || "";
  const plan = name.startsWith("PRO") ? "PRO" : name.startsWith("STARTER") ? "STARTER" : "FREE";
  const interval = name.endsWith("ANNUAL") ? "ANNUAL" : "MONTHLY";
  return { plan, interval };
}

export async function getLedgerUsage(shopId) {
  return prisma.productLedgerEntry.count({ where: { shopId } });
}

// Check + consume one product slot. Idempotent per product: an already-ledgered
// product never blocks (merchants can always edit what they already added).
export async function assertProductAllowance(shop, shopifyProductId) {
  const existing = await prisma.productLedgerEntry.findUnique({
    where: { shopId_shopifyProductId: { shopId: shop.id, shopifyProductId } },
  });
  if (existing) return { allowed: true };

  const limit = PLAN_LIMITS[shop.plan] ?? PLAN_LIMITS.FREE;
  const used = await getLedgerUsage(shop.id);
  if (used >= limit) {
    return {
      allowed: false,
      used,
      limit,
      message:
        shop.plan === "FREE"
          ? `Free plan limit reached: ${limit} products (lifetime). Deleting products does not free up slots. Upgrade in Plan & Billing to continue.`
          : `Your ${shop.plan} plan allows ${limit} products (lifetime). Upgrade in Plan & Billing to continue.`,
    };
  }

  await prisma.productLedgerEntry.create({
    data: { shopId: shop.id, shopifyProductId },
  });
  return { allowed: true, used: used + 1, limit };
}
