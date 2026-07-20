import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit, useSearchParams } from "@remix-run/react";
import { useCallback, useState, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Button, Banner, BlockStack,
  InlineStack, Text, Box, Badge, Divider, EmptyState, IndexTable, Icon, DropZone,
  Thumbnail, Spinner,
} from "@shopify/polaris";
import { FileIcon, DeleteIcon, ExternalIcon, UploadIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { useT } from "../lib/i18n/context";
import {
  createStagedUpload, registerUploadedFile, isAllowedUpload, MAX_UPLOAD_BYTES,
} from "../lib/shopify-files.server";

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
    return t > now && t - now < 1000 * 60 * 60 * 24 * 180;
  }).length;
  return json({ docs, soon, defaultYears: shop.defaultRetentionYears || 10 });
};

export const action = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await prisma.complianceDocument.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  // Step 1 of the upload handshake — hand the browser a staged target.
  if (intent === "stageUpload") {
    const filename = String(form.get("filename") || "").trim();
    const mimeType = String(form.get("mimeType") || "").trim();
    const fileSize = parseInt(String(form.get("fileSize") || "0"), 10);

    if (!filename || !mimeType) return json({ uploadError: "Missing file details." }, { status: 400 });
    if (!isAllowedUpload(mimeType)) {
      return json({ uploadError: "Only PDF, Word and image files can be uploaded." }, { status: 400 });
    }
    if (!fileSize || fileSize > MAX_UPLOAD_BYTES) {
      return json({ uploadError: "Files must be smaller than 20 MB." }, { status: 400 });
    }
    try {
      const target = await createStagedUpload(admin, { filename, mimeType, fileSize });
      return json({ stagedTarget: target });
    } catch (e) {
      return json({ uploadError: e?.message || "Could not start the upload." }, { status: 500 });
    }
  }

  // Step 3 — register the uploaded object and store the document record.
  if (intent === "finalizeUpload") {
    const resourceUrl = String(form.get("resourceUrl") || "");
    const mimeType = String(form.get("mimeType") || "");
    const kind = String(form.get("kind") || "OTHER");
    const fileName = String(form.get("fileName") || "").trim();
    const productRef = String(form.get("productRef") || "").trim() || null;
    const years = parseInt(String(form.get("retentionYears") || "10"), 10) || 10;

    if (!resourceUrl || !fileName) {
      return json({ uploadError: "Upload did not complete. Try again." }, { status: 400 });
    }
    try {
      const file = await registerUploadedFile(admin, { resourceUrl, mimeType, alt: fileName });
      if (!file.url) {
        return json({ uploadError: "Shopify is still processing the file. Try again in a moment." }, { status: 202 });
      }
      const retainUntil = new Date();
      retainUntil.setFullYear(retainUntil.getFullYear() + years);

      await prisma.complianceDocument.create({
        data: { shopId: shop.id, kind, fileName, fileUrl: file.url, productId: productRef, retainUntil },
      });
      await prisma.auditEvent.create({
        data: { shopId: shop.id, actor: session.shop, action: "document.uploaded", target: fileName },
      });
      return redirect("/app/documents?saved=1");
    } catch (e) {
      return json({ uploadError: e?.message || "Could not save the uploaded file." }, { status: 500 });
    }
  }

  // Link-only path, kept for files already hosted elsewhere.
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
  const days = Math.round((t - Date.now()) / (1000 * 60 * 60 * 24));
  if (days < 0) return { tone: "critical", label: "Retention ended" };
  if (days < 180) return { tone: "warning", label: `Keep ${Math.round(days / 30)} more months` };
  return { tone: "success", label: `Keep until ${new Date(retainUntil).toLocaleDateString()}` };
}

