import { json, redirect } from "@remix-run/node";
import {
  useLoaderData, useActionData, useNavigation, Form, useSubmit, useSearchParams,
} from "@remix-run/react";
import { useState, useCallback, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Button, Banner,
  BlockStack, InlineStack, Text, Box, Badge, Divider, EmptyState,
  InlineGrid, Icon,
} from "@shopify/polaris";
import {
  PersonIcon, LocationIcon, DeleteIcon, CheckCircleIcon, ExternalIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import {
  EU_COUNTRIES, EEA_EXTRA, UK_COUNTRY, CH_COUNTRY, isValidRpCountry, RP_PROVIDERS,
} from "../lib/eu-data";

const ROLE_OPTIONS = [
  { label: "EU Responsible Person — covers all 27 EU states + EEA + NI", value: "EU_RESPONSIBLE_PERSON" },
  { label: "UK Responsible Person — Great Britain (post-Brexit)", value: "UK_RESPONSIBLE_PERSON" },
  { label: "Switzerland representative — CH market", value: "CH_RESPONSIBLE_PERSON" },
  { label: "Manufacturer acting as RP (EU-based)", value: "MANUFACTURER_AS_RP" },
  { label: "Importer acting as RP (EU-based)", value: "IMPORTER_AS_RP" },
];

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const rps = await prisma.responsiblePerson.findMany({
    where: { shopId: shop.id },
    orderBy: { createdAt: "desc" },
  });
  return json({ rps, providers: RP_PROVIDERS });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await prisma.responsiblePerson.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true, deleted: true });
  }

  const data = {
    role: String(form.get("role") || "EU_RESPONSIBLE_PERSON"),
    legalName: String(form.get("legalName") || "").trim(),
    companyName: String(form.get("companyName") || "").trim() || null,
    streetAddress: String(form.get("streetAddress") || "").trim(),
    city: String(form.get("city") || "").trim(),
    postalCode: String(form.get("postalCode") || "").trim(),
    country: String(form.get("country") || "").trim(),
    email: String(form.get("email") || "").trim(),
    phone: String(form.get("phone") || "").trim(),
  };

  const errors = {};
  if (!data.legalName) errors.legalName = "Legal name is required.";
  if (!data.streetAddress) errors.streetAddress = "A street address is required — a PO box is not accepted under GPSR.";
  if (!data.city) errors.city = "City is required.";
  if (!data.postalCode) errors.postalCode = "Postal code is required.";
  if (!data.country) errors.country = "Select a country.";
  else if (!isValidRpCountry(data.role, data.country)) {
    errors.country =
      data.role === "UK_RESPONSIBLE_PERSON"
        ? "A UK Responsible Person must be established in the United Kingdom."
        : "An EU Responsible Person must be established in the EU/EEA (or Northern Ireland).";
  }
  if (!data.email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(data.email)) errors.email = "A valid email is required.";
  if (!data.phone) errors.phone = "A phone number is required — regulators must be able to reach the RP.";

  if (Object.keys(errors).length) return json({ errors, values: data }, { status: 400 });

  await prisma.responsiblePerson.create({ data: { ...data, shopId: shop.id } });
  await prisma.auditEvent.create({
    data: { shopId: shop.id, actor: session.shop, action: "rp.created", target: data.legalName },
  });
  return redirect("/app/responsible-persons?saved=1");
};

function countryOptionsFor(role) {
  if (role === "UK_RESPONSIBLE_PERSON") return UK_COUNTRY;
  if (role === "CH_RESPONSIBLE_PERSON") return CH_COUNTRY;
  return [...EU_COUNTRIES, ...EEA_EXTRA];
}

function roleLabel(v) {
  return (ROLE_OPTIONS.find((r) => r.value === v) || {}).label || v;
}

