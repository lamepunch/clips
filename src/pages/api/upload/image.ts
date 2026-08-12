import type { APIRoute } from "astro";
import { imageExtension, imageObjectKey } from "@/lib/images";
import { requireUploadUser } from "@/lib/upload";

export const POST: APIRoute = async ({ request, locals }) => {
  const { env, session, user } = locals;
  const uploader = requireUploadUser(session, user);
  if (uploader instanceof Response) return uploader;
  if (!request.body) return new Response("Missing image body", { status: 400 });

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0] ?? "";
  if (!imageExtension(contentType)) {
    return new Response("Unsupported image type", { status: 400 });
  }

  const key = imageObjectKey(uploader.slug, contentType);
  try {
    await env.CLIPS.put(key, request.body, { httpMetadata: { contentType } });
    return Response.json({ key }, { status: 201 });
  } catch (err) {
    console.error("image upload failed", { key, err });
    return new Response("Image upload failed", { status: 502 });
  }
};
