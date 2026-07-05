import type { Theme } from "../src/core/types.js";

/**
 * Identity theme stub: `fg` returns the text unchanged so assertions can match
 * on plain substrings. Mirrors the pattern used by pi-cursor-usage's tests.
 */
export const stubTheme = {
  fg: (_role: string, text: string) => text,
} as unknown as Theme;

/** A fake ModelRegistry that returns a canned key for given providers. */
export function fakeModelRegistry(
  keys: Record<string, string | undefined>,
): { getApiKeyForProvider: (provider: string) => Promise<string | undefined> } {
  return {
    getApiKeyForProvider: async (provider: string) => keys[provider],
  };
}
