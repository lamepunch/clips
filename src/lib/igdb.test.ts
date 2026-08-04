import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// searchGames/getToken keep a module-level token cache, so each test imports a
// fresh module instance via resetModules to isolate that state.
async function importIgdb() {
  vi.resetModules();
  return import("./igdb");
}

const env = {
  TWITCH_CLIENT_ID: "cid",
  TWITCH_CLIENT_SECRET: "secret",
} as unknown as Env;

const fetchMock = vi.fn();

function tokenResponse(access = "tok", expiresIn = 3600) {
  return { ok: true, json: async () => ({ access_token: access, expires_in: expiresIn }) };
}

function gamesResponse(games: unknown[]) {
  return { ok: true, json: async () => games };
}

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("searchGames", () => {
  it("returns [] for a blank query without hitting the network", async () => {
    const { searchGames } = await importIgdb();

    await expect(searchGames(env, "   ")).resolves.toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("authenticates then queries IGDB and maps results", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok"))
      .mockResolvedValueOnce(
        gamesResponse([
          { id: 1, name: "Halo", slug: "halo", cover: { url: "//img/t_thumb/a.jpg" } },
          { id: 2, name: "Doom", slug: "doom" },
        ]),
      );

    const { searchGames } = await importIgdb();
    const result = await searchGames(env, "sh");

    expect(result).toEqual([
      { igdbId: 1, title: "Halo", slug: "halo", image: "https://img/t_cover_big/a.jpg" },
      { igdbId: 2, title: "Doom", slug: "doom", image: null },
    ]);

    // Second call is the games search with the bearer token from the first.
    const [url, init] = fetchMock.mock.calls[1];
    expect(url).toBe("https://api.igdb.com/v4/games");
    expect(init.headers.Authorization).toBe("Bearer tok");
    expect(init.headers["Client-ID"]).toBe("cid");
  });

  it("escapes quotes and backslashes in the search term", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(gamesResponse([]));

    const { searchGames } = await importIgdb();
    await searchGames(env, 'a"b\\c');

    const body = fetchMock.mock.calls[1][1].body as string;
    expect(body).toContain('search "a\\"b\\\\c";');
  });

  it("caches the token across searches within its lifetime", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok"))
      .mockResolvedValue(gamesResponse([]));

    const { searchGames } = await importIgdb();
    await searchGames(env, "one");
    await searchGames(env, "two");

    // 1 token request + 2 search requests (token reused).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0].toString()).toContain("id.twitch.tv/oauth2/token");
  });

  it("throws when the token request fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    const { searchGames } = await importIgdb();
    await expect(searchGames(env, "x")).rejects.toThrow("Twitch token failed (401)");
  });

  it("throws when the IGDB search fails", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    const { searchGames } = await importIgdb();
    await expect(searchGames(env, "x")).rejects.toThrow("IGDB search failed (500)");
  });
});
