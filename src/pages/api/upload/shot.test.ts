import { describe, expect, it, vi } from "vitest";
import { POST } from "./shot";

const call = (request: Request, locals: Record<string, unknown>) =>
  POST({ request, locals } as never);

describe("POST /api/upload/shot", () => {
  it("validates the body and image MIME type", async () => {
    const env = { CLIPS: { put: vi.fn() } };
    expect(
      (
        await call(new Request("https://clips.test/api/upload/shot", { method: "POST" }), {
          env,
          user: { role: "user", slug: "grenuttag" },
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await call(
          new Request("https://clips.test/api/upload/shot", {
            method: "POST",
            headers: { "Content-Type": "image/gif" },
            body: "data",
          }),
          { env, user: { role: "user", slug: "grenuttag" } },
        )
      ).status,
    ).toBe(400);
  });

  it("streams an approved shot into the user's folder", async () => {
    const put = vi.fn();
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: { "Content-Type": "image/png; charset=binary" },
        body: "shot-data",
      }),
      { env: { CLIPS: { put } }, user: { role: "user", slug: "grenuttag" } },
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
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: { "Content-Type": "image/jpeg" },
        body: "shot-data",
      }),
      {
        env: { CLIPS: { put: vi.fn().mockRejectedValue(new Error("R2 unavailable")) } },
        user: { role: "user", slug: "grenuttag" },
      },
    );
    expect(response.status).toBe(502);
  });
});