export default function Documents() {
  const { docs, soon, defaultYears } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const errors = actionData?.errors || {};
  const justSaved = searchParams.get("saved") === "1";

  const [kind, setKind] = useState("DECLARATION_OF_CONFORMITY");
  const [retentionYears, setRetentionYears] = useState(String(defaultYears));
  const [fileName, setFileName] = useState("");
  const [fileUrl, setFileUrl] = useState("");
  const [productRef, setProductRef] = useState("");
  const [showLinkForm, setShowLinkForm] = useState(false);

  const [uploading, setUploading] = useState(false);
  const [uploadStage, setUploadStage] = useState("");
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    if (actionData?.values) {
      const v = actionData.values;
      if (v.kind) setKind(v.kind);
      setFileName(v.fileName || "");
      setFileUrl(v.fileUrl || "");
      setProductRef(v.productRef || "");
    }
    if (actionData?.uploadError) {
      setUploadError(actionData.uploadError);
      setUploading(false);
    }
  }, [actionData]);

  useEffect(() => {
    if (justSaved) { setFileName(""); setFileUrl(""); setProductRef(""); }
  }, [justSaved]);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  // Browser-side three-step upload: stage → PUT to storage → register.
  const handleDrop = useCallback(async (_files, accepted) => {
    const file = accepted?.[0];
    if (!file) return;
    setUploadError(null);
    setUploading(true);

    try {
      setUploadStage("Preparing upload…");
      const stageForm = new FormData();
      stageForm.append("intent", "stageUpload");
      stageForm.append("filename", file.name);
      stageForm.append("mimeType", file.type || "application/octet-stream");
      stageForm.append("fileSize", String(file.size));

      const stageRes = await fetch("/app/documents", { method: "POST", body: stageForm });
      const stageJson = await stageRes.json();
      if (!stageJson?.stagedTarget) {
        setUploadError(stageJson?.uploadError || "Could not start the upload.");
        setUploading(false);
        return;
      }

      setUploadStage("Uploading file…");
      const target = stageJson.stagedTarget;
      const cloudForm = new FormData();
      for (const p of target.parameters) cloudForm.append(p.name, p.value);
      cloudForm.append("file", file);

      const cloudRes = await fetch(target.url, { method: "POST", body: cloudForm });
      if (!cloudRes.ok && cloudRes.status !== 201 && cloudRes.status !== 204) {
        setUploadError("The file could not be uploaded to Shopify storage.");
        setUploading(false);
        return;
      }

      setUploadStage("Saving to your vault…");
      const finalForm = new FormData();
      finalForm.append("intent", "finalizeUpload");
      finalForm.append("resourceUrl", target.resourceUrl);
      finalForm.append("mimeType", file.type || "application/octet-stream");
      finalForm.append("kind", kind);
      finalForm.append("fileName", fileName.trim() || file.name);
      finalForm.append("productRef", productRef);
      finalForm.append("retentionYears", retentionYears);
      submit(finalForm, { method: "post" });
    } catch (e) {
      setUploadError("Upload failed. Check your connection and try again.");
      setUploading(false);
    }
  }, [kind, fileName, productRef, retentionYears, submit]);

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
            <Banner tone="success" title="Document saved"
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
        {uploadError && (
          <Layout.Section>
            <Banner tone="critical" title={uploadError} onDismiss={() => setUploadError(null)} />
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Add a document</Text>

              <FormLayout>
                <FormLayout.Group>
                  <Select label="Document type" options={DOC_KINDS} value={kind} onChange={setKind} />
                  <Select label="Keep for"
                    options={[
                      { label: "10 years (GPSR standard)", value: "10" },
                      { label: "5 years", value: "5" },
                      { label: "15 years", value: "15" },
                    ]}
                    value={retentionYears} onChange={setRetentionYears} />
                </FormLayout.Group>
                <TextField label="Document name (optional)" autoComplete="off"
                  value={fileName} onChange={setFileName}
                  placeholder="Leave blank to use the file name"
                  helpText="e.g. Declaration of Conformity — Wooden Toy Car" />
                <TextField label="Applies to product / SKU (optional)" autoComplete="off"
                  value={productRef} onChange={setProductRef} placeholder="e.g. Wooden Toy Car, or SKU-1234" />
              </FormLayout>

              {uploading ? (
                <Box padding="500" borderColor="border" borderWidth="025" borderRadius="200">
                  <InlineStack gap="300" blockAlign="center" align="center">
                    <Spinner size="small" />
                    <Text as="span" variant="bodyMd">{uploadStage}</Text>
                  </InlineStack>
                </Box>
              ) : (
                <DropZone accept="application/pdf,image/*,.doc,.docx" type="file"
                  allowMultiple={false} onDrop={handleDrop}>
                  <DropZone.FileUpload actionTitle="Upload a file"
                    actionHint="PDF, Word or image, up to 20 MB. Stored in your own Shopify Files." />
                </DropZone>
              )}

              <Divider />

              {!showLinkForm ? (
                <InlineStack align="center">
                  <Button variant="plain" onClick={() => setShowLinkForm(true)}>
                    Or link a file hosted elsewhere
                  </Button>
                </InlineStack>
              ) : (
                <Form method="post">
                  <input type="hidden" name="intent" value="add" />
                  <input type="hidden" name="kind" value={kind} />
                  <input type="hidden" name="retentionYears" value={retentionYears} />
                  <input type="hidden" name="productRef" value={productRef} />
                  <FormLayout>
                    <TextField label="Document name" name="fileName" autoComplete="off"
                      value={fileName} onChange={setFileName} error={errors.fileName} requiredIndicator />
                    <TextField label="File link (https)" name="fileUrl" autoComplete="off"
                      value={fileUrl} onChange={setFileUrl} error={errors.fileUrl} requiredIndicator
                      placeholder="https://…" helpText="Drive, Dropbox, or any public https link." />
                    <InlineStack align="end" gap="200">
                      <Button onClick={() => setShowLinkForm(false)}>Cancel</Button>
                      <Button variant="primary" submit loading={saving}>Add link</Button>
                    </InlineStack>
                  </FormLayout>
                </Form>
              )}
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
