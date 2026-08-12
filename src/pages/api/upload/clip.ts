import type { APIRoute } from "astro";
import { clips } from "@/db/schema";
import { sendToCio } from "@/lib/cio";
import { requireUploadUser } from "@/lib/upload";
import { createUploadUrl } from "@/lib/stream";

/**
 * Tus creation relay for direct creator uploads. The browser POSTs the tus
 * metadata here, then streams the video directly to the returned Stream URL.
 */
export const POST: APIRoute = async ({ request, locals }) => {
  const { cfContext, db, env, session, user } = locals;
  const uploader = requireUploadUser(session, user);
  if (uploader instanceof Response) return uploader;

  const length = request.headers.get("Upload-Length");
  if (!length) return new Response("Missing Upload-Length", { status: 400 });
  const metadata = request.headers.get("Upload-Metadata") ?? "";

  let upload: { url: string; uid: string };
  try {
    upload = await createUploadUrl(env, {
      length,
      metadata,
      creatorId: uploader.id,
    });
  } catch (err) {
    console.error("stream upload init failed", err);
    return new Response("Upload init failed", { status: 502 });
  }

  try {
    await db.insert(clips).values({ userId: uploader.id, uid: upload.uid });
  } catch (err) {
    console.error("failed to persist clip row", { uid: upload.uid, err });
    return new Response("Upload init failed", { status: 502 });
  }

  sendToCio(env, cfContext, (cio) =>
    cio.track({
      userId: uploader.id,
      event: "Clip Uploaded",
      properties: { uid: upload.uid },
    }),
  );

  return new Response(null, {
    status: 201,
    headers: {
      "Access-Control-Expose-Headers": "Location, Tus-Resumable",
      "Tus-Resumable": "1.0.0",
      Location: upload.url,
    },
  });
};
