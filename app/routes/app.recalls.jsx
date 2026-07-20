import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSearchParams, useSubmit, useNavigation, Form } from "@remix-run/react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Badge, Button, Box,
  Banner, EmptyState, Divider, Icon, Link as PolarisLink,
} from "@shopify/polaris";
import { AlertTriangleIcon, RefreshIcon, ExternalIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { syncRecallFeed, matchAlertsForShop } from "../lib/recalls.server";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

const CATALOG_QUERY = `#graphql
  query RecallCatalog($first: Int!) {
    products(first: $first) {
      edges {
        node {
          id title vendor productType
          variants(first: 20) { edges { node { barcode } } }
        }
      }
    }
  }`;

async function loadCatalog(admin) {
  try {
    const res = await admin.graphql(CATALOG_QUERY, { variables: { first: 100 } });
    const body = await res.json();
    return (body.data?.products?.edges || []).map((e) => ({
      id: e.node.id,
      title: e.node.title,
      vendor: e.node.vendor,
      productType: e.node.productType,
      barcodes: (e.node.variants?.edges || []).map((v) => v.node.barcode).filter(Boolean),
    }));
  } catch (e) {
    return [];
  }
}

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);

  let feedError = null;
  if (shop.recallAlertsEnabled) {
    try {
      await syncRecallFeed();
      const catalog = await loadCatalog(admin);
      if (catalog.length) await matchAlertsForShop(shop.id, catalog);
    } catch (e) {
      feedError = "Could not refresh the EU Safety Gate feed just now. Showing previously matched alerts.";
    }
  }

  const [matches, alertCount, lastAlert] = await Promise.all([
    prisma.recallMatch.findMany({
      where: { shopId: shop.id },
      include: { alert: true },
      orderBy: [{ status: "asc" }, { matchScore: "desc" }],
      take: 100,
    }),
    prisma.recallAlert.count(),
    prisma.recallAlert.findFirst({ orderBy: { alertDate: "desc" } }),
  ]);

  return json({
    matches,
    alertCount,
    lastAlertDate: lastAlert?.alertDate || null,
    enabled: shop.recallAlertsEnabled,
    feedError,
  });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = String(form.get("intent"));

  if (intent === "dismiss" || intent === "actioned") {
    await prisma.recallMatch.update({
      where: { id: String(form.get("id")) },
      data: { status: intent === "dismiss" ? "DISMISSED" : "ACTIONED" },
    });
    return json({ ok: true });
  }

  if (intent === "logIncident") {
    const match = await prisma.recallMatch.findUnique({
      where: { id: String(form.get("id")) },
      include: { alert: true },
    });
    if (match) {
      await prisma.incidentLog.create({
        data: {
          shopId: shop.id,
          type: "RECALL",
          productRef: match.productTitle || match.shopifyProductId,
          description:
            `EU Safety Gate alert ${match.alert.alertNumber} (${match.alert.alertLevel || "risk"}): ` +
            `${match.alert.productName || "recalled product"}. ${match.alert.description || ""}`.trim(),
          actionTaken: null,
          reportedToAuthority: false,
          occurredAt: match.alert.alertDate || new Date(),
        },
      });
      await prisma.recallMatch.update({ where: { id: match.id }, data: { status: "ACTIONED" } });
      await prisma.auditEvent.create({
        data: { shopId: shop.id, actor: session.shop, action: "recall.loggedAsIncident", target: match.alert.alertNumber },
      });
    }
    return redirect("/app/recalls?logged=1");
  }

  if (intent === "resync") {
    await syncRecallFeed({ force: true });
    const catalog = await loadCatalog(admin);
    if (catalog.length) await matchAlertsForShop(shop.id, catalog);
    return redirect("/app/recalls?synced=1");
  }

  return json({ ok: false });
};

const STATUS_META = {
  NEW: { tone: "critical", label: "Needs review" },
  DISMISSED: { tone: undefined, label: "Dismissed" },
  ACTIONED: { tone: "success", label: "Logged as incident" },
};

