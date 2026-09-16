import { afterEach, describe, expect, it, vi } from "vitest";
import {
  numberHeader,
  normalizeOpencodeResetAt,
  normalizeOpencodeWindow,
  opencodeProvider,
  parseOpencodeUsage,
  parseOpencodeWindow,
  shouldFallbackToProbe,
} from "../src/providers/opencode.js";
import { UsageError } from "../src/core/http.js";
import { fakeModelRegistry, stubTheme } from "./helpers.js";

/** Live shape observed from GET https://opencode.ai/zen/go/v1/usage (secret redacted). */
const liveUsageResponse = {
  usage: {
    rolling: { status: "ok", percent: 12, resetsAt: "2026-09-16T07:16:35.669Z" },
    weekly: { status: "ok", percent: 4, resetsAt: "2026-09-21T00:00:00.669Z" },
    monthly: { status: "ok", percent: 2, resetsAt: "2026-10-16T02:14:53.669Z" },
  },
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function probeResponse(): Response {
  return new Response("{}", {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "x-opencode-rolling-usage-percent": "25",
      "x-opencode-weekly-usage-percent": "6",
      "x-opencode-monthly-usage-percent": "1",
    },
  });
}

/** Route mocked fetches by URL substring; each handler returns a Response or throws. */
function mockFetch(routes: Record<string, () => Response>) {
  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const url = typeof input === "string" ? input : (input as Request).url;
    for (const key of Object.keys(routes)) {
      if (url.includes(key)) return routes[key]!();
    }
    throw new Error(`unexpected fetch: ${url}`);
  });
  return spy;
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe("numberHeader", () => {
  it("reads a value case-insensitively", () => {
    expect(numberHeader({ "X-Opencode-Weekly-Usage-Percent": "42" }, "x-opencode-weekly-usage-percent")).toBe(
      42,
    );
  });

  it("returns undefined for non-numeric values", () => {
    expect(numberHeader({ "x-foo": "abc" }, "x-foo")).toBeUndefined();
  });

  it("returns undefined when the header is absent", () => {
    expect(numberHeader({}, "x-missing")).toBeUndefined();
  });
});

describe("normalizeOpencodeWindow", () => {
  it("clamps to 0..100", () => {
    expect(normalizeOpencodeWindow(150)).toBe(100);
    expect(normalizeOpencodeWindow(-3)).toBe(0);
    expect(normalizeOpencodeWindow(42)).toBe(42);
  });

  it("returns undefined for non-finite values", () => {
    expect(normalizeOpencodeWindow("nope")).toBeUndefined();
    expect(normalizeOpencodeWindow(undefined)).toBeUndefined();
  });
});

describe("normalizeOpencodeResetAt", () => {
  it("parses absolute ISO-8601 timestamps into epoch seconds", () => {
    const iso = "2026-09-16T07:16:35.669Z";
    expect(normalizeOpencodeResetAt(iso)).toBe(Math.round(Date.parse(iso) / 1000));
  });

  it("accepts epoch seconds and milliseconds defensively", () => {
    expect(normalizeOpencodeResetAt(1_758_006_995)).toBe(1_758_006_995);
    expect(normalizeOpencodeResetAt(1_758_006_995_000)).toBe(1_758_006_995);
    expect(normalizeOpencodeResetAt("1758006995")).toBe(1_758_006_995);
  });

  it("returns undefined for missing / unparseable values", () => {
    expect(normalizeOpencodeResetAt(undefined)).toBeUndefined();
    expect(normalizeOpencodeResetAt("")).toBeUndefined();
    expect(normalizeOpencodeResetAt("not-a-date")).toBeUndefined();
    expect(normalizeOpencodeResetAt({})).toBeUndefined();
  });
});

describe("parseOpencodeWindow", () => {
  it("maps percent, status, and reset time", () => {
    expect(parseOpencodeWindow(liveUsageResponse.usage.rolling)).toEqual({
      usedPercent: 12,
      status: "ok",
      resetAt: Math.round(Date.parse("2026-09-16T07:16:35.669Z") / 1000),
    });
  });

  it("treats a rate-limited window as exhausted", () => {
    expect(parseOpencodeWindow({ status: "rate-limited" })).toEqual({
      usedPercent: 100,
      status: "rate-limited",
    });
    expect(parseOpencodeWindow({ status: "rate-limited", percent: 99 })?.usedPercent).toBe(99);
  });

  it("returns undefined for empty / unknown windows", () => {
    expect(parseOpencodeWindow(undefined)).toBeUndefined();
    expect(parseOpencodeWindow({})).toBeUndefined();
    expect(parseOpencodeWindow({ renamedPercent: 5 })).toBeUndefined();
  });
});

