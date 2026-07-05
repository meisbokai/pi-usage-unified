import { afterEach, describe, expect, it, vi } from "vitest";
import {
  openrouterProvider,
  parseOpenRouterCredits,
  parseOpenRouterKey,
} from "../src/providers/openrouter.js";
import { fakeModelRegistry, stubTheme } from "./helpers.js";

const keyResponse = { data: { usage: 4.2, limit: 10, label: "sk-…" } };
const creditsResponse = { total_credits: 20, total_usage: 5.5 };

function mockFetch(urls: Record<string, unknown>) {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    for (const key of Object.keys(urls)) {
      if (url.includes(key)) {
        return new Response(JSON.stringify(urls[key]), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response("not found", { status: 404 });
  });
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseOpenRouterKey", () => {
  it("computes usage percent from usage/limit", () => {
    const r = parseOpenRouterKey(keyResponse);
    expect(r.keyUsagePercent).toBe(42);
    expect(r.keySpend).toBe(4.2);
    expect(r.keyLimit).toBe(10);
  });

  it("returns no percent when limit is 0 or missing", () => {
    expect(parseOpenRouterKey({ data: { usage: 1, limit: 0 } }).keyUsagePercent).toBeUndefined();
    expect(parseOpenRouterKey({ data: { usage: 1 } }).keyUsagePercent).toBeUndefined();
  });
});

describe("parseOpenRouterCredits", () => {
  it("computes balance = total_credits - total_usage", () => {
    expect(parseOpenRouterCredits(creditsResponse).creditBalance).toBe(14.5);
  });

  it("returns undefined when both fields missing", () => {
    expect(parseOpenRouterCredits({}).creditBalance).toBeUndefined();
  });
});

describe("openrouterProvider.fetch (mocked fetch)", () => {
  it("combines key + credits endpoints", async () => {
    mockFetch({
      "/api/v1/key": keyResponse,
      "/api/v1/credits": creditsResponse,
    });
    const data = await openrouterProvider.fetch({ modelRegistry: fakeModelRegistry({ openrouter: "sk-or" }) });
    expect(data.keyUsagePercent).toBe(42);
    expect(data.creditBalance).toBe(14.5);
    expect(data.source).toBe("openrouter-api");
  });

  it("sends Authorization Bearer header with the resolved key", async () => {
    const spy = mockFetch({ "/api/v1/key": keyResponse, "/api/v1/credits": creditsResponse });
    await openrouterProvider.fetch({ modelRegistry: fakeModelRegistry({ openrouter: "sk-or-xyz" }) });
    const calls = spy.mock.calls.map((c) => c[1] as RequestInit | undefined);
    expect(calls.every((c) => (c?.headers as Record<string, string>).Authorization === "Bearer sk-or-xyz")).toBe(true);
  });

  it("matches openrouter* providers", () => {
    expect(openrouterProvider.match("openrouter")).toBe(true);
    expect(openrouterProvider.match("openrouter/auto")).toBe(true);
    expect(openrouterProvider.match("openai")).toBe(false);
  });

  it("renders a footer line with percent and balance", () => {
    const line = openrouterProvider.renderStatus!(
      {
        provider: "openrouter",
        label: "OpenRouter",
        keyUsagePercent: 42,
        keySpend: 4.2,
        keyLimit: 10,
        creditBalance: 14.5,
        source: "openrouter-api",
      },
      stubTheme,
    );
    expect(line).toContain("42%");
    expect(line).toContain("$14.5");
  });
});
