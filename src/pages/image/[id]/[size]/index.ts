import type { APIRoute } from "astro";

// quick napkin scribblings of how this should work:
// clips.lamepunch.com/image/{id}/{size}
// does image transformation through here: https://developers.cloudflare.com/images/optimization/transformations/transform-via-workers/
// clips.lamepunch.com/image/{id}/thumbnail (300x300 thumbnail)
// clips.lamepunch.com/image/{id}/preview (1280x720 preview)
// clips.lamepunch.com/image/{id}/original (original size)

/**
 * Serves images from R2 storage with optional transformations.
 * @param param0
 * @returns
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
  const list = await env.CLIPS.list();
  console.log(list);

  /**
  const object = await env.CLIPS.get(id!);
  if (!object) {
    return new Response("Image not found", { status: 404 });
  }
    **/

  // Apply transformations if needed
  // Return the image

  return new Response(`Image ${id} with size ${size}`);
};