describe("parseOpencodeUsage", () => {
  it("parses the live top-level `usage` response", () => {
    const data = parseOpencodeUsage(liveUsageResponse);
    expect(data.provider).toBe("opencode");
    expect(data.source).toBe("opencode-usage-api");
    expect(data.rolling?.usedPercent).toBe(12);
    expect(data.weekly?.usedPercent).toBe(4);
    expect(data.monthly?.usedPercent).toBe(2);
    expect(data.rolling?.resetAt).toBe(Math.round(Date.parse("2026-09-16T07:16:35.669Z") / 1000));
    expect(data.weekly?.status).toBe("ok");
  });

  it("preserves a rate-limited window status", () => {
    const data = parseOpencodeUsage({
      usage: { rolling: { status: "rate-limited", percent: 100, resetsAt: "2026-09-16T07:16:35.669Z" } },
    });
    expect(data.rolling?.status).toBe("rate-limited");
    expect(data.rolling?.usedPercent).toBe(100);
    expect(data.weekly).toBeUndefined();
  });

  it("tolerates an unwrapped response and renamed fields", () => {
    const data = parseOpencodeUsage({
      rolling: { usedPercent: 5, reset_at: 1_758_006_995 },
      weekly: { used_percent: 7 },
    });
    expect(data.rolling).toEqual({ usedPercent: 5, resetAt: 1_758_006_995 });
    expect(data.weekly).toEqual({ usedPercent: 7 });
    expect(data.monthly).toBeUndefined();
  });

  it("throws UsageError('nodata') when no window is recognized", () => {
    for (const body of [{}, { usage: {} }, { usage: { rolling: { renamed: 1 } } }, null]) {
      try {
        parseOpencodeUsage(body);
        throw new Error("expected parseOpencodeUsage to throw");
      } catch (error) {
        expect(error).toBeInstanceOf(UsageError);
        expect((error as UsageError).code).toBe("nodata");
      }
    }
  });
});

describe("shouldFallbackToProbe", () => {
  it("falls back for network errors and 401/403/404/5xx", () => {
    for (const code of ["fetch", "http401", "http403", "http404", "http500", "http503"]) {
      expect(shouldFallbackToProbe(new UsageError("x", code))).toBe(true);
    }
  });

  it("does not fall back for parseable-but-broken endpoint responses", () => {
    for (const code of ["nodata", "badjson", "noauth"]) {
      expect(shouldFallbackToProbe(new UsageError("x", code))).toBe(false);
    }
    expect(shouldFallbackToProbe(new Error("boom"))).toBe(false);
  });
});

describe("opencodeProvider.fetch (mocked fetch)", () => {
  it("uses the usage endpoint as the primary source and never probes", async () => {
    const spy = mockFetch({ "/zen/go/v1/usage": () => jsonResponse(liveUsageResponse) });
    const data = await opencodeProvider.fetch({
      modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }),
    });
    expect(data.source).toBe("opencode-usage-api");
    expect(data.rolling?.usedPercent).toBe(12);
    expect(data.probeModel).toBeUndefined();
    expect(spy).toHaveBeenCalledTimes(1);
    expect(String(spy.mock.calls[0]?.[0])).toContain("/zen/go/v1/usage");
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-live");
  });

  it("falls back to the probe when the endpoint returns 401", async () => {
    const spy = mockFetch({
      "/zen/go/v1/usage": () => jsonResponse({ error: "unauthorized" }, 401),
      "/chat/completions": probeResponse,
    });
    const data = await opencodeProvider.fetch({
      modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }),
    });
    expect(data.source).toBe("opencode-probe");
    expect(data.rolling?.usedPercent).toBe(25);
    expect(data.fallbackReason).toContain("http401");
    expect(data.probeModel).toBe("kimi-k2.6");
    expect(spy).toHaveBeenCalledTimes(2);
    expect(String(spy.mock.calls[1]?.[0])).toContain("/chat/completions");
  });

  it("falls back to the probe when the endpoint returns 403", async () => {
    mockFetch({
      "/zen/go/v1/usage": () => jsonResponse({ error: "no subscription" }, 403),
      "/chat/completions": probeResponse,
    });
    const data = await opencodeProvider.fetch({
      modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }),
    });
    expect(data.source).toBe("opencode-probe");
    expect(data.fallbackReason).toContain("http403");
  });

  it("falls back to the probe on a network error", async () => {
    mockFetch({
      "/zen/go/v1/usage": () => {
        throw new Error("socket hang up");
      },
      "/chat/completions": probeResponse,
    });
    const data = await opencodeProvider.fetch({
      modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }),
    });
    expect(data.source).toBe("opencode-probe");
    expect(data.fallbackReason).toContain("fetch");
  });

  it("surfaces an unparseable 200 instead of masking it with the probe", async () => {
    const spy = mockFetch({ "/zen/go/v1/usage": () => jsonResponse({ usage: {} }) });
    await expect(
      opencodeProvider.fetch({ modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }) }),
    ).rejects.toMatchObject({ code: "nodata" });
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("reports the endpoint failure when the endpoint and the probe both fail", async () => {
    mockFetch({
      "/zen/go/v1/usage": () => jsonResponse({ error: "gone" }, 404),
      "/chat/completions": () => jsonResponse({ error: "nope" }, 500),
    });
    await expect(
      opencodeProvider.fetch({ modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }) }),
    ).rejects.toMatchObject({ code: "http404" });
  });

  it("throws noauth without fetching when no key is configured", async () => {
    vi.stubEnv("OPENCODE_API_KEY", "");
    const spy = mockFetch({});
    await expect(
      opencodeProvider.fetch({ modelRegistry: fakeModelRegistry({}) }),
    ).rejects.toMatchObject({ code: "noauth" });
    expect(spy).not.toHaveBeenCalled();
  });

  it("falls back to OPENCODE_API_KEY when the registry has no key", async () => {
    vi.stubEnv("OPENCODE_API_KEY", "sk-env");
    const spy = mockFetch({ "/zen/go/v1/usage": () => jsonResponse(liveUsageResponse) });
    await opencodeProvider.fetch({ modelRegistry: fakeModelRegistry({}) });
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-env");
  });

  it("matches opencode* providers", () => {
    expect(opencodeProvider.match("opencode")).toBe(true);
    expect(opencodeProvider.match("opencode-go")).toBe(true);
    expect(opencodeProvider.match("openai")).toBe(false);
  });
});

