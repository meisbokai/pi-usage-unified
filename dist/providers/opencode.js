/**
 * OpenCode Go usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * - Auth: API key provider `opencode-go` / `opencode`, or `OPENCODE_API_KEY`
 * - Probe: POST https://opencode.ai/zen/go/v1/chat/completions with a 1-token
 *   ping; reads rate-limit headers `x-opencode-*-usage-percent`
 *   (rolling/weekly/monthly)
 * - Optional dashboard quota via `OPENCODE_GO_WORKSPACE_ID` +
 *   `OPENCODE_GO_AUTH_COOKIE` (HTML scrape of opencode.ai/workspace/<id>/go)
 */
import { homedir } from "node:os";
import { join } from "node:path";
import { getApiKey, PROXY_MANAGED_SENTINEL } from "../core/auth.js";
import { UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { pct } from "../core/format.js";
import { readJson } from "../core/config.js";
const OPENCODE_GO_BASE_URL = "https://opencode.ai/zen/go/v1";
const OPENCODE_GO_DASHBOARD_PREFIX = "https://opencode.ai/workspace/";
const OPENCODE_GO_PROBE_MODEL = "kimi-k2.6";
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
function readOpencodeWorkspaceId() {
    const env = process.env.OPENCODE_GO_WORKSPACE_ID?.trim();
    if (env)
        return env;
    return readOpencodeConfigField("workspaceId");
}
function readOpencodeAuthCookie() {
    const env = process.env.OPENCODE_GO_AUTH_COOKIE?.trim();
    if (env)
        return env;
    return readOpencodeConfigField("authCookie");
}
function readOpencodeConfigField(field) {
    const explicitConfig = process.env.OPENCODE_GO_QUOTA_CONFIG;
    const candidates = [
        explicitConfig,
        process.env.XDG_CONFIG_HOME
            ? join(process.env.XDG_CONFIG_HOME, "opencode", "opencode-quota", "opencode-go.json")
            : undefined,
        join(homedir(), ".config", "opencode", "opencode-quota", "opencode-go.json"),
    ].filter(Boolean);
    for (const path of candidates) {
        const data = readJson(path);
        if (data && typeof data[field] === "string" && data[field])
            return data[field];
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
/** Parse the dashboard JSON blob scraped from the opencode workspace HTML. */
export function parseOpencodeDashboard(parsed) {
    const rolling = normalizeOpencodeWindow(parsed?.rollingUsage);
    const weekly = normalizeOpencodeWindow(parsed?.weeklyUsage);
    const monthly = normalizeOpencodeWindow(parsed?.monthlyUsage);
    if (rolling === undefined && weekly === undefined && monthly === undefined)
        return undefined;
    return { rolling, weekly, monthly };
}
async function fetchOpencodeDashboardQuota() {
    const workspaceId = readOpencodeWorkspaceId();
    const authCookie = readOpencodeAuthCookie();
    if (!workspaceId || !authCookie)
        return undefined;
    const url = `${OPENCODE_GO_DASHBOARD_PREFIX}${encodeURIComponent(workspaceId)}/go`;
    let response;
    try {
        response = await fetch(url, {
            headers: {
                Cookie: `auth=${authCookie}`,
                "Accept-Encoding": "identity",
                "User-Agent": "pi-usage-unified/0.1.0",
            },
        });
    }
    catch {
        return undefined;
    }
    if (!response.ok)
        return undefined;
    let html = "";
    try {
        html = await response.text();
    }
    catch {
        return undefined;
    }
    const match = html.match(/\{[^{}]*"(?:rollingUsage|weeklyUsage|monthlyUsage)"[\s\S]*?\}/);
    if (!match)
        return undefined;
    let parsed;
    try {
        parsed = JSON.parse(match[0]);
    }
    catch {
        return undefined;
    }
    return parseOpencodeDashboard(parsed);
}
async function probeOpencode(ctx) {
    const fromRegistry = await getApiKey(ctx.modelRegistry, ["opencode-go", "opencode"]);
    const apiKey = (fromRegistry && fromRegistry !== PROXY_MANAGED_SENTINEL
        ? fromRegistry
        : process.env.OPENCODE_API_KEY?.trim()) || undefined;
    if (!apiKey) {
        throw new UsageError("OpenCode Go key not found. Set OPENCODE_API_KEY or log in via /login.", "noauth");
    }
    let response;
    try {
        response = await fetch(`${OPENCODE_GO_BASE_URL}/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                "Accept-Encoding": "identity",
                "User-Agent": "pi-usage-unified/0.1.0",
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
    const dashboard = await fetchOpencodeDashboardQuota();
    const hasAny = rolling !== undefined ||
        weekly !== undefined ||
        monthly !== undefined ||
        (dashboard !== undefined &&
            (dashboard.rolling !== undefined || dashboard.weekly !== undefined || dashboard.monthly !== undefined));
    if (!hasAny) {
        throw new UsageError("OpenCode Go exposes no rate-limit headers. Set OPENCODE_GO_WORKSPACE_ID + OPENCODE_GO_AUTH_COOKIE for dashboard quota.", "noquotadata");
    }
    return {
        provider: "opencode",
        label: "OpenCode",
        rolling: rolling !== undefined ? { usedPercent: rolling } : undefined,
        weekly: weekly !== undefined ? { usedPercent: weekly } : undefined,
        monthly: monthly !== undefined ? { usedPercent: monthly } : undefined,
        dashboard: dashboard &&
            (dashboard.rolling !== undefined || dashboard.weekly !== undefined || dashboard.monthly !== undefined)
            ? dashboard
            : undefined,
        source: "opencode-probe",
        probeModel: OPENCODE_GO_PROBE_MODEL,
    };
}
function colorWindowPart(part, theme) {
    const num = Number(part.replace(/[^0-9.]/g, ""));
    return colorForPercentage(Number.isFinite(num) ? num : 0, theme)(part);
}
function renderStatus(data, theme) {
    const parts = [];
    if (data.rolling?.usedPercent !== undefined)
        parts.push(`R ${pct(data.rolling.usedPercent)}`);
    if (data.weekly?.usedPercent !== undefined)
        parts.push(`W ${pct(data.weekly.usedPercent)}`);
    if (data.monthly?.usedPercent !== undefined)
        parts.push(`M ${pct(data.monthly.usedPercent)}`);
    const label = parts.length > 0
        ? parts.map((p) => colorWindowPart(p, theme)).join(fg(theme, "dim", " "))
        : "n/a";
    const dashboard = data.dashboard;
    if (dashboard &&
        (dashboard.rolling !== undefined || dashboard.weekly !== undefined || dashboard.monthly !== undefined)) {
        const dparts = [];
        if (dashboard.rolling !== undefined)
            dparts.push(`R ${pct(dashboard.rolling)}`);
        if (dashboard.weekly !== undefined)
            dparts.push(`W ${pct(dashboard.weekly)}`);
        if (dashboard.monthly !== undefined)
            dparts.push(`M ${pct(dashboard.monthly)}`);
        const dlabel = dparts.map((p) => colorWindowPart(p, theme)).join(fg(theme, "dim", " "));
        return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " OpenCode ")}${dlabel}${fg(theme, "dim", " · ")}${label}${fg(theme, "dim", " used")}`;
    }
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " OpenCode ")}${label}${fg(theme, "dim", " used")}`;
}
function formatDetails(data) {
    return [
        "OpenCode Go usage",
        data.rolling?.usedPercent !== undefined ? `Rolling: ${pct(data.rolling.usedPercent)} used` : undefined,
        data.weekly?.usedPercent !== undefined ? `Weekly: ${pct(data.weekly.usedPercent)} used` : undefined,
        data.monthly?.usedPercent !== undefined ? `Monthly: ${pct(data.monthly.usedPercent)} used` : undefined,
        data.dashboard?.rolling !== undefined ? `Dashboard rolling: ${pct(data.dashboard.rolling)} used` : undefined,
        data.dashboard?.weekly !== undefined ? `Dashboard weekly: ${pct(data.dashboard.weekly)} used` : undefined,
        data.dashboard?.monthly !== undefined ? `Dashboard monthly: ${pct(data.dashboard.monthly)} used` : undefined,
        data.probeModel ? `Probed: ${data.probeModel}` : undefined,
        `Source: ${data.source}`,
    ]
        .filter(Boolean)
        .join("\n");
}
export const opencodeProvider = {
    id: "opencode",
    label: "OpenCode",
    match: (provider) => provider?.startsWith("opencode") ?? false,
    ttlMs: 60_000,
    fetch: probeOpencode,
    renderStatus,
    formatDetails,
};
//# sourceMappingURL=opencode.js.map