import { describe, expect, it } from "vitest";
import {
  cursorProvider,
  pickTeamMember,
  resolveCursorPercentages,
  getTeamMemberSpendList,
} from "../src/providers/cursor.js";
import { stubTheme } from "./helpers.js";

describe("resolveCursorPercentages", () => {
  it("passes through explicit rounded percentages", () => {
    const r = resolveCursorPercentages({
      totalPercentUsed: 71.34,
      autoPercentUsed: 92.71,
      apiPercentUsed: 0.2,
    });
    expect(r).toEqual({ totalPercentUsed: 71.3, autoPercentUsed: 92.7, apiPercentUsed: 0.2 });
  });

  it("derives total from included/limit spend when totalPercentUsed is missing", () => {
    const r = resolveCursorPercentages({
      autoPercentUsed: 10,
      apiPercentUsed: 0,
      includedSpendCents: 750,
      limitCents: 1000,
    });
    expect(r.totalPercentUsed).toBe(75);
  });

  it("falls back total to max(auto, api) when no spend fields", () => {
    const r = resolveCursorPercentages({ autoPercentUsed: 30, apiPercentUsed: 5 });
    expect(r.totalPercentUsed).toBe(30);
  });

  it("treats non-finite values as zero", () => {
    const r = resolveCursorPercentages({ autoPercentUsed: "nope", apiPercentUsed: undefined });
    expect(r.autoPercentUsed).toBe(0);
    expect(r.apiPercentUsed).toBe(0);
  });
});

describe("getTeamMemberSpendList / pickTeamMember", () => {
  it("reads teamMemberSpend or spend", () => {
    expect(getTeamMemberSpendList({ teamMemberSpend: [1] })).toEqual([1]);
    expect(getTeamMemberSpendList({ spend: [2] })).toEqual([2]);
    expect(getTeamMemberSpendList({})).toEqual([]);
  });

  it("picks by preferred email (case-insensitive)", () => {
    const members = [{ email: "A@x.com" }, { email: "b@x.com" }];
    expect(pickTeamMember(members, "a@x.com")?.email).toBe("A@x.com");
  });

  it("returns the only member when no email match", () => {
    expect(pickTeamMember([{ email: "a@x.com" }], "z@x.com")?.email).toBe("a@x.com");
  });

  it("returns undefined when multiple members and no match", () => {
    expect(
      pickTeamMember([{ email: "a@x.com" }, { email: "b@x.com" }], "z@x.com"),
    ).toBeUndefined();
  });
});

describe("cursorProvider", () => {
  it("matches cursor* providers", () => {
    expect(cursorProvider.match("cursor")).toBe(true);
    expect(cursorProvider.match("cursor-small")).toBe(true);
    expect(cursorProvider.match("zai")).toBe(false);
  });

  it("renders total/auto/api percentages", () => {
    const line = cursorProvider.renderStatus!(
      {
        provider: "cursor",
        label: "Cursor",
        totalPercentUsed: 71.3,
        autoPercentUsed: 92.7,
        apiPercentUsed: 0.2,
        source: "cursor-dashboard-api",
      },
      stubTheme,
    );
    expect(line).toContain("71.3%");
    expect(line).toContain("92.7%");
    expect(line).toContain("0.2%");
    expect(line).toContain("Auto");
    expect(line).toContain("API");
  });
});
