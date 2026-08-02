import { json } from "@remix-run/node";
import { useLoaderData, useSearchParams, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Button, Box,
  InlineGrid, List, Banner, ButtonGroup, ProgressBar,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PLAN_LIMITS, PLAN_PRICING } from "../lib/plans";
import {
  BILLING_PLANS, IS_TEST_BILLING, getLedgerUsage,
  resolvePlanBothModes,
} from "../lib/billing.server";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

export const loader = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);
  const shop = await getShop(session);

  const url = new URL(request.url);
  const justChanged = url.searchParams.get("changed") === "1";

  // Resolve plan by checking BOTH test and live subscriptions. A reviewer test
  // charge and a real merchant live charge both resolve; a live-flagged app
  // would otherwise report FREE for the reviewer test subscription.
  let plan, interval;
  {
    const wanted = justChanged ? 8 : 1;
    for (let attempt = 0; attempt < wanted; attempt++) {
      const r = await resolvePlanBothModes(billing);
      plan = r.plan; interval = r.interval;
      const prev = shop.plan || "FREE";
      if (!justChanged || plan !== prev || attempt === wanted - 1) break;
      await new Promise((res) => setTimeout(res, 750));
    }
  }

  // Keep DB in sync with Shopify's billing truth.
  if (shop.plan !== plan || shop.planInterval !== interval) {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { plan, planInterval: interval, planActivatedAt: plan === "FREE" ? null : new Date() },
    });
  }

  const used = await getLedgerUsage(shop.id);
  return json({ plan, interval, used, isTest: IS_TEST_BILLING });
};

export const action = async ({ request }) => {
  const { billing, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "subscribe") {
    const planKey = String(form.get("planKey"));
    if (!BILLING_PLANS.includes(planKey)) return json({ error: "Unknown plan." }, { status: 400 });
    // Throws a redirect to Shopify's confirmation page.
    // Return to the EMBEDDED admin URL, not the raw app URL — otherwise the
    // merchant lands on a bare JSON page outside the Shopify admin.
    const shopHandle = session.shop.replace(".myshopify.com", "");
    const appHandle = process.env.SHOPIFY_APP_HANDLE || "gpsr-compliance-hub";
    await billing.request({
      plan: planKey,
      isTest: IS_TEST_BILLING,
      returnUrl: `https://admin.shopify.com/store/${shopHandle}/apps/${appHandle}/app/billing?changed=1`,
    });
    return null;
  }

  if (intent === "cancel") {
    // Cancel whichever subscription exists (test or live).
    for (const mode of [false, true]) {
      const { appSubscriptions } = await billing.check({ plans: BILLING_PLANS, isTest: mode });
      for (const sub of appSubscriptions) {
        await billing.cancel({ subscriptionId: sub.id, isTest: mode, prorate: true });
      }
    }
    await prisma.shop.update({ where: { id: shop.id }, data: { plan: "FREE", planActivatedAt: null } });
    return json({ cancelled: true });
  }

  return json({ ok: false });
};

const FEATURES = {
  FREE: ["10 products (lifetime)", "1 Responsible Person", "Storefront safety block", "1 market language"],
  STARTER: ["250 products (lifetime)", "All 24 EU languages", "Templates & bulk apply", "Compliance scanner", "Amazon (EU) export"],
  PRO: ["Unlimited products", "Export to 10 EU marketplaces", "Amazon, TikTok, eBay, Etsy, Temu, Allegro, Kaufland, Zalando, bol.com, Cdiscount", "Document vault (10-yr)", "Incident log", "Supplier requests", "Priority support"],
};

