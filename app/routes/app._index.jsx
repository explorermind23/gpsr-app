import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page, Layout, Card, Text, Button, BlockStack, InlineStack, Badge, Box,
  ProgressBar, InlineGrid, Icon, Banner, Divider, List,
} from "@shopify/polaris";
import {
  PersonIcon, GlobeIcon, ProductIcon, AlertTriangleIcon, CheckCircleIcon,
  FileIcon, StoreIcon, StatusActiveIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useT } from "../lib/i18n/context";
import { PLAN_LIMITS } from "../lib/plans";
import { countNewRecallMatches } from "../lib/recalls.server";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);

  const [rpCount, mfCount, templateCount, docCount, records, ledgerUsed, newRecalls] =
    await Promise.all([
      prisma.responsiblePerson.count({ where: { shopId: shop.id } }),
      prisma.manufacturer.count({ where: { shopId: shop.id } }),
      prisma.complianceTemplate.count({ where: { shopId: shop.id } }),
      prisma.complianceDocument.count({ where: { shopId: shop.id } }),
      prisma.productCompliance.findMany({
        where: { shopId: shop.id },
        select: { status: true },
      }),
      prisma.productLedgerEntry.count({ where: { shopId: shop.id } }),
      countNewRecallMatches(shop.id).catch(() => 0),
    ]);

  const total = records.length;
  const ready = records.filter((r) => r.status === "READY" || r.status === "PUBLISHED").length;
  const published = records.filter((r) => r.status === "PUBLISHED").length;
  const incomplete = records.filter((r) => r.status === "INCOMPLETE").length;
  const needsReview = records.filter((r) => r.status === "NEEDS_REVIEW").length;
  const langCount = (shop.euMarketLocales || []).length;

  // ── Compliance score (0–100) ────────────────────────────────────────
  const parts = [
    { key: "rp", label: "Responsible Person added", weight: 25, done: rpCount > 0, url: "/app/responsible-persons", cta: "Add one" },
    { key: "lang", label: "EU market languages selected", weight: 15, done: langCount > 0, url: "/app/languages", cta: "Choose languages" },
    { key: "mf", label: "Manufacturer added", weight: 10, done: mfCount > 0, url: "/app/manufacturers", cta: "Add one" },
    { key: "products", label: "Products carry full safety data", weight: 40, done: total > 0 && ready === total,
      partial: total > 0 ? ready / total : 0, url: "/app/products", cta: "Complete products" },
    { key: "docs", label: "Technical documentation stored", weight: 10, done: docCount > 0, url: "/app/documents", cta: "Add a document" },
  ];

  const score = Math.round(
    parts.reduce((sum, p) => {
      if (p.key === "products") return sum + p.weight * (p.partial || 0);
      return sum + (p.done ? p.weight : 0);
    }, 0)
  );

  const limit = PLAN_LIMITS[shop.plan] ?? PLAN_LIMITS.FREE;

  return json({
    shop, score, parts,
    stats: { total, ready, published, incomplete, needsReview, langCount, docCount, rpCount, mfCount, templateCount },
    ledger: { used: ledgerUsed, limit: limit === Infinity ? null : limit },
    newRecalls,
  });
};

function scoreTone(score) {
  if (score >= 90) return { tone: "success", label: "Compliant" };
  if (score >= 50) return { tone: "warning", label: "In progress" };
  return { tone: "critical", label: "At risk" };
}

