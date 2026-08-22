import { describe, expect, it } from "vitest";
import { getAccessDenial, requireClipOwner } from "./access";

type AccessOptions = {
  method?: string;
  role?: string;
  signedIn?: boolean;
  userAgent?: string;
};

function evaluate(pathname: string, options: AccessOptions = {}) {
  const request = new Request(`https://clips.test${pathname}`, {
    method: options.method ?? "GET",
    headers: options.userAgent ? { "User-Agent": options.userAgent } : undefined,
  });
  const signedIn = options.signedIn ?? false;

  return getAccessDenial({
    request,
    session: signedIn ? {} : null,
    user: signedIn ? { id: "user-1", role: options.role ?? "user" } : null,
    redirect: (location) =>
      new Response(null, { status: 302, headers: { Location: location } }),
  });
}

describe("route access policy", () => {
  it("allows the declared public routes without a session", () => {
    for (const pathname of [
      "/welcome",
      "/api/auth/callback/discord",
      "/api/webhooks/stream",
    ]) {
      expect(evaluate(pathname)).toBeUndefined();
    }
  });

  it("requires authentication everywhere else", () => {
    for (const page of [evaluate("/"), evaluate("/grenuttag")]) {
      expect(page).toMatchObject({ status: 302 });
      expect(page?.headers.get("Location")).toBe("/welcome");
    }

    expect(evaluate("/api/private")).toMatchObject({ status: 401 });
    expect(evaluate("/grenuttag", { signedIn: true })).toBeUndefined();
  });

  it("limits admin routes to admins", () => {
    expect(evaluate("/admin/users", { signedIn: true })).toMatchObject({
      status: 403,
    });
    expect(
      evaluate("/admin/users", { signedIn: true, role: "admin" }),
    ).toBeUndefined();
  });

  it("keeps viewers out of upload pages and APIs", () => {
    for (const pathname of ["/upload", "/upload/clip", "/upload/shot"]) {
      const page = evaluate(pathname, { signedIn: true, role: "viewer" });
      expect(page).toMatchObject({ status: 302 });
      expect(page?.headers.get("Location")).toBe("/");
    }
    expect(
      evaluate("/api/upload/shot", { signedIn: true, role: "viewer" }),
    ).toMatchObject({ status: 403 });
    expect(evaluate("/api/upload/shot", { signedIn: true })).toBeUndefined();
  });

  it("only exposes GET media details to Discord's crawler", () => {
    const discord = "Discordbot/2.0";
    expect(evaluate("/watch/clip-1", { userAgent: discord })).toBeUndefined();
    expect(evaluate("/view/shot-1", { userAgent: discord })).toBeUndefined();
    expect(evaluate("/watch/clip-1")).toMatchObject({ status: 302 });
    expect(evaluate("/view/shot-1")).toMatchObject({ status: 302 });
    expect(evaluate("/view/shot-1/edit", { userAgent: discord })).toMatchObject({
      status: 302,
    });
    expect(
      evaluate("/watch/clip-1/edit", { userAgent: discord }),
    ).toMatchObject({ status: 302 });
    expect(
      evaluate("/watch/clip-1", { method: "POST", userAgent: discord }),
    ).toMatchObject({ status: 302 });
  });
});

describe("requireClipOwner", () => {
  const clip = { userId: "owner-1" };

  it("allows the owner and rejects other or missing users", () => {
    expect(requireClipOwner({ id: "owner-1" }, clip)).toBeUndefined();
    expect(requireClipOwner({ id: "other-user" }, clip)).toMatchObject({
      status: 403,
    });
    expect(requireClipOwner(null, clip)).toMatchObject({ status: 403 });
  });
});
