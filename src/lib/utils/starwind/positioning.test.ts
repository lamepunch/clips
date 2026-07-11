import { describe, expect, it } from "vitest";
import {
  getTransformOrigin,
  resolvePlacement,
  type FloatingAlign,
  type FloatingSide,
  type ResolvePlacementOptions,
} from "./positioning";

/** Build a minimal DOMRect-like object covering the fields the code reads. */
function rect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    x: left,
    y: top,
    width,
    height,
    left,
    top,
    right: left + width,
    bottom: top + height,
    toJSON() {
      return this;
    },
  } as DOMRect;
}

function options(
  overrides: Partial<ResolvePlacementOptions> = {},
): ResolvePlacementOptions {
  return {
    side: "bottom",
    align: "center",
    sideOffset: 8,
    triggerRect: rect(450, 300, 100, 40),
    contentWidth: 200,
    contentHeight: 120,
    viewportWidth: 1000,
    viewportHeight: 800,
    viewportPadding: 8,
    ...overrides,
  };
}

describe("resolvePlacement", () => {
  it("keeps the preferred placement when there is ample room", () => {
    const result = resolvePlacement(options());

    expect(result.side).toBe("bottom");
    expect(result.align).toBe("center");
    // bottom + sideOffset
    expect(result.top).toBe(300 + 40 + 8);
    // centered: left + (width - contentWidth) / 2
    expect(result.left).toBe(450 + (100 - 200) / 2);
  });

  it("bypasses collision handling and does not clamp when avoidCollisions is false", () => {
    // Trigger near the right edge; without collision handling the content
    // is allowed to overflow the viewport.
    const result = resolvePlacement(
      options({
        avoidCollisions: false,
        side: "right",
        align: "start",
        triggerRect: rect(980, 300, 20, 40),
      }),
    );

    expect(result.side).toBe("right");
    expect(result.align).toBe("start");
    // right edge (1000) + offset (8), un-clamped even though it overflows.
    expect(result.left).toBe(1000 + 8);
    expect(result.top).toBe(300);
  });

  it("flips to the opposite side when the preferred side overflows", () => {
    // Trigger pinned to the top: content cannot fit above, so it should flip
    // from "top" to "bottom".
    const result = resolvePlacement(
      options({
        side: "top",
        align: "center",
        triggerRect: rect(450, 4, 100, 40),
      }),
    );

    expect(result.side).toBe("bottom");
  });

  it("clamps the chosen position within the viewport padding", () => {
    const result = resolvePlacement(
      options({
        side: "bottom",
        align: "start",
        triggerRect: rect(950, 300, 40, 40),
        viewportPadding: 8,
      }),
    );

    const maxLeft = 1000 - 200 - 8;
    expect(result.left).toBeLessThanOrEqual(maxLeft);
    expect(result.left).toBeGreaterThanOrEqual(8);
  });

  it("never returns a position outside the padded viewport when colliding", () => {
    const result = resolvePlacement(
      options({
        side: "left",
        align: "start",
        triggerRect: rect(2, 2, 20, 20),
        contentWidth: 300,
        contentHeight: 300,
      }),
    );

    expect(result.left).toBeGreaterThanOrEqual(8);
    expect(result.top).toBeGreaterThanOrEqual(8);
    expect(result.left + 300).toBeLessThanOrEqual(1000 - 8 + 1);
    expect(result.top + 300).toBeLessThanOrEqual(800 - 8 + 1);
  });
});

describe("getTransformOrigin", () => {
  const cases: Array<[FloatingSide, FloatingAlign, string]> = [
    ["bottom", "start", "left top"],
    ["bottom", "center", "center top"],
    ["bottom", "end", "right top"],
    ["top", "start", "left bottom"],
    ["top", "end", "right bottom"],
    ["right", "start", "left top"],
    ["right", "center", "left center"],
    ["left", "end", "right bottom"],
  ];

  it.each(cases)("maps side=%s align=%s to '%s'", (side, align, expected) => {
    expect(getTransformOrigin(side, align)).toBe(expected);
  });
});
