// On save, push the product's compliance data into Shopify metafields under the
// `gpsr` namespace. The theme app extension reads these via Liquid — native, fast,
// no runtime calls back to our server.

import { PICTOGRAM_MAP } from "./pictograms";

const METAFIELDS_SET = `#graphql
  mutation SetGpsrMetafields($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key }
      userErrors { field message }
    }
  }`;

// Ensure the metafields are readable by the storefront (Liquid). Run once per shop.
const DEFINITION_CREATE = `#graphql
  mutation CreateGpsrDefinition($def: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $def) {
      createdDefinition { id key }
      userErrors { field message code }
    }
  }`;

const NS = "gpsr";
const DEFS = [
  { key: "responsible_person", name: "GPSR Responsible Person", type: "json" },
  { key: "manufacturer", name: "GPSR Manufacturer", type: "json" },
  { key: "warnings", name: "GPSR Warnings", type: "json" },
  { key: "identifiers", name: "GPSR Identifiers", type: "json" },
  { key: "care_instructions", name: "GPSR Care Instructions", type: "multi_line_text_field" },
  { key: "ce_marked", name: "GPSR CE Marked", type: "boolean" },
  { key: "pictograms", name: "GPSR Pictograms", type: "json" },
  { key: "status", name: "GPSR Status", type: "single_line_text_field" },
];

export async function ensureGpsrDefinitions(admin) {
  for (const d of DEFS) {
    try {
      await admin.graphql(DEFINITION_CREATE, {
        variables: {
          def: {
            name: d.name, namespace: NS, key: d.key, type: d.type,
            ownerType: "PRODUCT",
            access: { storefront: "PUBLIC_READ" }, // Liquid can read it
          },
        },
      });
    } catch (e) { /* already exists — ignore */ }
  }
}

export async function writeComplianceMetafields(admin, productId, record, rp, manufacturer) {
  const rpValue = rp
    ? {
        name: rp.legalName, company: rp.companyName || "",
        address: `${rp.streetAddress}, ${rp.city} ${rp.postalCode}`,
        country: rp.country, email: rp.email, phone: rp.phone, role: rp.role,
      }
    : null;

  const mfValue = manufacturer
    ? {
        name: manufacturer.legalName, tradeName: manufacturer.tradeName || "",
        address: `${manufacturer.streetAddress}, ${manufacturer.city} ${manufacturer.postalCode}, ${manufacturer.country}`,
      }
    : null;

  const identifiers = {
    gtin: record.gtin || "", model: record.modelNumber || "",
    batch: record.batchNumber || "", serial: record.serialNumber || "",
  };

  const pictograms = (record.pictograms || [])
    .map((k) => PICTOGRAM_MAP[k])
    .filter(Boolean)
    .map((p) => ({ key: p.key, label: p.label, svg: p.svg }));

  const metafields = [
    { ownerId: productId, namespace: NS, key: "responsible_person", type: "json", value: JSON.stringify(rpValue || {}) },
    { ownerId: productId, namespace: NS, key: "manufacturer", type: "json", value: JSON.stringify(mfValue || {}) },
    { ownerId: productId, namespace: NS, key: "warnings", type: "json", value: JSON.stringify(record.warnings || []) },
    { ownerId: productId, namespace: NS, key: "identifiers", type: "json", value: JSON.stringify(identifiers) },
    { ownerId: productId, namespace: NS, key: "care_instructions", type: "multi_line_text_field", value: record.careInstructions || "" },
    { ownerId: productId, namespace: NS, key: "ce_marked", type: "boolean", value: record.ceMarked ? "true" : "false" },
    { ownerId: productId, namespace: NS, key: "pictograms", type: "json", value: JSON.stringify(pictograms) },
    { ownerId: productId, namespace: NS, key: "status", type: "single_line_text_field", value: record.status || "INCOMPLETE" },
  ];

  const res = await admin.graphql(METAFIELDS_SET, { variables: { metafields } });
  const body = await res.json();
  const errors = body.data?.metafieldsSet?.userErrors || [];
  return { ok: errors.length === 0, errors };
}
