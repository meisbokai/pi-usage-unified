/**
 * pi-usage-unified — default export.
 *
 * A unified pi extension that monitors API usage / quota / rate-limits across
 * multiple AI providers in a single footer status line. Built on a
 * provider-plugin registry: adding a provider is one file + one register line.
 */
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
export { createUnifiedExtension } from "./core/extension.js";
export { ProviderRegistry, createRegistry } from "./core/registry.js";
export { createDefaultRegistry } from "./providers/index.js";
export type { UsageProvider, FetchContext, Theme } from "./core/types.js";
/**
 * Default pi extension factory. Registers all built-in providers (zai, cursor,
 * codex, opencode, openrouter, deepseek) and owns the single `pi-usage`
 * footer status key, the cache, and the lifecycle.
 */
export default function piUsageUnified(pi: ExtensionAPI): void;
//# sourceMappingURL=index.d.ts.map