import { describe, expect, it, vi } from "vitest";
import { env as workerEnv } from "cloudflare:workers";
import { POST } from "./shot";

const call = (request: Request, locals: Record<string, unknown>) =>
  POST({ request, locals } as never);

const imageInfo = {
  format: "image/avif",
  fileSize: 9,
  width: 1920,
  height: 1080,
};
const sourceHash = "a".repeat(64);

const mockDb = () => {
  const values = vi.fn().mockResolvedValue(undefined);
  return { db: { insert: vi.fn().mockReturnValue({ values }) }, values };
};

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

  it("requires a valid source image hash", async () => {
    const env = { CLIPS: { put: vi.fn() } };
    for (const hash of [undefined, "not-a-sha256"]) {
      const headers: Record<string, string> = { "Content-Type": "image/avif" };
      if (hash) headers["X-Source-SHA256"] = hash;
      const response = await call(
        new Request("https://clips.test/api/upload/shot", {
          method: "POST",
          headers,
          body: "shot-data",
        }),
        { env, user: { id: "user-1", role: "user", slug: "grenuttag" } },
      );
      expect(response.status).toBe(400);
    }
  });

  it("accepts any image MIME type", async () => {
    const put = vi.fn();
    const info = vi.fn().mockResolvedValue(imageInfo);
    const { db, values } = mockDb();
    const output = vi.fn().mockResolvedValue({
      response: () => new Response("converted-shot"),
    });
    const input = vi.fn().mockReturnValue({ output });
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: {
          "Content-Type": "image/gif",
          "X-Source-SHA256": sourceHash,
        },
        body: "shot-data",
      }),
      {
        db,
        env: { CLIPS: { put }, IMAGES: { info, input } },
        user: { id: "user-1", role: "user", slug: "grenuttag" },
      },
    );

    expect(response.status).toBe(201);
    expect(input).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(output).toHaveBeenCalledWith({ format: "image/avif" });
    expect(info).toHaveBeenCalledWith(expect.any(ReadableStream));
    expect(put).toHaveBeenCalledWith(expect.any(String), expect.any(ArrayBuffer), {
      httpMetadata: { contentType: "image/avif" },
      customMetadata: {},
    });
    expect(values).toHaveBeenCalledWith({
      id: expect.any(String),
      userId: "user-1",
      sourceHash,
      width: 1920,
      height: 1080,
    });
  });

  it("streams an AVIF shot unchanged under a UUID key", async () => {
    const put = vi.fn();
    const info = vi.fn().mockResolvedValue(imageInfo);
    const input = vi.fn();
    const { db } = mockDb();
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: {
          "Content-Type": "image/avif",
          "X-Source-SHA256": sourceHash,
        },
        body: "shot-data",
      }),
      {
        db,
        env: { CLIPS: { put }, IMAGES: { info, input } },
        user: { id: "user-1", role: "user", slug: "grenuttag" },
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

  it("preserves the body length required by R2 while inspecting it", async () => {
    const { db } = mockDb();
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: {
          "Content-Type": "image/avif",
          "X-Source-SHA256": sourceHash,
        },
        body: "shot-data",
      }),
      {
        db,
        env: {
          CLIPS: workerEnv.CLIPS,
          IMAGES: {
            info: vi.fn(async (image: ReadableStream) => {
              await new Response(image).arrayBuffer();
              return imageInfo;
            }),
          },
        },
        user: { id: "user-1", role: "user", slug: "grenuttag" },
      },
    );

    expect(response.status).toBe(201);
    const { key } = (await response.json()) as { key: string };
    try {
      expect(await (await workerEnv.CLIPS.get(key))?.text()).toBe("shot-data");
    } finally {
      await workerEnv.CLIPS.delete(key);
    }
  });

  it("preserves the body length after converting an image", async () => {
    const png = Uint8Array.from(
      atob(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
      ),
      (character) => character.charCodeAt(0),
    );
    const { db } = mockDb();
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: {
          "Content-Type": "image/png",
          "X-Source-SHA256": sourceHash,
        },
        body: png,
      }),
      {
        db,
        env: { CLIPS: workerEnv.CLIPS, IMAGES: workerEnv.IMAGES },
        user: { id: "user-1", role: "user", slug: "grenuttag" },
      },
    );

    expect(response.status).toBe(201);
    const { key } = (await response.json()) as { key: string };
    try {
      expect((await workerEnv.CLIPS.get(key))?.httpMetadata?.contentType).toBe(
        "image/avif",
      );
    } finally {
      await workerEnv.CLIPS.delete(key);
    }
  });

  it("returns 502 when R2 rejects the write", async () => {
    const deleteObject = vi.fn();
    const { db } = mockDb();
    const response = await call(
      new Request("https://clips.test/api/upload/shot", {
        method: "POST",
        headers: {
          "Content-Type": "image/avif",
          "X-Source-SHA256": sourceHash,
        },
        body: "shot-data",
      }),
      {
        db,
        env: {
          CLIPS: {
            delete: deleteObject,
            put: vi.fn().mockRejectedValue(new Error("R2 unavailable")),
          },
          IMAGES: { info: vi.fn().mockResolvedValue(imageInfo) },
        },
        user: { id: "user-1", role: "user", slug: "grenuttag" },
      },
    );
    expect(response.status).toBe(502);
    expect(deleteObject).toHaveBeenCalledWith(expect.any(String));
  });
});
