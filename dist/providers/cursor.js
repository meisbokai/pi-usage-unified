/**
 * Cursor usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * Two modes:
 * - Admin API: `CURSOR_ADMIN_API_KEY`, POST https://api.cursor.com/teams/spend
 * - Dashboard: reads the Cursor Desktop SQLite `state.vscdb` for accessToken /
 *   refreshToken / email, then POST https://api2.cursor.sh/.../GetCurrentPeriodUsage
 *   (with OAuth refresh via api2.cursor.sh/oauth/token).
 *
 * Env:
 * - `CURSOR_USAGE_MODE` — `auto` (default) | `admin` | `dashboard`
 * - `CURSOR_USAGE_EMAIL` — preferred team member email
 * - `CURSOR_ADMIN_API_KEY` — admin API key (Basic auth)
 * - `CURSOR_API_KEY` — alias used only in admin mode
 */
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { getApiKey } from "../core/auth.js";
import { safeFetchJson, UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { pct, roundPercent } from "../core/format.js";
const CURSOR_ADMIN_SPEND_URL = "https://api.cursor.com/teams/spend";
const CURSOR_DASHBOARD_USAGE_URL = "https://api2.cursor.sh/aiserver.v1.DashboardService/GetCurrentPeriodUsage";
const CURSOR_OAUTH_TOKEN_URL = "https://api2.cursor.sh/oauth/token";
const CURSOR_OAUTH_CLIENT_ID = "KbZUR41cY7W6zRSdpSUJ7I7mLYBKOCmB";
/** Candidate Cursor Desktop SQLite paths across Linux / macOS / Windows. */
export function cursorDbPaths(home = homedir()) {
    return [
        join(home, ".config", "Cursor", "User", "globalStorage", "state.vscdb"),
        join(home, "Library", "Application Support", "Cursor", "User", "globalStorage", "state.vscdb"),
        join(home, "AppData", "Roaming", "Cursor", "User", "globalStorage", "state.vscdb"),
    ];
}
/** Read accessToken/refreshToken/email from the Cursor Desktop SQLite session. */
export async function loadCursorAuth() {
    const { DatabaseSync } = await import("node:sqlite");
    for (const dbPath of cursorDbPaths()) {
        if (!existsSync(dbPath))
            continue;
        let db;
        try {
            db = new DatabaseSync(dbPath, { readOnly: true });
            const read = (key) => {
                const row = db.prepare("SELECT value FROM ItemTable WHERE key = ?").get(key);
                return typeof row?.value === "string" && row.value.length > 0 ? row.value : undefined;
            };
            const accessToken = read("cursorAuth/accessToken");
            if (accessToken) {
                return {
                    accessToken,
                    refreshToken: read("cursorAuth/refreshToken"),
                    email: read("cursorAuth/cachedEmail"),
                };
            }
        }
        catch {
            /* try next path */
        }
        finally {
            try {
                db?.close();
            }
            catch {
                /* ignore */
            }
        }
    }
    return undefined;
}
/** Exchange a refresh token for a new access token via Cursor's OAuth endpoint. */
export async function refreshCursorAccessToken(refreshToken) {
    const parsed = await safeFetchJson(CURSOR_OAUTH_TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept-Encoding": "identity" },
        body: JSON.stringify({
            grant_type: "refresh_token",
            client_id: CURSOR_OAUTH_CLIENT_ID,
            refresh_token: refreshToken,
        }),
    });
    return typeof parsed?.access_token === "string" ? parsed.access_token : undefined;
}
/**
 * Resolve Cursor percentages from a raw admin/dashboard payload into rounded
 * 0–100 numbers. When `totalPercentUsed` is missing it's derived from
 * included/limit spend, or the max of auto/api. Pure function — unit tested.
 */