function RpCard({ rp, onDelete }) {
  const country =
    [...EU_COUNTRIES, ...EEA_EXTRA, ...UK_COUNTRY, ...CH_COUNTRY].find((c) => c.code === rp.country)?.name || rp.country;
  return (
    <Card>
      <BlockStack gap="300">
        <InlineStack align="space-between" blockAlign="start">
          <InlineStack gap="200" blockAlign="center">
            <Icon source={PersonIcon} tone="base" />
            <BlockStack gap="0">
              <Text as="span" variant="headingSm">{rp.legalName}</Text>
              {rp.companyName && <Text as="span" tone="subdued" variant="bodySm">{rp.companyName}</Text>}
            </BlockStack>
          </InlineStack>
          <InlineStack gap="200" blockAlign="center">
            <Badge tone={rp.role.startsWith("UK") ? "attention" : "success"}>
              {rp.role.startsWith("UK") ? "UK RP" : "EU RP"}
            </Badge>
            {rp.isThirdParty && <Badge tone="info">Provider</Badge>}
            <Button icon={DeleteIcon} tone="critical" variant="tertiary" accessibilityLabel="Delete"
              onClick={() => onDelete(rp.id)} />
          </InlineStack>
        </InlineStack>
        <Divider />
        <InlineStack gap="400" wrap>
          <InlineStack gap="100" blockAlign="center"><Icon source={LocationIcon} tone="subdued" />
            <Text as="span" variant="bodySm">{rp.streetAddress}, {rp.city} {rp.postalCode}, {country}</Text>
          </InlineStack>
        </InlineStack>
        <InlineStack gap="400" wrap>
          <Text as="span" variant="bodySm" tone="subdued">{rp.email}</Text>
          <Text as="span" variant="bodySm" tone="subdued">{rp.phone}</Text>
        </InlineStack>
        <Text as="span" variant="bodyXs" tone="subdued">{roleLabel(rp.role)}</Text>
      </BlockStack>
    </Card>
  );
}

const EMPTY_FORM = {
  legalName: "", companyName: "", streetAddress: "",
  city: "", postalCode: "", country: "", email: "", phone: "",
};

