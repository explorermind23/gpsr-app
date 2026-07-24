import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  AppProvider, Page, Card, FormLayout, TextField, Button, Banner, BlockStack,
  Text, Box, Divider, Checkbox, List, InlineStack, Icon,
} from "@shopify/polaris";
import { CheckCircleIcon } from "@shopify/polaris-icons";
import enTranslations from "@shopify/polaris/locales/en.json";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import prisma from "../db.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

// PUBLIC route — no Shopify auth. Access is controlled by the unguessable token.
export const loader = async ({ params }) => {
  const reqRow = await prisma.supplierDataRequest.findUnique({ where: { token: params.token } });
  if (!reqRow) return json({ notFound: true });
  return json({
    notFound: false,
    submitted: reqRow.status === "submitted",
    productRef: reqRow.productRef,
    token: params.token,
  });
};

export const action = async ({ request, params }) => {
  const reqRow = await prisma.supplierDataRequest.findUnique({ where: { token: params.token } });
  if (!reqRow) return json({ error: "This link is no longer valid." }, { status: 404 });

  const form = await request.formData();
  const submitted = {
    manufacturer_name: String(form.get("manufacturer_name") || "").trim(),
    manufacturer_address: String(form.get("manufacturer_address") || "").trim(),
    manufacturer_email: String(form.get("manufacturer_email") || "").trim(),
    gtin: String(form.get("gtin") || "").trim(),
    model: String(form.get("model") || "").trim(),
    warning: String(form.get("warning") || "").trim(),
    ce_marked: form.get("ce_marked") === "on" ? "Yes" : "No",
  };
  if (!submitted.manufacturer_name) {
    return json({ error: "Manufacturer name is required." }, { status: 400 });
  }

  await prisma.supplierDataRequest.update({
    where: { token: params.token },
    data: { status: "submitted", submittedData: submitted },
  });
  return redirect(`/supplier/${params.token}?done=1`);
};

export default function SupplierForm() {
  const data = useLoaderData();
  const actionData = useActionData();
  const nav = useNavigation();
  const busy = nav.state === "submitting";

  // Controlled fields — without value/onChange Polaris renders inputs read-only.
  const [mName, setMName] = useState("");
  const [mAddr, setMAddr] = useState("");
  const [mEmail, setMEmail] = useState("");
  const [gtin, setGtin] = useState("");
  const [model, setModel] = useState("");
  const [warning, setWarning] = useState("");
  const [ce, setCe] = useState(false);

  const body = (() => {
    if (data.notFound) {
      return (
        <Card>
          <Box padding="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Link not found</Text>
              <Text as="p" tone="subdued">This request link is invalid or has been removed. Please ask the seller to send you a new one.</Text>
            </BlockStack>
          </Box>
        </Card>
      );
    }
    if (data.submitted) {
      return (
        <Card>
          <Box padding="400">
            <BlockStack gap="200">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={CheckCircleIcon} tone="success" />
                <Text as="h2" variant="headingMd">Thank you — received</Text>
              </InlineStack>
              <Text as="p" tone="subdued">Your safety details have been sent to the seller. You can close this page. Nothing else is needed.</Text>
            </BlockStack>
          </Box>
        </Card>
      );
    }
    return (
      <BlockStack gap="400">
        <Card>
          <BlockStack gap="400">
            <BlockStack gap="100">
              <Text as="h2" variant="headingMd">Product safety information</Text>
              <Text as="p" variant="bodySm" tone="subdued">
                {data.productRef ? `For: ${data.productRef}. ` : ""}
                A seller has asked you to provide EU product-safety details for this product. Fill in what you can and press Submit — it goes straight back to them.
              </Text>
            </BlockStack>
            {actionData?.error && <Banner tone="critical" title={actionData.error} />}
            <Form method="post">
              <FormLayout>
                <TextField label="Manufacturer name" name="manufacturer_name" autoComplete="organization"
                  value={mName} onChange={setMName} requiredIndicator
                  helpText="The legal name of the company that makes this product." />
                <TextField label="Manufacturer address" name="manufacturer_address" autoComplete="off"
                  value={mAddr} onChange={setMAddr} multiline={2}
                  helpText="Full postal address, including country." />
                <TextField label="Manufacturer email" name="manufacturer_email" type="email" autoComplete="email"
                  value={mEmail} onChange={setMEmail} />
                <FormLayout.Group>
                  <TextField label="GTIN / barcode" name="gtin" autoComplete="off"
                    value={gtin} onChange={setGtin} helpText="The barcode number, if the product has one." />
                  <TextField label="Model number" name="model" autoComplete="off"
                    value={model} onChange={setModel} />
                </FormLayout.Group>
                <TextField label="Safety warning" name="warning" autoComplete="off"
                  value={warning} onChange={setWarning} multiline={3}
                  placeholder="e.g. Not suitable for children under 3 years. Small parts — choking hazard."
                  helpText="Any warnings that must appear with this product." />
                <Checkbox label="This product carries CE marking" name="ce_marked"
                  checked={ce} onChange={setCe} />
                <div style={{ display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="primary" submit loading={busy}>Submit to seller</Button>
                </div>
              </FormLayout>
            </Form>
          </BlockStack>
        </Card>

        <Card>
          <BlockStack gap="200">
            <Text as="h3" variant="headingSm">What happens with this</Text>
            <List type="number">
              <List.Item>The seller you supply needs these details to sell this product legally in the EU.</List.Item>
              <List.Item>Fill in the fields above — only the manufacturer name is required, the rest help if you have them.</List.Item>
              <List.Item>Press "Submit to seller". Your answers go directly back to them.</List.Item>
              <List.Item>You don't need an account, and you get no access to the seller's store. This link is private to you.</List.Item>
            </List>
          </BlockStack>
        </Card>
      </BlockStack>
    );
  })();

  return (
    <AppProvider i18n={enTranslations}>
      <Page narrowWidth title="GPSR safety data request">
        {body}
        <Box paddingBlockStart="400">
          <Text as="p" variant="bodyXs" tone="subdued" alignment="center">
            Powered by Alnage
          </Text>
        </Box>
      </Page>
    </AppProvider>
  );
}
