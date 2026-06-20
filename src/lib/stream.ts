// Cloudflare Stream helpers:
//  - createUploadUrl: direct creator (tus) uploads via the REST API, so the
//    browser can resume large uploads. Needs CF_ACCOUNT_ID + STREAM_API_TOKEN.
//  - verifyStreamWebhook: HMAC verification of inbound Stream webhooks.

const CF_API = "https://api.cloudflare.com/client/v4";

/**
 * Create a direct creator upload URL that Uppy will use to
 * upload our clip to Cloudflare Stream
 *
 * {@link https://developers.cloudflare.com/api/resources/stream/methods/create Cloudflare Docs}
 */
export async function createUploadUrl(
  env: Env,
  opts: {
    length: string;
    metadata: string;
    creatorId: string;
  },
): Promise<{ url: string; uid: string }> {
  const res = await fetch(
    `${CF_API}/accounts/${env.CF_ACCOUNT_ID}/stream?direct_user=true`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.STREAM_API_TOKEN}`,
        "Tus-Resumable": "1.0.0",
        "Upload-Length": opts.length,
        "Upload-Metadata": opts.metadata,
        "Upload-Creator": opts.creatorId,
      },
    },
  );

  const url = res.headers.get("Location");
  const uid = res.headers.get("stream-media-id");
  if (!res.ok || !url || !uid) {
    throw new Error(
      `Stream upload init failed (${res.status}): ${await res.text()}`,
    );
  }
  return { url, uid };
}

// Per Cloudflare's Workers webhook example.
// https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/#examples
const getUtf8Bytes = (str: string) =>
  new Uint8Array(
    [...decodeURIComponent(encodeURIComponent(str))].map((c) =>
      c.charCodeAt(0),
    ),
  );

function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/**
 * Verify a Stream webhook signature, following Cloudflare's documented steps:
 *   1. Split the `Webhook-Signature` header into `time` and `sig1`.
 *   2. Build the source string `${time}.${rawBody}`.
 *   3. HMAC-SHA256 it with the webhook secret and hex-encode.
 *   4. Constant-time compare against `sig1`.
 * https://developers.cloudflare.com/stream/manage-video-library/using-webhooks/#examples
 */
export async function verifyStreamWebhook(
  rawBody: string,
  header: string | null,
  secret: string,
): Promise<boolean> {
  if (!header) return false;

  // Step 1: parse the header into its time and sig1 fields.
  const parts = Object.fromEntries(
    header.split(",").map((kv) => {
      const i = kv.indexOf("=");
      return [kv.slice(0, i).trim(), kv.slice(i + 1).trim()];
    }),
  );
  const time = parts["time"];
  const sig1 = parts["sig1"];
  if (!time || !sig1) return false;

  // Step 2: construct the signature source string.
  const message = `${time}.${rawBody}`;

  // Step 3: compute the expected HMAC-SHA256 hex digest (Web Crypto).
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    getUtf8Bytes(secret),
    { name: "HMAC", hash: "SHA-256" },
    true,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    getUtf8Bytes(message),
  );
  const expected = [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Step 4: constant-time compare against the header's sig1.
  return timingSafeEqual(expected, sig1);
}
