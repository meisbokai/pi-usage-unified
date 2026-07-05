import { afterEach, describe, expect, it, vi } from "vitest";
import { deepseekProvider, parseDeepSeekBalance } from "../src/providers/deepseek.js";
import { fakeModelRegistry, stubTheme } from "./helpers.js";

const balanceFixture = {
  is_sufficient: true,
  balance: {
    currency: "CNY",
    total_balance: "10.55",
    granted_balance: "10.00",
    topped_up_balance: "0.55",
    discounted_balance: "0.00",
  },
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe("parseDeepSeekBalance", () => {
  it("parses the balance object", () => {
    const d = parseDeepSeekBalance(balanceFixture);
    expect(d.isSufficient).toBe(true);
    expect(d.totalBalance).toBe(10.55);
    expect(d.grantedBalance).toBe(10);
    expect(d.toppedUpBalance).toBe(0.55);
    expect(d.discountedBalance).toBe(0);
    expect(d.currency).toBe("CNY");
    expect(d.source).toBe("deepseek-api");
  });

  it("treats is_sufficient: false as insufficient", () => {
    expect(parseDeepSeekBalance({ is_sufficient: false, balance: {} }).isSufficient).toBe(false);
  });

  it("defaults isSufficient to true when absent", () => {
    expect(parseDeepSeekBalance({ balance: {} }).isSufficient).toBe(true);
  });

  it("returns undefined fields when balance numbers are missing", () => {
    const d = parseDeepSeekBalance({ is_sufficient: true, balance: {} });
    expect(d.totalBalance).toBeUndefined();
    expect(d.grantedBalance).toBeUndefined();
  });
});

describe("deepseekProvider.fetch (mocked fetch)", () => {
  it("fetches the balance endpoint with the resolved key", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(balanceFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const data = await deepseekProvider.fetch({
      modelRegistry: fakeModelRegistry({ deepseek: "sk-ds" }),
    });
    expect(data.totalBalance).toBe(10.55);
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-ds");
  });

  it("matches deepseek* providers", () => {
    expect(deepseekProvider.match("deepseek")).toBe(true);
    expect(deepseekProvider.match("deepseek-chat")).toBe(true);
    expect(deepseekProvider.match("zai")).toBe(false);
  });

  it("renders a footer line with the balance", () => {
    const data = parseDeepSeekBalance(balanceFixture);
    const line = deepseekProvider.renderStatus!(data, stubTheme);
    expect(line).toContain("¥10.55");
    expect(line).toContain("DeepSeek");
  });

  it("renders an insufficient marker when is_sufficient is false", () => {
    const line = deepseekProvider.renderStatus!(
      { ...parseDeepSeekBalance(balanceFixture), isSufficient: false },
      stubTheme,
    );
    expect(line).toContain("insufficient");
  });
});
