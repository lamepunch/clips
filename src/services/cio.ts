import {
  PipelinesClient,
  type IdentifyPayload,
  type PagePayload,
  type TrackPayload,
} from "customerio-node";

export type Cio = {
  identify(payload: IdentifyPayload): void;
  track(payload: TrackPayload): void;
  page(payload: PagePayload): void;
};

/**
 * Convert a Date to unix seconds (not milliseconds) for Customer.io.
 *
 * {@link https://docs.customer.io/messaging/segmentation/timestamp-conditions/#what-does-is-a-timestamp-even-mean Timestamps}
 */
export const epochSeconds = (date: Date): number =>
  Math.floor(date.getTime() / 1000);

/**
 * Request-scoped Customer.io client. Calls are best-effort: they no-op without
 * a write key, never throw, and outlive the response where possible.
 */
export function getCio(env: Env, ctx: ExecutionContext | undefined): Cio {
  const writeKey = env.CIO_PIPELINES_WRITE_KEY;
  const client = writeKey
    ? new PipelinesClient(writeKey, {
        strictMode: true,
        retry: { maxRetries: 0 },
      })
    : undefined;

  const send = (call: (client: PipelinesClient) => Promise<unknown>) => {
    if (!client) return;
    const done = Promise.resolve()
      .then(() => call(client))
      .catch((err) => console.error("Customer.io API request failed", err));
    ctx?.waitUntil(done);
  };

  return {
    identify: (payload) => send((client) => client.identify(payload)),
    track: (payload) => send((client) => client.track(payload)),
    page: (payload) => send((client) => client.page(payload)),
  };
}