describe("opencodeProvider rendering", () => {
  it("renders rolling/weekly/monthly with reset times", () => {
    const resetAt = Math.round(Date.now() / 1000) + 300;
    const line = opencodeProvider.renderStatus!(
      {
        provider: "opencode",
        label: "OpenCode",
        rolling: { usedPercent: 12, status: "ok", resetAt },
        weekly: { usedPercent: 20 },
        monthly: { usedPercent: 30 },
        source: "opencode-usage-api",
      },
      stubTheme,
    );
    expect(line).toContain("R 12%");
    expect(line).toContain("W 20%");
    expect(line).toContain("M 30%");
    expect(line).toContain("(5m)");
    expect(line).not.toContain("probe fallback");
  });

  it("marks a probe-fallback render", () => {
    const line = opencodeProvider.renderStatus!(
      {
        provider: "opencode",
        label: "OpenCode",
        rolling: { usedPercent: 1 },
        source: "opencode-probe",
        probeModel: "kimi-k2.6",
      },
      stubTheme,
    );
    expect(line).toContain("R 1%");
    expect(line).toContain("probe fallback");
  });

  it("shows resets and status in details", () => {
    const resetAt = Math.round(Date.parse("2026-09-16T07:16:35.669Z") / 1000);
    const details = opencodeProvider.formatDetails!({
      provider: "opencode",
      label: "OpenCode",
      rolling: { usedPercent: 100, status: "rate-limited", resetAt },
      source: "opencode-usage-api",
    });
    expect(details).toContain("Rolling: 100% used [rate-limited]");
    // Reset times are stored as epoch seconds, so the rendered ISO is second-precision.
    expect(details).toContain(`(${new Date(resetAt * 1000).toISOString()})`);
    expect(details).toContain("Source: opencode-usage-api");
  });

  it("explains a probe fallback in details", () => {
    const details = opencodeProvider.formatDetails!({
      provider: "opencode",
      label: "OpenCode",
      rolling: { usedPercent: 25 },
      source: "opencode-probe",
      fallbackReason: "http403: OpenCode usage forbidden",
      probeModel: "kimi-k2.6",
    });
    expect(details).toContain("Fallback: usage endpoint failed (http403");
    expect(details).toContain("Probed: kimi-k2.6");
  });
});

describe("provider module surface", () => {
  it("no longer ships the dashboard scrape path", async () => {
    const mod = (await import("../src/providers/opencode.js")) as Record<string, unknown>;
    expect(mod.parseOpencodeDashboard).toBeUndefined();
  });

  it("ignores legacy dashboard-scrape env vars and only GETs the usage endpoint", async () => {
    vi.stubEnv("OPENCODE_GO_WORKSPACE_ID", "wrk_legacy");
    vi.stubEnv("OPENCODE_GO_AUTH_COOKIE", "session=legacy-secret");
    vi.stubEnv("OPENCODE_GO_QUOTA_CONFIG", "/tmp/legacy-quota.json");
    const spy = mockFetch({ "/zen/go/v1/usage": () => jsonResponse(liveUsageResponse) });
    const data = await opencodeProvider.fetch({
      modelRegistry: fakeModelRegistry({ "opencode-go": "sk-live" }),
    });
    expect(data.source).toBe("opencode-usage-api");
    expect(spy).toHaveBeenCalledTimes(1);
    const [input, init] = spy.mock.calls[0]!;
    expect(String(input)).toBe("https://opencode.ai/zen/go/v1/usage");
    const request = (init ?? {}) as RequestInit;
    expect(request.method ?? "GET").toBe("GET");
    const headers = (request.headers ?? {}) as Record<string, string>;
    expect(JSON.stringify(headers)).not.toContain("legacy-secret");
    expect(JSON.stringify(headers)).not.toContain("wrk_legacy");
  });
});
