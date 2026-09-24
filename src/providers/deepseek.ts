/**
 * DeepSeek usage provider. (NEW)
 *
 * - Auth: API key provider `deepseek`, or `DEEPSEEK_API_KEY`
 * - Endpoint: GET https://api.deepseek.com/user/balance
 * - Output: one wallet per currency (`balance_infos`), rendered as credit
 *   balances — one amount per wallet, not a percentage.
 *
 * Live response shape (current API):
 * ```json
 * { "is_available": true,
 *   "balance_infos": [
 *     { "currency": "USD", "total_balance": "0.00",
 *       "granted_balance": "0.00", "topped_up_balance": "0.00" },
 *     { "currency": "CNY", "total_balance": "49.27",
 *       "granted_balance": "0.00", "topped_up_balance": "49.27" }
 *   ] }
 * ```
 * Older responses carried a single `balance` object plus `is_sufficient`;
 * that legacy shape is still accepted as a fallback.
 */
import type { FetchContext, Theme, UsageProvider } from "../core/types.js";
import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson } from "../core/http.js";
import { colorForCredit, fg } from "../core/theme.js";

const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";

/** One currency wallet from the DeepSeek balance response. */
export interface DeepSeekWallet {
  currency?: string;
  totalBalance?: number;
  grantedBalance?: number;
  toppedUpBalance?: number;
  discountedBalance?: number;
}

export interface DeepSeekUsageData {
  provider: "deepseek";
  label: string;
  /** `is_available` (legacy: `is_sufficient !== false`). */
  isAvailable: boolean;
  /** Every wallet in the response, in payload order; empty when absent. */
  wallets: DeepSeekWallet[];
  source: string;
}

function toFinite(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

function isWalletObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parseWallet(raw: Record<string, unknown>): DeepSeekWallet {
  return {
    currency: typeof raw.currency === "string" ? raw.currency : undefined,
    totalBalance: toFinite(raw.total_balance),
    grantedBalance: toFinite(raw.granted_balance),
    toppedUpBalance: toFinite(raw.topped_up_balance),
    discountedBalance: toFinite(raw.discounted_balance),
  };
}

/** True for an object that carries any wallet-shaped field. */
function looksLikeWallet(raw: Record<string, unknown>): boolean {
  return (
    raw.currency !== undefined ||
    raw.total_balance !== undefined ||
    raw.granted_balance !== undefined ||
    raw.topped_up_balance !== undefined ||
    raw.discounted_balance !== undefined
  );
}

/** Extract the raw wallet objects from either response shape, in payload order. */
function rawWallets(parsed: any): Record<string, unknown>[] {
  if (Array.isArray(parsed?.balance_infos)) {
    const infos = parsed.balance_infos.filter(isWalletObject);
    if (infos.length > 0) return infos;
  }
  if (Array.isArray(parsed)) return parsed.filter(isWalletObject);
  // Legacy single-object shape: `balance: { currency, total_balance, ... }`,
  // or the same wallet fields at the top level.
  const single = parsed?.balance ?? parsed;
  return isWalletObject(single) && looksLikeWallet(single) ? [single] : [];
}

/**
 * Parse a DeepSeek `/user/balance` response into one wallet per currency.
 * Pure function — unit tested.
 */
export function parseDeepSeekBalance(parsed: any): DeepSeekUsageData {
  const wallets = rawWallets(parsed).map(parseWallet);
  // `is_available` is the current flag; `is_sufficient` is the legacy one.
  const isAvailable = parsed?.is_available !== undefined
    ? parsed.is_available !== false
    : parsed?.is_sufficient !== false;
  return {
    provider: "deepseek",
    label: "DeepSeek",
    isAvailable,
    wallets,
    source: "deepseek-api",
  };
}

/**
 * The smallest defined wallet balance — the wallet closest to depletion.
 *
 * Amounts in different currencies are compared nominally (no FX rates are
 * fetched); the value is only used to pick the warning colour, so the
 * closest-to-zero wallet wins.
 */
export function leastFundedBalance(wallets: DeepSeekWallet[]): number | undefined {
  let min: number | undefined;
  for (const wallet of wallets) {
    if (wallet.totalBalance === undefined) continue;
    min = min === undefined ? wallet.totalBalance : Math.min(min, wallet.totalBalance);
  }
  return min;
}

async function fetchDeepSeek(ctx: FetchContext): Promise<DeepSeekUsageData> {
  const headers = await buildAuthHeaders(ctx.modelRegistry, ["deepseek"]);
  const parsed = await safeFetchJson(DEEPSEEK_BALANCE_URL, { headers });
  return parseDeepSeekBalance(parsed);
}

/** `$0.00`, `¥49.27`, `12.00 EUR`, or `?`. */
function money(value: number | undefined, currency?: string): string {
  if (value === undefined || !Number.isFinite(value)) return "?";
  const rounded = Math.round(value * 100) / 100;
  const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : undefined;
  if (symbol) return `${symbol}${rounded}`;
  return currency ? `${rounded} ${currency}` : `${rounded}`;
}

function renderStatus(data: DeepSeekUsageData, theme: Theme): string {
  const walletText = data.wallets.length
    ? data.wallets.map((wallet) => money(wallet.totalBalance, wallet.currency)).join(" ")
    : "?";
  const leastFunded = leastFundedBalance(data.wallets);
  // Unavailable balance is always an error; otherwise colour the whole wallet
  // list by the least-funded wallet (low balance → warning/error).
  const color = !data.isAvailable
    ? (s: string) => fg(theme, "error", s)
    : leastFunded !== undefined
      ? colorForCredit(leastFunded, theme)
      : (s: string) => fg(theme, "muted", s);
  const marker = !data.isAvailable ? fg(theme, "dim", " (unavailable)") : "";
  return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " DeepSeek ")}${color(walletText)}${fg(theme, "dim", " bal")}${marker}`;
}

function formatDetails(data: DeepSeekUsageData): string {
  const lines: (string | undefined)[] = ["DeepSeek usage"];
  if (data.wallets.length === 0) lines.push("Balance: ?");
  for (const wallet of data.wallets) {
    const cur = wallet.currency;
    lines.push(`${cur ?? "Wallet"}: balance ${money(wallet.totalBalance, cur)}`);
    if (wallet.grantedBalance !== undefined) lines.push(`  Granted: ${money(wallet.grantedBalance, cur)}`);
    if (wallet.toppedUpBalance !== undefined) lines.push(`  Topped up: ${money(wallet.toppedUpBalance, cur)}`);
    if (wallet.discountedBalance !== undefined) lines.push(`  Discounted: ${money(wallet.discountedBalance, cur)}`);
  }
  lines.push(`Available: ${data.isAvailable ? "yes" : "no"}`);
  lines.push(`Source: ${data.source}`);
  return lines.filter(Boolean).join("\n");
}

export const deepseekProvider: UsageProvider<DeepSeekUsageData> = {
  id: "deepseek",
  label: "DeepSeek",
  match: (provider) => provider?.startsWith("deepseek") ?? false,
  ttlMs: 60_000,
  fetch: fetchDeepSeek,
  renderStatus,
  formatDetails,
};
