import type { UsageProvider } from "../core/types.js";
export interface CursorUsageData {
    provider: "cursor";
    label: string;
    totalPercentUsed: number;
    autoPercentUsed: number;
    apiPercentUsed: number;
    email?: string;
    billingCycleEnd?: number;
    source: string;
}
interface CursorAuth {
    accessToken: string;
    refreshToken?: string;
    email?: string;
}
/** Candidate Cursor Desktop SQLite paths across Linux / macOS / Windows. */
export declare function cursorDbPaths(home?: string): string[];
/** Read accessToken/refreshToken/email from the Cursor Desktop SQLite session. */
export declare function loadCursorAuth(): Promise<CursorAuth | undefined>;
/** Exchange a refresh token for a new access token via Cursor's OAuth endpoint. */
export declare function refreshCursorAccessToken(refreshToken: string): Promise<string | undefined>;
interface RawPercentages {
    totalPercentUsed?: unknown;
    autoPercentUsed?: unknown;
    apiPercentUsed?: unknown;
    includedSpendCents?: unknown;
    includedSpend?: unknown;
    limitCents?: unknown;
    limit?: unknown;
}
/**
 * Resolve Cursor percentages from a raw admin/dashboard payload into rounded
 * 0–100 numbers. When `totalPercentUsed` is missing it's derived from
 * included/limit spend, or the max of auto/api. Pure function — unit tested.
 */
export declare function resolveCursorPercentages(input: RawPercentages): {
    autoPercentUsed: number;
    apiPercentUsed: number;
    totalPercentUsed: number;
};
/** Extract the team-member spend list from an admin API response. */
export declare function getTeamMemberSpendList(response: any): any[];
/** Pick the matching member by email, or the only member, or undefined. */
export declare function pickTeamMember(members: any[], preferredEmail?: string): any | undefined;
export declare function fetchCursorAdminUsage(apiKey: string, preferredEmail?: string): Promise<CursorUsageData>;
export declare function fetchCursorDashboardUsage(): Promise<CursorUsageData>;
export declare const cursorProvider: UsageProvider<CursorUsageData>;
export {};
//# sourceMappingURL=cursor.d.ts.map