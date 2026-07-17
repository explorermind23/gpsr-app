import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import {
  AppProvider, Page, Card, FormLayout, TextField, Button, Banner, BlockStack,
  Text, Box, Divider,
} from "@shopify/polaris";
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
    ce_marked: form.get("ce_marked") ? "Yes" : "No",
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

  const body = (() => {
    if (data.notFound) {
      return (
        <Card>
          <Box padding="400">
            <Text as="h2" variant="headingMd">Link not found</Text>
            <Text as="p" tone="subdued">This request link is invalid or has been removed.</Text>
          </Box>
        </Card>
      );
    }
    if (data.submitted) {
      return (
        <Card>
          <Box padding="400">
            <BlockStack gap="200">
              <Text as="h2" variant="headingMd">Thank you — received</Text>
              <Text as="p" tone="subdued">Your safety data has been submitted. You can close this page.</Text>
            </BlockStack>
          </Box>
        </Card>
      );
    }
    return (
      <Card>
        <BlockStack gap="400">
          <BlockStack gap="100">
            <Text as="h2" variant="headingMd">Product safety information</Text>
            <Text as="p" variant="bodySm" tone="subdued">
              {data.productRef ? `For: ${data.productRef}. ` : ""}
              A seller has asked you to provide GPSR safety details for this product.
            </Text>
          </BlockStack>
          {actionData?.error && <Banner tone="critical" title={actionData.error} />}
          <Form method="post">
            <FormLayout>
              <TextField label="Manufacturer name" name="manufacturer_name" autoComplete="off" requiredIndicator />
              <TextField label="Manufacturer address" name="manufacturer_address" autoComplete="off" multiline={2} />
              <TextField label="Manufacturer email" name="manufacturer_email" type="email" autoComplete="off" />
              <FormLayout.Group>
                <TextField label="GTIN / barcode" name="gtin" autoComplete="off" />
                <TextField label="Model number" name="model" autoComplete="off" />
              </FormLayout.Group>
              <TextField label="Safety warning" name="warning" autoComplete="off" multiline={2}
                placeholder="e.g. Not suitable for children under 3. Small parts." />
              <InlineStackShim>
                <Button variant="primary" submit loading={busy}>Submit</Button>
              </InlineStackShim>
            </FormLayout>
          </Form>
        </BlockStack>
      </Card>
    );
  })();

  return (
    <AppProvider i18n={enTranslations}>
      <Page narrowWidth title="GPSR safety data request">
        {body}
        <Box paddingBlockStart="400">
          <Text as="p" variant="bodyXs" tone="subdued" alignment="center">
            Powered by GPSR Compliance Hub
          </Text>
        </Box>
      </Page>
    </AppProvider>
  );
}

function InlineStackShim({ children }) {
  return <div style={{ display: "flex", justifyContent: "flex-end" }}>{children}</div>;
}
