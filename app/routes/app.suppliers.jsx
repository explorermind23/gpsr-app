import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit, useSearchParams } from "@remix-run/react";
import { useCallback, useState, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Button, Banner, BlockStack,
  InlineStack, Text, Box, Badge, Divider, EmptyState, Icon, Checkbox,
} from "@shopify/polaris";
import {
  DeleteIcon, ClipboardIcon, PersonIcon, CheckCircleIcon, EmailIcon,
} from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useT } from "../lib/i18n/context";
import { sendSupplierRequestEmail, emailConfigured } from "../lib/email.server";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

function makeToken() {
  return "sr_" + Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

const SHOP_QUERY = `#graphql
  query SupplierShop { shop { name contactEmail } }`;

async function shopIdentity(admin, fallbackDomain) {
  try {
    const res = await admin.graphql(SHOP_QUERY);
    const body = await res.json();
    return {
      name: body.data?.shop?.name || fallbackDomain,
      email: body.data?.shop?.contactEmail || null,
    };
  } catch (e) {
    return { name: fallbackDomain, email: null };
  }
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const requests = await prisma.supplierDataRequest.findMany({
    where: { shopId: shop.id }, orderBy: { createdAt: "desc" },
  });
  const origin = new URL(request.url).origin;
  return json({ requests, origin, mailEnabled: emailConfigured() });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");
  const origin = new URL(request.url).origin;

  if (intent === "delete") {
    await prisma.supplierDataRequest.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  if (intent === "resend") {
    const rq = await prisma.supplierDataRequest.findUnique({ where: { id: String(form.get("id")) } });
    if (!rq) return json({ error: "Request not found." }, { status: 404 });
    const who = await shopIdentity(admin, shop.shopDomain);
    const result = await sendSupplierRequestEmail({
      to: rq.supplierEmail,
      shopName: who.name,
      productRef: rq.productRef,
      link: `${origin}/supplier/${rq.token}`,
      replyTo: who.email,
    });
    await prisma.supplierDataRequest.update({
      where: { id: rq.id },
      data: {
        emailSentAt: result.ok ? new Date() : rq.emailSentAt,
        emailError: result.ok ? null : result.error,
      },
    });
    return redirect(result.ok ? "/app/suppliers?sent=1" : "/app/suppliers?mailfail=1");
  }

  if (intent === "create") {
    const supplierEmail = String(form.get("supplierEmail") || "").trim();
    const productRef = String(form.get("productRef") || "").trim() || null;
    const sendNow = form.get("sendEmail") === "on";

    if (!supplierEmail || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(supplierEmail)) {
      return json({ error: "Enter a valid supplier email.", values: { supplierEmail, productRef } }, { status: 400 });
    }

    const created = await prisma.supplierDataRequest.create({
      data: { shopId: shop.id, supplierEmail, productRef, token: makeToken(), status: "sent" },
    });

    if (sendNow && emailConfigured()) {
      const who = await shopIdentity(admin, shop.shopDomain);
      const result = await sendSupplierRequestEmail({
        to: supplierEmail,
        shopName: who.name,
        productRef,
        link: `${origin}/supplier/${created.token}`,
        replyTo: who.email,
      });
      await prisma.supplierDataRequest.update({
        where: { id: created.id },
        data: {
          emailSentAt: result.ok ? new Date() : null,
          emailError: result.ok ? null : result.error,
        },
      });
      await prisma.auditEvent.create({
        data: {
          shopId: shop.id, actor: session.shop,
          action: result.ok ? "supplier.emailSent" : "supplier.emailFailed",
          target: supplierEmail,
        },
      }).catch(() => {});
      return redirect(result.ok ? "/app/suppliers?sent=1" : "/app/suppliers?mailfail=1");
    }

    return redirect("/app/suppliers?created=1");
  }

  return json({ ok: false });
};

export default function Suppliers() {
  const { requests, origin, mailEnabled } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const busy = nav.state === "submitting";
  const flag = searchParams.get("sent") ? "sent"
    : searchParams.get("mailfail") ? "mailfail"
    : searchParams.get("created") ? "created" : null;
  const [copied, setCopied] = useState(null);

  const [supplierEmail, setSupplierEmail] = useState("");
  const [productRef, setProductRef] = useState("");
  const [sendEmail, setSendEmail] = useState(mailEnabled);

  useEffect(() => {
    if (actionData?.values) {
      setSupplierEmail(actionData.values.supplierEmail || "");
      setProductRef(actionData.values.productRef || "");
    }
  }, [actionData]);

  useEffect(() => {
    if (flag) { setSupplierEmail(""); setProductRef(""); }
  }, [flag]);

  const act = useCallback((id, intent) => {
    const fd = new FormData();
    fd.append("intent", intent);
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  const copyLink = (token) => {
    const url = `${origin}/supplier/${token}`;
    navigator.clipboard?.writeText(url);
    setCopied(token);
    setTimeout(() => setCopied(null), 1500);
  };

  const dismiss = () => setSearchParams({}, { replace: true });

  return (
    <Page title="Supplier data requests"
      subtitle="Ask your suppliers to fill in the safety data you're missing — email them a secure form link."
      backAction={{ content: t("common.back"), url: "/app" }}>
      <Layout>
        {flag === "sent" && (
          <Layout.Section>
            <Banner tone="success" title="Email sent to your supplier" onDismiss={dismiss} />
          </Layout.Section>
        )}
        {flag === "created" && (
          <Layout.Section>
            <Banner tone="success" title="Request link created — copy it below and send it to your supplier"
              onDismiss={dismiss} />
          </Layout.Section>
        )}
        {flag === "mailfail" && (
          <Layout.Section>
            <Banner tone="warning" title="The request was created, but the email could not be sent"
              onDismiss={dismiss}>
              <Text as="p">Copy the link below and send it to your supplier manually. The failure reason is shown on the request.</Text>
            </Banner>
          </Layout.Section>
        )}
        {!mailEnabled && (
          <Layout.Section>
            <Banner tone="info" title="Email sending is not configured">
              <Text as="p">Requests still work — copy the secure link and send it yourself.</Text>
            </Banner>
          </Layout.Section>
        )}

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
                      value={supplierEmail} onChange={setSupplierEmail}
                      placeholder="supplier@factory.com" requiredIndicator />
                    <TextField label="Product / SKU (optional)" name="productRef" autoComplete="off"
                      value={productRef} onChange={setProductRef}
                      placeholder="e.g. Wooden Toy Car" />
                  </FormLayout.Group>
                  <Checkbox label="Email the request to this supplier now"
                    name="sendEmail" checked={sendEmail} onChange={setSendEmail} disabled={!mailEnabled}
                    helpText={mailEnabled
                      ? "They receive a secure link. No account needed, and no access to your store."
                      : "Email sending is not configured on this store."} />
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={busy}>
                      {sendEmail && mailEnabled ? "Create and send" : "Create request link"}
                    </Button>
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
                    <BlockStack gap="200">
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
                          {rq.emailSentAt && <Badge tone="info">Emailed</Badge>}
                          {rq.emailError && <Badge tone="critical">Email failed</Badge>}
                        </InlineStack>
                      </InlineStack>

                      {rq.emailSentAt && (
                        <Text as="span" variant="bodySm" tone="subdued">
                          {`Email sent ${new Date(rq.emailSentAt).toLocaleString()}`}
                        </Text>
                      )}
                      {rq.emailError && (
                        <Text as="span" variant="bodySm" tone="critical">{rq.emailError}</Text>
                      )}

                      <InlineStack gap="200" align="end">
                        <Button icon={ClipboardIcon} onClick={() => copyLink(rq.token)}>
                          {copied === rq.token ? "Copied!" : "Copy link"}
                        </Button>
                        {mailEnabled && rq.status !== "submitted" && (
                          <Button icon={EmailIcon} onClick={() => act(rq.id, "resend")} loading={busy}>
                            {rq.emailSentAt ? "Send again" : "Send email"}
                          </Button>
                        )}
                        <Button icon={DeleteIcon} variant="tertiary" tone="critical"
                          onClick={() => act(rq.id, "delete")} accessibilityLabel="Delete" />
                      </InlineStack>

                      {rq.status === "submitted" && rq.submittedData && (
                        <>
                          <Divider />
                          <BlockStack gap="100">
                            <Text as="span" variant="bodySm" fontWeight="semibold">Submitted data:</Text>
                            <Text as="p" variant="bodySm" tone="subdued">
                              {Object.entries(rq.submittedData).map(([k, v]) => `${k}: ${v}`).join("  ·  ")}
                            </Text>
                          </BlockStack>
                        </>
                      )}
                    </BlockStack>
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
