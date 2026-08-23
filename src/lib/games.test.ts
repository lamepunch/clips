import { env } from "cloudflare:workers";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolveGameId } from "./games";

const getGame = vi.hoisted(() => vi.fn());
vi.mock("@/lib/igdb", () => ({ getGame }));

// The pool keeps D1 storage for the whole file, so clear what we insert.
beforeEach(async () => {
  getGame.mockReset();
  await env.DB.prepare("delete from games").run();
});

const row = (id: string) =>
  env.DB.prepare("select * from games where id = ?").bind(id).first();

describe("resolveGameId", () => {
  it("returns the existing row without calling IGDB", async () => {
    const id = crypto.randomUUID();
    await env.DB.prepare(
      "insert into games (id, igdb_id, title, slug) values (?, 42, 'Halo', 'halo')",
    )
      .bind(id)
      .run();

    await expect(resolveGameId(42)).resolves.toBe(id);
    expect(getGame).not.toHaveBeenCalled();
  });

  it("inserts what IGDB returns on a miss", async () => {
    getGame.mockResolvedValue({
      igdbId: 7,
      title: "Doom",
      slug: "doom",
      image: "https://img/doom.jpg",
    });

    const id = await resolveGameId(7);

    expect(await row(id!)).toEqual({
      id,
      igdb_id: 7,
      title: "Doom",
      slug: "doom",
      image: "https://img/doom.jpg",
    });
  });

  it("returns null and inserts nothing when IGDB does not know the id", async () => {
    getGame.mockResolvedValue(null);

    await expect(resolveGameId(999)).resolves.toBeNull();
    const { results } = await env.DB.prepare("select * from games").all();
    expect(results).toEqual([]);
  });
});
