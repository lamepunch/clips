import { describe, expect, it } from "vitest";
import { requireUploadUser } from "./upload";

describe("requireUploadUser", () => {
  it("returns the user only for an authenticated non-viewer", () => {
    expect(requireUploadUser(null, null)).toMatchObject({ status: 401 });
    expect(requireUploadUser({}, { role: "viewer" })).toMatchObject({ status: 403 });
    expect(requireUploadUser({}, { role: "user", id: "u1" })).toEqual({
      role: "user",
      id: "u1",
    });
  });
});
