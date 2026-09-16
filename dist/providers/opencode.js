import { getApiKey, PROXY_MANAGED_SENTINEL } from "../core/auth.js";
import { UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { formatDurationFromNow, normalizeResetAt, pct } from "../core/format.js";
const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";
const OPENCODE_GO_PROBE_MODEL = "kimi-k2.6";
const OPENCODE_GO_USER_AGENT = "pi-usage-unified/0.1.0";
const OPENCODE_GO_PROBE_BODY = {
    model: OPENCODE_GO_PROBE_MODEL,
    messages: [{ role: "user", content: "ping" }],
    max_tokens: 1,
    stream: false,
};
/** Read a numeric header value (case-insensitive) from a Headers-like object. */
export function numberHeader(headers, name) {
    const wanted = name.toLowerCase();
    for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() !== wanted || value === undefined || value === null)
            continue;
        const parsed = Number(String(value).trim());
        return Number.isFinite(parsed) ? parsed : undefined;
    }
    return undefined;
}
/** Clamp an opencode window value to 0–100, or undefined when not finite. */
export function normalizeOpencodeWindow(value) {
    if (value === undefined)
        return undefined;
    const num = Number(value);
    if (!Number.isFinite(num))
        return undefined;
    return Math.max(0, Math.min(100, num));
}
/**
 * Parse an absolute reset timestamp into epoch seconds.
 *
 * The live usage endpoint sends ISO-8601 strings (`"2026-09-16T07:16:35.669Z"`);
 * numeric epoch seconds / milliseconds are also accepted defensively in case
 * the API switches representation. Anything unparseable → undefined.
 */
export function normalizeOpencodeResetAt(value) {
    if (typeof value === "number")
        return Number.isFinite(value) ? normalizeResetAt(value) : undefined;
    if (typeof value !== "string")
        return undefined;
    const trimmed = value.trim();
    if (!trimmed)
        return undefined;
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric))
        return normalizeResetAt(numeric);
    const ms = Date.parse(trimmed);
    return Number.isFinite(ms) ? Math.round(ms / 1000) : undefined;
}
/**
 * Normalize one usage window (`{ status, percent, resetsAt }`).
 *
 * Defensive about field names because the endpoint is new: `percent` accepts
 * its camelCase/snake_case variants, `resetsAt` accepts the same family, and a
 * window whose percent is missing/renamed is dropped rather than crashing —
 * except when `status` says the window is exhausted, in which case it is
 * reported as 100% used.
 */
export function parseOpencodeWindow(raw) {
    if (!raw || typeof raw !== "object")
        return undefined;
    const usedPercent = normalizeOpencodeWindow(raw.percent ?? raw.usedPercent ?? raw.used_percent ?? raw.usagePercent);
    const status = typeof raw.status === "string" ? raw.status : undefined;
    const exhausted = status?.toLowerCase() === "rate-limited";
    const percent = usedPercent ?? (exhausted ? 100 : undefined);
    if (percent === undefined)
        return undefined;
    const window = { usedPercent: percent };
    if (status)
        window.status = status;
    const resetAt = normalizeOpencodeResetAt(raw.resetsAt ?? raw.resetAt ?? raw.reset_at);
    if (resetAt !== undefined)
        window.resetAt = resetAt;
    return window;
}
/**
 * Parse a usage-endpoint response into the normalized shape. Pure — unit
 * tested against the live response fixture.
 *
 * Throws `UsageError("nodata")` when no window could be read; a 200 that we
 * cannot parse is surfaced as an error (the probe fallback deliberately does
 * not run for it).
 */
