import { getApiKey } from "../core/auth.js";
import { PROXY_MANAGED_SENTINEL } from "../core/auth.js";
import { authJsonPath, readJson } from "../core/config.js";
import { safeFetchJson, UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { formatDurationFromNow, normalizeResetAt, pct } from "../core/format.js";
const CODEX_USAGE_ENDPOINTS = [
    "https://chatgpt.com/backend-api/codex/usage",
    "https://chatgpt.com/backend-api/wham/usage",
];
/** Normalize one rate-limit window. Returns undefined when used_percent is missing. */
export function normalizeCodexWindow(window) {
    if (!window || typeof window !== "object")
        return undefined;
    const raw = window;
    const usedPercent = Number(raw.used_percent ?? raw.usedPercent);
    if (!Number.isFinite(usedPercent))
        return undefined;
    return {
        usedPercent: Math.max(0, Math.min(100, usedPercent)),
        resetAt: normalizeResetAt(raw.reset_at ?? raw.resetAt),
        windowSeconds: Number(raw.limit_window_seconds ?? raw.windowSeconds ?? 0) || undefined,
    };
}
/** Parse a Codex usage API response into the normalized shape. Pure — unit tested. */
export function normalizeCodexUsage(api, endpoint) {
    const rateLimit = api?.rate_limit ?? api?.rateLimit;
    const primary = normalizeCodexWindow(rateLimit?.primary_window ?? rateLimit?.primaryWindow ?? rateLimit?.primary);
    const secondary = normalizeCodexWindow(rateLimit?.secondary_window ?? rateLimit?.secondaryWindow ?? rateLimit?.secondary);
    if (!primary && !secondary) {
        throw new UsageError("Codex rate_limit windows missing", "nodata");
    }
    const credits = api?.credits;
    return {
        provider: "codex",
        label: "Codex",
        primary,
        secondary,
        plan: api?.plan_type ?? api?.planType,
        email: api?.email,
        credits: credits?.balance !== undefined ? String(credits.balance) : undefined,
        source: endpoint.includes("/wham/") ? "codex-wham-api" : "codex-api",
    };
}
/** Read the OpenAI Codex account id from pi's auth.json. */
export function readCodexAccountId() {
    const auth = readJson(authJsonPath());
    const entry = auth?.["openai-codex"];
    return typeof entry?.accountId === "string" ? entry.accountId : undefined;
}
async function fetchCodex(ctx) {
    const token = await getApiKey(ctx.modelRegistry, ["openai-codex"]);
    if (!token || token === PROXY_MANAGED_SENTINEL) {
        throw new UsageError("OpenAI Codex OAuth token not found. Run /login for openai-codex.", "noauth");
    }
    const accountId = readCodexAccountId();
    let lastError;
    for (const endpoint of CODEX_USAGE_ENDPOINTS) {
        try {
            const parsed = await safeFetchJson(endpoint, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    ...(accountId ? { "chatgpt-account-id": accountId } : {}),
                    Accept: "application/json",
                    "Accept-Encoding": "identity",
                    "User-Agent": "pi-usage-unified/0.1.0",
                },
            });
            return normalizeCodexUsage(parsed, endpoint);
        }
        catch (error) {
            lastError = error;
            if (error instanceof UsageError &&
                error.code &&
                !["http404", "http401", "http403", "nodata"].includes(error.code)) {
                break;
            }
        }
    }
    throw lastError ?? new UsageError("Codex usage failed", "fetch");
}
function renderStatus(data, theme) {
    const primaryUsed = data.primary?.usedPercent;
    const secondaryUsed = data.secondary?.usedPercent;
    const p = primaryUsed !== undefined
        ? colorForPercentage(primaryUsed, theme)(`5h ${pct(primaryUsed)}`)
        : "5h ?%";
    const s = secondaryUsed !== undefined
        ? colorForPercentage(secondaryUsed, theme)(`W ${pct(secondaryUsed)}`)
        : "W ?%";
    const reset = data.primary?.resetAt
        ? fg(theme, "dim", ` (${formatDurationFromNow(data.primary.resetAt)})`)
        : "";
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " Codex ")}${p}${fg(theme, "dim", " / ")}${s}${fg(theme, "dim", " used")}${reset}`;
}
function formatDetails(data) {
    return [
        "OpenAI Codex usage",
        data.plan ? `Plan: ${data.plan}` : undefined,
        data.email ? `Account: ${data.email}` : undefined,
        data.primary
            ? `5-hour: ${pct(data.primary.usedPercent)} used${data.primary.resetAt ? `, resets in ${formatDurationFromNow(data.primary.resetAt)}` : ""}`
            : undefined,
        data.secondary
            ? `Weekly: ${pct(data.secondary.usedPercent)} used${data.secondary.resetAt ? `, resets in ${formatDurationFromNow(data.secondary.resetAt)}` : ""}`
            : undefined,
        data.credits ? `Credits: ${data.credits}` : undefined,
        `Source: ${data.source}`,
    ]
        .filter(Boolean)
        .join("\n");
}
export const codexProvider = {
    id: "codex",
    label: "Codex",
    match: (provider) => provider?.startsWith("openai-codex") ?? false,
    ttlMs: 60_000,
    fetch: fetchCodex,
    renderStatus,
    formatDetails,
};
//# sourceMappingURL=codex.js.map