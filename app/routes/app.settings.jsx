import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Layout, Card, Button, Banner, BlockStack, InlineStack, Text, Checkbox, Select, TextField,
} from "@shopify/polaris";
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
  return json({ shop });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  await prisma.shop.update({
    where: { id: shop.id },
    data: {
      sellsIntoEU: form.get("sellsIntoEU") === "on",
      defaultRetentionYears: parseInt(String(form.get("defaultRetentionYears") || "10"), 10) || 10,
      recallAlertsEnabled: form.get("recallAlertsEnabled") === "on",
      weeklyDigestEnabled: form.get("weeklyDigestEnabled") === "on",
      brandLogoUrl: String(form.get("brandLogoUrl") || "").trim() || null,
      brandAccentHex: String(form.get("brandAccentHex") || "").trim() || null,
    },
  });
  return redirect("/app/settings?saved=1");
};

export default function Settings() {
  const { shop } = useLoaderData();
  const nav = useNavigation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const justSaved = searchParams.get("saved") === "1";

  const [sellsEU, setSellsEU] = useState(shop.sellsIntoEU);
  const [retention, setRetention] = useState(String(shop.defaultRetentionYears || 10));
  const [recallAlerts, setRecallAlerts] = useState(shop.recallAlertsEnabled);
  const [weeklyDigest, setWeeklyDigest] = useState(shop.weeklyDigestEnabled);
  const [logoUrl, setLogoUrl] = useState(shop.brandLogoUrl || "");
  const [accentHex, setAccentHex] = useState(shop.brandAccentHex || "#1D9E75");

  return (
    <Page title={t("nav.settings")} backAction={{ content: t("common.back"), url: "/app" }}>
      <Layout>
        {justSaved && (
          <Layout.Section>
            <Banner tone="success" title="Settings saved"
              onDismiss={() => setSearchParams({}, { replace: true })} />
          </Layout.Section>
        )}
        <Layout.Section>
          <Form method="post">
            {/* Polaris Checkbox does not emit a submittable form value, so each
                toggle is backed by a hidden input carrying its real state. */}
            <input type="hidden" name="sellsIntoEU" value={sellsEU ? "on" : "off"} />
            <input type="hidden" name="recallAlertsEnabled" value={recallAlerts ? "on" : "off"} />
            <input type="hidden" name="weeklyDigestEnabled" value={weeklyDigest ? "on" : "off"} />
            <input type="hidden" name="defaultRetentionYears" value={retention} />

            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Store preferences</Text>
                  <Checkbox label="This store sells into the EU"
                    checked={sellsEU} onChange={setSellsEU}
                    helpText="Turn off to hide GPSR prompts if you don't sell to EU customers." />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Document Vault</Text>
                  <Select label="Default retention period for new documents"
                    options={[
                      { label: "10 years (GPSR standard)", value: "10" },
                      { label: "5 years", value: "5" },
                      { label: "15 years", value: "15" },
                    ]}
                    value={retention} onChange={setRetention} />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Passport branding</Text>
                  <Text as="p" variant="bodySm" tone="subdued">
                    Applied to the GPSR passport PDF you can download for each product.
                  </Text>
                  <TextField label="Logo URL (https, PNG or JPG)" name="brandLogoUrl" autoComplete="off"
                    value={logoUrl} onChange={setLogoUrl} placeholder="https://cdn.shopify.com/.../logo.png"
                    helpText="Paste a direct link to your logo image. Leave blank to show your shop name only." />
                  <TextField label="Accent colour (hex)" name="brandAccentHex" autoComplete="off"
                    value={accentHex} onChange={setAccentHex} placeholder="#1D9E75"
                    helpText="Used for the header bar and section headings." />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Notifications</Text>
                  <Checkbox label="EU Safety Gate recall alerts"
                    checked={recallAlerts} onChange={setRecallAlerts}
                    helpText="Warn me on the dashboard when an EU recall alert may match my catalog." />
                  <Checkbox label="Weekly compliance digest"
                    checked={weeklyDigest} onChange={setWeeklyDigest}
                    helpText="A weekly summary of products missing compliance data. (Email delivery coming soon.)" />
                </BlockStack>
              </Card>

              <InlineStack align="end">
                <Button variant="primary" submit loading={saving}>Save settings</Button>
              </InlineStack>
            </BlockStack>
          </Form>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
