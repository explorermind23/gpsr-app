// Server-only billing helpers. The .server suffix keeps this (and the
// database client) out of the browser bundle.

import prisma from "../db.server";
import { PLAN_LIMITS } from "./plans";

export { BILLING_PLANS, PLAN_LIMITS, PLAN_PRICING, planFromBillingCheck } from "./plans";

// Test charges until BILLING_LIVE=true is set on Railway (required for dev stores).
export const IS_TEST_BILLING = process.env.BILLING_LIVE !== "true";

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
