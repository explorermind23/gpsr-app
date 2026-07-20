// Public privacy policy — no authentication, so it can be linked from the
// Shopify App Store listing (which requires a reachable privacy policy URL).

const UPDATED = "20 July 2026";

export const loader = async () => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Privacy Policy — GPSR Compliance Hub</title>
<style>
  :root { color-scheme: light; }
  body {
    margin: 0; padding: 48px 20px 96px;
    background: #f7f7f5; color: #1a1a1a;
    font: 16px/1.65 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  main { max-width: 720px; margin: 0 auto; background: #fff; border: 1px solid #e4e4e1;
         border-radius: 12px; padding: 40px 44px; }
  h1 { font-size: 28px; line-height: 1.25; margin: 0 0 6px; }
  h2 { font-size: 18px; margin: 34px 0 10px; }
  p, li { color: #2b2b2b; }
  ul { padding-left: 20px; }
  li { margin: 6px 0; }
  .meta { color: #6d6d68; font-size: 14px; margin: 0 0 8px; }
  code { background: #f1f1ee; padding: 1px 5px; border-radius: 4px; font-size: 14px; }
  footer { max-width: 720px; margin: 20px auto 0; color: #6d6d68; font-size: 13px; }
  a { color: #2a5db0; }
</style>
</head>
<body>
<main>
  <p class="meta">Last updated ${UPDATED}</p>
  <h1>Privacy Policy</h1>
  <p>
    GPSR Compliance Hub ("the app") helps Shopify merchants meet EU General Product Safety
    Regulation (EU) 2023/988 obligations. This policy explains what the app stores, why, and
    for how long.
  </p>

  <h2>What the app stores</h2>
  <ul>
    <li>Your store domain and the access token needed to talk to Shopify on your behalf.</li>
    <li>Compliance data you enter: responsible persons, manufacturers, product safety warnings,
        pictograms, product identifiers, care instructions and conformity details.</li>
    <li>References to compliance documents you upload or link, and their retention dates.</li>
    <li>Incident and recall records you create, and supplier request emails you send.</li>
    <li>An activity log of compliance actions taken inside the app.</li>
  </ul>

  <h2>What the app does not store</h2>
  <ul>
    <li>No customer personal data. The app does not read, request or retain customer names,
        addresses, email addresses, payment details or order history.</li>
    <li>No payment information. Subscriptions are billed by Shopify; the app never sees card data.</li>
  </ul>

  <h2>Who the data is shared with</h2>
  <p>Data is shared only where it is needed to run the service:</p>
  <ul>
    <li><strong>Shopify</strong> — product and file data, and billing, through the Shopify Admin API.</li>
    <li><strong>Railway</strong> — hosting and database infrastructure.</li>
    <li><strong>Resend</strong> — delivery of supplier request emails you choose to send.</li>
    <li><strong>Anthropic</strong> — only when you use the optional AI warning-draft feature, and
        only the product title you ask it to draft for.</li>
  </ul>
  <p>Data is never sold, rented, or used for advertising.</p>

  <h2>Recall alert data</h2>
  <p>
    The app matches your catalogue against publicly published EU Safety Gate recall alerts. This
    uses open government data. No information about your store is sent to that data source.
  </p>

  <h2>Retention and deletion</h2>
  <ul>
    <li>Your data is retained while the app is installed.</li>
    <li>On uninstall, stored access tokens are deleted immediately.</li>
    <li>Shopify sends a <code>shop/redact</code> request 48 hours after uninstall; on receiving it,
        all data belonging to your store is permanently deleted.</li>
    <li>You can request earlier deletion at any time using the contact address below.</li>
  </ul>

  <h2>Your rights</h2>
  <p>
    Under the GDPR you may request access to, correction of, or deletion of your data, and may
    object to processing. Contact the address below and the request will be handled within 30 days.
  </p>

  <h2>Contact</h2>
  <p>
    Email: <a href="mailto:explorermind23@gmail.com">explorermind23@gmail.com</a>
  </p>
</main>
<footer>GPSR Compliance Hub — an independent app. Not affiliated with Shopify Inc. or the European Commission.</footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
