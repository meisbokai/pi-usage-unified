export class ProviderRegistry {
    providers = new Map();
    order = [];
    /** Register (or replace) a provider definition by id. */
    registerProvider(def) {
        if (!this.providers.has(def.id))
            this.order.push(def.id);
        this.providers.set(def.id, def);
    }
    /** Look up a provider definition by id. */
    get(id) {
        return this.providers.get(id);
    }
    /** All registered providers, in registration order. */
    list() {
        return this.order.map((id) => this.providers.get(id));
    }
    /**
     * Resolve the active provider for a model. The provider string is lowercased
     * before being passed to each provider's `match` (in registration order);
     * the first match wins.
     */
    resolve(provider) {
        if (!provider)
            return undefined;
        const lower = provider.toLowerCase();
        for (const def of this.list()) {
            if (def.match(lower))
                return def;
        }
        return undefined;
    }
}
/** Create a fresh empty registry. */
export function createRegistry() {
    return new ProviderRegistry();
}
//# sourceMappingURL=registry.js.map