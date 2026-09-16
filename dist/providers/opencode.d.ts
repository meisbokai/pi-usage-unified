/**
 * OpenCode Go usage provider.
 *
 * - Auth: API key provider `opencode-go` / `opencode`, or `OPENCODE_API_KEY`
 *   (pi's auth store is the source of truth — see `../core/auth.ts`)
 * - Primary: GET https://opencode.ai/zen/go/v1/usage — the OpenCode Go usage
 *   API (anomalyco/opencode#16513). It returns rolling / weekly / monthly
 *   windows with `{ status, percent, resetsAt }`, where `resetsAt` is an
 *   absolute ISO-8601 timestamp. This is both cheaper and richer than the old
 *   probe: no chat-completion call is spent and reset times are available.
 * - Fallback: POST https://opencode.ai/zen/go/v1/chat/completions with a
 *   1-token ping; reads rate-limit headers `x-opencode-*-usage-percent`
 *   (rolling/weekly/monthly). Used ONLY when the usage endpoint fails
 *   (network error, 401, 403, 404, 5xx) — never alongside a working endpoint,
 *   and never to mask a response the endpoint did return. The fallback is
 *   recorded in the data (`source` / `fallbackReason`) so `/pi-usage` shows it
 *   rather than silently pretending the endpoint worked.
 *
 * The old dashboard HTML scrape (workspace id + session cookie) is gone: the
 * usage endpoint supersedes it, so no session credentials are needed.
 */
import type { UsageProvider } from "../core/types.js";
export interface OpencodeWindow {
    /** Percent of the window consumed (0–100). */
    usedPercent: number;
    /** API-reported window status; the live API sends `ok` | `rate-limited`. */
    status?: string;
    /** Epoch seconds when the window resets. */
    resetAt?: number;
}
export interface OpencodeUsageData {
    provider: "opencode";
    label: string;
    rolling?: OpencodeWindow;
    weekly?: OpencodeWindow;
    monthly?: OpencodeWindow;
    /** `"opencode-usage-api"` (primary endpoint) or `"opencode-probe"` (fallback). */
    source: string;
    /** Endpoint failure that triggered the probe fallback (fallback runs only). */
    fallbackReason?: string;
    /** Model used by the fallback probe (fallback runs only). */
    probeModel?: string;
}
/** Read a numeric header value (case-insensitive) from a Headers-like object. */
export declare function numberHeader(headers: Record<string, string>, name: string): number | undefined;
/** Clamp an opencode window value to 0–100, or undefined when not finite. */
export declare function normalizeOpencodeWindow(value: unknown): number | undefined;
/**
 * Parse an absolute reset timestamp into epoch seconds.
 *
 * The live usage endpoint sends ISO-8601 strings (`"2026-09-16T07:16:35.669Z"`);
 * numeric epoch seconds / milliseconds are also accepted defensively in case
 * the API switches representation. Anything unparseable → undefined.
 */
export declare function normalizeOpencodeResetAt(value: unknown): number | undefined;
/**
 * Normalize one usage window (`{ status, percent, resetsAt }`).
 *
 * Defensive about field names because the endpoint is new: `percent` accepts
 * its camelCase/snake_case variants, `resetsAt` accepts the same family, and a
 * window whose percent is missing/renamed is dropped rather than crashing —
 * except when `status` says the window is exhausted, in which case it is
 * reported as 100% used.
 */
export declare function parseOpencodeWindow(raw: any): OpencodeWindow | undefined;
/**
 * Parse a usage-endpoint response into the normalized shape. Pure — unit
 * tested against the live response fixture.
 *
 * Throws `UsageError("nodata")` when no window could be read; a 200 that we
 * cannot parse is surfaced as an error (the probe fallback deliberately does
 * not run for it).
 */
export declare function parseOpencodeUsage(parsed: any): OpencodeUsageData;
/**
 * Endpoint failures that justify falling back to the chat-completion probe.
 * A response the endpoint did return but we could not parse (`nodata`,
 * `badjson`) is NOT in this set: the endpoint is the source of truth and its
 * breakdown must be visible instead of being masked by probe numbers.
 */
export declare function shouldFallbackToProbe(error: unknown): boolean;
export declare const opencodeProvider: UsageProvider<OpencodeUsageData>;
//# sourceMappingURL=opencode.d.ts.map