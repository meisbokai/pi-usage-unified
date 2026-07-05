import { describe, expect, it } from "vitest";
import { buildAuthHeaders, getApiKey, PROXY_MANAGED_SENTINEL } from "../src/core/auth.js";
import { fakeModelRegistry } from "./helpers.js";

describe("buildAuthHeaders — 3-way sandbox-aware strategy", () => {
  it("sets Authorization: Bearer when a real key is present", async () => {
    const headers = await buildAuthHeaders(fakeModelRegistry({ zai: "sk-real" }), "zai");
    expect(headers.Authorization).toBe("Bearer sk-real");
    expect(headers["Accept-Encoding"]).toBe("identity");
  });

  it("does NOT set Authorization when the key is the proxy-managed sentinel", async () => {
    const headers = await buildAuthHeaders(
      fakeModelRegistry({ zai: PROXY_MANAGED_SENTINEL }),
      "zai",
    );
    expect(headers.Authorization).toBeUndefined();
    expect(headers["Accept-Encoding"]).toBe("identity");
  });

  it("does NOT set Authorization when there is no key", async () => {
    const headers = await buildAuthHeaders(fakeModelRegistry({}), "zai");
    expect(headers.Authorization).toBeUndefined();
  });

  it("tries a list of provider aliases and uses the first non-empty key", async () => {
    const headers = await buildAuthHeaders(
      fakeModelRegistry({ glm: "glm-key" }),
      ["zai", "glm", "zai-coding-cn"],
    );
    expect(headers.Authorization).toBe("Bearer glm-key");
  });

  it("merges extra headers", async () => {
    const headers = await buildAuthHeaders(fakeModelRegistry({ zai: "k" }), "zai", {
      "Content-Type": "application/json",
    });
    expect(headers["Content-Type"]).toBe("application/json");
    expect(headers.Authorization).toBe("Bearer k");
  });

  it("trims whitespace from keys", async () => {
    const headers = await buildAuthHeaders(fakeModelRegistry({ zai: "  sk-real  " }), "zai");
    expect(headers.Authorization).toBe("Bearer sk-real");
  });
});

describe("getApiKey", () => {
  it("returns undefined when all providers throw or are empty", async () => {
    const registry = {
      getApiKeyForProvider: async (p: string) => {
        if (p === "boom") throw new Error("nope");
        return undefined;
      },
    };
    expect(await getApiKey(registry, ["boom", "missing"])).toBeUndefined();
  });

  it("skips providers that throw and returns the next valid key", async () => {
    const registry = {
      getApiKeyForProvider: async (p: string) => {
        if (p === "boom") throw new Error("nope");
        return p === "ok" ? "key-ok" : undefined;
      },
    };
    expect(await getApiKey(registry, ["boom", "ok"])).toBe("key-ok");
  });
});
