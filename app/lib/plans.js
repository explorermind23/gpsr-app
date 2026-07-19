// Plan constants — client-safe (no server imports).

export const BILLING_PLANS = ["STARTER_MONTHLY", "STARTER_ANNUAL", "PRO_MONTHLY", "PRO_ANNUAL"];

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
  const active = (appSubscriptions || []).find((s) => s.status === "ACTIVE") || (appSubscriptions || [])[0];
  if (!active) return { plan: "FREE", interval: "MONTHLY" };
  const name = active.name || "";
  const plan = name.startsWith("PRO") ? "PRO" : name.startsWith("STARTER") ? "STARTER" : "FREE";
  const interval = name.endsWith("ANNUAL") ? "ANNUAL" : "MONTHLY";
  return { plan, interval };
}