export default function Recalls() {
  const { matches, alertCount, lastAlertDate, enabled, feedError } = useLoaderData();
  const submit = useSubmit();
  const nav = useNavigation();
  const [params, setParams] = useSearchParams();
  const syncing = nav.formData?.get("intent") === "resync";

  const act = (id, intent) => {
    const fd = new FormData();
    fd.append("intent", intent);
    fd.append("id", id);
    submit(fd, { method: "post" });
  };

  const newOnes = matches.filter((m) => m.status === "NEW");

  return (
    <Page
      title="Recall alerts"
      subtitle="Products in your catalog that resemble items recalled through the EU Safety Gate."
      backAction={{ content: "Dashboard", url: "/app" }}
      secondaryActions={[
        { content: "Re-check catalog", icon: RefreshIcon, loading: syncing,
          onAction: () => submit(new URLSearchParams({ intent: "resync" }), { method: "post" }) },
      ]}
    >
      <Layout>
        {params.get("logged") === "1" && (
          <Layout.Section>
            <Banner tone="success" title="Added to your Incident Log"
              action={{ content: "Open Incident Log", url: "/app/incidents" }}
              onDismiss={() => setParams({}, { replace: true })} />
          </Layout.Section>
        )}
        {params.get("synced") === "1" && (
          <Layout.Section>
            <Banner tone="success" title="Catalog re-checked against the latest alerts"
              onDismiss={() => setParams({}, { replace: true })} />
          </Layout.Section>
        )}
        {feedError && (
          <Layout.Section>
            <Banner tone="warning" title={feedError} />
          </Layout.Section>
        )}
        {!enabled && (
          <Layout.Section>
            <Banner tone="info" title="Recall alerts are switched off"
              action={{ content: "Turn on in Settings", url: "/app/settings" }} />
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="200">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Monitoring</Text>
                <Badge tone={newOnes.length ? "critical" : "success"}>
                  {newOnes.length ? `${newOnes.length} to review` : "Nothing to review"}
                </Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                {`Checking your catalog against ${alertCount} recent EU Safety Gate alerts` +
                  (lastAlertDate ? ` · latest alert ${new Date(lastAlertDate).toLocaleDateString()}` : "") + "."}
              </Text>
              <Text as="p" variant="bodyXs" tone="subdued">
                Matches are suggestions based on barcode, brand and product category — always confirm against the official alert before acting.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {matches.length === 0 ? (
            <Card>
              <EmptyState heading="No matching recalls"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg">
                <p>Nothing in your catalog resembles a recently recalled product. We re-check automatically when you open this page.</p>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="300">
              {matches.map((m) => {
                const meta = STATUS_META[m.status] || STATUS_META.NEW;
                return (
                  <Card key={m.id}>
                    <BlockStack gap="300">
                      <InlineStack align="space-between" blockAlign="start" wrap>
                        <InlineStack gap="200" blockAlign="center">
                          <Icon source={m.status === "NEW" ? AlertTriangleIcon : CheckCircleIcon}
                            tone={m.status === "NEW" ? "critical" : "success"} />
                          <BlockStack gap="0">
                            <Text as="span" variant="headingSm">{m.productTitle}</Text>
                            <Text as="span" variant="bodySm" tone="subdued">{m.matchReason}</Text>
                          </BlockStack>
                        </InlineStack>
                        <InlineStack gap="200" blockAlign="center">
                          <Badge tone={meta.tone}>{meta.label}</Badge>
                          <Badge>{`${m.matchScore}% confidence`}</Badge>
                        </InlineStack>
                      </InlineStack>

                      <Divider />

                      <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                        <BlockStack gap="150">
                          <InlineStack gap="200" blockAlign="center" wrap>
                            <Text as="span" variant="bodyMd" fontWeight="semibold">
                              {m.alert.productName || "Recalled product"}
                            </Text>
                            {m.alert.alertLevel && <Badge tone="critical">{m.alert.alertLevel}</Badge>}
                            {m.alert.riskType && <Badge>{m.alert.riskType}</Badge>}
                          </InlineStack>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {[m.alert.productBrand && `Brand: ${m.alert.productBrand}`,
                              m.alert.productCategory && `Category: ${m.alert.productCategory}`,
                              m.alert.alertCountry && `Notified by: ${m.alert.alertCountry}`,
                              m.alert.alertNumber && `Alert ${m.alert.alertNumber}`]
                              .filter(Boolean).join("  ·  ")}
                          </Text>
                          {m.alert.description && (
                            <Text as="p" variant="bodySm">{m.alert.description}</Text>
                          )}
                          {m.alert.rapexUrl && (
                            <InlineStack>
                              <Button url={m.alert.rapexUrl} target="_blank" icon={ExternalIcon} variant="plain">
                                View official alert
                              </Button>
                            </InlineStack>
                          )}
                        </BlockStack>
                      </Box>

                      {m.status === "NEW" && (
                        <InlineStack align="end" gap="200">
                          <Button onClick={() => act(m.id, "dismiss")}>Not my product</Button>
                          <Button variant="primary" tone="critical" onClick={() => act(m.id, "logIncident")}>
                            Log as incident
                          </Button>
                        </InlineStack>
                      )}
                    </BlockStack>
                  </Card>
                );
              })}
            </BlockStack>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
