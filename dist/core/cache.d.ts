/**
 * pi-usage-unified — usage cache.
 *
 * Per-provider TTL cache. The core owns a single instance keyed by provider
 * id; each provider may override the default TTL (60s) via `ttlMs`.
 */
import type { FetchContext, UsageProvider } from "./types.js";
export declare class UsageCache {
    private readonly state;
    /** Drop one provider's cached entry, or everything when no id is given. */
    clear(provider?: string): void;
    /**
     * Return cached data if fresh, otherwise call the provider's `fetch`,
     * cache the result, and return it. `force` bypasses the TTL once.
     */
    get<TData>(provider: UsageProvider<TData>, ctx: FetchContext, force?: boolean): Promise<TData>;
}
/** Create a fresh empty cache. */
export declare function createCache(): UsageCache;
//# sourceMappingURL=cache.d.ts.map