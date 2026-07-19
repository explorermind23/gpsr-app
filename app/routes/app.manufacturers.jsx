import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit, useSearchParams } from "@remix-run/react";
import { useCallback, useState, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Button, Banner, BlockStack,
  InlineStack, Text, Divider, Icon,
} from "@shopify/polaris";
import { DeleteIcon, StoreIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

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
  return json({ manufacturers });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await prisma.manufacturer.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  if (intent === "add") {
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
    await prisma.auditEvent.create({
      data: { shopId: shop.id, actor: session.shop, action: "manufacturer.created", target: data.legalName },
    });
    return redirect("/app/manufacturers?saved=1");
  }
  return json({ ok: false });
};

const EMPTY = {
  legalName: "", tradeName: "", streetAddress: "",
  city: "", postalCode: "", country: "", email: "", phone: "",
};

export default function Manufacturers() {
  const { manufacturers } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const errors = actionData?.errors || {};
  const justSaved = searchParams.get("saved") === "1";

  const [f, setF] = useState(EMPTY);
  const set = useCallback((field) => (value) => setF((p) => ({ ...p, [field]: value })), []);

  useEffect(() => {
    if (actionData?.values) {
      const rest = actionData.values;
      setF({
        ...EMPTY, ...rest,
        tradeName: rest.tradeName || "", email: rest.email || "", phone: rest.phone || "",
      });
    }
  }, [actionData]);

  useEffect(() => {
    if (justSaved) setF(EMPTY);
  }, [justSaved]);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  return (
    <Page title="Manufacturers"
      subtitle="GPSR requires manufacturer details on every product. Add them once, then assign per product."
      backAction={{ content: "Dashboard", url: "/app" }}>
      <Layout>
        {justSaved && (
          <Layout.Section>
            <Banner tone="success" title="Manufacturer added"
              onDismiss={() => setSearchParams({}, { replace: true })} />
          </Layout.Section>
        )}
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={StoreIcon} tone="base" />
                <Text as="h2" variant="headingMd">Add a manufacturer</Text>
              </InlineStack>
              {actionData?.errors && <Banner tone="critical" title="Fix the highlighted fields" />}
              <Form method="post">
                <input type="hidden" name="intent" value="add" />
                <FormLayout>
                  <FormLayout.Group>
                    <TextField label="Manufacturer name" name="legalName" autoComplete="off"
                      value={f.legalName} onChange={set("legalName")} error={errors.legalName} requiredIndicator />
                    <TextField label="Trade name (optional)" name="tradeName" autoComplete="off"
                      value={f.tradeName} onChange={set("tradeName")} />
                  </FormLayout.Group>
                  <TextField label="Street address" name="streetAddress" autoComplete="off"
                    value={f.streetAddress} onChange={set("streetAddress")} error={errors.streetAddress} requiredIndicator />
                  <FormLayout.Group>
                    <TextField label="City" name="city" autoComplete="off"
                      value={f.city} onChange={set("city")} error={errors.city} requiredIndicator />
                    <TextField label="Postal code" name="postalCode" autoComplete="off"
                      value={f.postalCode} onChange={set("postalCode")} />
                    <TextField label="Country" name="country" autoComplete="off"
                      value={f.country} onChange={set("country")} error={errors.country} requiredIndicator
                      helpText="Manufacturers may be anywhere in the world." />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label="Email (optional)" name="email" type="email" autoComplete="off"
                      value={f.email} onChange={set("email")} />
                    <TextField label="Phone (optional)" name="phone" type="tel" autoComplete="off"
                      value={f.phone} onChange={set("phone")} />
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
      </Layout>
    </Page>
  );
}
