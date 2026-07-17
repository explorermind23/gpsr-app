import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useRevalidator } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Button, ProgressBar,
  Box, Icon, Divider, IndexTable, Thumbnail, Banner, InlineGrid, List,
} from "@shopify/polaris";
import {
  CheckCircleIcon, AlertTriangleIcon, RefreshIcon, ImageIcon, ProductIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { computeCompliance, STATUS_META } from "../lib/compliance";
import { useT } from "../lib/i18n/context";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

const SCAN_QUERY = `#graphql
  query ScanProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, sortKey: TITLE) {
      edges { node { id title featuredImage { url } } }
      pageInfo { hasNextPage endCursor }
    }
  }`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const required = shop.euMarketLocales || [];

  // Fetch up to 250 products (5 pages of 50)
  let products = [];
  let after = null;
  try {
    for (let i = 0; i < 5; i++) {
      const res = await admin.graphql(SCAN_QUERY, { variables: { first: 50, after } });
      const body = await res.json();
      const conn = body.data?.products;
      if (!conn) break;
      products.push(...conn.edges.map((e) => e.node));
      if (!conn.pageInfo.hasNextPage) break;
      after = conn.pageInfo.endCursor;
    }
  } catch (e) { /* offline / dev */ }

  const records = await prisma.productCompliance.findMany({ where: { shopId: shop.id } });
  const byId = new Map(records.map((r) => [r.shopifyProductId, r]));

  const gapCounts = {};
  const incomplete = [];
  let ready = 0;

  for (const p of products) {
    const rec = byId.get(p.id);
    let result;
    if (!rec) result = { status: "INCOMPLETE", missingFields: ["Not started — no compliance data"] };
    else result = computeCompliance(rec, required);

    if (result.status === "READY" || result.status === "PUBLISHED") {
      ready++;
    } else {
      for (const g of result.missingFields) gapCounts[g] = (gapCounts[g] || 0) + 1;
      incomplete.push({ id: p.id, title: p.title, image: p.featuredImage?.url || null, missing: result.missingFields });
    }
  }

  // persist scan timestamp on existing records
  try {
    await prisma.productCompliance.updateMany({
      where: { shopId: shop.id }, data: { lastScannedAt: new Date() },
    });
  } catch (e) { /* ignore */ }

  const total = products.length;
  const pct = total ? Math.round((ready / total) * 100) : 0;
  const gaps = Object.entries(gapCounts).sort((a, b) => b[1] - a[1]).map(([label, count]) => ({ label, count }));

  return json({
    total, ready, incompleteCount: incomplete.length, pct, gaps,
    incomplete: incomplete.slice(0, 100),
    marketCount: required.length, scannedAt: new Date().toISOString(),
  });
};