export default function BillingPage() {
  const { plan, interval, used, isTest } = useLoaderData();
  const nav = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const submittingPlanKey = nav.formData?.get("planKey");
  const cancelling = nav.formData?.get("intent") === "cancel";
  const justChanged = searchParams.get("changed") === "1";

  const [yearly, setYearly] = useState(interval === "ANNUAL");

  const limit = PLAN_LIMITS[plan];
  const pct = limit === Infinity ? 0 : Math.min(100, Math.round((used / limit) * 100));

  const cards = [
    {
      key: "FREE", name: "Free", monthly: 0, annual: 0, tagline: "Try it out",
      features: FEATURES.FREE,
    },
    {
      key: "STARTER", name: "Starter", monthly: PLAN_PRICING.STARTER.monthly, annual: PLAN_PRICING.STARTER.annual,
      tagline: "Single store + Amazon", features: FEATURES.STARTER,
    },
    {
      key: "PRO", name: "Pro", monthly: PLAN_PRICING.PRO.monthly, annual: PLAN_PRICING.PRO.annual,
      tagline: "Multi-marketplace", features: FEATURES.PRO, highlight: true,
    },
  ];

  return (
    <Page title="Plan & Billing" backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        {justChanged && (
          <Layout.Section>
            <Banner tone="success" title="Plan updated"
              onDismiss={() => setSearchParams({}, { replace: true })} />
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Product allowance</Text>
                <Badge tone={plan === "FREE" ? "attention" : "success"}>{`Current plan: ${plan}${plan !== "FREE" ? ` · ${interval === "ANNUAL" ? "yearly" : "monthly"}` : ""}`}</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                {limit === Infinity
                  ? `${used} products under compliance — unlimited on Pro.`
                  : `${used} of ${limit} lifetime product slots used. Slots are not freed by deleting products.`}
              </Text>
              {limit !== Infinity && <ProgressBar progress={pct} size="small" tone={pct >= 100 ? "critical" : "primary"} />}
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Plans</Text>
                <ButtonGroup variant="segmented">
                  <Button pressed={!yearly} onClick={() => setYearly(false)}>Monthly</Button>
                  <Button pressed={yearly} onClick={() => setYearly(true)}>Yearly — save 25%</Button>
                </ButtonGroup>
              </InlineStack>

              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                {cards.map((c) => {
                  const isCurrent =
                    plan === c.key && (c.key === "FREE" || (yearly ? interval === "ANNUAL" : interval === "MONTHLY"));
                  const price = yearly ? c.annual : c.monthly;
                  const planKey = `${c.key}_${yearly ? "ANNUAL" : "MONTHLY"}`;
                  return (
                    <Box key={c.key} padding="400" borderRadius="200"
                      borderWidth={c.highlight ? "050" : "025"}
                      borderColor={c.highlight ? "border-emphasis" : "border"}
                      background={c.highlight ? "bg-surface-selected" : "bg-surface"}>
                      <BlockStack gap="200">
                        <InlineStack align="space-between" blockAlign="center">
                          <Text as="span" variant="headingSm">{c.name}</Text>
                          {c.highlight && <Badge tone="attention">Best value</Badge>}
                        </InlineStack>
                        <InlineStack gap="100" blockAlign="end">
                          <Text as="span" variant="headingLg">
                            {price === 0 ? "$0" : `$${price.toFixed(2)}`}
                          </Text>
                          {price > 0 && (
                            <Text as="span" variant="bodySm" tone="subdued">{yearly ? "/year" : "/month"}</Text>
                          )}
                        </InlineStack>
                        {yearly && price > 0 && (
                          <Text as="span" variant="bodySm" tone="success">
                            {`= $${(price / 12).toFixed(2)}/mo · 25% off`}
                          </Text>
                        )}
                        <Text as="span" variant="bodySm" tone="subdued">{c.tagline}</Text>
                        <List type="bullet">
                          {c.features.map((f) => <List.Item key={f}>{f}</List.Item>)}
                        </List>
                        {c.key === "FREE" ? (
                          plan === "FREE" ? (
                            <Button disabled fullWidth>Current plan</Button>
                          ) : (
                            <Form method="post">
                              <input type="hidden" name="intent" value="cancel" />
                              <Button submit variant="secondary" tone="critical" loading={cancelling} fullWidth>
                                Downgrade to Free
                              </Button>
                            </Form>
                          )
                        ) : isCurrent ? (
                          <Button disabled fullWidth>Current plan</Button>
                        ) : (
                          <Form method="post">
                            <input type="hidden" name="intent" value="subscribe" />
                            <input type="hidden" name="planKey" value={planKey} />
                            <Button submit variant={c.highlight ? "primary" : "secondary"}
                              loading={submittingPlanKey === planKey} fullWidth>
                              {`Choose ${c.name}`}
                            </Button>
                          </Form>
                        )}
                      </BlockStack>
                    </Box>
                  );
                })}
              </InlineGrid>
              <Text as="p" variant="bodyXs" tone="subdued">
                Billing is handled securely through Shopify and appears on your Shopify invoice. Prices in USD. Yearly plans are billed once per year.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
