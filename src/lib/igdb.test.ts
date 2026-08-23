import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// searchGames/getToken keep a module-level token cache, so each test imports a
// fresh module instance via resetModules to isolate that state.
async function importIgdb() {
  vi.resetModules();
  return import("./igdb");
}

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

    await expect(searchGames("   ")).resolves.toEqual([]);
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
    const result = await searchGames("sh");

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
    await searchGames('a"b\\c');

    const body = fetchMock.mock.calls[1][1].body as string;
    expect(body).toContain('search "a\\"b\\\\c";');
    expect(body).toContain("where game_type != (1,2,3,13,14);");
    expect(body).toContain("limit 50;");
  });

  it("ranks by rating_count, keeps IGDB relevance for ties, and caps at 10", async () => {
    // 12 unrated games, then a popular one buried at the end — IGDB really does
    // return "Halo 3" (840 ratings) below "Halo 4: Limited Edition" (5).
    const filler = Array.from({ length: 12 }, (_, i) => ({
      id: i + 1,
      name: `filler ${i + 1}`,
      slug: `filler-${i + 1}`,
    }));
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce(
        gamesResponse([...filler, { id: 99, name: "Halo 3", slug: "halo-3", rating_count: 840 }]),
      );

    const { searchGames } = await importIgdb();
    const result = await searchGames("halo");

    expect(result).toHaveLength(10);
    expect(result[0].slug).toBe("halo-3");
    // Ties fall back to the order IGDB returned them in.
    expect(result.slice(1).map((g) => g.slug)).toEqual(
      filler.slice(0, 9).map((g) => g.slug),
    );
  });

  it("caches the token across searches within its lifetime", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse("tok"))
      .mockResolvedValue(gamesResponse([]));

    const { searchGames } = await importIgdb();
    await searchGames("one");
    await searchGames("two");

    // 1 token request + 2 search requests (token reused).
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[0][0].toString()).toContain("id.twitch.tv/oauth2/token");
  });

  it("throws when the token request fails", async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, status: 401, json: async () => ({}) });

    const { searchGames } = await importIgdb();
    await expect(searchGames("x")).rejects.toThrow("Twitch token failed (401)");
  });

  it("throws when the IGDB search fails", async () => {
    fetchMock
      .mockResolvedValueOnce(tokenResponse())
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });

    const { searchGames } = await importIgdb();
    await expect(searchGames("x")).rejects.toThrow("IGDB search failed (500)");
  });
});