export function parseOpencodeUsage(parsed) {
    // The shipped response wraps the windows in a top-level `usage` object; fall
    // back to the root too so a future unwrapped response still parses.
    const root = parsed?.usage ?? parsed;
    const rolling = parseOpencodeWindow(root?.rolling);
    const weekly = parseOpencodeWindow(root?.weekly);
    const monthly = parseOpencodeWindow(root?.monthly);
    if (!rolling && !weekly && !monthly) {
        throw new UsageError("OpenCode usage response has no rolling/weekly/monthly windows", "nodata");
    }
    const data = {
        provider: "opencode",
        label: "OpenCode",
        source: "opencode-usage-api",
    };
    if (rolling)
        data.rolling = rolling;
    if (weekly)
        data.weekly = weekly;
    if (monthly)
        data.monthly = monthly;
    return data;
}
/**
 * Endpoint failures that justify falling back to the chat-completion probe.
 * A response the endpoint did return but we could not parse (`nodata`,
 * `badjson`) is NOT in this set: the endpoint is the source of truth and its
 * breakdown must be visible instead of being masked by probe numbers.
 */
export function shouldFallbackToProbe(error) {
    if (!(error instanceof UsageError))
        return false;
    if (error.code === "fetch")
        return true;
    if (error.code === "http401" || error.code === "http403" || error.code === "http404")
        return true;
    return /^http5\d\d$/.test(error.code);
}
/** Resolve the OpenCode Go API key (pi auth store first, `OPENCODE_API_KEY` second). */
async function resolveOpencodeKey(ctx) {
    const fromRegistry = await getApiKey(ctx.modelRegistry, ["opencode-go", "opencode"]);
    const apiKey = (fromRegistry && fromRegistry !== PROXY_MANAGED_SENTINEL
        ? fromRegistry
        : process.env.OPENCODE_API_KEY?.trim()) || undefined;
    if (!apiKey) {
        throw new UsageError("OpenCode Go key not found. Set OPENCODE_API_KEY or log in via /login.", "noauth");
    }
    return apiKey;
}
/** GET the OpenCode Go usage endpoint (the primary source of truth). */
async function fetchOpencodeUsageApi(apiKey) {
    let response;
    try {
        response = await fetch(`${OPENCODE_GO_BASE_URL}/usage`, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
                "Accept-Encoding": "identity",
                "User-Agent": OPENCODE_GO_USER_AGENT,
            },
        });
    }
    catch (error) {
        throw new UsageError(`Network error: ${error instanceof Error ? error.message : String(error)}`, "fetch");
    }
    if (response.status === 401) {
        throw new UsageError("OpenCode usage auth failed (401): missing or unknown key", "http401");
    }
    if (response.status === 403) {
        throw new UsageError("OpenCode usage forbidden (403): no OpenCode Go subscription", "http403");
    }
    if (!response.ok) {
        let body = "";
        try {
            body = await response.text();
        }
        catch {
            /* ignore */
        }
        throw new UsageError(`OpenCode usage HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`, `http${response.status}`);
    }
    let parsed;
    try {
        parsed = await response.json();
    }
    catch (error) {
        throw new UsageError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`, "badjson");
    }
    return parseOpencodeUsage(parsed);
}
/** Fallback: 1-token chat probe that sniffs the `x-opencode-*-usage-percent` headers. */
async function probeOpencode(apiKey) {
    let response;
    try {
        response = await fetch(`${OPENCODE_GO_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept-Encoding": "identity",
                "User-Agent": OPENCODE_GO_USER_AGENT,
            },
            body: JSON.stringify(OPENCODE_GO_PROBE_BODY),
        });
    }
    catch (error) {
        throw new UsageError(`Network error: ${error instanceof Error ? error.message : String(error)}`, "fetch");
    }
    if (response.status === 401 || response.status === 403) {
        throw new UsageError(`OpenCode auth failed (${response.status})`, "noauth");
    }
    if (response.status === 429)
        throw new UsageError("OpenCode rate limited", "ratelimited");
    if (!response.ok) {
        throw new UsageError(`OpenCode probe HTTP ${response.status}`, `http${response.status}`);
    }
    const headers = Object.fromEntries(response.headers.entries());
    const rolling = numberHeader(headers, "x-opencode-rolling-usage-percent") ??
        numberHeader(headers, "x-opencode-rolling-used-percent") ??
        numberHeader(headers, "x-rolling-usage-percent");
    const weekly = numberHeader(headers, "x-opencode-weekly-usage-percent") ??
        numberHeader(headers, "x-opencode-weekly-used-percent") ??
        numberHeader(headers, "x-weekly-usage-percent");
    const monthly = numberHeader(headers, "x-opencode-monthly-usage-percent") ??
        numberHeader(headers, "x-opencode-monthly-used-percent") ??
        numberHeader(headers, "x-monthly-usage-percent");
    if (rolling === undefined && weekly === undefined && monthly === undefined) {
        throw new UsageError("OpenCode Go exposes no rate-limit headers", "noquotadata");
    }
    const data = {
        provider: "opencode",
        label: "OpenCode",
        source: "opencode-probe",
        probeModel: OPENCODE_GO_PROBE_MODEL,
    };
    if (rolling !== undefined)
        data.rolling = { usedPercent: rolling };
    if (weekly !== undefined)
        data.weekly = { usedPercent: weekly };
    if (monthly !== undefined)
        data.monthly = { usedPercent: monthly };
    return data;
}
async function fetchOpencode(ctx) {
    const apiKey = await resolveOpencodeKey(ctx);
    try {
        return await fetchOpencodeUsageApi(apiKey);
    }
    catch (error) {
        if (!shouldFallbackToProbe(error))
            throw error;
        const failure = error;
        try {
            const probed = await probeOpencode(apiKey);
            probed.fallbackReason = `${failure.code}: ${failure.message}`;
            return probed;
        }
        catch {
            // The endpoint is the source of truth: report its failure, not the probe's.
            throw error;
        }
    }
}
function renderWindow(tag, window, theme) {
    const head = colorForPercentage(window.usedPercent, theme)(`${tag} ${pct(window.usedPercent)}`);
    const reset = window.resetAt ? fg(theme, "dim", ` (${formatDurationFromNow(window.resetAt)})`) : "";
    return `${head}${reset}`;
}
function renderStatus(data, theme) {
    const parts = [];
    if (data.rolling)
        parts.push(renderWindow("R", data.rolling, theme));
    if (data.weekly)
        parts.push(renderWindow("W", data.weekly, theme));
    if (data.monthly)
        parts.push(renderWindow("M", data.monthly, theme));
    const label = parts.length > 0 ? parts.join(fg(theme, "dim", " ")) : "n/a";
    const suffix = data.source === "opencode-probe" ? " used (probe fallback)" : " used";
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " OpenCode ")}${label}${fg(theme, "dim", suffix)}`;
}
function formatDetails(data) {
    const windows = [
        ["Rolling", data.rolling],
        ["Weekly", data.weekly],
        ["Monthly", data.monthly],
    ];
    const lines = ["OpenCode Go usage"];
    for (const [label, window] of windows) {
        if (!window)
            continue;
        const status = window.status && window.status !== "ok" ? ` [${window.status}]` : "";
        const reset = window.resetAt
            ? `, resets in ${formatDurationFromNow(window.resetAt)} (${new Date(window.resetAt * 1000).toISOString()})`
            : "";
        lines.push(`${label}: ${pct(window.usedPercent)} used${status}${reset}`);
    }
    if (data.source === "opencode-probe") {
        lines.push(`Fallback: usage endpoint failed (${data.fallbackReason ?? "unknown"})`);
        if (data.probeModel)
            lines.push(`Probed: ${data.probeModel}`);
    }
    lines.push(`Source: ${data.source}`);
    return lines.join("\n");
}
export const opencodeProvider = {
    id: "opencode",
    label: "OpenCode",
    match: (provider) => provider?.startsWith("opencode") ?? false,
    ttlMs: 60_000,
    fetch: fetchOpencode,
    renderStatus,
    formatDetails,
};
//# sourceMappingURL=opencode.js.map