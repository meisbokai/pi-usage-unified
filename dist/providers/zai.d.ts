/**
 * Z.ai / GLM usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * - Auth: API key, providers `zai` / `glm` / `zai-coding-cn`
 * - Endpoint: GET https://api.z.ai/api/monitor/usage/quota/limit
 * - Parse: `data.limits` find `type === "TOKENS_LIMIT"` → percentage + nextResetTime
 */
import type { UsageProvider } from "../core/types.js";
export interface ZaiUsageData {
    provider: "zai";
    label: string;
    usedPercent: number;
    resetAt?: number;
    source: string;
}
/**
 * Parse a Z.ai quota response. Pure function — exposed for unit tests.
 *
 * Throws UsageError("nolimit") when no TOKENS_LIMIT is present, and
 * UsageError(`api{code}`) when the API returns `success: false`.
 */
export declare function parseZaiUsage(parsed: any): ZaiUsageData;
export declare const zaiProvider: UsageProvider<ZaiUsageData>;
//# sourceMappingURL=zai.d.ts.map