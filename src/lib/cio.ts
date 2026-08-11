import { PipelinesClient } from "customerio-node";

type CioCall = (cio: PipelinesClient) => Promise<unknown>;

/**
 * Convert a Date to unix seconds (not milliseconds) for Customer.io.
 *
 * {@link https://docs.customer.io/messaging/segmentation/timestamp-conditions/#what-does-is-a-timestamp-even-mean Timestamps}
 */
export const epochSeconds = (date: Date): number =>
  Math.floor(date.getTime() / 1000);

/**
 * Send a request to the Customer.io Pipelines API.
 * Best-effort: no-ops without a write key, never throws, tries not to block.
 */
export function sendToCio(
  env: Env,
  ctx: ExecutionContext | undefined,
  call: CioCall,
): void {
  const writeKey = env.CIO_PIPELINES_WRITE_KEY;
  if (!writeKey) return;

  const cio = new PipelinesClient(writeKey, {
    // Use strict mode to ensure errors aren't silently dropped.
    strictMode: true,
    // Don't retry - we'd rather drop an event than slow down the request.
    retry: { maxRetries: 0 },
  });

  const done = call(cio).catch((err) => {
    console.error("Customer.io API request failed", err);
  });

  // Outlive the response where possible.
  ctx?.waitUntil(done);
}
