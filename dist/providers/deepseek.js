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
function isWalletObject(value) {
    return value !== null && typeof value === "object" && !Array.isArray(value);
}
function parseWallet(raw) {
    return {
        currency: typeof raw.currency === "string" ? raw.currency : undefined,
        totalBalance: toFinite(raw.total_balance),
        grantedBalance: toFinite(raw.granted_balance),
        toppedUpBalance: toFinite(raw.topped_up_balance),
        discountedBalance: toFinite(raw.discounted_balance),
    };
}
/** True for an object that carries any wallet-shaped field. */
function looksLikeWallet(raw) {
    return (raw.currency !== undefined ||
        raw.total_balance !== undefined ||
        raw.granted_balance !== undefined ||
        raw.topped_up_balance !== undefined ||
        raw.discounted_balance !== undefined);
}
/** Extract the raw wallet objects from either response shape, in payload order. */
function rawWallets(parsed) {
    if (Array.isArray(parsed?.balance_infos)) {
        const infos = parsed.balance_infos.filter(isWalletObject);
        if (infos.length > 0)
            return infos;
    }
    // Legacy single-object shape: `balance: { currency, total_balance, ... }`,
    // or the same wallet fields at the top level.
    const single = parsed?.balance ?? parsed;
    return isWalletObject(single) && looksLikeWallet(single) ? [single] : [];
}
/**
 * Parse a DeepSeek `/user/balance` response into one wallet per currency.
 * Pure function — unit tested.
 */
export function parseDeepSeekBalance(parsed) {
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
async function fetchDeepSeek(ctx) {
    const headers = await buildAuthHeaders(ctx.modelRegistry, ["deepseek"]);
    const parsed = await safeFetchJson(DEEPSEEK_BALANCE_URL, { headers });
    return parseDeepSeekBalance(parsed);
}
/** `$0.00`, `¥49.27`, `12.00 EUR`, or `?`. */
function money(value, currency) {
    if (value === undefined || !Number.isFinite(value))
        return "?";
    const rounded = Math.round(value * 100) / 100;
    const symbol = currency === "CNY" ? "¥" : currency === "USD" ? "$" : undefined;
    if (symbol)
        return `${symbol}${rounded}`;
    return currency ? `${rounded} ${currency}` : `${rounded}`;
}
/**
 * Colour a single wallet by its own balance. An unavailable balance is an
 * explicit error state that overrides the per-wallet colours, so every wallet
 * renders in the error colour rather than one wallet colouring its siblings.
 */
function walletColor(data, wallet, theme) {
    if (!data.isAvailable)
        return (s) => fg(theme, "error", s);
    if (wallet.totalBalance === undefined)
        return (s) => fg(theme, "muted", s);
    return colorForCredit(wallet.totalBalance, theme);
}
function renderStatus(data, theme) {
    const walletText = data.wallets.length
        ? data.wallets
            .map((wallet) => walletColor(data, wallet, theme)(money(wallet.totalBalance, wallet.currency)))
            .join(" ")
        : fg(theme, data.isAvailable ? "muted" : "error", "?");
    const marker = !data.isAvailable ? fg(theme, "dim", " (unavailable)") : "";
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " DeepSeek ")}${walletText}${fg(theme, "dim", " bal")}${marker}`;
}
function formatDetails(data) {
    const lines = ["DeepSeek usage"];
    if (data.wallets.length === 0)
        lines.push("Balance: ?");
    for (const wallet of data.wallets) {
        const cur = wallet.currency;
        lines.push(`${cur ?? "Wallet"}: balance ${money(wallet.totalBalance, cur)}`);
        if (wallet.grantedBalance !== undefined)
            lines.push(`  Granted: ${money(wallet.grantedBalance, cur)}`);
        if (wallet.toppedUpBalance !== undefined)
            lines.push(`  Topped up: ${money(wallet.toppedUpBalance, cur)}`);
        if (wallet.discountedBalance !== undefined)
            lines.push(`  Discounted: ${money(wallet.discountedBalance, cur)}`);
    }
    lines.push(`Available: ${data.isAvailable ? "yes" : "no"}`);
    lines.push(`Source: ${data.source}`);
    return lines.filter(Boolean).join("\n");
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