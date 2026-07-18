import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation, useSubmit, useSearchParams } from "@remix-run/react";
import { useCallback, useState, useEffect } from "react";
import {
  Page, Layout, Card, FormLayout, TextField, Select, Checkbox, Button, Banner,
  BlockStack, InlineStack, Text, Box, Badge, Divider, EmptyState, IndexTable, Icon,
  InlineGrid,
} from "@shopify/polaris";
import {
  DeleteIcon,
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

const TYPES = [
  { value: "COMPLAINT", label: "Customer complaint", tone: "attention", serious: false },
  { value: "NON_CONFORMITY", label: "Non-conformity found", tone: "attention", serious: false },
  { value: "INJURY", label: "Injury / safety incident", tone: "critical", serious: true },
  { value: "RECALL", label: "Product recall", tone: "critical", serious: true },
  { value: "AUTHORITY_REQUEST", label: "Authority request", tone: "warning", serious: false },
];
const TYPE_META = Object.fromEntries(TYPES.map((t) => [t.value, t]));

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const incidents = await prisma.incidentLog.findMany({
    where: { shopId: shop.id }, orderBy: { occurredAt: "desc" },
  });
  const unreportedSerious = incidents.filter(
    (i) => (i.type === "INJURY" || i.type === "RECALL") && !i.reportedToAuthority
  ).length;
  return json({ incidents, unreportedSerious });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "delete") {
    await prisma.incidentLog.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }

  if (intent === "add") {
    const type = String(form.get("type") || "COMPLAINT");
    const description = String(form.get("description") || "").trim();
    const productRef = String(form.get("productRef") || "").trim() || null;
    const actionTaken = String(form.get("actionTaken") || "").trim() || null;
    const reportedToAuthority = form.get("reportedToAuthority") === "on";
    const occurredRaw = String(form.get("occurredAt") || "");
    const occurredAt = occurredRaw ? new Date(occurredRaw) : new Date();

    const errors = {};
    if (!description) errors.description = "Describe what happened.";
    if (Object.keys(errors).length) {
      return json({ errors, values: { type, description, productRef, actionTaken } }, { status: 400 });
    }

    await prisma.incidentLog.create({
      data: { shopId: shop.id, type, description, productRef, actionTaken, reportedToAuthority, occurredAt },
    });
    await prisma.auditEvent.create({
      data: { shopId: shop.id, actor: session.shop, action: "incident.logged", target: type },
    });
    return redirect("/app/incidents?saved=1");
  }
  return json({ ok: false });
};

