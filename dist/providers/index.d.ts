/**
 * Built-in provider registration.
 *
 * Adding a provider = one new file under `src/providers/` + one
 * `registerProvider()` call here. The order determines resolution priority
 * (matches are disjoint across built-ins, so order is mostly cosmetic).
 */
import { type ProviderRegistry } from "../core/registry.js";
export { zaiProvider } from "./zai.js";
export { cursorProvider } from "./cursor.js";
export { codexProvider } from "./codex.js";
export { opencodeProvider } from "./opencode.js";
export { openrouterProvider } from "./openrouter.js";
export { deepseekProvider } from "./deepseek.js";
/** Build a registry with all built-in providers registered. */
export declare function createDefaultRegistry(): ProviderRegistry;
//# sourceMappingURL=index.d.ts.map