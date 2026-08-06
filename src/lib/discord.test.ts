import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getGuildRole,
  isDiscordBot,
  parseGuildIds,
  refreshGuildRole,
} from "./discord";

describe("isDiscordBot", () => {
  const req = (ua?: string) =>
    new Request("https://example.com/watch/1", {
      headers: ua ? { "user-agent": ua } : {},
    });

  it("matches Discord's crawler user agent", () => {
    expect(
      isDiscordBot(
        req("Mozilla/5.0 (compatible; Discordbot/2.0; +https://discordbot.com)"),
      ),
    ).toBe(true);
  });

  it("does not match browsers or a missing user agent", () => {
    expect(isDiscordBot(req("Mozilla/5.0 (Macintosh) Safari/605.1.15"))).toBe(
      false,
    );
    expect(isDiscordBot(req())).toBe(false);
  });
});

describe("parseGuildIds", () => {
  it("returns an empty array for undefined or empty input", () => {
    expect(parseGuildIds(undefined)).toEqual([]);
    expect(parseGuildIds("")).toEqual([]);
    expect(parseGuildIds("   ")).toEqual([]);
  });

  it("splits on commas and trims whitespace", () => {
    expect(parseGuildIds("1, 2 ,3")).toEqual(["1", "2", "3"]);
  });

  it("drops empty segments from trailing or doubled commas", () => {
    expect(parseGuildIds("1,,2,")).toEqual(["1", "2"]);
  });
});

describe("getGuildRole", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const guildsResponse = (guilds: Array<{ id: string; name: string }>) => ({
    ok: true,
    json: async () => guilds,
  });

  it("sends the access token as a bearer credential", async () => {
    fetchMock.mockResolvedValue(guildsResponse([{ id: "m1", name: "g" }]));

    await getGuildRole("tok", ["m1"], []);

    expect(fetchMock).toHaveBeenCalledWith(
      "https://discord.com/api/v10/users/@me/guilds",
      { headers: { Authorization: "Bearer tok" } },
    );
  });

  it("returns 'user' when the account is in a member guild", async () => {
    fetchMock.mockResolvedValue(
      guildsResponse([{ id: "x", name: "x" }, { id: "m1", name: "member" }]),
    );

    await expect(getGuildRole("tok", ["m1"], ["v1"])).resolves.toBe("user");
  });

  it("returns 'viewer' when only in a viewer guild", async () => {
    fetchMock.mockResolvedValue(guildsResponse([{ id: "v1", name: "viewer" }]));

    await expect(getGuildRole("tok", ["m1"], ["v1"])).resolves.toBe("viewer");
  });

  it("prefers 'user' when the account is in both member and viewer guilds", async () => {
    fetchMock.mockResolvedValue(
      guildsResponse([{ id: "m1", name: "m" }, { id: "v1", name: "v" }]),
    );

    await expect(getGuildRole("tok", ["m1"], ["v1"])).resolves.toBe("user");
  });

  it("throws when the account is in no approved guild", async () => {
    fetchMock.mockResolvedValue(guildsResponse([{ id: "other", name: "o" }]));

    await expect(getGuildRole("tok", ["m1"], ["v1"])).rejects.toMatchObject({
      message: "You must be a member of an approved Discord server to sign in.",
    });
  });

  it("throws when Discord rejects the token", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => [] });

    await expect(getGuildRole("bad", ["m1"], ["v1"])).rejects.toMatchObject({
      message: "Could not verify your Discord server membership.",
    });
  });
});

describe("refreshGuildRole", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  const guildsResponse = (guilds: Array<{ id: string; name: string }>) => ({
    ok: true,
    json: async () => guilds,
  });

  it("keeps 'user' while still in a member guild", async () => {
    fetchMock.mockResolvedValue(guildsResponse([{ id: "m1", name: "member" }]));

    await expect(refreshGuildRole("tok", ["m1"])).resolves.toBe("user");
  });

  it("downgrades to 'viewer' after leaving the member guilds", async () => {
    fetchMock.mockResolvedValue(guildsResponse([{ id: "other", name: "o" }]));

    await expect(refreshGuildRole("tok", ["m1"])).resolves.toBe("viewer");
  });

  it("downgrades to 'viewer' when in no guilds at all, never rejecting", async () => {
    fetchMock.mockResolvedValue(guildsResponse([]));

    await expect(refreshGuildRole("tok", ["m1"])).resolves.toBe("viewer");
  });

  it("still throws when Discord rejects the token, so the role is left alone", async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => [] });

    await expect(refreshGuildRole("bad", ["m1"])).rejects.toMatchObject({
      message: "Could not verify your Discord server membership.",
    });
  });
});
