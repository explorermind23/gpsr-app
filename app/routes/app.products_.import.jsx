import { json } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Button, Banner, Box,
  Badge, Divider, List, TextField,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { computeCompliance } from "../lib/compliance";
import { useT } from "../lib/i18n/context";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

// Minimal RFC-4180 CSV parser (handles quotes, commas, newlines in fields).
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", inQ = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQ) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') inQ = false;
      else field += c;
    } else {
      if (c === '"') inQ = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === "\r") { /* skip */ }
      else field += c;
    }
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

const PRODUCT_LOOKUP = `#graphql
  query Lookup($query: String!) {
    products(first: 1, query: $query) { edges { node { id title } } }
  }`;

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  await getShop(session);
  return json({ ok: true });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const csvText = String(form.get("csv") || "");
  const required = shop.euMarketLocales || [];

  if (!csvText.trim()) return json({ error: "Paste CSV content first." }, { status: 400 });

  const rows = parseCsv(csvText);
  if (rows.length < 2) return json({ error: "CSV needs a header row and at least one data row." }, { status: 400 });

  const header = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (name) => header.indexOf(name);
  const col = {
    title: idx("product_title") >= 0 ? idx("product_title") : idx("title"),
    gtin: idx("gtin"),
    model: idx("model_number"),
    batch: idx("batch_number"),
    serial: idx("serial_number"),
    care: idx("care_instructions"),
    ce: idx("ce_marked"),
    warn: idx("warnings"), // "DE: ... | FR: ..."
  };

  let matched = 0, updated = 0, notFound = 0;
  const problems = [];

  for (let r = 1; r < rows.length && r < 500; r++) {
    const cells = rows[r];
    const gtin = col.gtin >= 0 ? (cells[col.gtin] || "").trim() : "";
    const title = col.title >= 0 ? (cells[col.title] || "").trim() : "";

    // Find the Shopify product by barcode or title
    let productId = null, productTitle = title;
    try {
      const q = gtin ? `barcode:${gtin}` : `title:${title}`;
      const res = await admin.graphql(PRODUCT_LOOKUP, { variables: { query: q } });
      const body = await res.json();
      const node = body.data?.products?.edges?.[0]?.node;
      if (node) { productId = node.id; productTitle = node.title; }
    } catch (e) { /* ignore */ }

    if (!productId) { notFound++; problems.push(title || gtin || `row ${r + 1}`); continue; }
    matched++;

    // Parse warnings "DE: text | FR: text"
    const warnings = [];
    if (col.warn >= 0 && cells[col.warn]) {
      for (const part of cells[col.warn].split("|")) {
        const m = part.trim().match(/^([a-z]{2})\s*:\s*(.+)$/i);
        if (m) warnings.push({ locale: m[1].toLowerCase(), text: m[2].trim() });
      }
    }

    const data = {
      gtin: gtin || null,
      modelNumber: col.model >= 0 ? (cells[col.model] || "").trim() || null : null,
      batchNumber: col.batch >= 0 ? (cells[col.batch] || "").trim() || null : null,
      serialNumber: col.serial >= 0 ? (cells[col.serial] || "").trim() || null : null,
      careInstructions: col.care >= 0 ? (cells[col.care] || "").trim() || null : null,
      ceMarked: col.ce >= 0 ? /^(yes|true|1)$/i.test((cells[col.ce] || "").trim()) : false,
      warnings,
      productTitle,
    };
    const { status, missingFields } = computeCompliance(data, required);

    await prisma.productCompliance.upsert({
      where: { shopId_shopifyProductId_shopifyVariantId: { shopId: shop.id, shopifyProductId: productId, shopifyVariantId: null } },
      create: { shopId: shop.id, shopifyProductId: productId, ...data, status, missingFields },
      update: { ...data, status, missingFields },
    });
    updated++;
  }

  await prisma.auditEvent.create({
    data: { shopId: shop.id, actor: session.shop, action: "csv.imported", target: `${updated} products`, meta: { matched, notFound } },
  });

  return json({ result: { matched, updated, notFound, problems: problems.slice(0, 20) } });
};

export default function ImportCsv() {
  const actionData = useActionData();
  const nav = useNavigation();
  const t = useT();
  const busy = nav.state === "submitting";
  const [csv, setCsv] = useState("");
  const result = actionData?.result;

  const sample = "product_title,gtin,model_number,ce_marked,warnings\nWooden Toy Car,5012345678900,WTC-1,Yes,DE: Achtung. Kleinteile. | FR: Attention. Petites pièces.";

  return (
    <Page title="Import from CSV"
      subtitle="Fill compliance data for many products at once from a spreadsheet."
      backAction={{ content: t("nav.products"), url: "/app/products" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Paste CSV</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                Products are matched by GTIN (barcode) first, then by exact title. Warnings use the format
                {" "}<Text as="span" fontWeight="semibold">DE: text | FR: text</Text>.
              </Text>
              {actionData?.error && <Banner tone="critical" title={actionData.error} />}
              <Form method="post">
                <BlockStack gap="300">
                  <TextField label="CSV content" name="csv" value={csv} onChange={setCsv}
                    multiline={8} autoComplete="off" monospaced
                    placeholder={sample} labelHidden />
                  <InlineStack align="space-between">
                    <Button onClick={() => setCsv(sample)}>Insert sample</Button>
                    <Button variant="primary" submit loading={busy}>Import</Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {result && (
          <Layout.Section>
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">Import result</Text>
                <InlineStack gap="300">
                  <Badge tone="success">{`${result.updated} updated`}</Badge>
                  <Badge>{`${result.matched} matched`}</Badge>
                  {result.notFound > 0 && <Badge tone="warning">{`${result.notFound} not found`}</Badge>}
                </InlineStack>
                {result.problems.length > 0 && (
                  <>
                    <Divider />
                    <Text as="span" variant="bodySm" fontWeight="semibold">Not matched to a product:</Text>
                    <List type="bullet">
                      {result.problems.map((p, i) => <List.Item key={i}>{p}</List.Item>)}
                    </List>
                  </>
                )}
                <Button url="/app/products">View products</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        )}
      </Layout>
    </Page>
  );
}
