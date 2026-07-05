/**
 * pi-usage-unified — provider plugin registry.
 *
 * Providers register themselves with a stable id. The core resolves the active
 * provider from `ctx.model.provider` on each lifecycle event. Adding a
 * provider is one new file + one `registerProvider()` call in
 * `src/providers/index.ts`.
 */
import type { UsageProvider } from "./types.js";

// Providers are stored erased of their data type parameter: a
// UsageProvider<ZaiUsageData> is not assignable to UsageProvider<unknown>
// (function parameters are contravariant), so we erase to `any` on insert.
type ErasedUsageProvider = UsageProvider<any>;

export class ProviderRegistry {
  private readonly providers = new Map<string, ErasedUsageProvider>();
  private readonly order: string[] = [];

  /** Register (or replace) a provider definition by id. */
  registerProvider<T>(def: UsageProvider<T>): void {
    if (!this.providers.has(def.id)) this.order.push(def.id);
    this.providers.set(def.id, def as ErasedUsageProvider);
  }

  /** Look up a provider definition by id. */
  get(id: string): ErasedUsageProvider | undefined {
    return this.providers.get(id);
  }

  /** All registered providers, in registration order. */
  list(): ErasedUsageProvider[] {
    return this.order.map((id) => this.providers.get(id)!);
  }

  /**
   * Resolve the active provider for a model. The provider string is lowercased
   * before being passed to each provider's `match` (in registration order);
   * the first match wins.
   */
  resolve(provider: string | undefined): ErasedUsageProvider | undefined {
    if (!provider) return undefined;
    const lower = provider.toLowerCase();
    for (const def of this.list()) {
      if (def.match(lower)) return def;
    }
    return undefined;
  }
}

/** Create a fresh empty registry. */
export function createRegistry(): ProviderRegistry {
  return new ProviderRegistry();
}
