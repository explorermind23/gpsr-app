import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import {
  Page, Layout, Card, Text, BlockStack, InlineStack, Box, Badge,
  ProgressBar, Button, Icon, Banner, InlineGrid, Divider,
} from "@shopify/polaris";
import {
  CheckCircleIcon, AlertTriangleIcon, ProductIcon, GlobeIcon,
  FileIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useT } from "../lib/i18n/context";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop =
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }));

  const [total, ready, published, incomplete, review, rpCount, docCount, channelStates] =
    await Promise.all([
      prisma.productCompliance.count({ where: { shopId: shop.id } }),
      prisma.productCompliance.count({ where: { shopId: shop.id, status: "READY" } }),
      prisma.productCompliance.count({ where: { shopId: shop.id, status: "PUBLISHED" } }),
      prisma.productCompliance.count({ where: { shopId: shop.id, status: "INCOMPLETE" } }),
      prisma.productCompliance.count({ where: { shopId: shop.id, status: "NEEDS_REVIEW" } }),
      prisma.responsiblePerson.count({ where: { shopId: shop.id } }),
      prisma.complianceDocument.count({ where: { shopId: shop.id } }),
      prisma.channelProductState.groupBy({
        by: ["channel", "status"],
        where: { productCompliance: { shopId: shop.id } },
        _count: true,
      }).catch(() => []),
    ]);

  const compliant = published + ready;
  const pct = total ? Math.round((compliant / total) * 100) : 0;

  return json({
    shop, stats: { total, ready, published, incomplete, review, compliant, pct, rpCount, docCount },
    channelStates,
  });
};

function StatCard({ icon, label, value, tone }) {
  return (
    <Card>
      <BlockStack gap="200">
        <InlineStack gap="200" blockAlign="center">
          <Icon source={icon} tone={tone} />
          <Text as="span" variant="bodySm" tone="subdued">{label}</Text>
        </InlineStack>
        <Text as="p" variant="heading2xl">{value}</Text>
      </BlockStack>
    </Card>
  );
}

export default function Dashboard() {
  const { shop, stats } = useLoaderData();
  const t = useT();

  return (
    <Page
      title={t("dash.title")}
      subtitle={t("dash.subtitle")}
      primaryAction={{ content: t("dash.scanCatalog"), url: "/app/scanner" }}
      secondaryActions={[{ content: t("dash.addRP"), url: "/app/responsible-persons" }]}
    >
      <Layout>
        {stats.rpCount === 0 && (
          <Layout.Section>
            <Banner title="Start here: add your EU Responsible Person" tone="warning" action={{ content: "Add Responsible Person", url: "/app/responsible-persons" }}>
              <Text as="p">GPSR requires an EU-based contact on every product. Without one, EU listings can be removed on Shopify, Amazon and TikTok Shop.</Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">{t("dash.catalogCompliance")}</Text>
                <Badge tone={stats.pct === 100 ? "success" : stats.pct > 0 ? "attention" : "critical"}>
                  {`${stats.pct}% ${t("dash.ready")}`}
                </Badge>
              </InlineStack>
              <ProgressBar progress={stats.pct} tone={stats.pct === 100 ? "success" : "primary"} />
              <InlineStack gap="600">
                <InlineStack gap="100" blockAlign="center"><Icon source={CheckCircleIcon} tone="success" /><Text as="span">{stats.compliant} {t("dash.compliant")}</Text></InlineStack>
                <InlineStack gap="100" blockAlign="center"><Icon source={AlertTriangleIcon} tone="critical" /><Text as="span">{stats.incomplete} {t("dash.missingData")}</Text></InlineStack>
                <InlineStack gap="100" blockAlign="center"><Icon source={AlertTriangleIcon} tone="warning" /><Text as="span">{stats.review} {t("dash.needReview")}</Text></InlineStack>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, sm: 2, md: 4 }} gap="400">
            <StatCard icon={ProductIcon} label="Products tracked" value={stats.total} tone="base" />
            <StatCard icon={CheckCircleIcon} label="Published to storefront" value={stats.published} tone="success" />
            <StatCard icon={GlobeIcon} label="EU market languages" value={(shop.euMarketLocales || []).length} tone="base" />
            <StatCard icon={FileIcon} label="Documents on file" value={stats.docCount} tone="base" />
          </InlineGrid>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">{t("dash.channels")}</Text>
              <Text as="p" tone="subdued" variant="bodySm">Enter safety data once — publish everywhere it's required.</Text>
              <Divider />
              <InlineGrid columns={{ xs: 1, sm: 3 }} gap="300">
                <ChannelRow name="Shopify storefront" status="Live injection" tone="success" />
                <ChannelRow name="Amazon (EU)" status="Feed export ready" tone="attention" />
                <ChannelRow name="TikTok Shop (EU)" status="Sync ready" tone="attention" />
              </InlineGrid>
              <Box><Button url="/app/channels">Manage channels &amp; exports</Button></Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <InlineGrid columns={{ xs: 1, md: 2 }} gap="400">
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">{t("dash.quickActions")}</Text>
                <Button url="/app/products" fullWidth>Manage product compliance</Button>
                <Button url="/app/templates" fullWidth>Create a template (bulk apply)</Button>
                <Button url="/app/languages" fullWidth>Set EU market languages</Button>
              </BlockStack>
            </Card>
            <Card>
              <BlockStack gap="200">
                <Text as="h3" variant="headingSm">Coming for you (DPP-ready)</Text>
                <Text as="p" variant="bodySm" tone="subdued">Your data is already structured for the EU Digital Product Passport (textiles first, ~2027). When it lands, you switch it on — no re-entry.</Text>
                <Badge tone="info">DPP data model active</Badge>
              </BlockStack>
            </Card>
          </InlineGrid>
        </Layout.Section>
      </Layout>
    </Page>
  );
}

function ChannelRow({ name, status, tone }) {
  return (
    <Box padding="300" borderColor="border" borderWidth="025" borderRadius="200">
      <BlockStack gap="100">
        <Text as="span" variant="bodyMd" fontWeight="semibold">{name}</Text>
        <Badge tone={tone}>{status}</Badge>
      </BlockStack>
    </Box>
  );
}
