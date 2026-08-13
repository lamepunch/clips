import { describe, expect, it } from "vitest";
import { imageExtension, imageObjectKey } from "./images";

describe("image upload files", () => {
  it("recognizes supported images and creates safe R2 keys", () => {
    expect(imageExtension("image/jpeg")).toBe("jpg");
    expect(imageExtension("image/png")).toBe("png");
    expect(imageExtension("image/webp")).toBe("webp");
    expect(imageExtension("image/gif")).toBeUndefined();
    expect(imageObjectKey("grenuttag", "image/jpeg", "image-id")).toBe(
      "grenuttag/image-id.jpg",
    );
    expect(imageObjectKey("grenuttag", "image/png", "image-id")).toBe(
      "grenuttag/image-id.png",
    );
  });
});
