import { createUnifiedExtension } from "./core/extension.js";
import { createDefaultRegistry } from "./providers/index.js";
export { createUnifiedExtension } from "./core/extension.js";
export { ProviderRegistry, createRegistry } from "./core/registry.js";
export { createDefaultRegistry } from "./providers/index.js";
/**
 * Default pi extension factory. Registers all built-in providers (zai, cursor,
 * codex, opencode, openrouter, deepseek) and owns the single `pi-usage`
 * footer status key, the cache, and the lifecycle.
 */
export default function piUsageUnified(pi) {
    return createUnifiedExtension(createDefaultRegistry())(pi);
}
//# sourceMappingURL=index.js.map