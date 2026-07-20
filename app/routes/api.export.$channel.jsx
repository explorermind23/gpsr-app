import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { CHANNEL_META } from "../lib/exporters";
import { canExport } from "../lib/plans";

// GET /api/export/:channel  → downloads a GPSR feed file for that marketplace.
export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const channel = String(params.channel || "").toLowerCase();
  const meta = CHANNEL_META[channel];

  if (!shop || !meta) {
    return new Response("Unknown channel", { status: 404 });
  }

  // Plan entitlement — Free has no exports, Starter has Amazon only.
  if (!canExport(shop.plan, channel)) {
    return new Response(
      JSON.stringify({
        error: "upgrade_required",
        message:
          shop.plan === "FREE"
            ? "Marketplace exports are available on Starter and Pro."
            : `The ${meta.label} export is available on Pro.`,
        channel,
        plan: shop.plan,
      }),
      { status: 402, headers: { "Content-Type": "application/json" } }
    );
  }

  // Only export products that are actually compliant (READY / PUBLISHED).
  const records = await prisma.productCompliance.findMany({
    where: { shopId: shop.id, status: { in: ["READY", "PUBLISHED"] } },
    include: { responsiblePerson: true, manufacturer: true },
  });

  const items = records.map((rec) => ({ rec, rp: rec.responsiblePerson, mf: rec.manufacturer }));
  const csv = meta.build(items);

  await prisma.channelExport.create({
    data: {
      shopId: shop.id,
      channel: channel.toUpperCase(),
      format: meta.format,
      rowCount: items.length,
    },
  }).catch(() => {});

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${meta.filename}"`,
      "Cache-Control": "no-store",
    },
  });
};
