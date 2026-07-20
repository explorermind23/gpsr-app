import { json } from "@remix-run/node";
import { useLoaderData, useRevalidator } from "@remix-run/react";
import { useState } from "react";
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
import { canExport } from "../lib/plans";
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

  const filenames = Object.fromEntries(
    Object.entries(CHANNEL_META).map(([k, m]) => [k, m.filename])
  );
  const formats = Object.fromEntries(
    Object.entries(CHANNEL_META).map(([k, m]) => [k, m.format])
  );

  const locked = Object.fromEntries(
    Object.keys(CHANNEL_META).map((k) => [k, !canExport(shop.plan, k)])
  );

  return json({ readyCount, publishedCount, recentExports, filenames, formats, plan: shop.plan, locked });
};

const MARKETPLACES = [
  { key: "amazon", label: "Amazon (EU)", desc: "Compliance flat-file for Seller Central → Manage Your Compliance.", tone: "attention" },
  { key: "tiktok", label: "TikTok Shop (EU)", desc: "Manufacturer + Responsible Person records for the Qualification Center.", tone: "attention" },
  { key: "ebay", label: "eBay", desc: "CSV with all GPSR fields for eBay EU listings.", tone: "base" },
  { key: "etsy", label: "Etsy", desc: "CSV with all GPSR fields for Etsy EU listings.", tone: "base" },
  { key: "temu", label: "Temu", desc: "CSV with all GPSR fields for Temu EU listings.", tone: "base" },
];

export default function Channels() {
  const { readyCount, publishedCount, recentExports, filenames, formats, plan, locked } = useLoaderData();
  const t = useT();
  const revalidator = useRevalidator();
  const [downloading, setDownloading] = useState(null);
  const [exportError, setExportError] = useState(null);

  const download = async (key) => {
    setDownloading(key);
    setExportError(null);
    try {
      const res = await fetch(`/api/export/${key}`);
      if (res.status === 402) {
        const info = await res.json().catch(() => ({}));
        setExportError(info.message || "This export needs a higher plan.");
        return;
      }
      if (!res.ok) throw new Error(`Export failed (${res.status})`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenames[key] || `${key}-gpsr-export.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      revalidator.revalidate(); // refresh "Recent exports"
    } catch (e) {
      setExportError(`Could not generate the ${key} export. Try again — if it keeps failing, re-open the app.`);
    } finally {
      setDownloading(null);
    }
  };

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

        {exportError && (
          <Layout.Section>
            <Banner tone="warning" title={exportError}
              action={{ content: "View plans", url: "/app/billing" }}
              onDismiss={() => setExportError(null)} />
          </Layout.Section>
        )}

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
                            {formats[m.key]}
                          </Badge>
                          {locked[m.key] && <Badge size="small">{plan === "FREE" ? "Starter" : "Pro"}</Badge>}
                        </InlineStack>
                        <Text as="span" variant="bodySm" tone="subdued">{m.desc}</Text>
                      </BlockStack>
                      {locked[m.key] ? (
                        <Button url="/app/billing" variant="secondary">
                          {plan === "FREE" ? "Upgrade to export" : "Upgrade to Pro"}
                        </Button>
                      ) : (
                        <Button icon={ExportIcon} onClick={() => download(m.key)}
                          loading={downloading === m.key}
                          disabled={readyCount === 0 || (downloading && downloading !== m.key)}>
                          {`Export ${readyCount} product(s)`}
                        </Button>
                      )}
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
