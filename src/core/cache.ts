/**
 * pi-usage-unified — usage cache.
 *
 * Per-provider TTL cache. The core owns a single instance keyed by provider
 * id; each provider may override the default TTL (60s) via `ttlMs`.
 */
import type { FetchContext, UsageProvider } from "./types.js";

interface CacheEntry<TData> {
  data: TData;
  fetchedAt: number;
}

const DEFAULT_TTL_MS = 60_000;

export class UsageCache {
  private readonly state = new Map<string, CacheEntry<unknown>>();

  /** Drop one provider's cached entry, or everything when no id is given. */
  clear(provider?: string): void {
    if (provider) this.state.delete(provider);
    else this.state.clear();
  }

  /**
   * Return cached data if fresh, otherwise call the provider's `fetch`,
   * cache the result, and return it. `force` bypasses the TTL once.
   */
  async get<TData>(
    provider: UsageProvider<TData>,
    ctx: FetchContext,
    force = false,
  ): Promise<TData> {
    const cached = this.state.get(provider.id) as CacheEntry<TData> | undefined;
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
export function createCache(): UsageCache {
  return new UsageCache();
}
