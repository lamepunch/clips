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
