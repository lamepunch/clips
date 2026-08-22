import { and, desc, eq } from "drizzle-orm";
import type { DB } from "@/db";
import {
  clips,
  games,
  shots,
  user,
  ClipStatus,
  type Clip,
  type Shot,
} from "@/db/schema";
import { streamThumbnailUrl } from "@/lib/stream";

/** Ready clips for a user, newest first. */
export function userClips(db: DB, userId: string, limit?: number) {
  const q = db
    .select()
    .from(clips)
    .where(and(eq(clips.userId, userId), eq(clips.status, ClipStatus.READY)))
    .orderBy(desc(clips.createdAt), desc(clips.id));
  return limit === undefined ? q : q.limit(limit);
}

/** Shots for a user, newest first. */
export function userShots(db: DB, userId: string, limit?: number) {
  const q = db
    .select()
    .from(shots)
    .where(eq(shots.userId, userId))
    .orderBy(desc(shots.createdAt), desc(shots.id));
  return limit === undefined ? q : q.limit(limit);
}

export const countClips = (db: DB, userId: string) =>
  db.$count(
    clips,
    and(eq(clips.userId, userId), eq(clips.status, ClipStatus.READY)),
  );

export const countShots = (db: DB, userId: string) =>
  db.$count(shots, eq(shots.userId, userId));

export const clipItems = (env: Env, l: Clip[]) =>
  l.map((c) => ({
    href: `/watch/${c.id}`,
    src: streamThumbnailUrl(env, c.uid),
    alt: c.title || "Clip thumbnail",
    title: c.title || "Untitled clip",
  }));

export const shotItems = (l: Shot[]) =>
  l.map((s) => ({
    href: `/view/${s.id}`,
    src: `/image/${s.id}/thumbnail`,
    alt: s.title || "Shot thumbnail",
    title: s.title || "Untitled shot",
  }));

/** The uploader and game shown on a clip or shot detail page. */
export async function mediaMeta(
  db: DB,
  media: { userId: string; gameId: string | null },
) {
  const [uploader, game] = await Promise.all([
    db.query.user.findFirst({ where: eq(user.id, media.userId) }),
    media.gameId
      ? db.query.games.findFirst({ where: eq(games.id, media.gameId) })
      : undefined,
  ]);
  return { uploader, game };
}

/** Hrefs either side of `id` in a newest-first list of ids. */
export function neighborHrefs(ids: string[], id: string, base: string) {
  const i = ids.indexOf(id);
  const at = (n: number) => (i !== -1 && ids[n] ? `${base}/${ids[n]}` : undefined);
  return { prevHref: at(i - 1), nextHref: at(i + 1) };
}

/**
 * The items either side of this one in its uploader's library.
 *
 * ponytail: pulls the whole id list and walks it — one small query, no keyset
 * tuple comparison. Swap in two `LIMIT 1` queries if a library ever grows big
 * enough for the list to cost anything.
 */
export async function mediaNeighbors(
  db: DB,
  media: { id: string; userId: string },
  type: "clips" | "shots",
) {
  const rows =
    type === "clips"
      ? await db
          .select({ id: clips.id })
          .from(clips)
          .where(
            and(
              eq(clips.userId, media.userId),
              eq(clips.status, ClipStatus.READY),
            ),
          )
          .orderBy(desc(clips.createdAt), desc(clips.id))
      : await db
          .select({ id: shots.id })
          .from(shots)
          .where(eq(shots.userId, media.userId))
          .orderBy(desc(shots.createdAt), desc(shots.id));

  return neighborHrefs(
    rows.map((r) => r.id),
    media.id,
    type === "clips" ? "/watch" : "/view",
  );
}
