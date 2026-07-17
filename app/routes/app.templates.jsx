import { json } from "@remix-run/node";
import { useLoaderData, useNavigate, useSubmit } from "@remix-run/react";
import { useCallback } from "react";
import {
  Page, Card, BlockStack, InlineStack, Text, Badge, Button, EmptyState,
  InlineGrid, Box, Icon, Divider,
} from "@shopify/polaris";
import { PlusIcon, DeleteIcon, EditIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { PICTOGRAM_MAP } from "../lib/pictograms";
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
  const templates = await prisma.complianceTemplate.findMany({
    where: { shopId: shop.id }, orderBy: { updatedAt: "desc" },
  });
  const usage = await prisma.productCompliance.groupBy({
    by: ["templateId"], where: { shopId: shop.id, templateId: { not: null } }, _count: true,
  }).catch(() => []);
  const usageMap = Object.fromEntries(usage.map((u) => [u.templateId, u._count]));
  return json({ templates, usageMap });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  if (form.get("intent") === "delete") {
    await prisma.complianceTemplate.delete({ where: { id: String(form.get("id")) } });
    return json({ ok: true });
  }
  return json({ ok: false });
};

export default function Templates() {
  const { templates, usageMap } = useLoaderData();
  const navigate = useNavigate();
  const submit = useSubmit();
  const t = useT();

  const onDelete = useCallback((id) => {
    const fd = new FormData();
    fd.append("intent", "delete");
    fd.append("id", id);
    submit(fd, { method: "post" });
  }, [submit]);

  return (
    <Page
      title={t("nav.templates")}
      subtitle="Define compliance defaults once per category, then bulk-apply to many products."
      backAction={{ content: t("common.back"), url: "/app" }}
      primaryAction={{ content: "Create template", icon: PlusIcon, url: "/app/templates/new" }}
    >
      {templates.length === 0 ? (
        <Card>
          <EmptyState heading="No templates yet"
            image="https://cdn.shopify.com/s/files/1/0757/9955/files/empty-state.svg"
            action={{ content: "Create your first template", url: "/app/templates/new" }}>
            <p>A template holds warnings, pictograms and care instructions for a product category — apply it to hundreds of products in one action.</p>
          </EmptyState>
        </Card>
      ) : (
        <InlineGrid columns={{ xs: 1, md: 2 }} gap="300">
          {templates.map((tpl) => {
            const warnings = Array.isArray(tpl.defaultWarnings) ? tpl.defaultWarnings : [];
            const picts = (tpl.defaultPictograms || []).map((k) => PICTOGRAM_MAP[k]).filter(Boolean);
            return (
              <Card key={tpl.id}>
                <BlockStack gap="300">
                  <InlineStack align="space-between" blockAlign="center">
                    <BlockStack gap="0">
                      <Text as="span" variant="headingSm">{tpl.name}</Text>
                      {tpl.category && <Text as="span" variant="bodySm" tone="subdued">{tpl.category}</Text>}
                    </BlockStack>
                    <InlineStack gap="200">
                      {tpl.requiresCE && <Badge tone="attention">CE</Badge>}
                      <Badge>{`${usageMap[tpl.id] || 0} products`}</Badge>
                    </InlineStack>
                  </InlineStack>
                  <Divider />
                  <InlineStack gap="300" blockAlign="center">
                    <Text as="span" variant="bodySm" tone="subdued">{`${warnings.length} warning language(s)`}</Text>
                    {picts.length > 0 && (
                      <InlineStack gap="100">
                        {picts.slice(0, 5).map((p) => (
                          <span key={p.key} title={p.label}
                            style={{ width: 24, height: 24, display: "inline-block" }}
                            dangerouslySetInnerHTML={{ __html: p.svg }} />
                        ))}
                      </InlineStack>
                    )}
                  </InlineStack>
                  <InlineStack gap="200">
                    <Button icon={EditIcon} onClick={() => navigate(`/app/templates/${tpl.id}`)}>Edit</Button>
                    <Button icon={DeleteIcon} tone="critical" variant="tertiary"
                      onClick={() => onDelete(tpl.id)} accessibilityLabel="Delete">Delete</Button>
                  </InlineStack>
                </BlockStack>
              </Card>
            );
          })}
        </InlineGrid>
      )}
    </Page>
  );
}
