import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useFetcher, useSearchParams } from "@remix-run/react";
import { useState, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Checkbox, Button, Banner,
  BlockStack, InlineStack, Text, Box, Badge, Divider, Thumbnail, Icon, List, InlineGrid,
} from "@shopify/polaris";
import { ImageIcon, AlertTriangleIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { computeCompliance, STATUS_META } from "../lib/compliance";
import { languageByCode } from "../lib/languages";
import { PICTOGRAMS } from "../lib/pictograms";
import { ensureGpsrDefinitions, writeComplianceMetafields } from "../lib/shopify-metafields";
import { useT } from "../lib/i18n/context";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

const PRODUCT_QUERY = `#graphql
  query Product($id: ID!) {
    product(id: $id) {
      id title
      featuredImage { url altText }
      variants(first: 10) { edges { node { id title sku barcode } } }
    }
  }`;

export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const productId = decodeURIComponent(params.id);

  let product = { id: productId, title: "Product", featuredImage: null, variants: [] };
  try {
    const res = await admin.graphql(PRODUCT_QUERY, { variables: { id: productId } });
    const body = await res.json();
    const p = body.data?.product;
    if (p) {
      product = {
        id: p.id, title: p.title,
        featuredImage: p.featuredImage,
        variants: (p.variants?.edges || []).map((e) => e.node),
      };
    }
  } catch (e) { /* offline / dev fallback */ }

  const [record, rps, manufacturers, templates] = await Promise.all([
    prisma.productCompliance.findFirst({ where: { shopId: shop.id, shopifyProductId: productId } }),
    prisma.responsiblePerson.findMany({ where: { shopId: shop.id } }),
    prisma.manufacturer.findMany({ where: { shopId: shop.id } }),
    prisma.complianceTemplate.findMany({ where: { shopId: shop.id } }),
  ]);

  const required = shop.euMarketLocales || [];
  const compliance = record ? computeCompliance(record, required) : { status: "INCOMPLETE", missingFields: ["Nothing entered yet"] };

  // Pre-fill GTIN from the first variant barcode if empty
  const firstBarcode = product.variants[0]?.barcode || "";

  return json({ product, record, rps, manufacturers, templates, required, compliance, firstBarcode });
};

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const productId = decodeURIComponent(params.id);
  const form = await request.formData();
  const required = shop.euMarketLocales || [];

  // Collect per-language warnings
  const warnings = [];
  for (const loc of required) {
    const text = String(form.get(`warning_${loc}`) || "").trim();
    if (text) warnings.push({ locale: loc, text });
  }
  const pictograms = form.getAll("pictograms").map(String);

  const data = {
    responsiblePersonId: String(form.get("responsiblePersonId") || "") || null,
    manufacturerId: String(form.get("manufacturerId") || "") || null,
    gtin: String(form.get("gtin") || "").trim() || null,
    modelNumber: String(form.get("modelNumber") || "").trim() || null,
    batchNumber: String(form.get("batchNumber") || "").trim() || null,
    serialNumber: String(form.get("serialNumber") || "").trim() || null,
    careInstructions: String(form.get("careInstructions") || "").trim() || null,
    ceMarked: form.get("ceMarked") === "on",
    eprRegistrationNo: String(form.get("eprRegistrationNo") || "").trim() || null,
    warnings,
    pictograms,
    productTitle: String(form.get("productTitle") || "") || null,
  };

  const { status, missingFields } = computeCompliance(data, required);

  const saved = await prisma.productCompliance.upsert({
    where: { shopId_shopifyProductId_shopifyVariantId: { shopId: shop.id, shopifyProductId: productId, shopifyVariantId: null } },
    create: { shopId: shop.id, shopifyProductId: productId, ...data, status, missingFields, lastScannedAt: new Date() },
    update: { ...data, status, missingFields, lastScannedAt: new Date() },
  });
  await prisma.auditEvent.create({
    data: { shopId: shop.id, actor: session.shop, action: "product.compliance.saved", target: productId },
  });

  // Push resolved data to Shopify metafields so the storefront block can render it.
  try {
    const [rp, mf] = await Promise.all([
      data.responsiblePersonId ? prisma.responsiblePerson.findUnique({ where: { id: data.responsiblePersonId } }) : null,
      data.manufacturerId ? prisma.manufacturer.findUnique({ where: { id: data.manufacturerId } }) : null,
    ]);
    await ensureGpsrDefinitions(admin);
    await writeComplianceMetafields(admin, productId, saved, rp, mf);
  } catch (e) { /* metafield sync failed — record is still saved; retry on next save */ }

  return redirect(`/app/products/${encodeURIComponent(productId)}?saved=1`);
};

