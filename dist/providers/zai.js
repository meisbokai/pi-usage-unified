import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson, UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { formatDurationFromNow, pct } from "../core/format.js";
const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
/**
 * Parse a Z.ai quota response. Pure function — exposed for unit tests.
 *
 * Throws UsageError("nolimit") when no TOKENS_LIMIT is present, and
 * UsageError(`api{code}`) when the API returns `success: false`.
 */
export function parseZaiUsage(parsed) {
    if (parsed && typeof parsed.success === "boolean" && !parsed.success) {
        throw new UsageError(`Z.ai API error: ${parsed.msg ?? "unknown"}`, `api${parsed.code ?? "unknown"}`);
    }
    const tokensLimit = parsed?.data?.limits?.find?.((limit) => limit?.type === "TOKENS_LIMIT");
    if (!tokensLimit)
        throw new UsageError("TOKENS_LIMIT not found", "nolimit");
    const nextReset = tokensLimit.nextResetTime;
    return {
        provider: "zai",
        label: "Z.ai",
        usedPercent: Number(tokensLimit.percentage),
        resetAt: nextReset ? Math.round(Number(nextReset) / 1000) : undefined,
        source: "zai-api",
    };
}
async function fetchZai(ctx) {
    const headers = await buildAuthHeaders(ctx.modelRegistry, ["zai", "glm", "zai-coding-cn"]);
    const parsed = await safeFetchJson(ZAI_USAGE_API_URL, { headers });
    return parseZaiUsage(parsed);
}
function renderStatus(data, theme) {
    const color = colorForPercentage(data.usedPercent, theme);
    const reset = data.resetAt ? fg(theme, "dim", ` (${formatDurationFromNow(data.resetAt)})`) : "";
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " Z.ai ")}${color(`${pct(data.usedPercent)} used`)}${reset}`;
}
function formatDetails(data) {
    return [
        "Z.ai usage",
        `Tokens: ${pct(data.usedPercent)} used`,
        data.resetAt ? `Resets in: ${formatDurationFromNow(data.resetAt)}` : undefined,
        `Source: ${data.source}`,
    ]
        .filter(Boolean)
        .join("\n");
}
export const zaiProvider = {
    id: "zai",
    label: "Z.ai",
    match: (provider) => provider === "glm" || (provider?.startsWith("zai") ?? false),
    ttlMs: 30_000,
    fetch: fetchZai,
    renderStatus,
    formatDetails,
};
//# sourceMappingURL=zai.js.map