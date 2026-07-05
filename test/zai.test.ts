import { describe, expect, it } from "vitest";
import { parseZaiUsage, zaiProvider } from "../src/providers/zai.js";
import { UsageError } from "../src/core/http.js";
import { stubTheme } from "./helpers.js";

const zaiFixture = {
  success: true,
  code: 0,
  msg: "ok",
  data: {
    limits: [
      { type: "TOKENS_LIMIT", percentage: 71.34, nextResetTime: "1735689600000" },
      { type: "OTHER", percentage: 12 },
    ],
  },
};

describe("parseZaiUsage", () => {
  it("extracts the TOKENS_LIMIT percentage and normalizes the reset time to epoch seconds", () => {
    const data = parseZaiUsage(zaiFixture);
    expect(data.provider).toBe("zai");
    expect(data.usedPercent).toBe(71.34);
    expect(data.resetAt).toBe(1735689600);
    expect(data.source).toBe("zai-api");
  });

  it("throws UsageError(nolimit) when TOKENS_LIMIT is missing", () => {
    expect(() => parseZaiUsage({ success: true, data: { limits: [] } })).toThrow(UsageError);
    let caught: unknown;
    try {
      parseZaiUsage({ success: true, data: { limits: [] } });
    } catch (e) {
      caught = e;
    }
    expect((caught as UsageError).code).toBe("nolimit");
  });

  it("throws when the API returns success: false", () => {
    expect(() => parseZaiUsage({ success: false, code: 401, msg: "unauthorized" })).toThrow(
      UsageError,
    );
  });

  it("omits resetAt when nextResetTime is absent", () => {
    const data = parseZaiUsage({
      success: true,
      data: { limits: [{ type: "TOKENS_LIMIT", percentage: 5 }] },
    });
    expect(data.resetAt).toBeUndefined();
  });
});

describe("zaiProvider", () => {
  it("matches glm and zai* providers", () => {
    expect(zaiProvider.match("glm")).toBe(true);
    expect(zaiProvider.match("zai")).toBe(true);
    expect(zaiProvider.match("zai-coding-cn")).toBe(true);
    expect(zaiProvider.match("cursor")).toBe(false);
  });

  it("renders a footer line containing the percentage", () => {
    const data = parseZaiUsage(zaiFixture);
    const line = zaiProvider.renderStatus!(data, stubTheme);
    expect(line).toContain("71.3%");
    expect(line).toContain("Z.ai");
  });

  it("formatDetails lists tokens, reset, and source", () => {
    const data = parseZaiUsage(zaiFixture);
    const details = zaiProvider.formatDetails!(data);
    expect(details).toContain("Tokens: 71.3% used");
    expect(details).toContain("Resets in:");
    expect(details).toContain("Source: zai-api");
  });
});