export default function ProductEditor() {
  const { product, record, rps, manufacturers, required, compliance, firstBarcode } = useLoaderData();
  const nav = useNavigation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const justSaved = searchParams.get("saved") === "1";
  const r = record || {};
  const savedWarnings = Object.fromEntries((r.warnings || []).map((w) => [w.locale, w.text]));

  const [rpId, setRpId] = useState(r.responsiblePersonId || "");
  const [mfId, setMfId] = useState(r.manufacturerId || "");
  const [gtin, setGtin] = useState(r.gtin || firstBarcode);
  const [modelNumber, setModelNumber] = useState(r.modelNumber || "");
  const [batchNumber, setBatchNumber] = useState(r.batchNumber || "");
  const [serialNumber, setSerialNumber] = useState(r.serialNumber || "");
  const [careInstructions, setCareInstructions] = useState(r.careInstructions || "");
  const [eprRegistrationNo, setEprRegistrationNo] = useState(r.eprRegistrationNo || "");
  const [ce, setCe] = useState(!!r.ceMarked);
  const [picts, setPicts] = useState(new Set(r.pictograms || []));
  const togglePict = (key) => setPicts((prev) => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  // AI autofill for warnings
  const ai = useFetcher();
  const [warnVals, setWarnVals] = useState(savedWarnings);
  useEffect(() => {
    if (ai.data?.warnings) {
      const next = { ...warnVals };
      for (const w of ai.data.warnings) next[w.locale] = w.text;
      setWarnVals(next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ai.data]);
  const runAi = () => {
    const fd = new FormData();
    fd.append("title", product.title);
    ai.submit(fd, { method: "post", action: "/api/ai-autofill" });
  };

  const meta = STATUS_META[compliance.status] || STATUS_META.INCOMPLETE;

  const rpOptions = [{ label: "— Select a Responsible Person —", value: "" },
    ...rps.map((rp) => ({ label: `${rp.legalName} (${rp.role.startsWith("UK") ? "UK" : rp.role.startsWith("CH") ? "CH" : "EU"})`, value: rp.id }))];
  const mfOptions = [{ label: "— Select a manufacturer —", value: "" },
    ...manufacturers.map((m) => ({ label: m.legalName, value: m.id }))];

  return (
    <Page title={product.title} subtitle="Product compliance"
      backAction={{ content: t("nav.products"), url: "/app/products" }}
      titleMetadata={<Badge tone={meta.tone}>{meta.label}</Badge>}>
      <Form method="post">
        <input type="hidden" name="productTitle" value={product.title} />
        {[...picts].map((k) => <input key={k} type="hidden" name="pictograms" value={k} />)}
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              {justSaved && (
                <Banner tone="success" title="Compliance data saved"
                  onDismiss={() => setSearchParams({}, { replace: true })} />
              )}
              {rps.length === 0 && (
                <Banner tone="warning" title="No Responsible Person yet"
                  action={{ content: "Add one", url: "/app/responsible-persons" }}>
                  <Text as="p">You must assign a Responsible Person before this product can be compliant.</Text>
                </Banner>
              )}

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Who is responsible</Text>
                  <FormLayout>
                    <Select label="Responsible Person" name="responsiblePersonId"
                      options={rpOptions} value={rpId} onChange={setRpId} />
                    <Select label="Manufacturer" name="manufacturerId"
                      options={mfOptions} value={mfId} onChange={setMfId}
                      helpText={manufacturers.length === 0 ? "Add manufacturers in Settings." : undefined} />
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Product identifiers</Text>
                  <Text as="p" variant="bodySm" tone="subdued">GPSR requires traceability — at least one identifier.</Text>
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField label="GTIN / Barcode" name="gtin" autoComplete="off"
                        value={gtin} onChange={setGtin}
                        helpText={firstBarcode && !r.gtin ? "Pre-filled from variant barcode." : undefined} />
                      <TextField label="Model number" name="modelNumber" autoComplete="off"
                        value={modelNumber} onChange={setModelNumber} />
                    </FormLayout.Group>
                    <FormLayout.Group>
                      <TextField label="Batch number" name="batchNumber" autoComplete="off"
                        value={batchNumber} onChange={setBatchNumber} />
                      <TextField label="Serial number" name="serialNumber" autoComplete="off"
                        value={serialNumber} onChange={setSerialNumber} />
                    </FormLayout.Group>
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Safety warnings</Text>
                    <InlineStack gap="200" blockAlign="center">
                      <Badge tone={required.length ? "info" : "attention"}>
                        {required.length ? `${required.length} market languages` : "No markets set"}
                      </Badge>
                      {required.length > 0 && (
                        <Button size="slim" onClick={runAi} loading={ai.state !== "idle"}>
                          ✨ AI draft
                        </Button>
                      )}
                    </InlineStack>
                  </InlineStack>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Warnings must be written in each market language you sell into. One field per language.
                    {ai.data?.error && <Text as="span" tone="critical"> {ai.data.error}</Text>}
                  </Text>
                  {required.length === 0 ? (
                    <Banner tone="warning" action={{ content: "Set market languages", url: "/app/languages" }}>
                      <Text as="p">Choose your EU market languages first.</Text>
                    </Banner>
                  ) : (
                    <FormLayout>
                      {required.map((loc) => {
                        const lang = languageByCode(loc);
                        return (
                          <TextField key={loc} multiline={2} autoComplete="off"
                            name={`warning_${loc}`}
                            label={`${lang ? lang.native : loc} (${lang ? lang.name : loc})`}
                            value={warnVals[loc] || ""}
                            onChange={(val) => setWarnVals((p) => ({ ...p, [loc]: val }))}
                            placeholder="e.g. Warning. Not suitable for children under 3 years. Small parts." />
                        );
                      })}
                    </FormLayout>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Warning pictograms</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Shown on the storefront product page. Select what applies.</Text>
                  <InlineGrid columns={{ xs: 2, sm: 3, md: 4 }} gap="300">
                    {PICTOGRAMS.map((p) => {
                      const on = picts.has(p.key);
                      return (
                        <Box key={p.key} padding="300" borderRadius="200" borderWidth="050"
                          borderColor={on ? "border-emphasis" : "border"}
                          background={on ? "bg-surface-selected" : "bg-surface"}>
                          <button type="button" onClick={() => togglePict(p.key)}
                            style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center" }}>
                            <BlockStack gap="150" inlineAlign="center">
                              <span style={{ width: 36, height: 36, display: "inline-block" }}
                                dangerouslySetInnerHTML={{ __html: p.svg }} />
                              <Text as="span" variant="bodyXs" alignment="center" tone={on ? "base" : "subdued"}>{p.label}</Text>
                            </BlockStack>
                          </button>
                        </Box>
                      );
                    })}
                  </InlineGrid>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Conformity & care</Text>
                  <FormLayout>
                    <Checkbox label="This product carries CE marking (toys, electronics, PPE)"
                      name="ceMarked" checked={ce} onChange={setCe} />
                    <TextField label="Care & usage instructions" name="careInstructions" multiline={3}
                      autoComplete="off" value={careInstructions} onChange={setCareInstructions} />
                    <TextField label="EPR registration number (optional)" name="eprRegistrationNo"
                      autoComplete="off" value={eprRegistrationNo} onChange={setEprRegistrationNo}
                      helpText="Some markets/categories ask for this on Amazon and TikTok." />
                  </FormLayout>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="300" blockAlign="center">
                    <Thumbnail source={product.featuredImage?.url || ImageIcon} alt={product.title} size="large" />
                    <BlockStack gap="0">
                      <Text as="span" variant="headingSm">{product.title}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">{product.variants.length} variant(s)</Text>
                    </BlockStack>
                  </InlineStack>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <InlineStack gap="200" blockAlign="center">
                    <Icon source={compliance.status === "READY" || compliance.status === "PUBLISHED" ? CheckCircleIcon : AlertTriangleIcon}
                      tone={meta.tone === "critical" ? "critical" : meta.tone === "success" ? "success" : "warning"} />
                    <Text as="h3" variant="headingSm">Compliance status</Text>
                  </InlineStack>
                  <Badge tone={meta.tone}>{meta.label}</Badge>
                  {compliance.missingFields.length > 0 && (
                    <>
                      <Divider />
                      <Text as="span" variant="bodySm" fontWeight="semibold">Still missing:</Text>
                      <List type="bullet">
                        {compliance.missingFields.map((m) => <List.Item key={m}>{m}</List.Item>)}
                      </List>
                    </>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="200">
                  <Button variant="primary" submit loading={saving} fullWidth>Save compliance data</Button>
                  {record && (
                    <Button url={`/api/passport/${encodeURIComponent(product.id.split("/").pop())}`} external fullWidth>
                      Download GPSR passport (PDF)
                    </Button>
                  )}
                  <Button url="/app/products" fullWidth>Cancel</Button>
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