export default function ResponsiblePersons() {
  const { rps, providers } = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const submit = useSubmit();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const justSaved = searchParams.get("saved") === "1";

  const errors = actionData?.errors || {};
  const [role, setRole] = useState("EU_RESPONSIBLE_PERSON");
  const [f, setF] = useState(EMPTY_FORM);
  const set = useCallback((field) => (value) => setF((p) => ({ ...p, [field]: value })), []);

  // Restore typed values if server-side validation failed
  useEffect(() => {
    if (actionData?.values) {
      const { role: r, ...rest } = actionData.values;
      setF({ ...EMPTY_FORM, ...rest, companyName: rest.companyName || "" });
      if (r) setRole(r);
    }
  }, [actionData]);

  // Clear form after successful save
  useEffect(() => {
    if (justSaved) setF(EMPTY_FORM);
  }, [justSaved]);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  const countryOpts = [{ label: "Select a country…", value: "" },
    ...countryOptionsFor(role).map((c) => ({ label: c.name, value: c.code }))];

  return (
    <Page
      title="Responsible Persons"
      subtitle="The EU/UK-based contact regulators reach if a product is unsafe. Required on every product you sell into that market."
      backAction={{ content: "Dashboard", url: "/app" }}
    >
      <Layout>
        {justSaved && (
          <Layout.Section>
            <Banner tone="success" title="Responsible Person saved"
              onDismiss={() => setSearchParams({}, { replace: true })} />
          </Layout.Section>
        )}
        <Layout.Section>
          <Banner tone="info">
            <BlockStack gap="100">
              <Text as="p" variant="bodyMd" fontWeight="semibold">Who is the Responsible Person?</Text>
              <Text as="p" variant="bodySm">
                It is not this app and not Shopify. It must be a real person or company physically in the EU (or UK, for UK sales)
                who takes legal responsibility for your product's safety. If your business, supplier, or importer is EU-based, that
                entity can be the RP — enter their details below. If not, appoint a provider from the list at the bottom of this page.
              </Text>
            </BlockStack>
          </Banner>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Add a Responsible Person</Text>
              {actionData?.errors && (
                <Banner tone="critical" title="Please fix the highlighted fields" />
              )}
              <Form method="post">
                <input type="hidden" name="intent" value="create" />
                <FormLayout>
                  <Select
                    label="Role" name="role" options={ROLE_OPTIONS} value={role}
                    onChange={setRole}
                    helpText="EU sales need an EU RP. UK sales need a separate UK RP (post-Brexit divergence)."
                  />
                  <FormLayout.Group>
                    <TextField label="Legal name" name="legalName" autoComplete="off"
                      value={f.legalName} onChange={set("legalName")} error={errors.legalName} requiredIndicator />
                    <TextField label="Company name (optional)" name="companyName" autoComplete="off"
                      value={f.companyName} onChange={set("companyName")} />
                  </FormLayout.Group>
                  <TextField label="Street address" name="streetAddress" autoComplete="off"
                    value={f.streetAddress} onChange={set("streetAddress")} error={errors.streetAddress} requiredIndicator
                    helpText="Full street address. A PO box does not satisfy GPSR." />
                  <FormLayout.Group>
                    <TextField label="City" name="city" autoComplete="off"
                      value={f.city} onChange={set("city")} error={errors.city} requiredIndicator />
                    <TextField label="Postal code" name="postalCode" autoComplete="off"
                      value={f.postalCode} onChange={set("postalCode")} error={errors.postalCode} requiredIndicator />
                    <Select label="Country" name="country" options={countryOpts}
                      value={f.country} onChange={set("country")} error={errors.country} />
                  </FormLayout.Group>
                  <FormLayout.Group>
                    <TextField label="Email" name="email" type="email" autoComplete="off"
                      value={f.email} onChange={set("email")} error={errors.email} requiredIndicator />
                    <TextField label="Phone" name="phone" type="tel" autoComplete="off"
                      value={f.phone} onChange={set("phone")} error={errors.phone} requiredIndicator />
                  </FormLayout.Group>
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={saving}>Save Responsible Person</Button>
                  </InlineStack>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {rps.length === 0 ? (
            <Card>
              <EmptyState heading="No Responsible Person yet"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg">
                <p>Add one above, or appoint a provider below. You can't publish GPSR-compliant listings without one.</p>
              </EmptyState>
            </Card>
          ) : (
            <BlockStack gap="300">
              <Text as="h2" variant="headingMd">{`Your Responsible Persons (${rps.length})`}</Text>
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                {rps.map((rp) => <RpCard key={rp.id} rp={rp} onDelete={onDelete} />)}
              </InlineGrid>
            </BlockStack>
          )}
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="300">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">Don't have an EU Responsible Person?</Text>
                <Badge tone="info">Appoint a provider</Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">
                These companies act as your EU Responsible Person for a fee. You appoint them, then enter the details they give
                you in the form above. Pricing models differ — some charge once per product or country, others bill annually or
                monthly. This app does not provide RP services, does not endorse any provider, and earns no commission from
                these links. Prices change without notice: always confirm on the provider's own site.
              </Text>
              <Divider />
              <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
                {providers.map((p) => (
                  <Box key={p.name} padding="300" borderColor="border" borderWidth="025" borderRadius="200">
                    <BlockStack gap="150">
                      <InlineStack align="space-between" blockAlign="center">
                        <Text as="span" variant="bodyMd" fontWeight="semibold">{p.name}</Text>
                        <Badge>{p.regions}</Badge>
                      </InlineStack>
                      {p.pricing && (
                        <InlineStack>
                          <Badge tone={p.pricing === "One-time fee" ? "success" : undefined} size="small">
                            {p.pricing}
                          </Badge>
                        </InlineStack>
                      )}
                      <Text as="span" variant="bodySm" tone="subdued">{p.blurb}</Text>
                      <InlineStack>
                        <Button url={p.ref || p.url} target="_blank" icon={ExternalIcon} variant="plain">
                          Visit provider
                        </Button>
                      </InlineStack>
                    </BlockStack>
                  </Box>
                ))}
              </InlineGrid>
            </BlockStack>
          </Card>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
