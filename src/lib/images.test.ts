import { describe, expect, it } from "vitest";
import { imageObjectKey, uploadKind, uploadRestriction } from "./images";

describe("image upload files", () => {
  it("classifies supported media and creates safe R2 keys", () => {
    expect(uploadKind("image/jpeg")).toBe("image");
    expect(uploadKind("image/png")).toBe("image");
    expect(uploadKind("image/webp")).toBe("image");
    expect(uploadKind("video/mp4")).toBe("video");
    expect(uploadKind("image/gif")).toBeUndefined();
    expect(imageObjectKey("grenuttag", "image/jpeg", "image-id")).toBe(
      "grenuttag/image-id.jpg",
    );
    expect(imageObjectKey("grenuttag", "image/png", "image-id")).toBe(
      "grenuttag/image-id.png",
    );
  });

  it("keeps image and video batches separate while limiting only videos", () => {
    expect(uploadRestriction("image/png", ["image/jpeg"])).toBeUndefined();
    expect(uploadRestriction("video/mp4", ["image/jpeg"])).toBe(
      "Upload images or videos in separate batches.",
    );
    expect(uploadRestriction("video/mp4", Array(4).fill("video/mp4"))).toBe(
      "You can upload up to four videos at once.",
    );
    expect(uploadRestriction("image/gif", [])).toBe(
      "Only video, JPEG, PNG, and WebP files are supported.",
    );
  });
});
