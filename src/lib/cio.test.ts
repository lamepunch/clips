import { describe, expect, it } from "vitest";
import { epochSeconds } from "./cio";

describe("epochSeconds", () => {
  it("converts a Date to unix seconds, not milliseconds", () => {
    expect(epochSeconds(new Date("2026-06-22T00:33:00.000Z"))).toBe(1782088380);
  });

  it("floors sub-second precision", () => {
    expect(epochSeconds(new Date("2026-06-22T00:33:00.999Z"))).toBe(1782088380);
  });
});