export default function Incidents() {
  const { incidents, unreportedSerious } = useLoaderData();
  const actionData = useActionData();
  const submit = useSubmit();
  const nav = useNavigation();
  const t = useT();
  const [searchParams, setSearchParams] = useSearchParams();
  const saving = nav.state === "submitting";
  const errors = actionData?.errors || {};
  const justSaved = searchParams.get("saved") === "1";

  const [type, setType] = useState("COMPLAINT");
  const [occurredAt, setOccurredAt] = useState(new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState("");
  const [productRef, setProductRef] = useState("");
  const [actionTaken, setActionTaken] = useState("");
  const [reported, setReported] = useState(false);

  // Restore typed values if server-side validation failed
  useEffect(() => {
    if (actionData?.values) {
      const v = actionData.values;
      if (v.type) setType(v.type);
      setDescription(v.description || "");
      setProductRef(v.productRef || "");
      setActionTaken(v.actionTaken || "");
    }
  }, [actionData]);

  // Clear form after successful save
  useEffect(() => {
    if (justSaved) {
      setDescription(""); setProductRef(""); setActionTaken(""); setReported(false);
    }
  }, [justSaved]);

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  const rows = incidents.map((inc, index) => {
    const meta = TYPE_META[inc.type] || { label: inc.type, tone: "base" };
    return (
      <IndexTable.Row id={inc.id} key={inc.id} position={index}>
        <IndexTable.Cell>
          <BlockStack gap="0">
            <Badge tone={meta.tone}>{meta.label}</Badge>
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <BlockStack gap="0">
            <Text as="span" variant="bodyMd">{inc.description.slice(0, 80)}{inc.description.length > 80 ? "…" : ""}</Text>
            {inc.productRef && <Text as="span" variant="bodySm" tone="subdued">{inc.productRef}</Text>}
          </BlockStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Text as="span" variant="bodySm">{new Date(inc.occurredAt).toLocaleDateString()}</Text>
        </IndexTable.Cell>
        <IndexTable.Cell>
          {inc.reportedToAuthority
            ? <Badge tone="success">Reported</Badge>
            : (meta.serious ? <Badge tone="critical">Not reported</Badge> : <Badge>—</Badge>)}
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button icon={DeleteIcon} variant="plain" tone="critical"
            onClick={() => onDelete(inc.id)} accessibilityLabel="Delete" />
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page
      title={t("nav.incidents")}
      subtitle="GPSR requires keeping records of safety complaints, incidents and recalls — and reporting serious ones."
      backAction={{ content: t("common.back"), url: "/app" }}
    >
      <Layout>
        {justSaved && (
          <Layout.Section>
            <Banner tone="success" title="Incident logged"
              onDismiss={() => setSearchParams({}, { replace: true })} />
          </Layout.Section>
        )}
        {unreportedSerious > 0 && (
          <Layout.Section>
            <Banner tone="critical" title={`${unreportedSerious} serious incident(s) not reported to authorities`}>
              <Text as="p">
                Injuries and recalls involving a safety risk must be reported through the EU Safety Business Gateway.
                Mark them as reported once submitted.
              </Text>
            </Banner>
          </Layout.Section>
        )}

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <Text as="h2" variant="headingMd">Log an incident</Text>
              {actionData?.errors && <Banner tone="critical" title="Fix the highlighted fields" />}
              <Form method="post">
                <input type="hidden" name="intent" value="add" />
                <FormLayout>
                  <FormLayout.Group>
                    <Select label="Incident type" name="type" options={TYPES} value={type} onChange={setType} />
                    <TextField label="Date it occurred" name="occurredAt" type="date" autoComplete="off"
                      value={occurredAt} onChange={setOccurredAt} />
                  </FormLayout.Group>
                  <TextField label="What happened" name="description" multiline={3} autoComplete="off"
                    value={description} onChange={setDescription} error={errors.description} requiredIndicator
                    placeholder="Describe the complaint, incident or authority request." />
                  <TextField label="Product / SKU (optional)" name="productRef" autoComplete="off"
                    value={productRef} onChange={setProductRef} placeholder="e.g. Wooden Toy Car, or SKU-1234" />
                  <TextField label="Action taken (optional)" name="actionTaken" multiline={2} autoComplete="off"
                    value={actionTaken} onChange={setActionTaken}
                    placeholder="e.g. Refunded customer, paused listing, contacted supplier." />
                  <Checkbox label="Reported to authorities (Safety Business Gateway)"
                    name="reportedToAuthority" checked={reported} onChange={setReported}
                    helpText="Required for injuries and recalls involving a safety risk." />
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={saving}>Log incident</Button>
                  </InlineStack>
                </FormLayout>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          {incidents.length === 0 ? (
            <Card>
              <EmptyState heading="No incidents logged"
                image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg">
                <p>A clean record is a good sign. If a complaint, injury or recall happens, log it here — GPSR requires you keep these records.</p>
              </EmptyState>
            </Card>
          ) : (
            <Card padding="0">
              <Box padding="300">
                <Text as="h2" variant="headingMd">{`Incident records (${incidents.length})`}</Text>
              </Box>
              <IndexTable resourceName={{ singular: "incident", plural: "incidents" }}
                itemCount={incidents.length} selectable={false}
                headings={[{ title: "Type" }, { title: "Description" }, { title: "Date" }, { title: "Reported" }, { title: "" }]}>
                {rows}
              </IndexTable>
            </Card>
          )}
        </Layout.Section>
      </Layout>
    </Page>
  );
}
