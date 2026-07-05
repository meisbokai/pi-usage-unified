/**
 * Built-in provider registration.
 *
 * Adding a provider = one new file under `src/providers/` + one
 * `registerProvider()` call here. The order determines resolution priority
 * (matches are disjoint across built-ins, so order is mostly cosmetic).
 */
import { createRegistry, type ProviderRegistry } from "../core/registry.js";
import { zaiProvider } from "./zai.js";
import { cursorProvider } from "./cursor.js";
import { codexProvider } from "./codex.js";
import { opencodeProvider } from "./opencode.js";
import { openrouterProvider } from "./openrouter.js";
import { deepseekProvider } from "./deepseek.js";

export { zaiProvider } from "./zai.js";
export { cursorProvider } from "./cursor.js";
export { codexProvider } from "./codex.js";
export { opencodeProvider } from "./opencode.js";
export { openrouterProvider } from "./openrouter.js";
export { deepseekProvider } from "./deepseek.js";

/** Build a registry with all built-in providers registered. */
export function createDefaultRegistry(): ProviderRegistry {
  const registry = createRegistry();
  registry.registerProvider(zaiProvider);
  registry.registerProvider(cursorProvider);
  registry.registerProvider(codexProvider);
  registry.registerProvider(opencodeProvider);
  registry.registerProvider(openrouterProvider);
  registry.registerProvider(deepseekProvider);
  return registry;
}
