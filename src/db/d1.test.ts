import { describe, expect, it } from "vitest";
import { d1, first, sql } from "./d1";

describe("sql", () => {
  it("binds interpolations instead of splicing them into the SQL", async () => {
    const title = "'; drop table games; --";
    await sql`insert into games (id, igdb_id, title) values ('a', 1, ${title})`.run();

    expect(
      await first<{ id: string }>(sql`select id from games where title = ${title}`),
    ).toEqual({ id: "a" });

    await d1().prepare("delete from games").run();
  });

  it("runs a statement with no interpolations", async () => {
    const { results } = await sql`select 1 as one`.all();
    expect(results).toEqual([{ one: 1 }]);
  });

  it("composes value lists", async () => {
    const { results } = await sql`select 1 as ok where 1 in (${sql.join([1, 2])})`.all();
    expect(results).toEqual([{ ok: 1 }]);
  });
});

describe("first", () => {
  it("is null when nothing matches", async () => {
    expect(await first(sql`select id from games where id = ${"nope"}`)).toBeNull();
  });
});
