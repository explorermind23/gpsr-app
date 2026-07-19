import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit, useSearchParams } from "@remix-run/react";
import { useState, useCallback } from "react";
import {
  Page, Card, IndexTable, useIndexResourceState, Text, Badge, Thumbnail,
  InlineStack, Button, ChoiceList, EmptyState, Box, Banner, Select,
  BlockStack, Modal,
} from "@shopify/polaris";
import { ImageIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { computeCompliance, STATUS_META } from "../lib/compliance";
import { useT } from "../lib/i18n/context";
import { assertProductAllowance } from "../lib/billing.server";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

const PRODUCTS_QUERY = `#graphql
  query Products($first: Int!, $after: String, $query: String) {
    products(first: $first, after: $after, sortKey: TITLE, query: $query) {
      edges {
        node {
          id
          title
          status
          featuredImage { url altText }
          totalInventory
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }`;

export const loader = async ({ request }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const url = new URL(request.url);
  const search = url.searchParams.get("q") || "";
  const statusFilter = url.searchParams.get("status") || "";

  let products = [];
  try {
    const res = await admin.graphql(PRODUCTS_QUERY, {
      variables: { first: 50, after: null, query: search || null },
    });
    const body = await res.json();
    products = (body.data?.products?.edges || []).map((e) => e.node);
  } catch (e) {
    products = [];
  }

  // Merge with our compliance records
  const records = await prisma.productCompliance.findMany({ where: { shopId: shop.id } });
  const byId = new Map(records.map((r) => [r.shopifyProductId, r]));
  const required = shop.euMarketLocales || [];

  let rows = products.map((p) => {
    const rec = byId.get(p.id);
    const { status } = rec
      ? computeCompliance(rec, required)
      : { status: "INCOMPLETE" };
    return {
      id: p.id,
      title: p.title,
      image: p.featuredImage?.url || null,
      status,
      hasRecord: !!rec,
    };
  });

  if (statusFilter) rows = rows.filter((r) => r.status === statusFilter);

  const templates = await prisma.complianceTemplate.findMany({
    where: { shopId: shop.id }, select: { id: true, name: true },
  });

  const counts = {
    total: products.length,
    ready: rows.filter((r) => r.status === "READY" || r.status === "PUBLISHED").length,
    incomplete: rows.filter((r) => r.status === "INCOMPLETE").length,
  };

  return json({ rows, templates, marketCount: required.length, counts, statusFilter });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "bulkTemplate") {
    const templateId = String(form.get("templateId"));
    const ids = form.getAll("ids").map(String);
    const tpl = await prisma.complianceTemplate.findUnique({ where: { id: templateId } });
    let skipped = 0;
    if (tpl) {
      for (const pid of ids) {
        const gate = await assertProductAllowance(shop, pid);
        if (!gate.allowed) { skipped += 1; continue; }
        const existing = await prisma.productCompliance.findFirst({
          where: { shopId: shop.id, shopifyProductId: pid, shopifyVariantId: null },
        });
        if (existing) {
          await prisma.productCompliance.update({
            where: { id: existing.id },
            data: {
              templateId: tpl.id, warnings: tpl.defaultWarnings,
              pictograms: tpl.defaultPictograms, careInstructions: tpl.careInstructions,
              appliedByBulk: true,
            },
          });
        } else {
          await prisma.productCompliance.create({
            data: {
              shopId: shop.id, shopifyProductId: pid, templateId: tpl.id,
              warnings: tpl.defaultWarnings, pictograms: tpl.defaultPictograms,
              careInstructions: tpl.careInstructions, ceMarked: false, appliedByBulk: true,
            },
          });
        }
      }
      await prisma.auditEvent.create({
        data: { shopId: shop.id, actor: session.shop, action: "template.bulkApplied", target: `${ids.length} products`, meta: { templateId } },
      });
    }
    return json({ ok: true, applied: ids.length - skipped, skipped });
  }
  return json({ ok: false });
};

