import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson } from "../core/http.js";
import { colorForCredit, fg } from "../core/theme.js";
const DEEPSEEK_BALANCE_URL = "https://api.deepseek.com/user/balance";
function toFinite(value) {
    if (value === null || value === undefined)
        return undefined;
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
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
export function parseDeepSeekBalance(parsed) {
    const balance = parsed?.balance ?? {};
    const total = toFinite(balance.total_balance ?? parsed?.total_balance);
    return {
        provider: "deepseek",
        label: "DeepSeek",
        isSufficient: parsed?.is_sufficient !== false,
        discountedBalance: toFinite(balance.discounted_balance),
        grantedBalance: toFinite(balance.granted_balance),
        toppedUpBalance: toFinite(balance.topped_up_balance),
        totalBalance: total,
        currency: typeof balance.currency === "string" ? balance.currency : undefined,
        source: "deepseek-api",
    };
}
async function fetchDeepSeek(ctx) {
    const headers = await buildAuthHeaders(ctx.modelRegistry, ["deepseek"]);
    const parsed = await safeFetchJson(DEEPSEEK_BALANCE_URL, { headers });
    return parseDeepSeekBalance(parsed);
}
function money(value, currency) {
    if (value === undefined || !Number.isFinite(value))
        return "?";
    const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : "";
    return `${symbol}${Math.round(value * 100) / 100}`;
}
function renderStatus(data, theme) {
    const balanceText = money(data.totalBalance, data.currency);
    // Insufficient balance is always an error; otherwise color by the credit
    // thresholds (low balance → warning/error).
    const color = !data.isSufficient
        ? (s) => fg(theme, "error", s)
        : data.totalBalance !== undefined
            ? colorForCredit(data.totalBalance, theme)
            : (s) => fg(theme, "muted", s);
    const marker = !data.isSufficient ? fg(theme, "dim", " (insufficient)") : "";
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " DeepSeek ")}${color(balanceText)}${fg(theme, "dim", " bal")}${marker}`;
}
function formatDetails(data) {
    const cur = data.currency;
    return [
        "DeepSeek usage",
        data.totalBalance !== undefined ? `Balance: ${money(data.totalBalance, cur)}` : undefined,
        data.discountedBalance !== undefined ? `Discounted: ${money(data.discountedBalance, cur)}` : undefined,
        data.grantedBalance !== undefined ? `Granted: ${money(data.grantedBalance, cur)}` : undefined,
        data.toppedUpBalance !== undefined ? `Topped up: ${money(data.toppedUpBalance, cur)}` : undefined,
        `Sufficient: ${data.isSufficient ? "yes" : "no"}`,
        data.currency ? `Currency: ${data.currency}` : undefined,
        `Source: ${data.source}`,
    ]
        .filter(Boolean)
        .join("\n");
}
export const deepseekProvider = {
    id: "deepseek",
    label: "DeepSeek",
    match: (provider) => provider?.startsWith("deepseek") ?? false,
    ttlMs: 60_000,
    fetch: fetchDeepSeek,
    renderStatus,
    formatDetails,
};
//# sourceMappingURL=deepseek.js.map