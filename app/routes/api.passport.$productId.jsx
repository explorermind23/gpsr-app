import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { buildPassportPdf } from "../lib/passport";

const PRODUCT_QUERY = `#graphql
  query PassportProduct($id: ID!) {
    product(id: $id) { id title }
    shop { name myshopifyDomain primaryDomain { host } }
  }`;

function slug(s) {
  return String(s || "product")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "product";
}

// GET /api/passport/:productId  → branded GPSR passport PDF
export const loader = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  if (!shop) return new Response("Shop not found", { status: 404 });

  const raw = decodeURIComponent(params.productId || "");
  const productId = raw.startsWith("gid://") ? raw : `gid://shopify/Product/${raw}`;

  const record = await prisma.productCompliance.findFirst({
    where: { shopId: shop.id, shopifyProductId: productId },
    include: { responsiblePerson: true, manufacturer: true },
  });

  if (!record) {
    return new Response(
      JSON.stringify({ error: "no_data", message: "Save compliance data for this product first." }),
      { status: 404, headers: { "Content-Type": "application/json" } }
    );
  }

  let product = { title: "Product" };
  let shopName = shop.shopDomain;
  let shopHost = shop.shopDomain;
  try {
    const res = await admin.graphql(PRODUCT_QUERY, { variables: { id: productId } });
    const body = await res.json();
    if (body.data?.product) product = body.data.product;
    if (body.data?.shop) {
      shopName = body.data.shop.name || shopName;
      shopHost = body.data.shop.primaryDomain?.host || body.data.shop.myshopifyDomain || shopHost;
    }
  } catch (e) { /* fall back to stored values */ }

  let pdfBytes;
  try {
    pdfBytes = await buildPassportPdf({
      product,
      record,
      rp: record.responsiblePerson,
      manufacturer: record.manufacturer,
      brand: {
        shopName,
        shopDomain: shopHost,
        accentHex: shop.brandAccentHex || "#1D9E75",
        logoUrl: shop.brandLogoUrl || null,
      },
    });
  } catch (e) {
    console.error("[gpsr] passport build failed:", e?.message || e);
    return new Response(
      JSON.stringify({ error: "build_failed", message: "Could not generate the passport PDF." }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  await prisma.auditEvent.create({
    data: { shopId: shop.id, actor: session.shop, action: "passport.generated", target: productId },
  }).catch(() => {});

  return new Response(pdfBytes, {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gpsr-passport-${slug(product.title)}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
};
