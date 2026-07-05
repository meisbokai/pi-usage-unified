/**
 * DeepSeek usage provider. (NEW)
 *
 * - Auth: API key provider `deepseek`, or `DEEPSEEK_API_KEY`
 * - Endpoint: GET https://api.deepseek.com/user/balance
 * - Output: balance object (`is_sufficient`, `discounted_balance`,
 *   `granted_balance`, `topped_up_balance`) — rendered as a credit balance,
 *   not a percentage.
 */
import type { UsageProvider } from "../core/types.js";
export interface DeepSeekUsageData {
    provider: "deepseek";
    label: string;
    isSufficient: boolean;
    discountedBalance?: number;
    grantedBalance?: number;
    toppedUpBalance?: number;
    totalBalance?: number;
    currency?: string;
    source: string;
}
/**
 * Parse a DeepSeek `/user/balance` response. Pure function — unit tested.
 * Expected shape:
 * ```json
 * { "is_sufficient": true,
 *   "balance": { "currency": "CNY", "total_balance": "10.00",
 *                "granted_balance": "10.00", "topped_up_balance": "0.00",
 *                "discounted_balance": "0.00" } }
 * ```
 */
export declare function parseDeepSeekBalance(parsed: any): DeepSeekUsageData;
export declare const deepseekProvider: UsageProvider<DeepSeekUsageData>;
//# sourceMappingURL=deepseek.d.ts.map