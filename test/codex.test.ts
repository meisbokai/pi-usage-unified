import { describe, expect, it } from "vitest";
import { normalizeCodexUsage, normalizeCodexWindow, codexProvider } from "../src/providers/codex.js";
import { UsageError } from "../src/core/http.js";
import { stubTheme } from "./helpers.js";

const codexFixture = {
  rate_limit: {
    primary_window: { used_percent: 42.5, reset_at: 1735689600, limit_window_seconds: 18000 },
    secondary_window: { used_percent: 10, reset_at: 1735689600 },
  },
  plan_type: "pro",
  email: "user@example.com",
  credits: { balance: "9.99" },
};

describe("normalizeCodexWindow", () => {
  it("parses used_percent and reset_at", () => {
    const w = normalizeCodexWindow({ used_percent: 42.5, reset_at: 1735689600 });
    expect(w?.usedPercent).toBe(42.5);
    expect(w?.resetAt).toBe(1735689600);
  });

  it("clamps used_percent to 0..100", () => {
    expect(normalizeCodexWindow({ used_percent: 250 })?.usedPercent).toBe(100);
    expect(normalizeCodexWindow({ used_percent: -5 })?.usedPercent).toBe(0);
  });

  it("returns undefined when used_percent is missing/non-finite", () => {
    expect(normalizeCodexWindow(undefined)).toBeUndefined();
    expect(normalizeCodexWindow({ reset_at: 1 })).toBeUndefined();
    expect(normalizeCodexWindow({ used_percent: "nope" })).toBeUndefined();
  });

  it("treats millisecond reset timestamps as ms and divides by 1000", () => {
    expect(normalizeCodexWindow({ used_percent: 1, reset_at: 1735689600000 })?.resetAt).toBe(
      1735689600,
    );
  });
});

describe("normalizeCodexUsage", () => {
  it("parses primary + secondary windows, plan, email, credits, source", () => {
    const data = normalizeCodexUsage(codexFixture, "https://chatgpt.com/backend-api/codex/usage");
    expect(data.primary?.usedPercent).toBe(42.5);
    expect(data.secondary?.usedPercent).toBe(10);
    expect(data.plan).toBe("pro");
    expect(data.email).toBe("user@example.com");
    expect(data.credits).toBe("9.99");
    expect(data.source).toBe("codex-api");
  });

  it("marks the wham endpoint source distinctly", () => {
    const data = normalizeCodexUsage(codexFixture, "https://chatgpt.com/backend-api/wham/usage");
    expect(data.source).toBe("codex-wham-api");
  });

  it("throws UsageError(nodata) when neither window is present", () => {
    let caught: unknown;
    try {
      normalizeCodexUsage({ rate_limit: {} }, "codex");
    } catch (e) {
      caught = e;
    }
    expect(caught).toBeInstanceOf(UsageError);
    expect((caught as UsageError).code).toBe("nodata");
  });
});

describe("codexProvider", () => {
  it("matches openai-codex* providers", () => {
    expect(codexProvider.match("openai-codex")).toBe(true);
    expect(codexProvider.match("openai-codex-x")).toBe(true);
    expect(codexProvider.match("openai")).toBe(false);
  });

  it("renders a footer line with 5h and weekly percentages", () => {
    const data = normalizeCodexUsage(codexFixture, "codex");
    const line = codexProvider.renderStatus!(data, stubTheme);
    expect(line).toContain("5h");
    expect(line).toContain("42.5%");
    expect(line).toContain("W");
    expect(line).toContain("10%");
  });
});