export function resolveCursorPercentages(input) {
    const auto = Number.isFinite(Number(input.autoPercentUsed)) ? Number(input.autoPercentUsed) : 0;
    const api = Number.isFinite(Number(input.apiPercentUsed)) ? Number(input.apiPercentUsed) : 0;
    let total = Number.isFinite(Number(input.totalPercentUsed))
        ? Number(input.totalPercentUsed)
        : undefined;
    if (total === undefined) {
        const included = Number.isFinite(Number(input.includedSpendCents))
            ? Number(input.includedSpendCents)
            : Number(input.includedSpend);
        const limit = Number.isFinite(Number(input.limitCents)) ? Number(input.limitCents) : Number(input.limit);
        total = Number.isFinite(included) && Number.isFinite(limit) && limit > 0 ? (included / limit) * 100 : Math.max(auto, api);
    }
    return {
        autoPercentUsed: roundPercent(auto),
        apiPercentUsed: roundPercent(api),
        totalPercentUsed: roundPercent(total),
    };
}
/** Extract the team-member spend list from an admin API response. */
export function getTeamMemberSpendList(response) {
    return response?.teamMemberSpend ?? response?.spend ?? [];
}
/** Pick the matching member by email, or the only member, or undefined. */
export function pickTeamMember(members, preferredEmail) {
    if (members.length === 0)
        return undefined;
    if (preferredEmail) {
        const match = members.find((m) => m?.email?.toLowerCase?.() === preferredEmail.toLowerCase());
        if (match)
            return match;
    }
    return members.length === 1 ? members[0] : undefined;
}
export async function fetchCursorAdminUsage(apiKey, preferredEmail) {
    const parsed = await safeFetchJson(CURSOR_ADMIN_SPEND_URL, {
        method: "POST",
        headers: {
            Authorization: `Basic ${Buffer.from(`${apiKey}:`, "utf8").toString("base64")}`,
            "Content-Type": "application/json",
            "Accept-Encoding": "identity",
        },
        body: JSON.stringify({ searchTerm: preferredEmail || undefined, page: 1, pageSize: 100 }),
    });
    const members = getTeamMemberSpendList(parsed);
    const member = pickTeamMember(members, preferredEmail);
    if (!member) {
        if (members.length > 1) {
            throw new UsageError("Multiple Cursor team members returned. Set CURSOR_USAGE_EMAIL.", "multiuser");
        }
        throw new UsageError("No Cursor member spend data returned", "nodata");
    }
    return {
        provider: "cursor",
        label: "Cursor",
        ...resolveCursorPercentages(member),
        email: member.email,
        source: "cursor-admin-api",
        billingCycleEnd: parsed.subscriptionCycleStart,
    };
}
async function fetchCursorDashboardWithToken(accessToken, email) {
    const parsed = await safeFetchJson(CURSOR_DASHBOARD_USAGE_URL, {
        method: "POST",
        headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
            "Connect-Protocol-Version": "1",
            "Accept-Encoding": "identity",
        },
        body: "{}",
    });
    if (!parsed?.planUsage) {
        throw new UsageError("planUsage missing from Cursor dashboard response", "nodata");
    }
    return {
        provider: "cursor",
        label: "Cursor",
        ...resolveCursorPercentages(parsed.planUsage),
        email,
        source: "cursor-dashboard-api",
        billingCycleEnd: Number.isFinite(Number(parsed.billingCycleEnd)) ? Number(parsed.billingCycleEnd) : undefined,
    };
}
export async function fetchCursorDashboardUsage() {
    const auth = await loadCursorAuth();
    if (!auth?.accessToken) {
        throw new UsageError("Cursor session not found. Open Cursor Desktop or set CURSOR_ADMIN_API_KEY.", "noauth");
    }
    try {
        return await fetchCursorDashboardWithToken(auth.accessToken, auth.email);
    }
    catch (error) {
        if (error instanceof UsageError && error.code === "http401" && auth.refreshToken) {
            const refreshed = await refreshCursorAccessToken(auth.refreshToken);
            if (refreshed)
                return await fetchCursorDashboardWithToken(refreshed, auth.email);
        }
        throw error;
    }
}
async function fetchCursor(ctx) {
    const mode = process.env.CURSOR_USAGE_MODE?.toLowerCase?.();
    const preferredEmail = process.env.CURSOR_USAGE_EMAIL?.trim() || (await loadCursorAuth())?.email;
    const envAdminKey = process.env.CURSOR_ADMIN_API_KEY?.trim() ||
        (mode === "admin" ? process.env.CURSOR_API_KEY?.trim() : undefined);
    const modelRegistryAdminKey = mode === "admin" ? await getApiKey(ctx.modelRegistry, ["cursor"]) : undefined;
    const adminKey = envAdminKey || modelRegistryAdminKey;
    if (mode === "admin") {
        if (!adminKey)
            throw new UsageError("CURSOR_ADMIN_API_KEY is required for admin mode", "noauth");
        return await fetchCursorAdminUsage(adminKey, preferredEmail);
    }
    if (mode === "dashboard") {
        return await fetchCursorDashboardUsage();
    }
    // auto: prefer admin key when present, fall back to dashboard on auth errors.
    if (adminKey) {
        try {
            return await fetchCursorAdminUsage(adminKey, preferredEmail);
        }
        catch (error) {
            if (!(error instanceof UsageError && (error.code === "http401" || error.code === "http403"))) {
                throw error;
            }
        }
    }
    return await fetchCursorDashboardUsage();
}
function renderStatus(data, theme) {
    const total = colorForPercentage(data.totalPercentUsed, theme)(`${pct(data.totalPercentUsed)} used`);
    const auto = colorForPercentage(data.autoPercentUsed, theme)(pct(data.autoPercentUsed));
    const api = colorForPercentage(data.apiPercentUsed, theme)(pct(data.apiPercentUsed));
    return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " Cursor ")}${total} ${fg(theme, "dim", "Auto ")}${auto}${fg(theme, "dim", " API ")}${api}`;
}
function formatDetails(data) {
    return [
        "Cursor usage",
        `Total: ${pct(data.totalPercentUsed)} used`,
        `Auto + Composer: ${pct(data.autoPercentUsed)} used`,
        `API: ${pct(data.apiPercentUsed)} used`,
        data.email ? `Account: ${data.email}` : undefined,
        data.billingCycleEnd ? `Cycle ends: ${new Date(data.billingCycleEnd).toLocaleString()}` : undefined,
        `Source: ${data.source}`,
    ]
        .filter(Boolean)
        .join("\n");
}
export const cursorProvider = {
    id: "cursor",
    label: "Cursor",
    match: (provider) => provider?.startsWith("cursor") ?? false,
    ttlMs: 60_000,
    fetch: fetchCursor,
    renderStatus,
    formatDetails,
};
//# sourceMappingURL=cursor.js.map