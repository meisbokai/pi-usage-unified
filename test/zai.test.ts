import { describe, expect, it } from "vitest";
import { parseZaiUsage, zaiProvider } from "../src/providers/zai.js";
import { UsageError } from "../src/core/http.js";
import { stubTheme } from "./helpers.js";

/** Minimal 1-limit fixture (legacy shape) — keeps the simplest case honest. */
const singleLimitFixture = {
  success: true,
  code: 0,
  msg: "ok",
  data: {
    limits: [{ type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 71.34, nextResetTime: "1735689600000" }],
  },
};

/** Real-shaped fixture with all three quotas (5h, weekly, tools). */
const fullFixture = {
  success: true,
  code: 200,
  msg: "Operation successful",
  data: {
    limits: [
      { type: "TOKENS_LIMIT", unit: 3, number: 5, percentage: 1, nextResetTime: 1783589341669 },
      { type: "TOKENS_LIMIT", unit: 6, number: 1, percentage: 92, nextResetTime: 1783841594996 },
      {
        type: "TIME_LIMIT",
        unit: 5,
        number: 1,
        usage: 4000,
        currentValue: 119,
        remaining: 3881,
        percentage: 2,
        nextResetTime: 1785223994983,
        usageDetails: [
          { modelCode: "search-prime", usage: 70 },
          { modelCode: "web-reader", usage: 49 },
          { modelCode: "zread", usage: 0 },
        ],
      },
    ],
    level: "max",
  },
};

describe("parseZaiUsage", () => {
  it("extracts the 5h TOKENS_LIMIT and normalizes the reset time to epoch seconds", () => {
    const data = parseZaiUsage(singleLimitFixture);
    expect(data.provider).toBe("zai");
    expect(data.limits).toHaveLength(1);
    expect(data.limits[0]).toMatchObject({ label: "5h", usedPercent: 71.34, resetAt: 1735689600 });
    expect(data.source).toBe("zai-api");
  });

  it("extracts all three limits (5h, Weekly, Tools) and orders them", () => {
    const data = parseZaiUsage(fullFixture);
    expect(data.limits.map((l) => l.label)).toEqual(["5h", "Weekly", "Tools"]);
    expect(data.limits[0]).toMatchObject({ label: "5h", usedPercent: 1 });
    expect(data.limits[1]).toMatchObject({ label: "Weekly", usedPercent: 92 });
    expect(data.limits[2]).toMatchObject({ label: "Tools", usedPercent: 2 });
  });

  it("preserves the 5h/Weekly/Tools order even when the API returns Weekly first", () => {
    const reordered = {
      success: true,
      data: {
        limits: [
          fullFixture.data.limits[1], // Weekly first
          fullFixture.data.limits[0], // 5h second
          fullFixture.data.limits[2], // Tools third
        ],
      },
    };
    const data = parseZaiUsage(reordered);
    expect(data.limits.map((l) => l.label)).toEqual(["5h", "Weekly", "Tools"]);
  });

  it("ignores unknown unit codes", () => {
    const data = parseZaiUsage({
      success: true,
      data: {
        limits: [
          { type: "TOKENS_LIMIT", unit: 3, percentage: 10 },
          { type: "TOKENS_LIMIT", unit: 99, percentage: 77 }, // unknown
          { type: "TIME_LIMIT", unit: 5, percentage: 3 },
        ],
      },
    });
    expect(data.limits.map((l) => l.label)).toEqual(["5h", "Tools"]);
    expect(data.limits.map((l) => l.usedPercent)).toEqual([10, 3]);
  });

  it("throws UsageError(nolimit) when no recognized limit is present", () => {
    expect(() => parseZaiUsage({ success: true, data: { limits: [] } })).toThrow(UsageError);
    expect(() =>
      parseZaiUsage({ success: true, data: { limits: [{ type: "OTHER", unit: 99, percentage: 1 }] } }),
    ).toThrow(UsageError);
    let caught: unknown;
    try {
      parseZaiUsage({ success: true, data: { limits: [] } });
    } catch (e) {
      caught = e;
    }
    expect((caught as UsageError).code).toBe("nolimit");
  });

  it("throws when the API returns success: false", () => {
    expect(() => parseZaiUsage({ success: false, code: 401, msg: "unauthorized" })).toThrow(UsageError);
  });

  it("omits resetAt when nextResetTime is absent", () => {
    const data = parseZaiUsage({
      success: true,
      data: { limits: [{ type: "TOKENS_LIMIT", unit: 3, percentage: 5 }] },
    });
    expect(data.limits[0].resetAt).toBeUndefined();
  });

  it("skips entries with non-finite percentages", () => {
    const data = parseZaiUsage({
      success: true,
      data: {
        limits: [
          { type: "TOKENS_LIMIT", unit: 3, percentage: 10 },
          { type: "TOKENS_LIMIT", unit: 6 /* no percentage */ },
        ],
      },
    });
    expect(data.limits.map((l) => l.label)).toEqual(["5h"]);
  });
});

describe("zaiProvider", () => {
  it("matches glm and zai* providers", () => {
    expect(zaiProvider.match("glm")).toBe(true);
    expect(zaiProvider.match("zai")).toBe(true);
    expect(zaiProvider.match("zai-coding-cn")).toBe(true);
    expect(zaiProvider.match("cursor")).toBe(false);
  });

  it("renders a footer line with all three limits, comma-separated", () => {
    const data = parseZaiUsage(fullFixture);
    const line = zaiProvider.renderStatus!(data, stubTheme);
    expect(line).toContain("Z.ai");
    expect(line).toContain("1% used");
    expect(line).toContain("92% used");
    expect(line).toContain("2% used");
    // Each entry is "<pct>% used" optionally followed by a " (<dur>)" parens.
    // Duration forms: "4h 40m", "3d 2h", "3d", "5m".
    expect(line).toMatch(/1% used \(\d+[hm](?:\s\d+[hm])?\)/);
    expect(line).toMatch(/92% used \(\d+d(?:\s\d+h)?\)/);
    expect(line).toMatch(/2% used \(\d+d(?:\s\d+h)?\)/);
  });

  it("renders a footer line for a single-limit response (5h only)", () => {
    const data = parseZaiUsage(singleLimitFixture);
    const line = zaiProvider.renderStatus!(data, stubTheme);
    expect(line).toContain("71.3%");
    expect(line).toContain("Z.ai");
  });

  it("formatDetails lists every limit with label, percentage, and reset", () => {
    const data = parseZaiUsage(fullFixture);
    const details = zaiProvider.formatDetails!(data);
    expect(details).toContain("5h: 1% used");
    expect(details).toContain("Weekly: 92% used");
    expect(details).toContain("Tools: 2% used");
    expect(details).toContain("resets in");
    expect(details).toContain("Source: zai-api");
  });
});