export default function Products() {
  const { rows, templates, marketCount, counts, statusFilter } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const t = useT();
  const [params, setParams] = useSearchParams();
  const [modalOpen, setModalOpen] = useState(false);
  const [templateId, setTemplateId] = useState(templates[0]?.id || "");

  const resourceName = { singular: "product", plural: "products" };
  const { selectedResources, allResourcesSelected, handleSelectionChange } =
    useIndexResourceState(rows);

  const openProduct = useCallback((id) => {
    navigate(`/app/products/${id.split("/").pop()}`);
  }, [navigate]);

  const applyTemplate = useCallback(() => {
    const fd = new FormData();
    fd.append("intent", "bulkTemplate");
    fd.append("templateId", templateId);
    selectedResources.forEach((id) => fd.append("ids", id));
    submit(fd, { method: "post" });
    setModalOpen(false);
  }, [templateId, selectedResources, submit]);

  const setStatus = (val) => {
    const next = new URLSearchParams(params);
    val ? next.set("status", val) : next.delete("status");
    setParams(next);
  };

  const promotedBulkActions = [
    { content: "Apply template", onAction: () => setModalOpen(true), disabled: templates.length === 0 },
  ];

  const rowMarkup = rows.map(({ id, title, image, status }, index) => {
    const meta = STATUS_META[status] || STATUS_META.INCOMPLETE;
    return (
      <IndexTable.Row id={id} key={id} position={index}
        selected={selectedResources.includes(id)}
        onClick={() => openProduct(id)}>
        <IndexTable.Cell>
          <InlineStack gap="300" blockAlign="center">
            <Thumbnail source={image || ImageIcon} alt={title} size="small" />
            <Text as="span" variant="bodyMd" fontWeight="semibold">{title}</Text>
          </InlineStack>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Badge tone={meta.tone}>{meta.label}</Badge>
        </IndexTable.Cell>
        <IndexTable.Cell>
          <Button variant="plain" onClick={() => openProduct(id)}>
            Manage
          </Button>
        </IndexTable.Cell>
      </IndexTable.Row>
    );
  });

  return (
    <Page title={t("nav.products")} subtitle="Attach GPSR safety data to each product and publish it to every channel."
      backAction={{ content: t("common.back"), url: "/app" }}
      secondaryActions={[{ content: "Import from CSV", url: "/app/products/import" }]}>
      {marketCount === 0 && (
        <Box paddingBlockEnd="400">
          <Banner tone="warning" title="Set your market languages first"
            action={{ content: "Set languages", url: "/app/languages" }}>
            <Text as="p">Warnings must be provided in each EU market language you sell into. Choose them before completing products.</Text>
          </Banner>
        </Box>
      )}

      <Box paddingBlockEnd="400">
        <InlineStack gap="300">
          <Badge>{`${counts.total} products`}</Badge>
          <Badge tone="success">{`${counts.ready} ready`}</Badge>
          <Badge tone="critical">{`${counts.incomplete} incomplete`}</Badge>
        </InlineStack>
      </Box>

      <Card padding="0">
        <Box padding="300">
          <ChoiceList title="Filter by status" titleHidden
            choices={[
              { label: "All", value: "" },
              { label: "Incomplete", value: "INCOMPLETE" },
              { label: "Ready", value: "READY" },
            ]}
            selected={[statusFilter]}
            onChange={(v) => setStatus(v[0])} />
        </Box>
        {rows.length === 0 ? (
          <EmptyState heading="No products found"
            image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg">
            <p>Products from your store appear here once they load, or adjust your filter.</p>
          </EmptyState>
        ) : (
          <IndexTable resourceName={resourceName} itemCount={rows.length}
            selectedItemsCount={allResourcesSelected ? "All" : selectedResources.length}
            onSelectionChange={handleSelectionChange}
            promotedBulkActions={promotedBulkActions}
            headings={[{ title: "Product" }, { title: "Compliance" }, { title: "" }]}>
            {rowMarkup}
          </IndexTable>
        )}
      </Card>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Apply template to selected products"
        primaryAction={{ content: "Apply", onAction: applyTemplate }}
        secondaryActions={[{ content: "Cancel", onAction: () => setModalOpen(false) }]}>
        <Modal.Section>
          <BlockStack gap="300">
            <Text as="p">{`Apply a compliance template to ${selectedResources.length} selected product(s). This fills warnings, pictograms and care instructions from the template.`}</Text>
            <Select label="Template" options={templates.map((tp) => ({ label: tp.name, value: tp.id }))}
              value={templateId} onChange={setTemplateId} />
          </BlockStack>
        </Modal.Section>
      </Modal>
    </Page>
  );
}
