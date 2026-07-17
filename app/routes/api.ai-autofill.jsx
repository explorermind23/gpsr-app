import { json } from "@remix-run/node";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { languageByCode } from "../lib/languages";

// POST /api/ai-autofill  → drafts GPSR safety warnings for a product using Claude.
// Requires ANTHROPIC_API_KEY in the environment. Returns { warnings: [{locale,text}] }.
export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = await prisma.shop.findUnique({ where: { shopDomain: session.shop } });
  const form = await request.formData();
  const title = String(form.get("title") || "").trim();
  const category = String(form.get("category") || "").trim();
  const locales = (shop?.euMarketLocales || []);

  if (!process.env.ANTHROPIC_API_KEY) {
    return json({ error: "AI autofill isn't configured. Add ANTHROPIC_API_KEY to enable it." }, { status: 400 });
  }
  if (!title) return json({ error: "Product title is required." }, { status: 400 });
  if (locales.length === 0) return json({ error: "Set market languages first." }, { status: 400 });

  const langList = locales.map((l) => { const x = languageByCode(l); return `${l} (${x ? x.name : l})`; }).join(", ");

  const prompt = `You are a product-safety compliance assistant. For the product below, write a concise GPSR safety warning suitable for an EU product listing. Base it only on obvious, well-established safety considerations for this kind of product (choking hazards, age suitability, electrical, sharp edges, small parts, etc.). Do not invent specific test results or certifications.

Product title: ${title}
Category: ${category || "unknown"}

Return the warning translated into EACH of these languages: ${langList}.
Respond with ONLY a JSON array, no preamble, no markdown, in exactly this shape:
[{"locale":"de","text":"..."},{"locale":"fr","text":"..."}]
Use the two-letter locale codes given above.`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const textBlock = (data.content || []).filter((c) => c.type === "text").map((c) => c.text).join("");
    const cleaned = textBlock.replace(/```json|```/g, "").trim();
    let warnings = [];
    try { warnings = JSON.parse(cleaned); } catch (e) {
      return json({ error: "AI returned an unexpected format. Try again." }, { status: 502 });
    }
    // keep only requested locales
    const wanted = new Set(locales);
    warnings = warnings.filter((w) => w && w.locale && wanted.has(String(w.locale).toLowerCase()));
    return json({ warnings });
  } catch (e) {
    return json({ error: "AI request failed. Try again." }, { status: 502 });
  }
};
