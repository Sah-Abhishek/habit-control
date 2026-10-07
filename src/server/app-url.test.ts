import { describe, expect, it } from "vitest";
import { resolveAppUrl, trustedOrigins } from "./app-url";

describe("resolveAppUrl", () => {
  it("prefers an explicit BETTER_AUTH_URL and trims trailing slashes", () => {
    expect(resolveAppUrl({ BETTER_AUTH_URL: "https://almanac.app/", VERCEL_URL: "x.vercel.app" })).toBe("https://almanac.app");
  });

  it("uses the production domain on production deploys", () => {
    expect(resolveAppUrl({ VERCEL_ENV: "production", VERCEL_PROJECT_PRODUCTION_URL: "almanac.vercel.app", VERCEL_URL: "almanac-abc123.vercel.app" })).toBe("https://almanac.vercel.app");
  });

  it("uses the deployment URL on preview deploys", () => {
    expect(resolveAppUrl({ VERCEL_ENV: "preview", VERCEL_PROJECT_PRODUCTION_URL: "almanac.vercel.app", VERCEL_URL: "almanac-git-feat-me.vercel.app" })).toBe("https://almanac-git-feat-me.vercel.app");
  });

  it("returns null when nothing is configured (startup then fails loudly)", () => {
    expect(resolveAppUrl({})).toBeNull();
  });
});

describe("trustedOrigins", () => {
  it("includes the deployment and branch URLs without duplicates", () => {
    expect(trustedOrigins({ VERCEL_URL: "a.vercel.app", VERCEL_BRANCH_URL: "b.vercel.app", VERCEL_PROJECT_PRODUCTION_URL: "p.vercel.app" }, "https://p.vercel.app")).toEqual([
      "https://p.vercel.app",
      "https://a.vercel.app",
      "https://b.vercel.app",
    ]);
  });

  it("is just the app URL off Vercel", () => {
    expect(trustedOrigins({}, "http://localhost:3000")).toEqual(["http://localhost:3000"]);
  });
});