export default function Index() {
  const { shop, score, parts, stats, ledger, newRecalls } = useLoaderData();
  const t = useT();
  const st = scoreTone(score);
  const doneCount = parts.filter((p) => p.done).length;
  const nextStep = parts.find((p) => !p.done);

  return (
    <Page
      title="GPSR Compliance Hub"
      subtitle="EU product-safety compliance across every sales channel"
      primaryAction={{ content: "Scan my catalog", url: "/app/scanner" }}
      secondaryActions={
        stats.rpCount === 0
          ? [{ content: "Add Responsible Person", url: "/app/responsible-persons" }]
          : [{ content: "Manage products", url: "/app/products" }]
      }
    >
      <Layout>
        {newRecalls > 0 && (
          <Layout.Section>
            <Banner tone="critical" title={`${newRecalls} product(s) may match a recent EU recall`}
              action={{ content: "Review recall alerts", url: "/app/recalls" }}>
              <Text as="p">The EU Safety Gate published alerts that resemble items in your catalog. Review them before they reach customers.</Text>
            </Banner>
          </Layout.Section>
        )}

        {ledger.limit !== null && ledger.used >= ledger.limit && (
          <Layout.Section>
            <Banner tone="warning" title="You've used every product slot on your plan"
              action={{ content: "View plans", url: "/app/billing" }}>
              <Text as="p">{`${ledger.used} of ${ledger.limit} lifetime slots used. Upgrade to add compliance data to more products.`}</Text>
            </Banner>
          </Layout.Section>
        )}

        {/* Compliance score */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Compliance score</Text>
                <Badge tone={st.tone}>{st.label}</Badge>
              </InlineStack>
              <InlineStack gap="500" blockAlign="center" wrap>
                <BlockStack gap="0">
                  <Text as="span" variant="heading2xl">{`${score}%`}</Text>
                  <Text as="span" variant="bodySm" tone="subdued">{`${doneCount} of ${parts.length} steps complete`}</Text>
                </BlockStack>
                <Box minWidth="260px" width="55%">
                  <ProgressBar progress={score} tone={st.tone === "critical" ? "critical" : st.tone === "warning" ? "highlight" : "success"} />
                </Box>
              </InlineStack>
              {nextStep && (
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <InlineStack align="space-between" blockAlign="center" wrap>
                    <Text as="span" variant="bodyMd">
                      <b>Next step:</b> {nextStep.label}
                    </Text>
                    <Button variant="primary" url={nextStep.url}>{nextStep.cta}</Button>
                  </InlineStack>
                </Box>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Setup checklist */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Setup checklist</Text>
              <BlockStack gap="200">
                {parts.map((p) => (
                  <Box key={p.key}>
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={p.done ? CheckCircleIcon : StatusActiveIcon}
                          tone={p.done ? "success" : "subdued"} />
                        <BlockStack gap="0">
                          <Text as="span" variant="bodyMd" tone={p.done ? "subdued" : "base"}>{p.label}</Text>
                          {p.key === "products" && stats.total > 0 && !p.done && (
                            <Text as="span" variant="bodySm" tone="subdued">
                              {`${stats.ready} of ${stats.total} products ready`}
                            </Text>
                          )}
                        </BlockStack>
                      </InlineStack>
                      {p.done ? <Badge tone="success">Done</Badge> : <Button url={p.url} size="slim">{p.cta}</Button>}
                    </InlineStack>
                    <Box paddingBlockStart="200"><Divider /></Box>
                  </Box>
                ))}
                <InlineStack align="space-between" blockAlign="center" wrap>
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={StoreIcon} tone="subdued" />
                    <BlockStack gap="0">
                      <Text as="span" variant="bodyMd">Storefront safety block added to your theme</Text>
                      <Text as="span" variant="bodySm" tone="subdued">Add the "GPSR Compliance" block to your product template in the theme editor.</Text>
                    </BlockStack>
                  </InlineStack>
                  <Badge>Manual step</Badge>
                </InlineStack>
              </BlockStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Catalog status */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Catalog status</Text>
              <InlineStack gap="400" wrap>
                <InlineStack gap="100" blockAlign="center">
                  <Icon source={CheckCircleIcon} tone="success" />
                  <Text as="span" variant="bodyMd">{`${stats.ready} compliant`}</Text>
                </InlineStack>
                <InlineStack gap="100" blockAlign="center">
                  <Icon source={AlertTriangleIcon} tone="critical" />
                  <Text as="span" variant="bodyMd">{`${stats.incomplete} missing data`}</Text>
                </InlineStack>
                <InlineStack gap="100" blockAlign="center">
                  <Icon source={AlertTriangleIcon} tone="warning" />
                  <Text as="span" variant="bodyMd">{`${stats.needsReview} need review`}</Text>
                </InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Stat tiles */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="300">
            {[
              { icon: ProductIcon, label: "Products tracked", value: stats.total },
              { icon: CheckCircleIcon, label: "Published to storefront", value: stats.published },
              { icon: GlobeIcon, label: "EU market languages", value: stats.langCount },
              { icon: FileIcon, label: "Documents on file", value: stats.docCount },
            ].map((s) => (
              <Card key={s.label}>
                <BlockStack gap="200">
                  <InlineStack align="space-between" blockAlign="center">
                    <Icon source={s.icon} tone="subdued" />
                    <Text as="span" variant="bodySm" tone="subdued">{s.label}</Text>
                  </InlineStack>
                  <Text as="span" variant="headingLg">{s.value}</Text>
                </BlockStack>
              </Card>
            ))}
          </InlineGrid>
        </Layout.Section>

        {/* Channels */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Channels</Text>
              <Text as="p" variant="bodySm" tone="subdued">Enter safety data once — publish everywhere it's required.</Text>
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                {[
                  { name: "Shopify storefront", state: "Live injection", tone: "success" },
                  { name: "Amazon (EU)", state: "Feed export ready", tone: "attention" },
                  { name: "TikTok Shop (EU)", state: "Sync ready", tone: "attention" },
                ].map((c) => (
                  <Box key={c.name} padding="300" borderColor="border" borderWidth="025" borderRadius="200">
                    <BlockStack gap="150">
                      <Text as="span" variant="bodyMd" fontWeight="semibold">{c.name}</Text>
                      <Badge tone={c.tone}>{c.state}</Badge>
                    </BlockStack>
                  </Box>
                ))}
              </InlineGrid>
              <InlineStack>
                <Button url="/app/channels">Manage channels & exports</Button>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Quick actions + DPP */}
        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Quick actions</Text>
                <BlockStack gap="200">
                  <Button url="/app/products" fullWidth>Manage product compliance</Button>
                  <Button url="/app/templates" fullWidth>Create a template (bulk apply)</Button>
                  <Button url="/app/recalls" fullWidth>Check recall alerts</Button>
                </BlockStack>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Coming for you (DPP-ready)</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  Your data is already structured for the EU Digital Product Passport (textiles first, ~2027). When it lands, you switch it on — no re-entry.
                </Text>
                <InlineStack><Badge tone="info">DPP data model active</Badge></InlineStack>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
