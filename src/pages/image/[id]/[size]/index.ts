import type { APIRoute } from "astro";
import { notFound } from "@/lib/http";

/**
 * Serves images from R2 storage
 */
export const GET: APIRoute = async ({ locals, params }) => {
  const { env } = locals;
  const { id, size } = params;

  // Only allow specific sizes
  const allowedSizes = ["thumbnail", "preview", "original"];
  if (!allowedSizes.includes(size as string)) {
    return new Response(
      "Invalid size passed (must be thumbnail, preview, or original)",
      { status: 400 },
    );
  }

  // Retrieve the image from R2
  const image = await env.CLIPS.get(id!);
  if (!image) return notFound();

  // Create transformation object (resize and convert) based on size
  let transform: ImageTransform = {};
  if (size === "thumbnail") {
    transform = { width: 500, height: 400, fit: "cover" };
  } else if (size === "preview") {
    transform = { width: 1280 };
  }

  // Construct the response
  const response = (
    await env.IMAGES.input(image.body)
      .transform(transform)
      .output({ quality: 100, format: "image/avif" })
  ).response();

  // Return the image with cache headers
  return new Response(response.body, {
    headers: {
      ...Object.fromEntries(response.headers),
      "Cache-Control": "public, max-age=604800, stale-while-revalidate=86400",
    },
  });
};
