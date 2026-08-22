import { describe, expect, it } from "vitest";
import { neighborHrefs } from "./media";

const ids = ["a", "b", "c"];

describe("neighborHrefs", () => {
  it("points both ways from the middle", () => {
    expect(neighborHrefs(ids, "b", "/watch")).toEqual({
      prevHref: "/watch/a",
      nextHref: "/watch/c",
    });
  });

  it("drops the missing side at each end", () => {
    expect(neighborHrefs(ids, "a", "/watch")).toEqual({
      prevHref: undefined,
      nextHref: "/watch/b",
    });
    expect(neighborHrefs(ids, "c", "/view")).toEqual({
      prevHref: "/view/b",
      nextHref: undefined,
    });
  });

  it("has no neighbours in a single-item library", () => {
    expect(neighborHrefs(["a"], "a", "/view")).toEqual({
      prevHref: undefined,
      nextHref: undefined,
    });
  });

  // A clip still processing is absent from its own library listing.
  it("has no neighbours when the id is missing", () => {
    expect(neighborHrefs(ids, "z", "/watch")).toEqual({
      prevHref: undefined,
      nextHref: undefined,
    });
  });
});
