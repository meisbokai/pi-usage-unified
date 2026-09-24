import { afterEach, describe, expect, it, vi } from "vitest";
import { deepseekProvider, leastFundedBalance, parseDeepSeekBalance } from "../src/providers/deepseek.js";
import { fakeModelRegistry, stubTheme } from "./helpers.js";

/** Live `GET /user/balance` payload from an account with two wallets. */
const multiWalletFixture = {
  is_available: true,
  balance_infos: [
    { currency: "USD", total_balance: "0.00", granted_balance: "0.00", topped_up_balance: "0.00" },
    { currency: "CNY", total_balance: "49.27", granted_balance: "0.00", topped_up_balance: "49.27" },
  ],
};

/** Legacy single-object payload (older API versions/accounts). */
const legacyFixture = {
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
  it("parses every wallet from the live multi-currency payload", () => {
    const d = parseDeepSeekBalance(multiWalletFixture);
    expect(d.isAvailable).toBe(true);
    expect(d.wallets).toHaveLength(2);
    expect(d.wallets[0]).toMatchObject({ currency: "USD", totalBalance: 0, toppedUpBalance: 0 });
    expect(d.wallets[1]).toMatchObject({ currency: "CNY", totalBalance: 49.27, toppedUpBalance: 49.27 });
    expect(d.source).toBe("deepseek-api");
  });

  it("flags the wallets as unavailable when is_available is false", () => {
    const d = parseDeepSeekBalance({ is_available: false, balance_infos: multiWalletFixture.balance_infos });
    expect(d.isAvailable).toBe(false);
    expect(d.wallets).toHaveLength(2);
  });

  it("defaults isAvailable to true when the flag is absent", () => {
    expect(parseDeepSeekBalance({ balance_infos: [] }).isAvailable).toBe(true);
  });

  it("returns no wallets when the response carries no balance fields", () => {
    const d = parseDeepSeekBalance({});
    expect(d.wallets).toEqual([]);
  });
});

describe("leastFundedBalance", () => {
  it("picks the least-funded wallet from the live payload", () => {
    const d = parseDeepSeekBalance(multiWalletFixture);
    // USD 0.00 is smaller than CNY 49.27 → it drives the status colour.
    expect(leastFundedBalance(d.wallets)).toBe(0);
  });

  it("skips wallets without a numeric total and returns undefined when there are none", () => {
    expect(leastFundedBalance([{ currency: "USD" }, { currency: "CNY", totalBalance: 3 }])).toBe(3);
    expect(leastFundedBalance([])).toBeUndefined();
  });
});

describe("deepseekProvider.renderStatus", () => {
  it("shows both wallet amounts in the footer line", () => {
    const line = deepseekProvider.renderStatus!(parseDeepSeekBalance(multiWalletFixture), stubTheme);
    expect(line).toContain("DeepSeek");
    expect(line).toContain("$0");
    expect(line).toContain("¥49.27");
    expect(line).toContain("bal");
  });

  it("renders a placeholder when the response carried no wallets", () => {
    const line = deepseekProvider.renderStatus!(parseDeepSeekBalance({}), stubTheme);
    expect(line).toContain("?");
  });

  it("marks the balance unavailable when is_available is false", () => {
    const line = deepseekProvider.renderStatus!(
      parseDeepSeekBalance({ is_available: false, balance_infos: multiWalletFixture.balance_infos }),
      stubTheme,
    );
    expect(line).toContain("unavailable");
  });

  it("falls back to the legacy single-object balance shape", () => {
    const d = parseDeepSeekBalance(legacyFixture);
    expect(d.wallets).toHaveLength(1);
    expect(d.wallets[0]).toMatchObject({ currency: "CNY", totalBalance: 10.55 });
    const line = deepseekProvider.renderStatus!(d, stubTheme);
    expect(line).toContain("¥10.55");
  });
});

describe("deepseekProvider.formatDetails", () => {
  it("renders per-wallet detail lines for every currency", () => {
    const details = deepseekProvider.formatDetails!(parseDeepSeekBalance(multiWalletFixture));
    expect(details).toContain("USD: balance $0");
    expect(details).toContain("CNY: balance ¥49.27");
    expect(details).toContain("Topped up: ¥49.27");
    expect(details).toContain("Available: yes");
    expect(details).toContain("Source: deepseek-api");
  });

  it("renders legacy single-wallet details", () => {
    const details = deepseekProvider.formatDetails!(parseDeepSeekBalance(legacyFixture));
    expect(details).toContain("CNY: balance ¥10.55");
    expect(details).toContain("Granted: ¥10");
    expect(details).toContain("Discounted: ¥0");
  });
});

describe("deepseekProvider.fetch (mocked fetch)", () => {
  it("fetches the balance endpoint with the resolved key", async () => {
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify(multiWalletFixture), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    const data = await deepseekProvider.fetch({
      modelRegistry: fakeModelRegistry({ deepseek: "sk-ds" }),
    });
    expect(data.wallets).toHaveLength(2);
    expect(data.wallets[1]?.totalBalance).toBe(49.27);
    const init = spy.mock.calls[0]?.[1] as RequestInit | undefined;
    expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer sk-ds");
  });

  it("matches deepseek* providers", () => {
    expect(deepseekProvider.match("deepseek")).toBe(true);
    expect(deepseekProvider.match("deepseek-chat")).toBe(true);
    expect(deepseekProvider.match("zai")).toBe(false);
  });
});
