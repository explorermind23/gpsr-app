import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { buildPassportPdf } from "../lib/passport";

// GET /api/passport/:productId  → downloads the product's GPSR passport PDF.
export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const productId = `gid://shopify/Product/${params.productId}`;

  const record = await prisma.productCompliance.findFirst({
    where: { shopId: shop.id, shopifyProductId: productId },
    include: { responsiblePerson: true, manufacturer: true },
  });

  if (!record) return new Response("No compliance data for this product", { status: 404 });

  const pdfBytes = await buildPassportPdf({
    product: { title: record.productTitle || "Product" },
    record,
    rp: record.responsiblePerson,
    mf: record.manufacturer,
    shopDomain: shop.shopDomain,
  });

  const safeName = (record.productTitle || "product").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new Response(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="gpsr-passport-${safeName}.pdf"`,
      "Cache-Control": "no-store",
    },
  });
};
