import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit } from "@remix-run/react";
import { useCallback, useState } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Button, Banner, BlockStack,
  InlineStack, Text, Box, Badge, Divider, EmptyState, Icon,
} from "@shopify/polaris";
import { DeleteIcon, ClipboardIcon, PersonIcon, CheckCircleIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useT } from "../lib/i18n/context";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

function makeToken() {
  return "sr_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const requests = await prisma.supplierDataRequest.findMany({
    where: { shopId: shop.id }, orderBy: { createdAt: "desc" },
  });
  const origin = new URL(request.url).origin;
  return json({ requests, origin });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await prisma.supplierDataRequest.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  if (intent === "create") {
    const supplierEmail = String(form.get("supplierEmail") || "").trim();
    const productRef = String(form.get("productRef") || "").trim() || null;
    if (!supplierEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supplierEmail)) {
      return json({ error: "Enter a valid supplier email." }, { status: 400 });
    }
    await prisma.supplierDataRequest.create({
      data: { shopId: shop.id, supplierEmail, productRef, token: makeToken(), status: "sent" },
    });
    return redirect("/app/suppliers?created=1");
  }
  return json({ ok: false });
};

export default function Suppliers() {
  const { requests, origin } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const t = useT();
  const busy = nav.state === "submitting";
  const [copied, setCopied] = useState(null);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  const copyLink = (token) => {
    const url = `${origin}/supplier/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Page title="Supplier data requests"
      subtitle="Ask your suppliers to fill in the safety data you're missing — send them a secure form link."
      backAction={{ content: t("common.back"), url: "/app" }}>
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">New request</Text>
              {actionData?.error && <Banner tone="critical" title={actionData.error} />}
              <Form method="post">
                <input type="hidden" name="intent" value="create" />
                <FormLayout>
                  <FormLayout.Group>
                    <TextField label="Supplier email" name="supplierEmail" type="email" autoComplete="off"
                      placeholder="supplier@factory.com" requiredIndicator />
                    <TextField label="Product / SKU (optional)" name="productRef" autoComplete="off"
                      placeholder="e.g. Wooden Toy Car" />
                  </FormLayout.Group>
                  <Text as="p" variant="bodySm" tone="subdued">
                    This creates a secure link. Copy it and send it to your supplier — they fill in manufacturer details,
                    warnings and identifiers without needing access to your store.
                  </Text>
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={busy}>Create request link</Button>
                  </InlineStack>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {requests.length === 0 ? (
            <Card>
              <EmptyState heading="No supplier requests yet"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg">
                <p>Create a request to collect missing safety data straight from your supplier.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card>
              <BlockStack gap="300">
                <Text as="h2" variant="headingMd">{`Requests (${requests.length})`}</Text>
                <Divider />
                {requests.map((rq) => (
                  <Box key={rq.id} padding="300" borderColor="border" borderWidth="025" borderRadius="200">
                    <InlineStack align="space-between" blockAlign="center" wrap>
                      <InlineStack gap="200" blockAlign="center">
                        <Icon source={PersonIcon} tone="base" />
                        <BlockStack gap="0">
                          <Text as="span" variant="bodyMd" fontWeight="semibold">{rq.supplierEmail}</Text>
                          {rq.productRef && <Text as="span" variant="bodySm" tone="subdued">{rq.productRef}</Text>}
                        </BlockStack>
                      </InlineStack>
                      <InlineStack gap="200" blockAlign="center">
                        {rq.status === "submitted"
                          ? <Badge tone="success" icon={CheckCircleIcon}>Submitted</Badge>
                          : <Badge tone="attention">Awaiting supplier</Badge>}
                        <Button icon={ClipboardIcon} onClick={() => copyLink(rq.token)}>
                          {copied === rq.token ? "Copied!" : "Copy link"}
                        </Button>
                        <Button icon={DeleteIcon} variant="tertiary" tone="critical"
                          onClick={() => onDelete(rq.id)} accessibilityLabel="Delete" />
                      </InlineStack>
                    </InlineStack>
                    {rq.status === "submitted" && rq.submittedData && (
                      <Box paddingBlockStart="300">
                        <Divider />
                        <Box paddingBlockStart="300">
                          <Text as="span" variant="bodySm" fontWeight="semibold">Submitted data:</Text>
                          <Text as="p" variant="bodySm" tone="subdued">
                            {Object.entries(rq.submittedData).map(([k, v]) => `${k}: ${v}`).join("  ·  ")}
                          </Text>
                        </Box>
                      </Box>
                    )}
                  </Box>
                ))}
              </BlockStack>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
