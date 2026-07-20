// Direct upload into Shopify Files, so merchants can attach declarations of
// conformity and test reports without hosting them elsewhere.
//
// Shopify's flow is three steps:
//   1. stagedUploadsCreate  → a one-time Google Cloud Storage target
//   2. the browser POSTs the file straight to that target (never through us)
//   3. fileCreate           → registers the uploaded object as a Shopify file
// Step 3 returns immediately with status UPLOADED; the CDN url only appears
// once processing reaches READY, so we poll briefly.

const STAGED_UPLOADS_CREATE = `#graphql
  mutation StageUpload($input: [StagedUploadInput!]!) {
    stagedUploadsCreate(input: $input) {
      stagedTargets {
        url
        resourceUrl
        parameters { name value }
      }
      userErrors { field message }
    }
  }`;

const FILE_CREATE = `#graphql
  mutation RegisterFile($files: [FileCreateInput!]!) {
    fileCreate(files: $files) {
      files {
        id
        fileStatus
        alt
        ... on GenericFile { url mimeType originalFileSize }
        ... on MediaImage { image { url } }
      }
      userErrors { field message }
    }
  }`;

const FILE_STATUS = `#graphql
  query FileStatus($id: ID!) {
    node(id: $id) {
      ... on GenericFile { id fileStatus url mimeType originalFileSize }
      ... on MediaImage { id fileStatus image { url } }
    }
  }`;

export const MAX_UPLOAD_BYTES = 20 * 1024 * 1024; // 20 MB

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

export function isAllowedUpload(mimeType) {
  return (
    mimeType === "application/pdf" ||
    IMAGE_TYPES.has(mimeType) ||
    mimeType === "application/msword" ||
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

/** Step 1 — ask Shopify where to put the file. */
export async function createStagedUpload(admin, { filename, mimeType, fileSize }) {
  const res = await admin.graphql(STAGED_UPLOADS_CREATE, {
    variables: {
      input: [
        {
          filename,
          mimeType,
          fileSize: String(fileSize),
          httpMethod: "POST",
          resource: IMAGE_TYPES.has(mimeType) ? "IMAGE" : "FILE",
        },
      ],
    },
  });
  const body = await res.json();
  const errors = body.data?.stagedUploadsCreate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));
  const target = body.data?.stagedUploadsCreate?.stagedTargets?.[0];
  if (!target) throw new Error("Shopify did not return an upload target.");
  return target;
}

/** Step 3 — register the uploaded object, then wait for a usable URL. */
export async function registerUploadedFile(admin, { resourceUrl, mimeType, alt }) {
  const res = await admin.graphql(FILE_CREATE, {
    variables: {
      files: [
        {
          originalSource: resourceUrl,
          contentType: IMAGE_TYPES.has(mimeType) ? "IMAGE" : "FILE",
          alt: alt || "GPSR compliance document",
        },
      ],
    },
  });
  const body = await res.json();
  const errors = body.data?.fileCreate?.userErrors || [];
  if (errors.length) throw new Error(errors.map((e) => e.message).join("; "));

  const file = body.data?.fileCreate?.files?.[0];
  if (!file) throw new Error("Shopify did not return the created file.");

  let url = file.url || file.image?.url || null;
  let status = file.fileStatus;

  // Processing is usually sub-second, but the URL is null until READY.
  for (let attempt = 0; attempt < 8 && !url; attempt++) {
    await new Promise((r) => setTimeout(r, 700));
    try {
      const poll = await admin.graphql(FILE_STATUS, { variables: { id: file.id } });
      const pb = await poll.json();
      const node = pb.data?.node;
      if (node) {
        status = node.fileStatus || status;
        url = node.url || node.image?.url || null;
        if (status === "FAILED") throw new Error("Shopify could not process the file.");
      }
    } catch (e) {
      if (String(e.message).includes("could not process")) throw e;
    }
  }

  return { id: file.id, url, status };
}
