import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// Shopify's mandatory privacy webhooks, plus app/uninstalled cleanup.
//
// What this app stores: shop-level compliance records (responsible persons,
// manufacturers, product safety data, documents, incidents, supplier requests).
// It does NOT store customer personal data — it holds no customer names,
// addresses, emails or order history. The customer-scoped topics are therefore
// acknowledged with an accurate "nothing held" response, while shop/redact
// performs a real, complete purge.

export const action = async ({ request }) => {
  const { topic, shop, payload } = await authenticate.webhook(request);

  try {
    switch (topic) {
      case "CUSTOMERS_DATA_REQUEST": {
        // No customer personal data is stored by this app, so there is nothing
        // to hand back to the merchant. Logged for the audit trail.
        console.log(
          `[gpsr] customers/data_request for ${shop} — no customer data is stored by this app.`
        );
        break;
      }

      case "CUSTOMERS_REDACT": {
        console.log(
          `[gpsr] customers/redact for ${shop} — no customer data is stored by this app.`
        );
        break;
      }

      case "SHOP_REDACT": {
        // Sent 48 hours after uninstall. Delete everything belonging to this
        // shop. Related rows cascade from Shop via onDelete: Cascade.
        const domain = payload?.shop_domain || shop;
        const record = await prisma.shop.findUnique({ where: { shopDomain: domain } });
        if (record) {
          await prisma.shop.delete({ where: { id: record.id } });
          console.log(`[gpsr] shop/redact — purged all stored data for ${domain}.`);
        } else {
          console.log(`[gpsr] shop/redact — nothing stored for ${domain}.`);
        }
        await prisma.session.deleteMany({ where: { shop: domain } }).catch(() => {});
        break;
      }

      case "APP_UNINSTALLED": {
        // Tokens are dead once the app is removed; drop them immediately.
        // Compliance data is kept until shop/redact so a reinstall within the
        // 48-hour window does not lose the merchant's work.
        await prisma.session.deleteMany({ where: { shop } });
        console.log(`[gpsr] app/uninstalled — sessions cleared for ${shop}.`);
        break;
      }

      default: {
        console.log(`[gpsr] unhandled webhook topic: ${topic} for ${shop}`);
      }
    }
  } catch (e) {
    // Still acknowledge: Shopify retries on non-2xx, and a retry storm helps
    // nobody. The error is logged so it can be handled manually.
    console.error(`[gpsr] webhook ${topic} failed for ${shop}:`, e?.message || e);
  }

  return new Response();
};
