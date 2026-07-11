/** Extract a human-readable message from an unknown thrown value. */
export const errorMessage = (err: unknown): string =>
  err instanceof Error ? err.message : String(err);
