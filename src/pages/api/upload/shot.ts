import type { APIRoute } from "astro";
import { shots } from "@/db/schema";
import { badRequest, tooLarge } from "@/lib/http";
import { fromSteamFilename } from "@/lib/time";

const MAX_BYTES = 25 * 1024 * 1024;

export const POST: APIRoute = async ({ request, locals }) => {
  const { headers } = request;
  const { db, env, user, timezone } = locals;

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

  // Limit to 25 MB to avoid hitting the 128 MB isolate limit
  const size = Number(headers.get("Content-Length"));
  if (!size || size > MAX_BYTES) return tooLarge("Image too large");

  // R2 custom metadata goes out as x-amz-meta-* headers: printable ASCII only.
  // The client percent-encodes; strip anything else so a hostile header can't
  // fail the put, and cap length against R2's ~2 KiB metadata budget.
  const filename = (headers.get("X-Filename") ?? "")
    .replace(/[^\x20-\x7E]/g, "")
    .slice(0, 256);

  // Steam puts the capture time in the filename. Percent-encoding never touches
  // the digits it's made of, so there's nothing to decode first.
  const occurredAt = fromSteamFilename(filename, timezone);

  // Generate a random key for the image
  const key = crypto.randomUUID();

  try {
    // Images decides the type, not the client header, so an SVG sent as
    // image/png can't come back out of R2 as script. Only SVG lacks dimensions.
    const info = await env.IMAGES.info(request.clone().body!);
    if (!("width" in info)) return badRequest("Unsupported image type");

    await env.CLIPS.put(key, request.body, {
      httpMetadata: { contentType: info.format },
      customMetadata: { uploaderId: user!.id, filename },
    });

    await db.insert(shots).values({
      id: key,
      userId: user!.id,
      sourceHash,
      width: info.width,
      height: info.height,
      occurredAt,
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
