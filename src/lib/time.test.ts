import { describe, expect, it } from "vitest";
import { fromLocalInput, toLocalInput } from "./time";

const ET = "America/New_York";

describe("datetime-local conversion", () => {
  it("renders an instant as wall-clock time in the zone", () => {
    expect(toLocalInput(new Date("2026-08-11T05:27:00Z"), ET)).toBe(
      "2026-08-11T01:27",
    );
    // Standard time, so the offset is -5 rather than -4.
    expect(toLocalInput(new Date("2026-01-11T05:27:00Z"), ET)).toBe(
      "2026-01-11T00:27",
    );
    expect(toLocalInput(new Date("2026-08-11T05:27:00Z"), "UTC")).toBe(
      "2026-08-11T05:27",
    );
  });

  it("reads a submitted value as wall-clock time in the zone", () => {
    expect(fromLocalInput("2026-08-11T13:27", ET).toISOString()).toBe(
      "2026-08-11T17:27:00.000Z",
    );
    expect(fromLocalInput("2026-01-11T13:27", ET).toISOString()).toBe(
      "2026-01-11T18:27:00.000Z",
    );
    expect(fromLocalInput("2026-08-11T13:27", "UTC").toISOString()).toBe(
      "2026-08-11T13:27:00.000Z",
    );
  });

  it("round-trips both ways", () => {
    const value = "2026-03-09T02:30";
    expect(toLocalInput(fromLocalInput(value, ET), ET)).toBe(value);

    const instant = new Date("2026-11-01T09:15:00Z");
    expect(fromLocalInput(toLocalInput(instant, ET), ET)).toEqual(instant);
  });
});
