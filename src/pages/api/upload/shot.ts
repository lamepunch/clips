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
    // Convert the image to AVIF if it isn't already
    let image = body;
    if (contentType !== "image/avif") {
      // https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/
      const response = (
        await env.IMAGES.input(body).output({
          quality: 100,
          format: "image/avif",
        })
      ).response();

      if (!response.body) throw new Error("Image conversion returned no body");

      image = response.body;
    }

    // Upload the image to R2
    await env.CLIPS.put(key, image, {
      httpMetadata: { contentType: "image/avif" },
      customMetadata: {},
    });

    return Response.json({ key }, { status: 201 });
  } catch (err) {
    console.error("shot upload failed", { key, err });
    return new Response("Shot upload failed", { status: 502 });
  }
};
