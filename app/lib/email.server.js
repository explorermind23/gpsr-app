// Outbound email via Resend.
//
// Only transactional mail is sent: a supplier is asked to fill in safety data
// the merchant is legally required to hold. Every send is best-effort — a
// failure never blocks the request being created, it just surfaces in the UI
// so the merchant can copy the link and send it themselves.

const RESEND_ENDPOINT = "https://api.resend.com/emails";

// Resend's shared test sender (onboarding@resend.dev) only delivers to the
// Resend account owner's own inbox. Leaving the feature "on" with that sender
// would show merchants a success message while their supplier receives nothing.
// So email is only considered available once a real verified sending domain is
// configured — set RESEND_FROM to an address on that domain and it turns on by
// itself, no code change needed.
const SHARED_TEST_SENDER = "onboarding@resend.dev";

export function emailConfigured() {
  const key = process.env.RESEND_API_KEY;
  const from = (process.env.RESEND_FROM || "").trim().toLowerCase();
  if (!key || !from) return false;
  return from !== SHARED_TEST_SENDER;
}

function escapeHtml(s) {
  return String(s || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function send({ to, subject, html, text, replyTo }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, error: "Email is not configured on this server." };

  const from = (process.env.RESEND_FROM || "").trim();
  if (!from || from.toLowerCase() === SHARED_TEST_SENDER) {
    return {
      ok: false,
      error: "No verified sending domain is configured, so the email was not sent.",
    };
  }

  try {
    const res = await fetch(RESEND_ENDPOINT, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject,
        html,
        text,
        ...(replyTo ? { reply_to: replyTo } : {}),
      }),
    });

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { ok: false, error: body?.message || `Resend returned ${res.status}.` };
    }
    return { ok: true, id: body?.id || null };
  } catch (e) {
    return { ok: false, error: e?.message || "Could not reach the email service." };
  }
}

export async function sendSupplierRequestEmail({ to, shopName, productRef, link, replyTo }) {
  const shop = escapeHtml(shopName || "a store you supply");
  const product = productRef ? escapeHtml(productRef) : null;

  const subject = product
    ? `Product safety information needed for ${productRef}`
    : `Product safety information needed for products you supply`;

  const intro = product
    ? `${shop} needs the EU product-safety details for <strong>${product}</strong>.`
    : `${shop} needs the EU product-safety details for products you supply.`;

  const html = `<!doctype html>
<html>
  <body style="margin:0;padding:0;background:#f4f4f2;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f2;padding:32px 16px;">
      <tr>
        <td align="center">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;border:1px solid #e3e3e0;">
            <tr>
              <td style="padding:28px 32px 8px;">
                <p style="margin:0 0 4px;font-size:13px;color:#6b6b66;">Product safety request</p>
                <h1 style="margin:0;font-size:20px;line-height:1.3;">Safety information needed</h1>
              </td>
            </tr>
            <tr>
              <td style="padding:12px 32px 0;font-size:15px;line-height:1.55;">
                <p style="margin:0 0 14px;">Hello,</p>
                <p style="margin:0 0 14px;">${intro}</p>
                <p style="margin:0 0 14px;">
                  Under the EU General Product Safety Regulation (EU) 2023/988, products sold to EU customers
                  must carry manufacturer details, a Responsible Person contact, and safety warnings. Your
                  customer needs this information from you to keep these products listed.
                </p>
                <p style="margin:0 0 20px;">
                  The secure form below takes a few minutes. You do not need an account and you will not get
                  access to their store.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 24px;">
                <a href="${escapeHtml(link)}"
                   style="display:inline-block;background:#1a1a1a;color:#ffffff;text-decoration:none;padding:12px 22px;border-radius:8px;font-size:15px;font-weight:600;">
                  Open the safety form
                </a>
              </td>
            </tr>
            <tr>
              <td style="padding:0 32px 28px;font-size:13px;line-height:1.5;color:#6b6b66;">
                <p style="margin:0 0 6px;">If the button does not work, paste this link into your browser:</p>
                <p style="margin:0;word-break:break-all;"><a href="${escapeHtml(link)}" style="color:#2a5db0;">${escapeHtml(link)}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:16px 32px 24px;border-top:1px solid #ecece9;font-size:12px;color:#8a8a84;">
                Sent on behalf of ${shop}. If you were not expecting this, you can ignore this email.
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;

  const text = [
    "Safety information needed",
    "",
    productRef
      ? `${shopName || "A store you supply"} needs the EU product-safety details for ${productRef}.`
      : `${shopName || "A store you supply"} needs the EU product-safety details for products you supply.`,
    "",
    "Under EU Regulation 2023/988 (GPSR), products sold to EU customers must carry manufacturer details,",
    "a Responsible Person contact, and safety warnings.",
    "",
    "Open the secure form:",
    link,
    "",
    "No account is needed and you will not get access to their store.",
  ].join("\n");

  return send({ to, subject, html, text, replyTo });
}
