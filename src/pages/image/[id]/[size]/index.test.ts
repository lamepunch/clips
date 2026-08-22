import { describe, expect, it, vi } from "vitest";
import { GET } from "./index";

const call = (size: string, locals: Record<string, unknown>) =>
  GET({ locals, params: { id: "shot-id", size } } as never);

describe("GET /image/[id]/[size]", () => {
  it("streams the stored image directly at full size", async () => {
    const input = vi.fn();
    const image = {
      body: new Response("shot-data").body,
      writeHttpMetadata: (headers: Headers) =>
        headers.set("Content-Type", "image/avif"),
    };

    const response = await call("full", {
      env: { CLIPS: { get: vi.fn().mockResolvedValue(image) }, IMAGES: { input } },
    });

    expect(new TextDecoder().decode(await response.arrayBuffer())).toBe("shot-data");
    expect(response.headers.get("Content-Type")).toBe("image/avif");
    expect(input).not.toHaveBeenCalled();
  });
});
