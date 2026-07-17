import { json, redirect } from "@remix-run/node";
import { useLoaderData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Checkbox, Button, Banner,
  BlockStack, InlineStack, Text, Box, Badge, InlineGrid,
} from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PICTOGRAMS } from "../lib/pictograms";
import { languageByCode } from "../lib/languages";
import { useT } from "../lib/i18n/context";

const CATEGORIES = [
  "Toys", "Electronics", "Cosmetics", "Furniture", "Textiles & apparel",
  "Jewelry & accessories", "Baby & childcare", "Sports & outdoor",
  "Home & kitchen", "Tools & hardware", "Other",
];

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const isNew = params.id === "new";
  const template = isNew ? null : await prisma.complianceTemplate.findFirst({
    where: { id: params.id, shopId: shop.id },
  });
  return json({ template, isNew, required: shop.euMarketLocales || [], pictograms: PICTOGRAMS });
};

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const required = shop.euMarketLocales || [];

  const warnings = [];
  for (const loc of required) {
    const text = String(form.get(`warning_${loc}`) || "").trim();
    if (text) warnings.push({ locale: loc, text });
  }
  const pictograms = form.getAll("pictograms").map(String);

  const data = {
    name: String(form.get("name") || "").trim(),
    category: String(form.get("category") || "").trim() || null,
    requiresCE: form.get("requiresCE") === "on",
    eprCategory: String(form.get("eprCategory") || "").trim() || null,
    careInstructions: String(form.get("careInstructions") || "").trim() || null,
    defaultWarnings: warnings,
    defaultPictograms: pictograms,
  };

  if (!data.name) {
    return json({ error: "Template name is required.", values: data }, { status: 400 });
  }

  if (params.id === "new") {
    await prisma.complianceTemplate.create({ data: { ...data, shopId: shop.id } });
  } else {
    await prisma.complianceTemplate.update({ where: { id: params.id }, data });
  }
  return redirect("/app/templates");
};

export default function TemplateEditor() {
  const { template, isNew, required, pictograms } = useLoaderData();
  const nav = useNavigation();
  const t = useT();
  const saving = nav.state === "submitting";
  const tpl = template || {};

  const savedWarnings = Object.fromEntries((tpl.defaultWarnings || []).map((w) => [w.locale, w.text]));
  const [ce, setCe] = useState(!!tpl.requiresCE);
  const [selected, setSelected] = useState(new Set(tpl.defaultPictograms || []));

  const togglePict = (key) => {
    setSelected((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  return (
    <Page
      title={isNew ? "New template" : `Edit: ${tpl.name}`}
      subtitle="These values apply to every product this template is attached to."
      backAction={{ content: t("nav.templates"), url: "/app/templates" }}
    >
      <Form method="post">
        {[...selected].map((k) => <input key={k} type="hidden" name="pictograms" value={k} />)}
        <Layout>
          <Layout.Section>
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Template basics</Text>
                  <FormLayout>
                    <FormLayout.Group>
                      <TextField label="Template name" name="name" autoComplete="off"
                        defaultValue={tpl.name} requiredIndicator placeholder="e.g. Wooden toys" />
                      <Select label="Category" name="category"
                        options={[{ label: "Select…", value: "" }, ...CATEGORIES.map((c) => ({ label: c, value: c }))]}
                        defaultValue={tpl.category || ""} onChange={() => {}} />
                    </FormLayout.Group>
                    <Checkbox label="Products in this category require CE marking"
                      name="requiresCE" checked={ce} onChange={setCe}
                      helpText="If ticked, a product using this template stays Incomplete until CE is confirmed." />
                    <TextField label="EPR category (optional)" name="eprCategory"
                      autoComplete="off" defaultValue={tpl.eprCategory || ""}
                      helpText="e.g. packaging, batteries, electronics — used for Amazon/TikTok EPR fields." />
                  </FormLayout>
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="400">
                  <Text as="h2" variant="headingMd">Warning pictograms</Text>
                  <Text as="p" variant="bodySm" tone="subdued">Select the safety symbols that apply to this category.</Text>
                  <InlineGrid columns={{ xs: 2, sm: 3, md: 4 }} gap="300">
                    {pictograms.map((p) => {
                      const on = selected.has(p.key);
                      return (
                        <Box key={p.key} padding="300" borderRadius="200"
                          borderWidth="050"
                          borderColor={on ? "border-emphasis" : "border"}
                          background={on ? "bg-surface-selected" : "bg-surface"}>
                          <button type="button" onClick={() => togglePict(p.key)}
                            style={{ all: "unset", cursor: "pointer", width: "100%", textAlign: "center" }}>
                            <BlockStack gap="150" inlineAlign="center">
                              <span style={{ width: 40, height: 40, display: "inline-block" }}
                                dangerouslySetInnerHTML={{ __html: p.svg }} />
                              <Text as="span" variant="bodyXs" alignment="center"
                                tone={on ? "base" : "subdued"}>{p.label}</Text>
                              {on && <Badge tone="success" size="small">Selected</Badge>}
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
                  <InlineStack align="space-between" blockAlign="center">
                    <Text as="h2" variant="headingMd">Default warnings</Text>
                    <Badge tone={required.length ? "info" : "attention"}>
                      {required.length ? `${required.length} market languages` : "No markets set"}
                    </Badge>
                  </InlineStack>
                  {required.length === 0 ? (
                    <Banner tone="warning" action={{ content: "Set market languages", url: "/app/languages" }}>
                      <Text as="p">Choose your EU market languages first, then add warnings here.</Text>
                    </Banner>
                  ) : (
                    <FormLayout>
                      {required.map((loc) => {
                        const lang = languageByCode(loc);
                        return (
                          <TextField key={loc} multiline={2} autoComplete="off"
                            name={`warning_${loc}`}
                            label={`${lang ? lang.native : loc} (${lang ? lang.name : loc})`}
                            defaultValue={savedWarnings[loc] || ""}
                            placeholder="Default warning applied to products using this template" />
                        );
                      })}
                    </FormLayout>
                  )}
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Care & usage</Text>
                  <TextField label="Care instructions" name="careInstructions" multiline={3}
                    autoComplete="off" defaultValue={tpl.careInstructions || ""} labelHidden />
                </BlockStack>
              </Card>
            </BlockStack>
          </Layout.Section>

          <Layout.Section variant="oneThird">
            <Card>
              <BlockStack gap="300">
                <Text as="h3" variant="headingSm">Save</Text>
                <Text as="p" variant="bodySm" tone="subdued">
                  After saving, apply this template to products from the Products page (select products → Apply template).
                </Text>
                <Button variant="primary" submit loading={saving} fullWidth>Save template</Button>
                <Button url="/app/templates" fullWidth>Cancel</Button>
              </BlockStack>
            </Card>
          </Layout.Section>
        </Layout>
      </Form>
    </Page>
  );
}
