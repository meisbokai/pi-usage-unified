const DEFAULT_TTL_MS = 60_000;
export class UsageCache {
    state = new Map();
    /** Drop one provider's cached entry, or everything when no id is given. */
    clear(provider) {
        if (provider)
            this.state.delete(provider);
        else
            this.state.clear();
    }
    /**
     * Return cached data if fresh, otherwise call the provider's `fetch`,
     * cache the result, and return it. `force` bypasses the TTL once.
     */
    async get(provider, ctx, force = false) {
        const cached = this.state.get(provider.id);
        const now = Date.now();
        const ttl = provider.ttlMs ?? DEFAULT_TTL_MS;
        if (!force && cached?.data && now - cached.fetchedAt < ttl) {
            return cached.data;
        }
        const data = await provider.fetch(ctx);
        this.state.set(provider.id, { data, fetchedAt: now });
        return data;
    }
}
/** Create a fresh empty cache. */
export function createCache() {
    return new UsageCache();
}
//# sourceMappingURL=cache.js.map