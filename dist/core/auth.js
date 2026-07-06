/** Sentinel injected by the Docker Sandbox proxy for proxy-managed env vars. */
export const PROXY_MANAGED_SENTINEL = "proxy-managed";
/**
 * Resolve an API key by trying a list of provider names in order, returning the
 * first non-empty trimmed value. Errors from `getApiKeyForProvider` are
 * swallowed so a missing/unconfigured provider doesn't abort the lookup.
 */
export async function getApiKey(modelRegistry, providerNames) {
    for (const provider of providerNames) {
        try {
            const key = await modelRegistry.getApiKeyForProvider(provider);
            if (key?.trim())
                return key.trim();
        }
        catch {
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
export async function buildAuthHeaders(modelRegistry, providerNames, extra = {}) {
    const names = Array.isArray(providerNames) ? providerNames : [providerNames];
    const key = await getApiKey(modelRegistry, names);
    const headers = {
        "Accept-Encoding": "identity",
        ...extra,
    };
    if (key && key !== PROXY_MANAGED_SENTINEL) {
        headers.Authorization = `Bearer ${key}`;
    }
    return headers;
}
//# sourceMappingURL=auth.js.map