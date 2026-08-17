import type { APIRoute } from "astro";
import { notFound, badRequest } from "@/lib/http";

/**
 * Serves images from R2 storage
 */
export const GET: APIRoute = async ({ locals, params }) => {
  const { env } = locals;
  const { id, size } = params;

  // Only allow specific sizes
  const allowedSizes = ["thumbnail", "preview", "full"];
  if (!allowedSizes.includes(size as string)) {
    return badRequest("Invalid size passed");
  }

  // Retrieve the image from R2
  const image = await env.CLIPS.get(id!);
  if (!image) return notFound();

  const cacheControl = "public, max-age=604800, stale-while-revalidate=86400";

  if (size === "full") {
    const headers = new Headers();
    image.writeHttpMetadata(headers);
    headers.set("Cache-Control", cacheControl);
    return new Response(image.body, { headers });
  }

  // Create transformation object (resize and convert) based on size
  // Note: We render everything at 2x for high DPI displays but scale them down to 1x
  let transform: ImageTransform = {};
  if (size === "thumbnail") {
    transform = { width: 500, height: 400, fit: "cover" };
  } else if (size === "preview") {
    transform = { width: 2560 };
  }

  // Construct the response
  const response = (
    await env.IMAGES.input(image.body)
      .transform(transform)
      .output({ format: "image/avif" })
  ).response();

  // Return the transformed image with cache headers
  return new Response(response.body, {
    headers: {
      ...Object.fromEntries(response.headers),
      "Cache-Control": cacheControl,
    },
  });
};
