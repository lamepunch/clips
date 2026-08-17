import type { APIRoute } from "astro";
import { shots } from "@/db/schema";
import { badRequest } from "@/lib/http";

export const POST: APIRoute = async ({ request, locals }) => {
  const { headers } = request;
  const { db, env, user } = locals;

  if (!request.body) return badRequest("Missing image body");

  // Get the content type from the request
  const contentType = headers.get("Content-Type")?.split(";", 1)[0];
  if (!contentType) return badRequest("Missing content type from image");

  // Check if the content type is an image
  if (!contentType.startsWith("image/"))
    return badRequest("Unsupported image type");

  const sourceHash = headers.get("X-Source-SHA256")?.toLowerCase();
  if (!sourceHash) return badRequest("Missing source image hash");
  if (!/^[0-9a-f]{64}$/.test(sourceHash))
    return badRequest("Invalid source image hash");

  // Generate a random key for the image
  const key = crypto.randomUUID();

  try {
    // Convert the image to AVIF if it isn't already
    let storedImage: ReadableStream | ArrayBuffer;
    let inspectedImage: ReadableStream;
    if (contentType !== "image/avif") {
      // https://developers.cloudflare.com/images/tutorials/optimize-user-uploaded-image/
      const result = await env.IMAGES.input(request.body).output({
        format: "image/avif",
      });
      storedImage = await result.response().arrayBuffer();
      inspectedImage = new Response(storedImage).body!;
    } else {
      inspectedImage = request.clone().body!;
      storedImage = request.body;
    }

    // Upload the image to R2
    const [info] = await Promise.all([
      env.IMAGES.info(inspectedImage),
      env.CLIPS.put(key, storedImage, {
        httpMetadata: { contentType: "image/avif" },
        customMetadata: {},
      }),
    ]);

    if (!("width" in info)) throw new Error("Image dimensions unavailable");

    await db.insert(shots).values({
      id: key,
      userId: user!.id,
      sourceHash,
      width: info.width,
      height: info.height,
    });

    return Response.json({ key }, { status: 201 });
  } catch (err) {
    try {
      await env.CLIPS.delete(key);
    } catch (cleanupErr) {
      console.error("shot cleanup failed", { key, err: cleanupErr });
    }
    console.error("shot upload failed", { key, err });
    return new Response("Shot upload failed", { status: 502 });
  }
};
