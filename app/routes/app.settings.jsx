import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSearchParams } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Layout, Card, Button, Banner, BlockStack, InlineStack, Text, Checkbox, Select,
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
            <BlockStack gap="400">
              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Store preferences</Text>
                  <Checkbox label="This store sells into the EU"
                    name="sellsIntoEU" checked={sellsEU} onChange={setSellsEU}
                    helpText="Turn off to hide GPSR prompts if you don't sell to EU customers." />
                </BlockStack>
              </Card>

              <Card>
                <BlockStack gap="300">
                  <Text as="h2" variant="headingMd">Document Vault</Text>
                  <Select label="Default retention period for new documents"
                    name="defaultRetentionYears"
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
                  <Text as="h2" variant="headingMd">Notifications</Text>
                  <Checkbox label="EU Safety Gate recall alerts"
                    name="recallAlertsEnabled" checked={recallAlerts} onChange={setRecallAlerts}
                    helpText="Warn me on the dashboard when an EU recall alert may match my catalog." />
                  <Checkbox label="Weekly compliance digest"
                    name="weeklyDigestEnabled" checked={weeklyDigest} onChange={setWeeklyDigest}
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
