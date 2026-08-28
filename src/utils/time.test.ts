import { describe, expect, it } from "vitest";
import { fromLocalInput, fromSteamFilename, toLocalInput } from "./time";

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

describe("Steam screenshot filenames", () => {
  it("reads the capture time as wall-clock time in the zone", () => {
    expect(fromSteamFilename("20260811132700_1.jpg", ET)?.toISOString()).toBe(
      "2026-08-11T17:27:00.000Z",
    );
    // Standard time, so the offset is -5 rather than -4.
    expect(fromSteamFilename("20260111132700_1.jpg", ET)?.toISOString()).toBe(
      "2026-01-11T18:27:00.000Z",
    );
  });

  it("returns null for anything that isn't one", () => {
    for (const name of [
      "",
      "screenshot.jpg",
      "20260811_1.jpg",
      "20261311132700_1.jpg", // month 13
      "20260811253000_1.jpg", // hour 25
    ]) {
      expect(fromSteamFilename(name, ET)).toBeNull();
    }
  });
});
