import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit } from "@remix-run/react";
import { useCallback, useState } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Button, Banner, BlockStack,
  InlineStack, Text, Box, Badge, Divider, EmptyState, InlineGrid, Icon, Checkbox, List,
} from "@shopify/polaris";
import {
  DeleteIcon, StoreIcon, PersonIcon, CheckCircleIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
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
  const manufacturers = await prisma.manufacturer.findMany({
    where: { shopId: shop.id }, orderBy: { createdAt: "desc" },
  });
  return json({ shop, manufacturers });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "deleteManufacturer") {
    await prisma.manufacturer.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  if (intent === "savePreferences") {
    await prisma.shop.update({
      where: { id: shop.id },
      data: { sellsIntoEU: form.get("sellsIntoEU") === "on" },
    });
    return redirect("/app/settings?saved=prefs");
  }

  if (intent === "addManufacturer") {
    const data = {
      legalName: String(form.get("legalName") || "").trim(),
      tradeName: String(form.get("tradeName") || "").trim() || null,
      streetAddress: String(form.get("streetAddress") || "").trim(),
      city: String(form.get("city") || "").trim(),
      postalCode: String(form.get("postalCode") || "").trim(),
      country: String(form.get("country") || "").trim(),
      email: String(form.get("email") || "").trim() || null,
      phone: String(form.get("phone") || "").trim() || null,
    };
    const errors = {};
    if (!data.legalName) errors.legalName = "Manufacturer name is required.";
    if (!data.streetAddress) errors.streetAddress = "Address is required.";
    if (!data.city) errors.city = "City is required.";
    if (!data.country) errors.country = "Country is required.";
    if (Object.keys(errors).length) return json({ errors, values: data }, { status: 400 });

    await prisma.manufacturer.create({ data: { ...data, shopId: shop.id } });
    return redirect("/app/settings?saved=mfr");
  }
  return json({ ok: false });
};

const PLANS = [
  { key: "FREE", name: "Free", price: "€0", tagline: "Try it out", features: ["1 Responsible Person", "Up to 10 products", "Storefront safety block", "1 market language"] },
  { key: "STARTER", name: "Starter", price: "€14.99/mo", tagline: "Single store", features: ["Up to 250 products", "All 24 EU languages", "Templates & bulk apply", "Compliance scanner"] },
  { key: "PRO", name: "Pro", price: "€39.99/mo", tagline: "Multi-marketplace", features: ["Unlimited products", "Amazon · TikTok · eBay · Etsy · Temu export", "Document vault (10-yr)", "Incident log", "Priority support"], highlight: true },
];

export default function Settings() {
  const { shop, manufacturers } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const t = useT();
  const saving = nav.state === "submitting";
  const errors = actionData?.errors || {};
  const v = actionData?.values || {};
  const [sellsEU, setSellsEU] = useState(shop.sellsIntoEU);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "deleteManufacturer");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  return (
    <Page title={t("nav.settings")} backAction={{ content: t("common.back"), url: "/app" }}>
      <Layout>
        {/* Manufacturers */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={StoreIcon} tone="base" />
                <Text as="h2" variant="headingMd">Manufacturers</Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                GPSR requires manufacturer details on every product. Add them once, then assign per product.
              </Text>

              {actionData?.errors && <Banner tone="critical" title="Fix the highlighted fields" />}

              <Form method="post">
                <input type="hidden" name="intent" value="addManufacturer" />
                <FormLayout>
                  <FormLayout.Group>
                    <TextField label="Manufacturer name" name="legalName" autoComplete="off"
                      defaultValue={v.legalName} error={errors.legalName} requiredIndicator />
                    <TextField label="Trade name (optional)" name="tradeName" autoComplete="off" defaultValue={v.tradeName} />
                  </FormLayout.Group>
                  <TextField label="Street address" name="streetAddress" autoComplete="off"
                    defaultValue={v.streetAddress} error={errors.streetAddress} requiredIndicator />
                  <FormLayout.Group>
                    <TextField label="City" name="city" autoComplete="off" defaultValue={v.city} error={errors.city} requiredIndicator />
                    <TextField label="Postal code" name="postalCode" autoComplete="off" defaultValue={v.postalCode} />
                    <TextField label="Country" name="country" autoComplete="off"
                      defaultValue={v.country} error={errors.country} requiredIndicator
                      helpText="Manufacturers may be anywhere in the world." />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label="Email (optional)" name="email" type="email" autoComplete="off" defaultValue={v.email} />
                    <TextField label="Phone (optional)" name="phone" type="tel" autoComplete="off" defaultValue={v.phone} />
                  </FormLayout.Group>
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={saving}>Add manufacturer</Button>
                  </InlineStack>
                </FormLayout>
              </Form>

              <Divider />

              {manufacturers.length === 0 ? (
                <Text as="p" variant="bodySm" tone="subdued">No manufacturers yet.</Text>
              ) : (
                <BlockStack gap="200">
                  {manufacturers.map((m) => (
                    <InlineStack key={m.id} align="space-between" blockAlign="center">
                      <BlockStack gap="0">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">
                          {m.legalName}{m.tradeName ? ` (${m.tradeName})` : ""}
                        </Text>
                        <Text as="span" variant="bodySm" tone="subdued">
                          {`${m.streetAddress}, ${m.city} ${m.postalCode}, ${m.country}`}
                        </Text>
                      </BlockStack>
                      <Button icon={DeleteIcon} tone="critical" variant="tertiary"
                        onClick={() => onDelete(m.id)} accessibilityLabel="Delete" />
                    </InlineStack>
                  ))}
                </BlockStack>
              )}
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Store preferences */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Store preferences</Text>
              <Form method="post">
                <input type="hidden" name="intent" value="savePreferences" />
                <BlockStack gap="300">
                  <Checkbox label="This store sells into the EU"
                    name="sellsIntoEU" checked={sellsEU} onChange={setSellsEU}
                    helpText="Turn off to hide GPSR prompts if you don't sell to EU customers." />
                  <InlineStack align="end">
                    <Button submit loading={saving}>Save preferences</Button>
                  </InlineStack>
                </BlockStack>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        {/* Plan */}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Plan & billing</Text>
                <Badge tone="success">{`Current: ${shop.plan}`}</Badge>
              </InlineStack>
              <InlineGrid columns={{ xs: 1, md: 3 }} gap="300">
                {PLANS.map((p) => (
                  <Box key={p.key} padding="400" borderRadius="200"
                    borderWidth={p.highlight ? "050" : "025"}
                    borderColor={p.highlight ? "border-emphasis" : "border"}
                    background={p.highlight ? "bg-surface-selected" : "bg-surface"}>
                    <BlockStack gap="200">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="span" variant="headingSm">{p.name}</Text>
                        {p.highlight && <Badge tone="attention">Best value</Badge>}
                      </InlineStack>
                      <Text as="span" variant="headingLg">{p.price}</Text>
                      <Text as="span" variant="bodySm" tone="subdued">{p.tagline}</Text>
                      <List type="bullet">
                        {p.features.map((f) => <List.Item key={f}>{f}</List.Item>)}
                      </List>
                      <Button variant={p.highlight ? "primary" : "secondary"}
                        disabled={shop.plan === p.key} fullWidth>
                        {shop.plan === p.key ? "Current plan" : `Choose ${p.name}`}
                      </Button>
                    </BlockStack>
                  </Box>
                ))}
              </InlineGrid>
              <Text as="p" variant="bodyXs" tone="subdued">
                Billing is handled securely through Shopify. Charges appear on your Shopify invoice.
              </Text>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
