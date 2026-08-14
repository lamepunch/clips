import type { APIRoute } from "astro";

export const POST: APIRoute = async ({ request, locals }) => {
  const { headers, body } = request;
  const { env } = locals;

  if (!body) {
    return new Response("Missing image body", { status: 400 });
  }

  // Get the content type from the request
  const contentType = headers.get("Content-Type")?.split(";", 1)[0];
  if (!contentType) {
    return new Response("Missing content type from image", { status: 400 });
  }

  // Check if the content type is an image
  if (!contentType.startsWith("image/")) {
    return new Response("Unsupported image type", { status: 400 });
  }

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
