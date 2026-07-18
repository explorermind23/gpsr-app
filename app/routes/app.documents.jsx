import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit, useSearchParams } from "@remix-run/react";
import { useCallback, useState, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Button, Banner, BlockStack,
  InlineStack, Text, Box, Badge, Divider, EmptyState, IndexTable, Icon, InlineGrid,
} from "@shopify/polaris";
import {
  FileIcon, DeleteIcon, ExternalIcon,
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

const DOC_KINDS = [
  { value: "DECLARATION_OF_CONFORMITY", label: "EU Declaration of Conformity" },
  { value: "TEST_REPORT", label: "Test report" },
  { value: "RISK_ASSESSMENT", label: "Risk assessment" },
  { value: "TECHNICAL_FILE", label: "Technical file / documentation" },
  { value: "CE_CERTIFICATE", label: "CE certificate" },
  { value: "LABEL_ARTWORK", label: "Label / packaging artwork" },
  { value: "OTHER", label: "Other" },
];
const KIND_LABEL = Object.fromEntries(DOC_KINDS.map((k) => [k.value, k.label]));

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const docs = await prisma.complianceDocument.findMany({
    where: { shopId: shop.id }, orderBy: { createdAt: "desc" },
  });
  const now = Date.now();
  const soon = docs.filter((d) => {
    const t = new Date(d.retainUntil).getTime();
    return t > now && t - now < 1000 * 60 * 60 * 24 * 180; // within 180 days
  }).length;
  return json({ docs, soon });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await prisma.complianceDocument.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  if (intent === "add") {
    const kind = String(form.get("kind") || "OTHER");
    const fileName = String(form.get("fileName") || "").trim();
    const fileUrl = String(form.get("fileUrl") || "").trim();
    const productRef = String(form.get("productRef") || "").trim() || null;
    const years = parseInt(String(form.get("retentionYears") || "10"), 10) || 10;

    const errors = {};
    if (!fileName) errors.fileName = "Give the document a name.";
    if (!fileUrl) errors.fileUrl = "Add a link to the file.";
    else if (!/^https?:\/\//i.test(fileUrl)) errors.fileUrl = "Must be a valid https link.";
    if (Object.keys(errors).length) return json({ errors, values: { kind, fileName, fileUrl, productRef } }, { status: 400 });

    const retainUntil = new Date();
    retainUntil.setFullYear(retainUntil.getFullYear() + years);

    await prisma.complianceDocument.create({
      data: { shopId: shop.id, kind, fileName, fileUrl, productId: productRef, retainUntil },
    });
    await prisma.auditEvent.create({
      data: { shopId: shop.id, actor: session.shop, action: "document.added", target: fileName },
    });
    return redirect("/app/documents?saved=1");
  }
  return json({ ok: false });
};

function retentionBadge(retainUntil) {
  const t = new Date(retainUntil).getTime();
  const now = Date.now();
  const days = Math.round((t - now) / (1000 * 60 * 60 * 24));
  if (days < 0) return { tone: "critical", label: "Retention ended" };
  if (days < 180) return { tone: "warning", label: `Keep ${Math.round(days / 30)} more months` };
  return { tone: "success", label: `Keep until ${new Date(retainUntil).toLocaleDateString()}` };
}

export default function Documents() {
  const { docs, soon } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const errors = actionData?.errors || {};
  const justSaved = searchParams.get("saved") === "1";

  const [kind, setKind] = useState("DECLARATION_OF_CONFORMITY");
  const [retentionYears, setRetentionYears] = useState("10");
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [productRef, setProductRef] = useState("");

  // Restore typed values if server-side validation failed
  useEffect(() => {
    if (actionData?.values) {
      const v = actionData.values;
      if (v.kind) setKind(v.kind);
      setFileName(v.fileName || "");
      setFileUrl(v.fileUrl || "");
      setProductRef(v.productRef || "");
    }
  }, [actionData]);

  // Clear form after successful save
  useEffect(() => {
    if (justSaved) {
      setFileName(""); setFileUrl(""); setProductRef("");
    }
  }, [justSaved]);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  const rows = docs.map((d, index) => {
    const rb = retentionBadge(d.retainUntil);
    return (
      <IndexTable.Row id={d.id} key={d.id} position={index}>
        <IndexTable.Cell>
          <InlineStack gap="200" blockAlign="center">
            <Icon source={FileIcon} tone="base" />
            <BlockStack gap="0">
              <Text as="span" variant="bodyMd" fontWeight="semibold">{d.fileName}</Text>
              {d.productId && <Text as="span" variant="bodySm" tone="subdued">{d.productId}</Text>}
            </BlockStack>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell><Badge>{KIND_LABEL[d.kind] || d.kind}</Badge></IndexTable.Cell>
        <IndexTable.Cell><Badge tone={rb.tone}>{rb.label}</Badge></IndexTable.Cell>
        <IndexTable.Cell>
          <InlineStack gap="200">
            <Button icon={ExternalIcon} variant="plain" url={d.fileUrl} external>Open</Button>
            <Button icon={DeleteIcon} variant="plain" tone="critical"
              onClick={() => onDelete(d.id)} accessibilityLabel="Delete" />
          </InlineStack>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title={t("nav.documents")}
      subtitle="GPSR requires keeping technical documentation for 10 years. Store and track it here."
      backAction={{ content: t("common.back"), url: "/app" }}
    >
      <Layout>
        {justSaved && (
          <Layout.Section>
            <Banner tone="success" title="Document added"
              onDismiss={() => setSearchParams({}, { replace: true })} />
          </Layout.Section>
        )}
        {soon > 0 && (
          <Layout.Section>
            <Banner tone="warning" title={`${soon} document(s) approaching the end of their retention period`}>
              <Text as="p">Review these before their 10-year retention ends.</Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Add a document</Text>
              {actionData?.errors && <Banner tone="critical" title="Fix the highlighted fields" />}
              <Form method="post">
                <input type="hidden" name="intent" value="add" />
                <FormLayout>
                  <FormLayout.Group>
                    <Select label="Document type" name="kind" options={DOC_KINDS} value={kind} onChange={setKind} />
                    <Select label="Keep for" name="retentionYears"
                      options={[{ label: "10 years (GPSR standard)", value: "10" }, { label: "5 years", value: "5" }, { label: "15 years", value: "15" }]}
                      value={retentionYears} onChange={setRetentionYears} />
                  </FormLayout.Group>
                  <TextField label="Document name" name="fileName" autoComplete="off"
                    value={fileName} onChange={setFileName} error={errors.fileName} requiredIndicator
                    placeholder="e.g. Declaration of Conformity — Wooden Toy Car" />
                  <TextField label="File link (https)" name="fileUrl" autoComplete="off"
                    value={fileUrl} onChange={setFileUrl} error={errors.fileUrl} requiredIndicator
                    placeholder="https://…"
                    helpText="Link to the file (Shopify Files, Drive, Dropbox, etc.). Direct upload to Shopify Files is coming." />
                  <TextField label="Applies to product / SKU (optional)" name="productRef" autoComplete="off"
                    value={productRef} onChange={setProductRef} placeholder="e.g. Wooden Toy Car, or SKU-1234" />
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={saving}>Add document</Button>
                  </InlineStack>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {docs.length === 0 ? (
            <Card>
              <EmptyState heading="No documents stored yet"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg">
                <p>Add declarations of conformity, test reports and technical files. GPSR requires you keep them for 10 years and produce them if a regulator asks.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <Box padding="300">
                <Text as="h2" variant="headingMd">{`Stored documents (${docs.length})`}</Text>
              </Box>
              <IndexTable resourceName={{ singular: "document", plural: "documents" }}
                itemCount={docs.length} selectable={false}
                headings={[{ title: "Document" }, { title: "Type" }, { title: "Retention" }, { title: "" }]}>
                {rows}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
