/**
 * Z.ai / GLM usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * - Auth: API key, providers `zai` / `glm` / `zai-coding-cn`
 * - Endpoint: GET https://api.z.ai/api/monitor/usage/quota/limit
 * - Parse: every entry in `data.limits` mapped by its `unit` code to a
 *   human label, then rendered in fixed order [5h, Weekly, Tools].
 *
 * The API returns three quotas we care about:
 *   unit=3  TOKENS_LIMIT  → 5-hour token limit   (label: "5h")
 *   unit=6  TOKENS_LIMIT  → weekly token limit   (label: "Weekly")
 *   unit=5  TIME_LIMIT    → tool-call limit      (label: "Tools")
 * Unknown `unit` codes are ignored so the footer survives API additions.
 */
import type { UsageProvider } from "../core/types.js";
export interface ZaiLimitData {
    /** Human label, e.g. "5h", "Weekly", "Tools". */
    label: string;
    /** Percent of the limit consumed (0–100). */
    usedPercent: number;
    /** Epoch seconds when the limit resets, or undefined if unknown. */
    resetAt?: number;
}
export interface ZaiUsageData {
    provider: "zai";
    label: string;
    /** All known limits, in fixed display order [5h, Weekly, Tools]. */
    limits: ZaiLimitData[];
    source: string;
}
/**
 * Parse a Z.ai quota response. Pure function — exposed for unit tests.
 *
 * Throws UsageError("nolimit") when no recognized limit is present, and
 * UsageError(`api{code}`) when the API returns `success: false`.
 */
export declare function parseZaiUsage(parsed: any): ZaiUsageData;
export declare const zaiProvider: UsageProvider<ZaiUsageData>;
//# sourceMappingURL=zai.d.ts.map