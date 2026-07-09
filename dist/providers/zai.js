import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson, UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { formatDurationFromNow, normalizeResetAt, pct } from "../core/format.js";
const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit";
/** Human label for a Z.ai `unit` code, in the order we want to render it. */
const ZAI_UNIT_LABELS = {
    3: "5h", // 5-hour token limit
    6: "Weekly", // weekly token limit
    5: "Tools", // tool-call limit (search-prime, web-reader, zread)
};
const ZAI_LIMIT_ORDER = [3, 6, 5];
/**
 * Parse a Z.ai quota response. Pure function — exposed for unit tests.
 *
 * Throws UsageError("nolimit") when no recognized limit is present, and
 * UsageError(`api{code}`) when the API returns `success: false`.
 */
export function parseZaiUsage(parsed) {
    if (parsed && typeof parsed.success === "boolean" && !parsed.success) {
        throw new UsageError(`Z.ai API error: ${parsed.msg ?? "unknown"}`, `api${parsed.code ?? "unknown"}`);
    }
    const limitsRaw = parsed?.data?.limits ?? [];
    const limits = [];
    for (const raw of limitsRaw) {
        const unit = Number(raw?.unit);
        const label = ZAI_UNIT_LABELS[unit];
        if (!label)
            continue;
        const used = Number(raw?.percentage);
        if (!Number.isFinite(used))
            continue;
        limits.push({
            label,
            usedPercent: used,
            resetAt: normalizeResetAt(raw?.nextResetTime),
        });
    }
    if (limits.length === 0) {
        throw new UsageError("No recognized limits in API response", "nolimit");
    }
    // Stable render order: 5h, Weekly, Tools.
    limits.sort((a, b) => ZAI_LIMIT_ORDER.findIndex((u) => ZAI_UNIT_LABELS[u] === a.label) -
        ZAI_LIMIT_ORDER.findIndex((u) => ZAI_UNIT_LABELS[u] === b.label));
    return {
        provider: "zai",
        label: "Z.ai",
        limits,
        source: "zai-api",
    };
}
async function fetchZai(ctx) {
    const headers = await buildAuthHeaders(ctx.modelRegistry, ["zai", "glm", "zai-coding-cn"]);
    const parsed = await safeFetchJson(ZAI_USAGE_API_URL, { headers });
    return parseZaiUsage(parsed);
}
function renderStatus(data, theme) {
    const segments = data.limits.map((l) => {
        const color = colorForPercentage(l.usedPercent, theme);
        const dur = l.resetAt ? formatDurationFromNow(l.resetAt) : undefined;
        const head = color(`${pct(l.usedPercent)} used`);
        return dur ? `${head}${fg(theme, "dim", ` (${dur})`)}` : head;
    });
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " Z.ai ")}${segments.join(", ")}`;
}
function formatDetails(data) {
    const lines = data.limits.map((l) => {
        const reset = l.resetAt ? `, resets in ${formatDurationFromNow(l.resetAt)}` : "";
        return `${l.label}: ${pct(l.usedPercent)} used${reset}`;
    });
    return ["Z.ai usage", ...lines, `Source: ${data.source}`].join("\n");
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