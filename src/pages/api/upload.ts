import type { APIRoute } from "astro";
import { clips } from "@/db/schema";
import { sendToCio } from "@/lib/cio";
import { forbidden, unauthorized } from "@/lib/http";
import { createUploadUrl } from "@/lib/stream";

/**
 * tus creation relay for direct creator uploads.
 *
 * Uppy's Tus plugin (in the browser) sends a tus POST here with Upload-Length /
 * Upload-Metadata. We forward to Stream, create the clip row in IN_PROGRESS
 * state, then return 201 with the one-time upload URL in Location so the
 * client streams the bytes straight to Stream. The webhook later flips the
 * row to READY.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { cfContext, db, env, session, user } = locals;
  if (!session || !user) {
    return unauthorized();
  }
  // Viewers cannot upload videos
  if (user.role === "viewer") {
    return forbidden();
  }

  const length = request.headers.get("Upload-Length");
  if (!length) {
    return new Response("Missing Upload-Length", { status: 400 });
  }
  const metadata = request.headers.get("Upload-Metadata") ?? "";

  let upload: { url: string; uid: string };
  try {
    upload = await createUploadUrl(env, {
      length,
      metadata,
      creatorId: user.id,
    });
  } catch (err) {
    console.error("stream upload init failed", err);
    return new Response("Upload init failed", { status: 502 });
  }

  try {
    await db.insert(clips).values({
      userId: user.id,
      uid: upload.uid,
    });
  } catch (err) {
    // The Stream video already exists at this point; log its uid so the
    // orphaned upload can be reconciled rather than the failure being lost.
    console.error("failed to persist clip row", { uid: upload.uid, err });
    return new Response("Upload init failed", { status: 502 });
  }

  sendToCio(env, cfContext, (cio) =>
    cio.track({
      userId: user.id,
      event: "Clip Uploaded",
      properties: { uid: upload.uid },
    }),
  );

  // Uppy's Tus plugin reads Location from the response of this request.
  return new Response(null, {
    status: 201,
    headers: {
      "Access-Control-Expose-Headers": "Location, Tus-Resumable",
      "Tus-Resumable": "1.0.0",
      Location: upload.url,
    },
  });
};
