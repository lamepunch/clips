/**
 * `<input type="datetime-local">` speaks naive wall-clock time and Workers run
 * in UTC, so both directions need the visitor's zone spliced in explicitly.
 */

const formatter = (tz: string) =>
  new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

const asUtc = (naive: string) => new Date(`${naive.slice(0, 16)}:00Z`);

/** An instant as the `datetime-local` value a viewer in `tz` should see. */
export function toLocalInput(date: Date, tz: string) {
  const p: Record<string, string> = {};
  for (const { type, value } of formatter(tz).formatToParts(date)) {
    p[type] = value;
  }
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * A submitted `datetime-local` value read as wall-clock time in `tz`.
 *
 * ponytail: two passes, because the first guess can land on the wrong side of a
 * DST transition and pick up the neighbouring offset. Only the genuinely
 * ambiguous fall-back hour stays undecidable; a tz library is the fix if it ever
 * matters.
 */
export function fromLocalInput(value: string, tz: string) {
  const guess = asUtc(value);
  const offset = (t: Date) => asUtc(toLocalInput(t, tz)).getTime() - t.getTime();
  const near = new Date(guess.getTime() - offset(guess));
  return new Date(guess.getTime() - offset(near));
}

/**
 * The capture time in a Steam screenshot filename (`YYYYMMDDHHMMSS_N.ext`),
 * which Steam writes in the player's own wall-clock time — so it reads exactly
 * like a submitted `datetime-local` value.
 *
 * ponytail: minute precision, matching the editor; seconds are dropped. An
 * impossible day like `0230` rolls into March rather than returning null,
 * because Steam never emits one.
 */
export function fromSteamFilename(filename: string, tz: string) {
  const m = filename.match(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})\d{2}_\d+\./);
  if (!m) return null;
  const naive = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  // Catches month 13, hour 25 and friends before Intl throws on them.
  return Number.isNaN(Date.parse(`${naive}:00Z`))
    ? null
    : fromLocalInput(naive, tz);
}
