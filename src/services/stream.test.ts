import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createUploadUrl, verifyStreamWebhook } from "./stream";

// Independent HMAC-SHA256 hex digest using Web Crypto (native in the Workers
// runtime), mirroring what verifyStreamWebhook computes internally.
async function hmacHex(key: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return [...new Uint8Array(sig)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const env = {
  CF_ACCOUNT_ID: "acct123",
  STREAM_API_TOKEN: "token123",
} as unknown as Env;

describe("createUploadUrl", () => {
  it("posts tus headers and returns the Location + media id", async () => {
    const headers = new Headers({
      Location: "https://upload.example/abc",
      "stream-media-id": "uid-1",
    });
    fetchMock.mockResolvedValue({ ok: true, headers });

    const result = await createUploadUrl(env, {
      length: "1024",
      metadata: "filename dGVzdA==",
      creatorId: "user-1",
    });

    expect(result).toEqual({ url: "https://upload.example/abc", uid: "uid-1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://api.cloudflare.com/client/v4/accounts/acct123/stream?direct_user=true",
    );
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer token123",
      "Tus-Resumable": "1.0.0",
      "Upload-Length": "1024",
      "Upload-Metadata": "filename dGVzdA==,maxDurationSeconds NjAw",
      "Upload-Creator": "user-1",
    });
  });

  it("replaces a client-supplied maxDurationSeconds with our own limit", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      headers: new Headers({
        Location: "https://upload.example/abc",
        "stream-media-id": "uid-1",
      }),
    });

    await createUploadUrl(env, {
      length: "1024",
      // maxDurationSeconds of 99999, which must not survive.
      metadata: "maxDurationSeconds OTk5OTk=,filename dGVzdA==",
      creatorId: "user-1",
    });

    expect(fetchMock.mock.calls[0][1].headers["Upload-Metadata"]).toBe(
      "filename dGVzdA==,maxDurationSeconds NjAw",
    );
  });

  it("throws when the response lacks the Location header", async () => {
    const headers = new Headers({ "stream-media-id": "uid-1" });
    fetchMock.mockResolvedValue({
      ok: true,
      headers,
      status: 200,
      text: async () => "no location",
    });

    await expect(
      createUploadUrl(env, { length: "1", metadata: "m", creatorId: "c" }),
    ).rejects.toThrow("Stream upload init failed");
  });

  it("throws with the status and body when the request is not ok", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      headers: new Headers(),
      status: 403,
      text: async () => "forbidden",
    });

    await expect(
      createUploadUrl(env, { length: "1", metadata: "m", creatorId: "c" }),
    ).rejects.toThrow("Stream upload init failed (403): forbidden");
  });
});

describe("verifyStreamWebhook", () => {
  const secret = "whsec";
  const body = '{"uid":"abc","status":{"state":"ready"}}';
  const time = "1710000000";

  const sign = (t: string, rawBody: string, key = secret) =>
    hmacHex(key, `${t}.${rawBody}`);

  it("returns false when the header is missing", async () => {
    await expect(verifyStreamWebhook(body, null, secret)).resolves.toBe(false);
  });

  it("returns false when the header lacks time or sig1", async () => {
    await expect(verifyStreamWebhook(body, "time=123", secret)).resolves.toBe(false);
    await expect(verifyStreamWebhook(body, "sig1=deadbeef", secret)).resolves.toBe(false);
  });

  it("returns true for a correctly signed payload", async () => {
    const header = `time=${time},sig1=${await sign(time, body)}`;
    await expect(verifyStreamWebhook(body, header, secret)).resolves.toBe(true);
  });

  it("returns false when the signature does not match", async () => {
    const header = `time=${time},sig1=${await sign(time, body, "wrong-secret")}`;
    await expect(verifyStreamWebhook(body, header, secret)).resolves.toBe(false);
  });

  it("returns false when the body was tampered with", async () => {
    const header = `time=${time},sig1=${await sign(time, body)}`;
    await expect(
      verifyStreamWebhook(body + "tamper", header, secret),
    ).resolves.toBe(false);
  });
});
