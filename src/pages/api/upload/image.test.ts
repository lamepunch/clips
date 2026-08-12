import { describe, expect, it, vi } from "vitest";
import { POST } from "./image";

const call = (request: Request, locals: Record<string, unknown>) =>
  POST({ request, locals } as never);

describe("POST /api/upload/image", () => {
  it("rejects requests without an upload-capable session", async () => {
    const request = new Request("https://clips.test/api/upload/image", { method: "POST" });
    expect((await call(request, { env: {}, session: null, user: null })).status).toBe(401);
    expect(
      (
        await call(request, {
          env: {},
          session: {},
          user: { role: "viewer", slug: "grenuttag" },
        })
      ).status,
    ).toBe(403);
  });

  it("validates the body and image MIME type", async () => {
    const env = { CLIPS: { put: vi.fn() } };
    expect(
      (
        await call(new Request("https://clips.test/api/upload/image", { method: "POST" }), {
          env,
          session: {},
          user: { role: "user", slug: "grenuttag" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          new Request("https://clips.test/api/upload/image", {
            method: "POST",
            headers: { "Content-Type": "image/gif" },
            body: "data",
          }),
          { env, session: {}, user: { role: "user", slug: "grenuttag" } },
        )
      ).status,
    ).toBe(400);
  });

  it("streams an approved image into the user's folder", async () => {
    const put = vi.fn();
    const response = await call(
      new Request("https://clips.test/api/upload/image", {
        method: "POST",
        headers: { "Content-Type": "image/png; charset=binary" },
        body: "image-data",
      }),
      { env: { CLIPS: { put } }, session: {}, user: { role: "user", slug: "grenuttag" } },
    );

    expect(response.status).toBe(201);
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^grenuttag\/[\w-]+\.png$/),
      expect.any(ReadableStream),
      { httpMetadata: { contentType: "image/png" } },
    );
  });

  it("returns 502 when R2 rejects the write", async () => {
    const response = await call(
      new Request("https://clips.test/api/upload/image", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: "image-data",
      }),
      {
        env: { CLIPS: { put: vi.fn().mockRejectedValue(new Error("R2 unavailable")) } },
        session: {},
        user: { role: "user", slug: "grenuttag" },
      },
    );
    expect(response.status).toBe(502);
  });
});
