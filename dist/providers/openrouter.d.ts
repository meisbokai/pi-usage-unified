/**
 * OpenRouter usage provider. (NEW)
 *
 * - Auth: API key provider `openrouter`, or `OPENROUTER_API_KEY`
 * - Endpoints:
 *   - GET https://openrouter.ai/api/v1/key   (rate limit + spend/limit dollars)
 *   - GET https://openrouter.ai/api/v1/credits (total purchased, total usage)
 * - Output: key-limit %, spend, credit balance ($)
 */
import type { UsageProvider } from "../core/types.js";
export interface OpenRouterUsageData {
    provider: "openrouter";
    label: string;
    /** usage/limit*100 when a spend limit is set. */
    keyUsagePercent?: number;
    /** spend so far this period, in USD. */
    keySpend?: number;
    /** spend limit for the period, in USD. */
    keyLimit?: number;
    /** total_credits - total_usage, in USD. */
    creditBalance?: number;
    source: string;
}
/**
 * Parse an OpenRouter `/api/v1/key` response `{ data: { usage, limit, ... } }`.
 * Pure function — unit tested. Returns undefined fields when data is missing.
 */
export declare function parseOpenRouterKey(parsed: any): {
    keyUsagePercent?: number;
    keySpend?: number;
    keyLimit?: number;
};
/**
 * Parse an OpenRouter `/api/v1/credits` response `{ total_credits, total_usage }`
 * into a credit balance. Pure function — unit tested.
 */
export declare function parseOpenRouterCredits(parsed: any): {
    creditBalance?: number;
};
export declare const openrouterProvider: UsageProvider<OpenRouterUsageData>;
//# sourceMappingURL=openrouter.d.ts.map