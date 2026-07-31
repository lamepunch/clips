import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ClipStatus, clips } from "@/db/schema";
import { forbidden } from "@/lib/http";
import { verifyStreamWebhook } from "@/lib/stream";

type StreamWebhookBody = {
  uid: string;
  status: { state: "ready" | "error" };
};

/**
 * Verifies the HMAC signature, then sets the clip's status to READY or ERROR
 * based on the Stream uid in the webhook data.
 *
 * Responses: 403 (bad signature), 400 (malformed body / missing uid), 500 (DB
 * update failed — signals Stream to retry), 200 otherwise. Unmapped states and
 * unmatched uids are acked with 200 but logged so they don't disappear.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { db, env } = locals;
  const rawBody = await request.text();

  const valid = await verifyStreamWebhook(
    rawBody,
    request.headers.get("Webhook-Signature"),
    env.STREAM_WEBHOOK_SECRET,
  );

  if (!valid) {
    return forbidden("Invalid signature");
  }

  let body: StreamWebhookBody;
  try {
    body = JSON.parse(rawBody) as StreamWebhookBody;
  } catch (err) {
    console.error("stream webhook: malformed JSON body", err);
    return new Response("Malformed body", { status: 400 });
  }

  const uid = body.uid;
  const state = body.status?.state;
  if (!uid) {
    console.error("stream webhook: missing uid", { state });
    return new Response("Missing uid", { status: 400 });
  }

  const status =
    state === "ready"
      ? ClipStatus.READY
      : state === "error"
        ? ClipStatus.ERROR
        : undefined;

  // A state we don't map (e.g. "inprogress", "queued") is expected; ack it so
  // Stream stops retrying, but log it so genuinely unexpected states surface.
  if (status === undefined) {
    console.warn("stream webhook: unhandled state", { uid, state });
    return new Response("ok", { status: 200 });
  }

  let updated: { uid: string }[];
  try {
    updated = await db
      .update(clips)
      .set({ status })
      .where(eq(clips.uid, uid))
      .returning({ uid: clips.uid });
  } catch (err) {
    // Surface DB failures with a 5xx so Stream retries the delivery rather
    // than the update being silently lost.
    console.error("stream webhook: failed to update clip status", {
      uid,
      state,
      err,
    });
    return new Response("Update failed", { status: 500 });
  }

  if (updated.length === 0) {
    console.warn("stream webhook: no clip matched uid", { uid, state });
  }

  return new Response("ok", { status: 200 });
};
