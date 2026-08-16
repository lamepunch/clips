import { describe, expect, it, vi } from "vitest";
import { POST } from "./shot";

const call = (request: Request, locals: Record<string, unknown>) =>
  POST({ request, locals } as never);

describe("POST /api/upload/shot", () => {
  it("requires a body with an image MIME type", async () => {
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
            headers: { "Content-Type": "application/octet-stream" },
            body: "data",
          }),
          { env, user: { role: "user", slug: "grenuttag" } },
        )
      ).status,
    ).toBe(400);
  });

  it("accepts any image MIME type", async () => {
    const put = vi.fn();
    const converted = new ReadableStream();
    const output = vi.fn().mockResolvedValue({
      response: () => new Response(converted),
    });
    const input = vi.fn().mockReturnValue({ output });
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: { "Content-Type": "image/gif" },
        body: "shot-data",
      }),
      {
        env: { CLIPS: { put }, IMAGES: { input } },
        user: { role: "user", slug: "grenuttag" },
      },
    );

    expect(response.status).toBe(201);
    expect(input).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(output).toHaveBeenCalledWith({ format: "image/avif" });
    expect(put).toHaveBeenCalledWith(expect.any(String), converted, {
      httpMetadata: { contentType: "image/avif" },
      customMetadata: {},
    });
  });

  it("streams an AVIF shot unchanged under a UUID key", async () => {
    const put = vi.fn();
    const input = vi.fn();
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: { "Content-Type": "image/avif" },
        body: "shot-data",
      }),
      {
        env: { CLIPS: { put }, IMAGES: { input } },
        user: { role: "user", slug: "grenuttag" },
      },
    );

    expect(response.status).toBe(201);
    expect(input).not.toHaveBeenCalled();
    expect(put).toHaveBeenCalledWith(
      expect.stringMatching(/^[0-9a-f-]{36}$/),
      expect.any(ReadableStream),
      {
        httpMetadata: { contentType: "image/avif" },
        customMetadata: {},
      },
    );
  });

  it("returns 502 when R2 rejects the write", async () => {
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: { "Content-Type": "image/avif" },
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
