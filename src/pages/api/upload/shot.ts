import type { APIRoute } from "astro";
import { imageExtension, imageObjectKey } from "@/lib/images";

export const POST: APIRoute = async ({ request, locals }) => {
  const { env, user } = locals;
  const uploader = user!;
  if (!request.body) return new Response("Missing shot body", { status: 400 });

  const contentType = request.headers.get("Content-Type")?.split(";", 1)[0] ?? "";
  if (!imageExtension(contentType)) {
    return new Response("Unsupported shot type", { status: 400 });
  }

  const key = imageObjectKey(uploader.slug, contentType);
  try {
    await env.CLIPS.put(key, request.body, { httpMetadata: { contentType } });
    return Response.json({ key }, { status: 201 });
  } catch (err) {
    console.error("shot upload failed", { key, err });
    return new Response("Shot upload failed", { status: 502 });
  }
};
