import { describe, expect, it } from "vitest";
import { ProviderRegistry, createRegistry } from "../src/core/registry.js";
import type { UsageProvider } from "../src/core/types.js";

function makeProvider(id: string, match: (p: string | undefined) => boolean): UsageProvider {
  return {
    id,
    label: id,
    match,
    fetch: async () => ({ id }),
    renderStatus: () => id,
  };
}

describe("ProviderRegistry", () => {
  it("resolves the matching provider from a model provider string", () => {
    const r = createRegistry();
    r.registerProvider(makeProvider("zai", (p) => p === "glm" || (p?.startsWith("zai") ?? false)));
    r.registerProvider(makeProvider("cursor", (p) => p?.startsWith("cursor") ?? false));

    expect(r.resolve("zai")?.id).toBe("zai");
    expect(r.resolve("zai-coding-cn")?.id).toBe("zai");
    expect(r.resolve("glm")?.id).toBe("zai");
    expect(r.resolve("cursor")?.id).toBe("cursor");
  });

  it("lowercases the provider string before matching", () => {
    const r = createRegistry();
    r.registerProvider(makeProvider("deepseek", (p) => p === "deepseek"));
    expect(r.resolve("DeepSeek")?.id).toBe("deepseek");
  });

  it("returns undefined when no provider matches", () => {
    const r = createRegistry();
    r.registerProvider(makeProvider("zai", (p) => p?.startsWith("zai") ?? false));
    expect(r.resolve("unknown")).toBeUndefined();
    expect(r.resolve(undefined)).toBeUndefined();
  });

  it("list() preserves registration order", () => {
    const r = createRegistry();
    r.registerProvider(makeProvider("a", () => false));
    r.registerProvider(makeProvider("b", () => false));
    r.registerProvider(makeProvider("c", () => false));
    expect(r.list().map((p) => p.id)).toEqual(["a", "b", "c"]);
  });

  it("registerProvider replaces an existing id in place (keeps order)", () => {
    const r = createRegistry();
    r.registerProvider(makeProvider("a", () => false));
    r.registerProvider(makeProvider("b", () => false));
    r.registerProvider(makeProvider("a", (p) => p === "a"));
    expect(r.list().map((p) => p.id)).toEqual(["a", "b"]);
    expect(r.resolve("a")?.id).toBe("a");
  });

  it("createDefaultRegistry registers all six built-in providers", async () => {
    const { createDefaultRegistry } = await import("../src/providers/index.js");
    const r: ProviderRegistry = createDefaultRegistry();
    const ids = r.list().map((p) => p.id);
    expect(ids).toEqual(["zai", "cursor", "codex", "opencode", "openrouter", "deepseek"]);
    expect(r.resolve("glm")?.id).toBe("zai");
    expect(r.resolve("openai-codex")?.id).toBe("codex");
    expect(r.resolve("cursor")?.id).toBe("cursor");
    expect(r.resolve("opencode-go")?.id).toBe("opencode");
    expect(r.resolve("openrouter")?.id).toBe("openrouter");
    expect(r.resolve("deepseek")?.id).toBe("deepseek");
  });
});
