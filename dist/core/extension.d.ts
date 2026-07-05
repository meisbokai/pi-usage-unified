/**
 * pi-usage-unified — the unified extension factory.
 *
 * Owns exactly ONE footer status key (`pi-usage`), a single shared cache keyed
 * by provider id, and the `session_start` / `model_select` / `turn_end` /
 * `session_shutdown` lifecycle. On each event it resolves the active provider
 * from `ctx.model` via the registry, fetches (cache-aware), and renders.
 *
 * Legacy single-provider status keys (`zai-usage`, `cursor-usage`, ...) are
 * cleared on activation so old extensions don't double-render.
 *
 * Behavior ported from the monolithic pi-usage-multi.ts; the difference is
 * structure: providers are now pluggable via the registry instead of a
 * hard-coded `FETCHERS` map.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import type { ProviderRegistry } from "./registry.js";
/** The single footer status key used by this extension. */
export declare const STATUS_KEY = "pi-usage";
/**
 * Status keys previously written by single-provider extensions or older builds
 * of pi-usage-unified. Cleared on every activation so they don't double-render
 * alongside this extension's own `pi-usage` key. (`pi-usage` itself is our key,
 * so it is deliberately not in this list.)
 */
export declare const LEGACY_STATUS_KEYS: string[];
/**
 * Create the unified pi extension factory bound to a registry.
 *
 * Usage:
 * ```ts
 * export default function (pi: ExtensionAPI) {
 *   return createUnifiedExtension(createDefaultRegistry())(pi);
 * }
 * ```
 */
export declare function createUnifiedExtension(registry: ProviderRegistry): (pi: ExtensionAPI) => void;
//# sourceMappingURL=extension.d.ts.map