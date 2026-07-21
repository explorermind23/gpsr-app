// Public privacy policy — no authentication, so it can be linked from the
// Shopify App Store listing (which requires a reachable privacy policy URL).

const UPDATED = "20 July 2026";
const CONTACT = "gpsrapplication@gmail.com";

const CSS = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body {
    margin: 0; padding: 48px 20px 96px;
    background: #f7f7f5; color: #1a1a1a;
    font: 16px/1.65 -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }
  main { max-width: 760px; margin: 0 auto; background: #fff; border: 1px solid #e4e4e1;
         border-radius: 12px; padding: 44px 48px; }
  h1 { font-size: 30px; line-height: 1.2; margin: 0 0 6px; letter-spacing: -0.01em; }
  h2 { font-size: 19px; margin: 36px 0 10px; }
  p, li { color: #2b2b2b; }
  ul { padding-left: 20px; margin: 10px 0; }
  li { margin: 7px 0; }
  .meta { color: #6d6d68; font-size: 14px; margin: 0 0 10px; }
  .lede { font-size: 17px; color: #3a3a38; }
  code { background: #f1f1ee; padding: 1px 5px; border-radius: 4px; font-size: 14px; }
  a { color: #2a5db0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14.5px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #ecece9; vertical-align: top; }
  th { color: #55554f; font-weight: 600; background: #fafaf8; }
  .box { background: #fafaf8; border: 1px solid #ecece9; border-radius: 8px; padding: 14px 18px; margin: 16px 0; }
  footer { max-width: 760px; margin: 20px auto 0; color: #6d6d68; font-size: 13px; }
  nav.doclinks { max-width: 760px; margin: 0 auto 14px; font-size: 14px; }
`;

export const loader = async () => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Privacy Policy — GPSR Compliance Hub</title>
<meta name="description" content="Privacy policy for the GPSR Compliance Hub Shopify app: what data is stored, why, who it is shared with, and how to have it deleted." />
<style>${CSS}</style>
</head>
<body>
<nav class="doclinks"><a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms of Service</a></nav>
<main>
  <p class="meta">Last updated ${UPDATED}</p>
  <h1>Privacy Policy</h1>
  <p class="lede">
    GPSR Compliance Hub ("the app") helps Shopify merchants meet their obligations under the EU
    General Product Safety Regulation (EU) 2023/988. This policy explains exactly what the app
    stores, why it stores it, who it is shared with, and how to have it deleted.
  </p>

  <div class="box">
    <strong>The short version:</strong> the app stores the compliance information you enter about
    your products and your business. It does not collect, request or retain any of your customers'
    personal data. Everything belonging to your store is permanently deleted after you uninstall.
  </div>

  <h2>1. Who is responsible for your data</h2>
  <p>
    The app is operated by an independent developer, contactable at
    <a href="mailto:${CONTACT}">${CONTACT}</a>.
  </p>
  <p>
    For the compliance data you enter, <strong>you are the data controller</strong> and the app acts
    as a <strong>data processor</strong> on your instructions. For your own details as a merchant
    using the app (store domain and contact address), the app operator is the controller.
  </p>

  <h2>2. What the app stores</h2>
  <table>
    <tr><th>Category</th><th>Examples</th><th>Why</th></tr>
    <tr>
      <td>Store identity</td>
      <td>Your <code>.myshopify.com</code> domain, store name, access token</td>
      <td>To connect to Shopify on your behalf and keep your data separate from other stores</td>
    </tr>
    <tr>
      <td>Responsible Persons</td>
      <td>Name, company, address, email, phone of the EU/UK Responsible Person you appoint</td>
      <td>GPSR requires this contact to be published with your products</td>
    </tr>
    <tr>
      <td>Manufacturers</td>
      <td>Name, trade name, address, email, phone</td>
      <td>GPSR requires manufacturer details on every product</td>
    </tr>
    <tr>
      <td>Product compliance data</td>
      <td>Safety warnings per language, pictograms, GTIN, model, batch, serial, CE status, care instructions</td>
      <td>The core function of the app</td>
    </tr>
    <tr>
      <td>Documents</td>
      <td>File names, links or Shopify Files references, retention dates</td>
      <td>GPSR requires technical documentation to be retained for 10 years</td>
    </tr>
    <tr>
      <td>Incidents and recalls</td>
      <td>Records you create, and matches against public EU recall alerts</td>
      <td>GPSR requires records of complaints, incidents and recalls</td>
    </tr>
    <tr>
      <td>Supplier requests</td>
      <td>Supplier email address, product reference, request status</td>
      <td>To collect missing safety data from your suppliers at your request</td>
    </tr>
    <tr>
      <td>Activity log</td>
      <td>Which compliance action was taken and when</td>
      <td>So you can show regulators an audit trail</td>
    </tr>
  </table>

  <p>
    Responsible Person, manufacturer and supplier records may contain the personal data of named
    individuals at those businesses. You enter this data and remain its controller. The app processes
    it only to display it on your product pages, include it in marketplace export files you generate,
    and send supplier request emails you choose to send.
  </p>

  <h2>3. What the app does not store</h2>
  <ul>
    <li><strong>No customer personal data.</strong> The app does not request the
        <code>read_customers</code> or <code>read_orders</code> permissions and holds no customer
        names, addresses, email addresses or order history.</li>
    <li><strong>No payment data.</strong> Subscriptions are billed by Shopify. The app never sees
        card numbers or bank details.</li>
    <li><strong>No tracking.</strong> The app sets no advertising or analytics cookies and runs no
        third-party trackers. The only cookies used are the session cookies Shopify requires for the
        embedded admin to function.</li>
  </ul>

  <h2>4. Legal basis for processing</h2>
  <ul>
    <li><strong>Performance of a contract</strong> — processing your store's data is necessary to
        provide the service you signed up for.</li>
    <li><strong>Legal obligation</strong> — some retention exists because GPSR itself requires
        documentation to be kept.</li>
    <li><strong>Legitimate interests</strong> — keeping the service secure, preventing abuse, and
        maintaining an audit trail.</li>
  </ul>

  <h2>5. Who data is shared with</h2>
  <p>Only the providers needed to run the service. None of them sell or reuse your data.</p>
  <table>
    <tr><th>Provider</th><th>Purpose</th><th>What they receive</th></tr>
    <tr><td>Shopify</td><td>Product data, file storage, billing</td><td>Compliance data written to your own store</td></tr>
    <tr><td>Railway</td><td>Application hosting and database</td><td>All app data, at rest</td></tr>
    <tr><td>Resend</td><td>Delivery of supplier request emails</td><td>Supplier email address and message content</td></tr>
    <tr><td>Anthropic</td><td>Optional AI drafting of safety warnings</td><td>Only the product title you ask it to draft for</td></tr>
    <tr><td>EU Safety Gate (open data)</td><td>Recall alert matching</td><td>Nothing — the app downloads public alerts; no store data is sent</td></tr>
  </table>
  <p>Data is never sold, rented, or used for advertising or model training.</p>

  <h2>6. International transfers</h2>
  <p>
    The app's infrastructure providers may process data outside the European Economic Area. Where
    that happens, transfers rely on the European Commission's Standard Contractual Clauses or an
    equivalent recognised safeguard. You can request details of the current hosting region using the
    contact address above.
  </p>

  <h2>7. Security</h2>
  <ul>
    <li>All traffic is encrypted in transit over HTTPS.</li>
    <li>Access tokens are stored server-side and never exposed to the browser.</li>
    <li>Data is separated per store; one merchant cannot read another's records.</li>
    <li>Access to production infrastructure is restricted to the app operator.</li>
  </ul>
  <p>
    No system is perfectly secure. If a breach affects your data, you will be notified without undue
    delay and, where required, within 72 hours of the operator becoming aware of it.
  </p>

  <h2>8. Retention and deletion</h2>
  <ul>
    <li>Data is retained while the app is installed on your store.</li>
    <li>On uninstall, stored access tokens are deleted immediately.</li>
    <li>Shopify sends a <code>shop/redact</code> request 48 hours after uninstall. On receiving it,
        all data belonging to your store is permanently deleted from the app's database. The delay
        exists so a reinstall within two days does not lose your work.</li>
    <li>You can request immediate deletion at any time using the contact address below.</li>
    <li>Files you uploaded live in your own Shopify Files and remain under your control; the app
        stores only a reference to them.</li>
  </ul>

  <h2>9. Your rights</h2>
  <p>Under the GDPR and equivalent UK law you have the right to:</p>
  <ul>
    <li>access the data held about you;</li>
    <li>have inaccurate data corrected;</li>
    <li>have your data deleted;</li>
    <li>restrict or object to processing;</li>
    <li>receive your data in a portable format;</li>
    <li>lodge a complaint with your national data protection supervisory authority.</li>
  </ul>
  <p>Requests sent to <a href="mailto:${CONTACT}">${CONTACT}</a> are answered within 30 days.</p>

  <h2>10. Children</h2>
  <p>
    The app is a business tool sold to merchants. It is not directed at children and does not
    knowingly process data relating to anyone under 16.
  </p>

  <h2>11. Changes to this policy</h2>
  <p>
    If this policy changes materially, the date at the top of this page is updated and, where the
    change affects how your data is handled, active merchants are notified by email.
  </p>

  <h2>12. Contact</h2>
  <p>
    Email: <a href="mailto:${CONTACT}">${CONTACT}</a><br />
    Please include your store domain so requests can be located quickly.
  </p>
</main>
<footer>GPSR Compliance Hub — an independent application. Not affiliated with Shopify Inc. or the European Commission. This app assists with compliance and does not constitute legal advice.</footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
