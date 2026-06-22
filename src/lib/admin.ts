import { getTableColumns } from "drizzle-orm";
import { clips, games, user } from "@/db/schema";

// Tables manageable through the /admin UI. Add a table here to expose it.
export const adminTables = { user, games, clips } as const;
export type AdminTableName = keyof typeof adminTables;

export const getAdminTable = (name?: string) =>
  name && name in adminTables
    ? adminTables[name as AdminTableName]
    : undefined;

/** The primary-key column entry [jsKey, column] for a table. */
export function primaryKey(table: AdminTable) {
  return Object.entries(getTableColumns(table)).find(([, c]) => c.primary)!;
}

/**
 * Coerce a form string into the column's JS type. "" => undefined so the field
 * is omitted from the insert/update and the DB default / null applies.
 * Booleans are handled separately via checkbox presence.
 */
function coerce(dataType: string, raw: string) {
  if (raw === "") return undefined;
  if (dataType === "number") return Number(raw);
  if (dataType === "date") return new Date(raw);
  return raw;
}

/**
 * Build an insert/update values object from submitted form data, skipping the
 * primary key. Empty non-boolean fields are omitted (DB default / no change).
 */
export function formValues(table: AdminTable, form: FormData) {
  const values: Record<string, unknown> = {};
  for (const [key, col] of Object.entries(getTableColumns(table))) {
    if (col.primary) continue;
    if (col.dataType === "boolean") {
      values[key] = form.has(key);
      continue;
    }
    const v = coerce(col.dataType, String(form.get(key) ?? ""));
    if (v !== undefined) values[key] = v;
  }
  return values;
}

type AdminTable = (typeof adminTables)[AdminTableName];
