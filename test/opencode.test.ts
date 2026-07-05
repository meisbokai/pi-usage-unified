import { describe, expect, it } from "vitest";
import {
  numberHeader,
  normalizeOpencodeWindow,
  parseOpencodeDashboard,
  opencodeProvider,
} from "../src/providers/opencode.js";
import { stubTheme } from "./helpers.js";

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

describe("parseOpencodeDashboard", () => {
  it("parses rolling/weekly/monthly percentages", () => {
    const d = parseOpencodeDashboard({ rollingUsage: 10, weeklyUsage: 20, monthlyUsage: 30 });
    expect(d).toEqual({ rolling: 10, weekly: 20, monthly: 30 });
  });

  it("returns undefined when all values are missing", () => {
    expect(parseOpencodeDashboard({})).toBeUndefined();
  });
});

describe("opencodeProvider", () => {
  it("matches opencode* providers", () => {
    expect(opencodeProvider.match("opencode")).toBe(true);
    expect(opencodeProvider.match("opencode-go")).toBe(true);
    expect(opencodeProvider.match("openai")).toBe(false);
  });

  it("renders rolling/weekly/monthly probe windows", () => {
    const line = opencodeProvider.renderStatus!(
      {
        provider: "opencode",
        label: "OpenCode",
        rolling: { usedPercent: 10 },
        weekly: { usedPercent: 20 },
        monthly: { usedPercent: 30 },
        source: "opencode-probe",
        probeModel: "kimi-k2.6",
      },
      stubTheme,
    );
    expect(line).toContain("R 10%");
    expect(line).toContain("W 20%");
    expect(line).toContain("M 30%");
  });

  it("renders dashboard windows alongside probe windows when present", () => {
    const line = opencodeProvider.renderStatus!(
      {
        provider: "opencode",
        label: "OpenCode",
        rolling: { usedPercent: 1 },
        dashboard: { rolling: 2, weekly: 3 },
        source: "opencode-probe",
        probeModel: "kimi-k2.6",
      },
      stubTheme,
    );
    expect(line).toContain("R 2%");
    expect(line).toContain("W 3%");
  });
});
