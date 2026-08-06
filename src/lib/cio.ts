import { PipelinesClient, RegionUS } from "customerio-node";

type CioCall = (cio: PipelinesClient) => Promise<unknown>;

/**
 * Customer.io stores date attributes as unix seconds, and only converts ISO
 * strings for its own reserved attributes — see PAPERCUTS.md.
 */
export const epochSeconds = (date: Date): number =>
  Math.floor(date.getTime() / 1000);

/**
 * Best-effort delivery to Customer.io. Does nothing without a write key, never
 * throws, and never delays the response — analytics must not be able to slow
 * down or break the flow it is reporting on. Callers fire and forget.
 *
 * The write key selects the workspace, so it doubles as the environment switch:
 * dev and production hold different keys and no code branches on it.
 */
export function sendToCio(
  env: Env,
  ctx: ExecutionContext | undefined,
  call: CioCall,
): void {
  const writeKey = env.CIO_PIPELINES_WRITE_KEY;
  if (!writeKey) return;

  const cio = new PipelinesClient(writeKey, {
    region: RegionUS,
    // Otherwise a bad key or payload is accepted with a 200 and dropped.
    strictMode: true,
    // Retries would trade a dropped event for a slow request. Wrong trade here.
    retry: { maxRetries: 0 },
  });

  const done = call(cio).catch((err) => {
    console.error("Customer.io call failed", err);
  });

  // Outlive the response where possible; otherwise let it float.
  ctx?.waitUntil(done);
}
