/**
 * pi-usage-unified — provider plugin registry.
 *
 * Providers register themselves with a stable id. The core resolves the active
 * provider from `ctx.model.provider` on each lifecycle event. Adding a
 * provider is one new file + one `registerProvider()` call in
 * `src/providers/index.ts`.
 */
import type { UsageProvider } from "./types.js";
type ErasedUsageProvider = UsageProvider<any>;
export declare class ProviderRegistry {
    private readonly providers;
    private readonly order;
    /** Register (or replace) a provider definition by id. */
    registerProvider<T>(def: UsageProvider<T>): void;
    /** Look up a provider definition by id. */
    get(id: string): ErasedUsageProvider | undefined;
    /** All registered providers, in registration order. */
    list(): ErasedUsageProvider[];
    /**
     * Resolve the active provider for a model. The provider string is lowercased
     * before being passed to each provider's `match` (in registration order);
     * the first match wins.
     */
    resolve(provider: string | undefined): ErasedUsageProvider | undefined;
}
/** Create a fresh empty registry. */
export declare function createRegistry(): ProviderRegistry;
export {};
//# sourceMappingURL=registry.d.ts.map