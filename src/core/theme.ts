/**
 * pi-usage-unified — theme helpers and color thresholds.
 *
 * `colorForPercentage` and `colorForCredit` return a TUI color function for a
 * given value, so providers can highlight usage approaching limits. Thresholds
 * default to built-in values but can be overridden via the user-managed file
 * `~/.pi/agent/usage-lib.json` (same format/location as
 * @alexanderfortin/pi-usage-lib, so settings are shared).
 */
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { ColorThresholds, Theme } from "./types.js";

/** Pi TUI theme color names (mirrors @earendil-works/pi-tui ThemeColor). */
export type ThemeColor =
  | "accent" | "border" | "borderAccent" | "borderMuted" | "success"
  | "error" | "warning" | "muted" | "dim" | "text" | "thinkingText"
  | "userMessageText" | "customMessageText" | "customMessageLabel"
  | "toolTitle" | "toolOutput" | "mdHeading" | "mdLink" | "mdLinkUrl"
  | "mdCode" | "mdCodeBlock" | "mdCodeBlockBorder" | "mdQuote"
  | "mdQuoteBorder" | "mdHr" | "mdListBullet" | "toolDiffAdded"
  | "toolDiffRemoved" | "toolDiffContext" | "syntaxComment"
  | "syntaxKeyword" | "syntaxFunction" | "syntaxVariable"
  | "syntaxString" | "syntaxNumber" | "syntaxType" | "syntaxOperator"
  | "syntaxPunctuation" | "thinkingOff" | "thinkingMinimal"
  | "thinkingLow" | "thinkingMedium" | "thinkingHigh" | "thinkingXhigh"
  | "bashMode";

/** Default color thresholds used when no user overrides are present. */
export const DEFAULT_COLOR_THRESHOLDS: ColorThresholds = {
  percentage: { warning: 80, critical: 90 },
  credit: { warning: 5, critical: 1 },
};

/** Filename for user-managed settings, relative to the home directory. */
export const SETTINGS_RELATIVE_PATH = ".pi/agent/usage-lib.json";

/** Resolve the absolute path to the user settings file. */
export function getSettingsFilePath(): string {
  return join(homedir(), SETTINGS_RELATIVE_PATH);
}

function pickNumber(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

/** Merge a partial set of user overrides into the defaults (unknown keys ignored). */
export function mergeThresholds(
  defaults: ColorThresholds,
  overrides: unknown,
): ColorThresholds {
  const o = (overrides ?? {}) as {
    percentage?: { warning?: unknown; critical?: unknown };
    credit?: { warning?: unknown; critical?: unknown };
  };
  return {
    percentage: {
      warning: pickNumber(o.percentage?.warning, defaults.percentage.warning),
      critical: pickNumber(o.percentage?.critical, defaults.percentage.critical),
    },
    credit: {
      warning: pickNumber(o.credit?.warning, defaults.credit.warning),
      critical: pickNumber(o.credit?.critical, defaults.credit.critical),
    },
  };
}

let cachedThresholds: ColorThresholds | null = null;

/**
 * Load color thresholds from `~/.pi/agent/usage-lib.json`, merged with the
 * defaults. Read once per process and cached. Returns the defaults when the
 * file is missing, unreadable, or contains invalid JSON.
 */
export function loadColorThresholds(): ColorThresholds {
  if (cachedThresholds) return cachedThresholds;
  let fileContent: string;
  try {
    fileContent = readFileSync(getSettingsFilePath(), "utf-8");
  } catch {
    cachedThresholds = { ...DEFAULT_COLOR_THRESHOLDS };
    return cachedThresholds;
  }
  let parsed: any;
  try {
    parsed = JSON.parse(fileContent);
  } catch {
    cachedThresholds = { ...DEFAULT_COLOR_THRESHOLDS };
    return cachedThresholds;
  }
  cachedThresholds = mergeThresholds(DEFAULT_COLOR_THRESHOLDS, parsed?.thresholds);
  return cachedThresholds;
}

/** Reset the internal cache so the next load re-reads the settings file. */
export function resetThresholdsCache(): void {
  cachedThresholds = null;
}

/** Apply a theme color, returning the text unchanged if the theme is missing. */
export function fg(theme: Theme | undefined, color: ThemeColor, text: string): string {
  return theme?.fg ? theme.fg(color, text) : text;
}

/**
 * Color function for a percentage-based usage value.
 * - accent when ≤ warning threshold
 * - warning (yellow) when > warning threshold
 * - error (red) when ≥ critical threshold
 */
export function colorForPercentage(
  percentage: number,
  theme: Theme,
  thresholds: ColorThresholds = loadColorThresholds(),
): (text: string) => string {
  if (percentage >= thresholds.percentage.critical) return (s) => fg(theme, "error", s);
  if (percentage > thresholds.percentage.warning) return (s) => fg(theme, "warning", s);
  return (s) => fg(theme, "accent", s);
}

/**
 * Color function for a credit / monetary balance value (USD).
 * - accent when ≥ warning threshold
 * - warning (yellow) when < warning threshold
 * - error (red) when ≤ critical threshold
 */
export function colorForCredit(
  credit: number,
  theme: Theme,
  thresholds: ColorThresholds = loadColorThresholds(),
): (text: string) => string {
  if (credit <= thresholds.credit.critical) return (s) => fg(theme, "error", s);
  if (credit < thresholds.credit.warning) return (s) => fg(theme, "warning", s);
  return (s) => fg(theme, "accent", s);
}
