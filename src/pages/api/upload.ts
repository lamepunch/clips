import type { APIRoute } from "astro";
import { clips } from "@/db/schema";
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
  const { db, env, session, user } = locals;
  if (!session || !user) {
    return new Response("Unauthorized", { status: 401 });
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

  await db.insert(clips).values({
    userId: user.id,
    uid: upload.uid,
  });

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
