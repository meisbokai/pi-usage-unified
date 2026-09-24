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
import type { UsageProvider } from "../core/types.js";
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
/**
 * Parse a DeepSeek `/user/balance` response into one wallet per currency.
 * Pure function — unit tested.
 */
export declare function parseDeepSeekBalance(parsed: any): DeepSeekUsageData;
/**
 * The smallest defined wallet balance — the wallet closest to depletion.
 *
 * Amounts in different currencies are compared nominally (no FX rates are
 * fetched); the value is only used to pick the warning colour, so the
 * closest-to-zero wallet wins.
 */
export declare function leastFundedBalance(wallets: DeepSeekWallet[]): number | undefined;
export declare const deepseekProvider: UsageProvider<DeepSeekUsageData>;
//# sourceMappingURL=deepseek.d.ts.map