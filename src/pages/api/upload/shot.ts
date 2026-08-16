import type { APIRoute } from "astro";
import { badRequest } from "@/lib/http";

export const POST: APIRoute = async ({ request, locals }) => {
  const { headers, body } = request;
  const { env } = locals;

  if (!body) return badRequest("Missing image body");

  // Get the content type from the request
  const contentType = headers.get("Content-Type")?.split(";", 1)[0];
  if (!contentType) return badRequest("Missing content type from image");

  // Check if the content type is an image
  if (!contentType.startsWith("image/"))
    return badRequest("Unsupported image type");

  // Generate a random key for the image
  const key = crypto.randomUUID();

  try {
    // Upload the image to R2
    await env.CLIPS.put(key, body, { httpMetadata: { contentType } });
    return Response.json({ key }, { status: 201 });
  } catch (err) {
    console.error("r2 upload failed", { key, err });
    return new Response("R2 upload failed", { status: 502 });
  }
};
