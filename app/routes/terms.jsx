// Public terms of service — linked from the Shopify App Store listing.

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
  a { color: #2a5db0; }
  .box { background: #fff8ec; border: 1px solid #f0dfc0; border-radius: 8px; padding: 14px 18px; margin: 16px 0; }
  table { border-collapse: collapse; width: 100%; margin: 12px 0; font-size: 14.5px; }
  th, td { text-align: left; padding: 9px 10px; border-bottom: 1px solid #ecece9; vertical-align: top; }
  th { color: #55554f; font-weight: 600; background: #fafaf8; }
  footer { max-width: 760px; margin: 20px auto 0; color: #6d6d68; font-size: 13px; }
  nav.doclinks { max-width: 760px; margin: 0 auto 14px; font-size: 14px; }
`;

export const loader = async () => {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Terms of Service — GPSR Compliance Hub</title>
<meta name="description" content="Terms of service for the GPSR Compliance Hub Shopify app." />
<style>${CSS}</style>
</head>
<body>
<nav class="doclinks"><a href="/privacy">Privacy Policy</a> &middot; <a href="/terms">Terms of Service</a></nav>
<main>
  <p class="meta">Last updated ${UPDATED}</p>
  <h1>Terms of Service</h1>
  <p class="lede">
    These terms govern your use of GPSR Compliance Hub ("the app"). By installing the app you agree
    to them. If you do not agree, uninstall the app.
  </p>

  <div class="box">
    <strong>Important:</strong> this app is a record-keeping and publishing tool. It helps you
    organise and display product safety information. It is not a law firm, not a certification body,
    and not your Responsible Person. Using the app does not by itself make your products compliant,
    and nothing in the app constitutes legal advice.
  </div>

  <h2>1. What the app does</h2>
  <p>The app lets you:</p>
  <ul>
    <li>record Responsible Person and manufacturer details;</li>
    <li>attach safety warnings, pictograms and product identifiers to your products;</li>
    <li>publish that information on your Shopify storefront;</li>
    <li>generate compliance files for marketplaces such as Amazon and TikTok Shop;</li>
    <li>store references to technical documentation and track retention periods;</li>
    <li>record incidents and review public EU recall alerts that may match your catalogue.</li>
  </ul>

  <h2>2. What you are responsible for</h2>
  <ul>
    <li><strong>Accuracy.</strong> You are responsible for the correctness of everything you enter.
        The app publishes what you give it.</li>
    <li><strong>Appointing a Responsible Person.</strong> GPSR requires a real person or company
        established in the EU. The app is not that person and cannot act as one.</li>
    <li><strong>Your own compliance.</strong> Meeting GPSR and any other applicable regulation
        remains your legal obligation as the seller.</li>
    <li><strong>Marketplace submissions.</strong> Export files are prepared to match each
        marketplace's documented format. You are responsible for reviewing and uploading them, and
        marketplaces may change their requirements without notice.</li>
  </ul>

  <h2>3. Recall alerts</h2>
  <p>
    Recall matching compares your catalogue against publicly published EU Safety Gate alerts using
    barcode, brand and category signals. Matches are <strong>suggestions, not determinations</strong>.
    A match does not mean your product was recalled, and the absence of a match does not mean it was
    not. Always verify against the official alert before acting.
  </p>

  <h2>4. Plans, billing and cancellation</h2>
  <ul>
    <li>Subscriptions are billed by Shopify and appear on your Shopify invoice.</li>
    <li>Plan limits are counted per unique product that has ever had compliance data saved, for the
        lifetime of the account. Deleting products does not free allowance. This is stated on the
        pricing page before you subscribe.</li>
    <li>You can change or cancel your plan at any time from the Plan &amp; Billing page. Cancellation
        stops future charges; Shopify's own proration and refund rules apply.</li>
    <li>Prices may change with at least 30 days' notice to active subscribers.</li>
  </ul>

  <h2>5. Acceptable use</h2>
  <p>You agree not to:</p>
  <ul>
    <li>use the app to publish information you know to be false;</li>
    <li>attempt to access other merchants' data, or probe, scan or overload the service;</li>
    <li>resell or redistribute the app's output as a competing compliance service;</li>
    <li>use the app for any unlawful purpose.</li>
  </ul>
  <p>Accounts found in breach may be suspended without refund.</p>

  <h2>6. Availability</h2>
  <p>
    The app is provided on a commercially reasonable-effort basis. No specific uptime is guaranteed.
    Planned maintenance is announced where practical. Third-party outages — Shopify, hosting,
    marketplaces, or the EU Safety Gate data source — may temporarily affect functionality.
  </p>

  <h2>7. Disclaimer and limitation of liability</h2>
  <p>
    The app is provided "as is", without warranties of any kind, express or implied, including
    fitness for a particular purpose. To the maximum extent permitted by law, the operator is not
    liable for indirect, incidental or consequential losses, including lost profits, lost sales,
    delisted marketplace listings, or regulatory penalties.
  </p>
  <table>
    <tr><th>Situation</th><th>Position</th></tr>
    <tr><td>Total liability</td><td>Capped at the amount you paid for the app in the 12 months before the claim</td></tr>
    <tr><td>Regulatory fines</td><td>Remain your responsibility as the seller</td></tr>
    <tr><td>Marketplace enforcement</td><td>Marketplaces set and enforce their own rules independently</td></tr>
  </table>
  <p>Nothing here excludes liability that cannot lawfully be excluded.</p>

  <h2>8. Data</h2>
  <p>
    Handling of your data is described in the <a href="/privacy">Privacy Policy</a>, which forms part
    of these terms. Your compliance data belongs to you and can be exported from the app at any time
    while your subscription is active.
  </p>

  <h2>9. Termination</h2>
  <p>
    You may uninstall at any time. The operator may suspend or terminate access for breach of these
    terms, non-payment, or where required by Shopify or by law. On termination, data is deleted as
    described in the Privacy Policy.
  </p>

  <h2>10. Changes to these terms</h2>
  <p>
    These terms may be updated. Material changes are notified to active merchants by email at least
    30 days before taking effect. Continuing to use the app after that means you accept the change.
  </p>

  <h2>11. Contact</h2>
  <p>Email: <a href="mailto:${CONTACT}">${CONTACT}</a></p>
</main>
<footer>GPSR Compliance Hub — an independent application. Not affiliated with Shopify Inc. or the European Commission.</footer>
</body>
</html>`;

  return new Response(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
};
