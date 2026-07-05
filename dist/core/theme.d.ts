import type { ColorThresholds, Theme } from "./types.js";
/** Pi TUI theme color names (mirrors @earendil-works/pi-tui ThemeColor). */
export type ThemeColor = "accent" | "border" | "borderAccent" | "borderMuted" | "success" | "error" | "warning" | "muted" | "dim" | "text" | "thinkingText" | "userMessageText" | "customMessageText" | "customMessageLabel" | "toolTitle" | "toolOutput" | "mdHeading" | "mdLink" | "mdLinkUrl" | "mdCode" | "mdCodeBlock" | "mdCodeBlockBorder" | "mdQuote" | "mdQuoteBorder" | "mdHr" | "mdListBullet" | "toolDiffAdded" | "toolDiffRemoved" | "toolDiffContext" | "syntaxComment" | "syntaxKeyword" | "syntaxFunction" | "syntaxVariable" | "syntaxString" | "syntaxNumber" | "syntaxType" | "syntaxOperator" | "syntaxPunctuation" | "thinkingOff" | "thinkingMinimal" | "thinkingLow" | "thinkingMedium" | "thinkingHigh" | "thinkingXhigh" | "bashMode";
/** Default color thresholds used when no user overrides are present. */
export declare const DEFAULT_COLOR_THRESHOLDS: ColorThresholds;
/** Filename for user-managed settings, relative to the home directory. */
export declare const SETTINGS_RELATIVE_PATH = ".pi/agent/usage-lib.json";
/** Resolve the absolute path to the user settings file. */
export declare function getSettingsFilePath(): string;
/** Merge a partial set of user overrides into the defaults (unknown keys ignored). */
export declare function mergeThresholds(defaults: ColorThresholds, overrides: unknown): ColorThresholds;
/**
 * Load color thresholds from `~/.pi/agent/usage-lib.json`, merged with the
 * defaults. Read once per process and cached. Returns the defaults when the
 * file is missing, unreadable, or contains invalid JSON.
 */
export declare function loadColorThresholds(): ColorThresholds;
/** Reset the internal cache so the next load re-reads the settings file. */
export declare function resetThresholdsCache(): void;
/** Apply a theme color, returning the text unchanged if the theme is missing. */
export declare function fg(theme: Theme | undefined, color: ThemeColor, text: string): string;
/**
 * Color function for a percentage-based usage value.
 * - accent when ≤ warning threshold
 * - warning (yellow) when > warning threshold
 * - error (red) when ≥ critical threshold
 */
export declare function colorForPercentage(percentage: number, theme: Theme, thresholds?: ColorThresholds): (text: string) => string;
/**
 * Color function for a credit / monetary balance value (USD).
 * - accent when ≥ warning threshold
 * - warning (yellow) when < warning threshold
 * - error (red) when ≤ critical threshold
 */
export declare function colorForCredit(credit: number, theme: Theme, thresholds?: ColorThresholds): (text: string) => string;
//# sourceMappingURL=theme.d.ts.map