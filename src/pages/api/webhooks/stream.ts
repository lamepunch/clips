import type { APIRoute } from "astro";
import { eq } from "drizzle-orm";
import { ClipStatus, clips } from "@/db/schema";
import { verifyStreamWebhook } from "@/lib/stream";

type StreamWebhookBody = {
  uid: string;
  status: { state: "ready" | "error" };
};

/**
 * Verifies the HMAC signature, then sets the clip's status to
 * READY or ERROR based the Stream uid in the webhook data.
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
    return new Response("Invalid signature", { status: 403 });
  }

  const body = JSON.parse(rawBody) as StreamWebhookBody;
  const state = body.status?.state;

  if (state === "ready") {
    await db
      .update(clips)
      .set({ status: ClipStatus.READY })
      .where(eq(clips.uid, body.uid));
  } else if (state === "error") {
    await db
      .update(clips)
      .set({ status: ClipStatus.ERROR })
      .where(eq(clips.uid, body.uid));
  }

  // Always 200 so Stream doesn't retry unnecessarily.
  return new Response("ok", { status: 200 });
};
