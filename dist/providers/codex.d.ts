/**
 * OpenAI Codex usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * - Auth: OAuth token provider `openai-codex`; account id from
 *   `~/.pi/agent/auth.json` `openai-codex.accountId`
 * - Endpoints: GET https://chatgpt.com/backend-api/codex/usage then fallback
 *   /wham/usage; sends header `chatgpt-account-id`
 * - Output: primary (5h) + secondary (weekly) `used_percent`, reset times,
 *   plan, credits
 */
import type { UsageProvider } from "../core/types.js";
export interface CodexWindow {
    usedPercent: number;
    resetAt?: number;
    windowSeconds?: number;
}
export interface CodexUsageData {
    provider: "codex";
    label: string;
    primary?: CodexWindow;
    secondary?: CodexWindow;
    plan?: string;
    email?: string;
    credits?: string;
    source: string;
}
/** Normalize one rate-limit window. Returns undefined when used_percent is missing. */
export declare function normalizeCodexWindow(window: any): CodexWindow | undefined;
/** Parse a Codex usage API response into the normalized shape. Pure — unit tested. */
export declare function normalizeCodexUsage(api: any, endpoint: string): CodexUsageData;
/** Read the OpenAI Codex account id from pi's auth.json. */
export declare function readCodexAccountId(): string | undefined;
export declare const codexProvider: UsageProvider<CodexUsageData>;
//# sourceMappingURL=codex.d.ts.map