import type { APIRoute } from "astro";
import { first, sql } from "@/db/d1";
import { ClipStatus } from "@/db/schema";
import { verifyStreamWebhook } from "@/services/stream";
import { badRequest, forbidden } from "@/utils/http";

type StreamWebhookBody = {
  uid: string;
  creator: string;
  status: { state: "ready" | "error" };
};

/**
 * Verifies the HMAC signature, then sets the clip's status to READY or ERROR
 * based on the Stream uid in the webhook data.
 *
 * Responses: 403 (bad signature), 400 (malformed body / missing uid), 200
 * otherwise. A D1 failure throws and becomes 500 so Stream retries. Unmapped
 * states and unmatched uids are acked with 200 but logged so they don't
 * disappear.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { cio, env } = locals;
  const raw = await request.text();
  const sig = request.headers.get("Webhook-Signature");

  // Verify the webhook signature
  const valid = await verifyStreamWebhook(raw, sig, env.STREAM_WEBHOOK_SECRET);
  if (!valid) return forbidden("Invalid signature");

  let body: StreamWebhookBody;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    console.error("webhook: malformed JSON body", err);
    return badRequest("Malformed body");
  }

  const { uid, creator } = body;
  const state = body.status?.state;

  const status =
    state === "ready"
      ? ClipStatus.READY
      : state === "error"
        ? ClipStatus.ERROR
        : undefined;

  // A state we don't map (e.g. "inprogress", "queued") is expected; ack it so
  // Stream stops retrying, but log it so genuinely unexpected states surface.
  if (status === undefined) {
    console.warn("stream: unhandled state", { uid, state });
    return new Response("ok", { status: 200 });
  }

  const clip = await first<{ id: string; uid: string }>(
    sql`
      update clips
      set status = ${status}
      where uid = ${uid} and status != ${status}
      returning id, uid
    `,
  );

  if (clip) {
    cio.track({
      userId: creator,
      event: "Clip Updated",
      properties: { id: clip.id, uid: clip.uid, state },
    });
  } else {
    console.warn("stream: no clip status changed", { uid, state });
  }

  return new Response("ok", { status: 200 });
};
