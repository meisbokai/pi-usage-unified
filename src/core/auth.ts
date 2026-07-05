/**
 * pi-usage-unified — 3-way sandbox-aware auth headers.
 *
 * Strategy (ported from @alexanderfortin/pi-usage-lib `buildAuthHeaders` and
 * the monolithic pi-usage-multi.ts `authHeaders`):
 *
 * 1. Real key present  → send `Authorization: Bearer <key>`
 * 2. Key is the `"proxy-managed"` sentinel → don't set auth (the Docker
 *    sandbox proxy injects the real header itself)
 * 3. No key            → don't set auth (the API will 401, surfaced as error)
 *
 * Always sets `Accept-Encoding: identity` to work around undici's
 * EnvHttpProxyAgent gzip decompression issue (pi v0.75.0+).
 */
import type { ModelRegistry } from "@earendil-works/pi-coding-agent";

/** Sentinel injected by the Docker Sandbox proxy for proxy-managed env vars. */
export const PROXY_MANAGED_SENTINEL = "proxy-managed";

type AuthModelRegistry = Pick<ModelRegistry, "getApiKeyForProvider">;

/**
 * Resolve an API key by trying a list of provider names in order, returning the
 * first non-empty trimmed value. Errors from `getApiKeyForProvider` are
 * swallowed so a missing/unconfigured provider doesn't abort the lookup.
 */
export async function getApiKey(
  modelRegistry: AuthModelRegistry,
  providerNames: string[],
): Promise<string | undefined> {
  for (const provider of providerNames) {
    try {
      const key = await modelRegistry.getApiKeyForProvider(provider);
      if (key?.trim()) return key.trim();
    } catch {
      /* try next provider */
    }
  }
  return undefined;
}

/**
 * Build authenticated headers using the 3-way sandbox-aware strategy.
 *
 * Accepts either a single provider name or a list (the list form lets a
 * provider fall back across aliases, e.g. zai → glm → zai-coding-cn).
 *
 * @param extra extra headers to merge in (e.g. `Content-Type`)
 */
export async function buildAuthHeaders(
  modelRegistry: AuthModelRegistry,
  providerNames: string | string[],
  extra: Record<string, string> = {},
): Promise<Record<string, string>> {
  const names = Array.isArray(providerNames) ? providerNames : [providerNames];
  const key = await getApiKey(modelRegistry, names);
  const headers: Record<string, string> = {
    "Accept-Encoding": "identity",
    ...extra,
  };
  if (key && key !== PROXY_MANAGED_SENTINEL) {
    headers.Authorization = `Bearer ${key}`;
  }
  return headers;
}
