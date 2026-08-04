import { describe, expect, it } from "vitest";
import { clips, games, user } from "@/db/schema";
import { formValues, getAdminTable, primaryKey } from "./admin";

describe("getAdminTable", () => {
  it("resolves known table names", () => {
    expect(getAdminTable("games")).toBe(games);
    expect(getAdminTable("user")).toBe(user);
    expect(getAdminTable("clips")).toBe(clips);
  });

  it("returns undefined for unknown or missing names", () => {
    expect(getAdminTable("nope")).toBeUndefined();
    expect(getAdminTable(undefined)).toBeUndefined();
    // Must not leak Object.prototype keys.
    expect(getAdminTable("toString")).toBeUndefined();
  });
});

describe("primaryKey", () => {
  it("returns the primary key column entry for a table", () => {
    const [key, col] = primaryKey(games);
    expect(key).toBe("id");
    expect(col.primary).toBe(true);
  });
});

describe("formValues", () => {
  it("skips the primary key and includes provided fields", () => {
    const form = new FormData();
    form.set("id", "should-be-ignored");
    form.set("title", "Halo");
    form.set("slug", "halo");
    form.set("igdbId", "42");

    const values = formValues(games, form);

    expect(values).not.toHaveProperty("id");
    expect(values.title).toBe("Halo");
    expect(values.slug).toBe("halo");
  });

  it("coerces numeric columns to numbers", () => {
    const form = new FormData();
    form.set("title", "Doom");
    form.set("igdbId", "7");

    const values = formValues(games, form);

    expect(values.igdbId).toBe(7);
    expect(typeof values.igdbId).toBe("number");
  });

  it("omits empty non-boolean fields so DB defaults apply", () => {
    const form = new FormData();
    form.set("title", "Doom");
    form.set("igdbId", "1");
    form.set("image", "");
    form.set("slug", "");

    const values = formValues(games, form);

    expect(values).not.toHaveProperty("image");
    expect(values).not.toHaveProperty("slug");
  });

  it("maps boolean columns from checkbox presence", () => {
    const present = new FormData();
    present.set("name", "Ann");
    present.set("emailVerified", "on");

    const withBool = formValues(user, present);
    expect(withBool.emailVerified).toBe(true);

    const absent = new FormData();
    absent.set("name", "Bob");
    const withoutBool = formValues(user, absent);
    expect(withoutBool.emailVerified).toBe(false);
  });

  it("coerces date columns to Date instances", () => {
    const form = new FormData();
    form.set("name", "Ann");
    form.set("banExpires", "2026-01-01");

    const values = formValues(user, form);

    expect(values.banExpires).toBeInstanceOf(Date);
    expect((values.banExpires as Date).getUTCFullYear()).toBe(2026);
  });
});
