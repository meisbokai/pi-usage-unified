/**
 * pi-usage-unified — core public API.
 *
 * The provider plugin contract, registry, cache, and the unified extension
 * factory. Use these to build a custom set of providers or to register your
 * own.
 */
export type { ColorThresholds, FetchContext, Theme, UsageProvider, } from "./types.js";
export { ProviderRegistry, createRegistry } from "./registry.js";
export { UsageCache, createCache } from "./cache.js";
export { UsageError, safeFetch, safeFetchJson, toFiniteNumber } from "./http.js";
export { PROXY_MANAGED_SENTINEL, buildAuthHeaders, getApiKey, } from "./auth.js";
export { DEFAULT_COLOR_THRESHOLDS, colorForCredit, colorForPercentage, fg, getSettingsFilePath, loadColorThresholds, mergeThresholds, resetThresholdsCache, } from "./theme.js";
export { formatDurationFromNow, normalizeResetAt, pct, roundPercent, usedFromLeft, } from "./format.js";
export { authJsonPath, readJson } from "./config.js";
export { LEGACY_STATUS_KEYS, STATUS_KEY, createUnifiedExtension, } from "./extension.js";
//# sourceMappingURL=index.d.ts.map