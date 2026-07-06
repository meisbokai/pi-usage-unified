/**
 * pi-usage-unified — shared types
 *
 * The provider plugin contract and shared types used by the core and all
 * built-in providers.
 */
import type { ExtensionContext, ModelRegistry } from "@earendil-works/pi-coding-agent";
/** Pi TUI theme — matches ctx.ui.theme. */
export type Theme = ExtensionContext["ui"]["theme"];
/**
 * Context handed to a provider's `fetch()`.
 *
 * `modelRegistry` is narrowed to the only method providers need
 * (`getApiKeyForProvider`) so tests can pass a minimal stub.
 */
export interface FetchContext {
    /** Model registry used to resolve API keys / OAuth tokens. */
    modelRegistry: Pick<ModelRegistry, "getApiKeyForProvider">;
}
/**
 * The provider plugin contract.
 *
 * Adding a provider = implement this interface in a new file under
 * `src/providers/` and add one `registerProvider()` call in
 * `src/providers/index.ts`. The core owns the single footer status key,
 * the cache, and the lifecycle.
 */
export interface UsageProvider<TData = unknown> {
    /** Stable identifier, e.g. `"zai"`. Used as the cache key. */
    id: string;
    /** Human label, e.g. `"Z.ai"`. */
    label: string;
    /**
     * Detect whether this provider is the active one.
     * Receives the lowercased `ctx.model.provider` string (or undefined).
     */
    match: (provider: string | undefined) => boolean;
    /** Cache TTL override (ms). Defaults to 60s when omitted. */
    ttlMs?: number;
    /** Fetch + parse the provider API into a normalized data shape. */
    fetch: (ctx: FetchContext) => Promise<TData>;
    /** Render the single footer status line. */
    renderStatus: (data: TData, theme: Theme) => string;
    /** Optional multi-line breakdown for the `/pi-usage` command. */
    formatDetails?: (data: TData) => string;
    /** Optional themed error line. Falls back to the core's default. */
    renderError?: (error: unknown, theme: Theme) => string;
}
/** Color thresholds for percentage- and credit-based rendering. */
export interface ColorThresholds {
    percentage: {
        warning: number;
        critical: number;
    };
    credit: {
        warning: number;
        critical: number;
    };
}
//# sourceMappingURL=types.d.ts.map