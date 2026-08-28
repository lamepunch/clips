import { beforeEach, describe, expect, it, vi } from "vitest";

const sdk = vi.hoisted(() => ({
  constructor: vi.fn(),
  identify: vi.fn(),
  track: vi.fn(),
  page: vi.fn(),
}));

vi.mock("customerio-node", () => ({
  PipelinesClient: class {
    constructor(...args: unknown[]) {
      sdk.constructor(...args);
    }

    identify = sdk.identify;
    track = sdk.track;
    page = sdk.page;
  },
}));

import { epochSeconds, getCio } from "./cio";

const testEnv = (writeKey?: string) =>
  ({ CIO_PIPELINES_WRITE_KEY: writeKey }) as Env;

const testContext = () => {
  const waitUntil = vi.fn();
  return {
    ctx: { waitUntil } as unknown as ExecutionContext,
    waitUntil,
  };
};

beforeEach(() => {
  vi.restoreAllMocks();
  for (const mock of Object.values(sdk)) mock.mockReset();
  sdk.identify.mockResolvedValue({});
  sdk.track.mockResolvedValue({});
  sdk.page.mockResolvedValue({});
});

describe("epochSeconds", () => {
  it("converts a Date to unix seconds, not milliseconds", () => {
    expect(epochSeconds(new Date("2026-06-22T00:33:00.000Z"))).toBe(1782088380);
  });

  it("floors sub-second precision", () => {
    expect(epochSeconds(new Date("2026-06-22T00:33:00.999Z"))).toBe(1782088380);
  });
});

describe("getCio", () => {
  it("delegates identify, track, and page calls and schedules each request", async () => {
    const { ctx, waitUntil } = testContext();
    const cio = getCio(testEnv("write-key"), ctx);
    const identify = { userId: "user-1", traits: { role: "user" } };
    const track = { userId: "user-1", event: "Clip Uploaded" };
    const page = { userId: "user-1", name: "/watch/clip-1" };

    cio.identify(identify);
    cio.track(track);
    cio.page(page);

    expect(sdk.constructor).toHaveBeenCalledWith("write-key", {
      strictMode: true,
      retry: { maxRetries: 0 },
    });
    expect(waitUntil).toHaveBeenCalledTimes(3);
    await Promise.all(waitUntil.mock.calls.map(([promise]) => promise));
    expect(sdk.identify).toHaveBeenCalledWith(identify);
    expect(sdk.track).toHaveBeenCalledWith(track);
    expect(sdk.page).toHaveBeenCalledWith(page);
  });

  it("returns safe no-op methods without a write key", () => {
    const { ctx, waitUntil } = testContext();
    const cio = getCio(testEnv(), ctx);

    expect(cio.identify({ userId: "user-1" })).toBeUndefined();
    expect(cio.track({ userId: "user-1", event: "Test" })).toBeUndefined();
    expect(cio.page({ userId: "user-1" })).toBeUndefined();
    expect(sdk.constructor).not.toHaveBeenCalled();
    expect(waitUntil).not.toHaveBeenCalled();
  });

  it("logs rejected requests without surfacing them", async () => {
    const error = new Error("failed");
    sdk.identify.mockRejectedValue(error);
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const { ctx, waitUntil } = testContext();
    const cio = getCio(testEnv("write-key"), ctx);

    expect(cio.identify({ userId: "user-1" })).toBeUndefined();
    await waitUntil.mock.calls[0][0];

    expect(log).toHaveBeenCalledWith("Customer.io API request failed", error);
  });
});
