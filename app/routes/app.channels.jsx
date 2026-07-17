import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Button, Box, Icon,
  Divider, InlineGrid, Banner,
} from "@shopify/polaris";
import {
  StoreIcon, ExportIcon, CheckCircleIcon, ClockIcon, GlobeIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { CHANNEL_META } from "../lib/exporters";
import { useT } from "../lib/i18n/context";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);

  const [readyCount, publishedCount, recentExports] = await Promise.all([
    prisma.productCompliance.count({ where: { shopId: shop.id, status: { in: ["READY", "PUBLISHED"] } } }),
    prisma.productCompliance.count({ where: { shopId: shop.id, status: "PUBLISHED" } }),
    prisma.channelExport.findMany({ where: { shopId: shop.id }, orderBy: { createdAt: "desc" }, take: 8 }),
  ]);

  return json({ readyCount, publishedCount, recentExports });
};

const MARKETPLACES = [
  { key: "amazon", label: "Amazon (EU)", desc: "Compliance flat-file for Seller Central → Manage Your Compliance.", tone: "attention" },
  { key: "tiktok", label: "TikTok Shop (EU)", desc: "Manufacturer + Responsible Person records for the Qualification Center.", tone: "attention" },
  { key: "ebay", label: "eBay", desc: "CSV with all GPSR fields for eBay EU listings.", tone: "base" },
  { key: "etsy", label: "Etsy", desc: "CSV with all GPSR fields for Etsy EU listings.", tone: "base" },
  { key: "temu", label: "Temu", desc: "CSV with all GPSR fields for Temu EU listings.", tone: "base" },
];

export default function Channels() {
  const { readyCount, publishedCount, recentExports } = useLoaderData();
  const t = useT();

  return (
    <Page
      title={t("nav.channels")}
      subtitle="Enter safety data once — publish it to every marketplace that requires it."
      backAction={{ content: t("common.back"), url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Banner tone="info">
            <Text as="p" variant="bodySm">
              {`${readyCount} product(s) are compliance-ready and can be exported. Each marketplace enforces GPSR at listing time — upload the matching file to keep your listings live.`}
            </Text>
          </Banner>
        </Layout.Section>

        {/* Shopify — native, live */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="200" blockAlign="center">
                  <Icon source={StoreIcon} tone="base" />
                  <BlockStack gap="0">
                    <Text as="span" variant="headingSm">Shopify storefront</Text>
                    <Text as="span" variant="bodySm" tone="subdued">Native — data is injected onto product pages automatically.</Text>
                  </BlockStack>
                </InlineStack>
                <Badge tone="success">{`${publishedCount} live`}</Badge>
              </InlineStack>
              <Divider />
              <InlineStack gap="200">
                <Button url="/app/products">Manage products</Button>
                <Text as="span" variant="bodySm" tone="subdued">Add the "GPSR Compliance" block to your product template in the theme editor.</Text>
              </InlineStack>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Marketplaces — export */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={GlobeIcon} tone="base" />
                <Text as="h2" variant="headingMd">Marketplace exports</Text>
              </InlineStack>
              <Divider />
              <BlockStack gap="300">
                {MARKETPLACES.map((m) => (
                  <Box key={m.key} padding="300" borderColor="border" borderWidth="025" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <BlockStack gap="050">
                        <InlineStack gap="200" blockAlign="center">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{m.label}</Text>
                          <Badge tone={m.tone === "attention" ? "attention" : undefined} size="small">
                            {CHANNEL_META[m.key].format}
                          </Badge>
                        </InlineStack>
                        <Text as="span" variant="bodySm" tone="subdued">{m.desc}</Text>
                      </BlockStack>
                      <Button icon={ExportIcon} url={`/api/export/${m.key}`} external
                        disabled={readyCount === 0}>
                        {`Export ${readyCount} product(s)`}
                      </Button>
                    </InlineStack>
                  </Box>
                ))}
              </BlockStack>
              {readyCount === 0 && (
                <Text as="p" variant="bodySm" tone="subdued">
                  No compliance-ready products yet. Complete products first — only READY products are exported.
                </Text>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Recent exports */}
        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">Recent exports</Text>
              {recentExports.length === 0 ? (
                <Text as="p" variant="bodySm" tone="subdued">No exports yet. Generate one above.</Text>
              ) : (
                <BlockStack gap="200">
                  {recentExports.map((ex) => (
                    <InlineStack key={ex.id} align="space-between" blockAlign="center">
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={ClockIcon} tone="subdued" />
                        <Text as="span" variant="bodySm">
                          {`${ex.channel} · ${ex.rowCount} products · ${new Date(ex.createdAt).toLocaleString()}`}
                        </Text>
                      </InlineStack>
                      <Badge>{ex.format}</Badge>
                    </InlineStack>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
