import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";
import { NavMenu } from "@shopify/app-bridge-react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { I18nProvider, translate } from "../lib/i18n/context";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop =
    (await prisma.shop.findUnique({ where: { shopDomain: session.shop } })) ||
    (await prisma.shop.create({ data: { shopDomain: session.shop } }));
  return json({ apiKey: process.env.SHOPIFY_API_KEY || "", locale: shop.defaultLocale || "en" });
};

export default function App() {
  const { apiKey, locale } = useLoaderData();
  const t = (k) => translate(locale, k);
  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <I18nProvider locale={locale}>
        <NavMenu>
          <Link to="/app" rel="home">{t("nav.dashboard")}</Link>
          <Link to="/app/products">{t("nav.products")}</Link>
          <Link to="/app/scanner">{t("nav.scanner")}</Link>
          <Link to="/app/templates">{t("nav.templates")}</Link>
          <Link to="/app/responsible-persons">{t("nav.responsiblePersons")}</Link>
          <Link to="/app/manufacturers">Manufacturers</Link>
          <Link to="/app/languages">{t("nav.languages")}</Link>
          <Link to="/app/channels">{t("nav.channels")}</Link>
          <Link to="/app/documents">{t("nav.documents")}</Link>
          <Link to="/app/suppliers">Supplier requests</Link>
          <Link to="/app/incidents">{t("nav.incidents")}</Link>
          <Link to="/app/recalls">Recall alerts</Link>
          <Link to="/app/settings">{t("nav.settings")}</Link>
          <Link to="/app/billing">Plan &amp; Billing</Link>
        </NavMenu>
        <Outlet />
      </I18nProvider>
    </AppProvider>
  );
}

export function ErrorBoundary() { return boundary.error(useRouteError()); }
export const headers = (args) => boundary.headers(args);