export default function Scanner() {
  const { total, ready, incompleteCount, pct, gaps, incomplete, marketCount } = useLoaderData();
  const navigate = useNavigate();
  const revalidator = useRevalidator();
  const t = useT();

  const rows = incomplete.map((p, index) => (
    <IndexTable.Row id={p.id} key={p.id} position={index}
      onClick={() => navigate(`/app/products/${encodeURIComponent(p.id)}`)}>
      <IndexTable.Cell>
        <InlineStack gap="300" blockAlign="center">
          <Thumbnail source={p.image || ImageIcon} alt={p.title} size="small" />
          <Text as="span" variant="bodyMd" fontWeight="semibold">{p.title}</Text>
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <InlineStack gap="100" wrap>
          {p.missing.slice(0, 4).map((m) => (
            <Badge key={m} tone="critical" size="small">{m}</Badge>
          ))}
          {p.missing.length > 4 && <Badge size="small">{`+${p.missing.length - 4}`}</Badge>}
        </InlineStack>
      </IndexTable.Cell>
      <IndexTable.Cell>
        <Button variant="plain" onClick={() => navigate(`/app/products/${encodeURIComponent(p.id)}`)}>Fix</Button>
      </IndexTable.Cell>
    </IndexTable.Row>
  ));

  return (
    <Page
      title={t("nav.scanner")}
      subtitle="Audit your whole catalog against GPSR and see exactly what's missing."
      backAction={{ content: t("common.back"), url: "/app" }}
      primaryAction={{ content: "Re-scan catalog", icon: RefreshIcon, loading: revalidator.state === "loading", onAction: () => revalidator.revalidate() }}
    >
      <Layout>
        {marketCount === 0 && (
          <Layout.Section>
            <Banner tone="warning" title="Set market languages for an accurate scan"
              action={{ content: "Set languages", url: "/app/languages" }}>
              <Text as="p">Without market languages selected, the scan can't check whether warnings are present in the buyer's language.</Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Catalog scan result</Text>
                <Badge tone={pct === 100 ? "success" : pct > 50 ? "attention" : "critical"}>
                  {`${pct}% compliant`}
                </Badge>
              </InlineStack>
              <ProgressBar progress={pct} tone={pct === 100 ? "success" : "primary"} />
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack gap="150" blockAlign="center"><Icon source={ProductIcon} /><Text as="span" variant="bodySm" tone="subdued">Scanned</Text></InlineStack>
                    <Text as="p" variant="headingXl">{total}</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface-success" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack gap="150" blockAlign="center"><Icon source={CheckCircleIcon} tone="success" /><Text as="span" variant="bodySm" tone="subdued">Compliant</Text></InlineStack>
                    <Text as="p" variant="headingXl">{ready}</Text>
                  </BlockStack>
                </Box>
                <Box padding="300" background="bg-surface-critical" borderRadius="200">
                  <BlockStack gap="100">
                    <InlineStack gap="150" blockAlign="center"><Icon source={AlertTriangleIcon} tone="critical" /><Text as="span" variant="bodySm" tone="subdued">At risk</Text></InlineStack>
                    <Text as="p" variant="headingXl">{incompleteCount}</Text>
                  </BlockStack>
                </Box>
              </InlineGrid>
              {incompleteCount > 0 && (
                <Text as="p" variant="bodySm" tone="subdued">
                  {`${incompleteCount} product(s) could be removed from EU listings on Shopify, Amazon or TikTok Shop until fixed.`}
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {gaps.length > 0 && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Biggest gaps</Text>
                <Text as="p" variant="bodySm" tone="subdued">The most common missing items across your catalog. Fix these first.</Text>
                <Divider />
                <BlockStack gap="200">
                  {gaps.map((g) => (
                    <InlineStack key={g.label} align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={AlertTriangleIcon} tone="critical" />
                        <Text as="span" variant="bodyMd">{g.label}</Text>
                      </InlineStack>
                      <Badge tone="critical">{`${g.count} products`}</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
                {gaps.some((g) => g.label.includes("Responsible Person")) && (
                  <Box paddingBlockStart="200">
                    <Button url="/app/responsible-persons">Add a Responsible Person</Button>
                  </Box>
                )}
              </BlockStack>
            </Card>
          </Layout.Section>
        )}

        <Layout.Section>
          {incompleteCount === 0 ? (
            <Card>
              <Box padding="400">
                <BlockStack gap="200" inlineAlign="center">
                  <Icon source={CheckCircleIcon} tone="success" />
                  <Text as="h2" variant="headingMd">Every scanned product is compliant</Text>
                  <Text as="p" tone="subdued">Nothing to fix right now. Re-scan after adding products.</Text>
                </BlockStack>
              </Box>
            </Card>
          ) : (
            <Card padding="0">
              <Box padding="300"><Text as="h2" variant="headingMd">Products to fix</Text></Box>
              <IndexTable resourceName={{ singular: "product", plural: "products" }}
                itemCount={incomplete.length} selectable={false}
                headings={[{ title: "Product" }, { title: "Missing" }, { title: "" }]}>
                {rows}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
