import { json, redirect } from "@remix-run/node";
import { useLoaderData, useActionData, Form, useNavigation } from "@remix-run/react";
import { useState } from "react";
import {
  Page, Layout, Card, BlockStack, InlineStack, Text, Select, Button, Banner,
  Box, Badge, Divider, Checkbox, InlineGrid, Icon,
} from "@shopify/polaris";
import { GlobeIcon } from "@shopify/polaris-icons";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { APP_UI_LANGUAGES, EU_OFFICIAL_LANGUAGES } from "../lib/languages";
import { TRANSLATED_LOCALES } from "../lib/i18n/dictionaries";
import { useT, translate } from "../lib/i18n/context";

async function getShop(session) {
  return (
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }))
  );
}

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  return json({
    uiLocale: shop.defaultLocale || "en",
    marketLocales: shop.euMarketLocales || [],
  });
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await getShop(session);
  const form = await request.formData();
  const intent = form.get("intent");

  if (intent === "ui") {
    const locale = String(form.get("uiLocale") || "en");
    await prisma.shop.update({ where: { id: shop.id }, data: { defaultLocale: locale } });
    return redirect("/app/languages?saved=ui");
  }
  if (intent === "markets") {
    const markets = form.getAll("markets").map(String);
    await prisma.shop.update({ where: { id: shop.id }, data: { euMarketLocales: markets } });
    return redirect("/app/languages?saved=markets");
  }
  return json({ ok: false });
};

export default function Languages() {
  const { uiLocale, marketLocales } = useLoaderData();
  const nav = useNavigation();
  const t = useT();
  const saving = nav.state === "submitting";

  const [selectedUi, setSelectedUi] = useState(uiLocale);
  const [markets, setMarkets] = useState(new Set(marketLocales));

  const uiOptions = APP_UI_LANGUAGES.map((l) => ({
    label: `${l.native} (${l.name})${TRANSLATED_LOCALES.has(l.code) ? "" : " — beta"}`,
    value: l.code,
  }));

  const toggleMarket = (code) => {
    setMarkets((prev) => {
      const next = new Set(prev);
      next.has(code) ? next.delete(code) : next.add(code);
      return next;
    });
  };

  return (
    <Page
      title={t("lang.title")}
      subtitle={t("lang.subtitle")}
      backAction={{ content: t("common.back"), url: "/app" }}
    >
      <Layout>
        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack gap="200" blockAlign="center">
                <Icon source={GlobeIcon} tone="base" />
                <Text as="h2" variant="headingMd">{t("lang.uiTitle")}</Text>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">{t("lang.uiBody")}</Text>
              <Form method="post">
                <input type="hidden" name="intent" value="ui" />
                <InlineStack gap="300" blockAlign="end">
                  <Box minWidth="320px">
                    <Select label={t("lang.currentLang")} name="uiLocale" options={uiOptions}
                      value={selectedUi} onChange={setSelectedUi} />
                  </Box>
                  <Button variant="primary" submit loading={saving}>{t("lang.saveUi")}</Button>
                </InlineStack>
              </Form>
              <Box>
                <Text as="span" variant="bodyXs" tone="subdued">
                  {`${TRANSLATED_LOCALES.size} languages fully translated · ${APP_UI_LANGUAGES.length - TRANSLATED_LOCALES.size} in beta (fall back to English until translated)`}
                </Text>
              </Box>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Card>
            <BlockStack gap="400">
              <InlineStack align="space-between" blockAlign="center">
                <Text as="h2" variant="headingMd">{t("lang.marketTitle")}</Text>
                <Badge tone={markets.size ? "success" : "attention"}>
                  {`${markets.size} ${t("lang.activeCount")}`}
                </Badge>
              </InlineStack>
              <Text as="p" variant="bodySm" tone="subdued">{t("lang.marketBody")}</Text>
              <Divider />
              <Form method="post">
                <input type="hidden" name="intent" value="markets" />
                {[...markets].map((m) => <input key={m} type="hidden" name="markets" value={m} />)}
                <InlineGrid columns={{ xs: 2, sm: 3, md: 4 }} gap="200">
                  {EU_OFFICIAL_LANGUAGES.map((l) => (
                    <Checkbox
                      key={l.code}
                      label={`${l.native}`}
                      helpText={l.name}
                      checked={markets.has(l.code)}
                      onChange={() => toggleMarket(l.code)}
                    />
                  ))}
                </InlineGrid>
                <Box paddingBlockStart="400">
                  <InlineStack align="end">
                    <Button variant="primary" submit loading={saving}>{t("lang.saveMarkets")}</Button>
                  </InlineStack>
                </Box>
              </Form>
            </BlockStack>
          </Card>
        </Layout.Section>

        <Layout.Section>
          <Banner tone="info">
            <Text as="p" variant="bodySm">
              Product warnings will be required in each selected market language before a product can be
              published. This is the GPSR "language of the buyer's country" rule, enforced automatically.
            </Text>
          </Banner>
        </Layout.Section>
      </Layout>
    </Page>
  );
}
