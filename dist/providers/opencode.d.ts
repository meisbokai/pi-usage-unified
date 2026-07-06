import type { UsageProvider } from "../core/types.js";
export interface OpencodeWindow {
    usedPercent: number;
}
export interface OpencodeUsageData {
    provider: "opencode";
    label: string;
    rolling?: OpencodeWindow;
    weekly?: OpencodeWindow;
    monthly?: OpencodeWindow;
    dashboard?: {
        rolling?: number;
        weekly?: number;
        monthly?: number;
    };
    source: string;
    probeModel: string;
}
/** Read a numeric header value (case-insensitive) from a Headers-like object. */
export declare function numberHeader(headers: Record<string, string>, name: string): number | undefined;
/** Clamp an opencode window value to 0–100, or undefined when not finite. */
export declare function normalizeOpencodeWindow(value: unknown): number | undefined;
/** Parse the dashboard JSON blob scraped from the opencode workspace HTML. */
export declare function parseOpencodeDashboard(parsed: any): {
    rolling?: number;
    weekly?: number;
    monthly?: number;
} | undefined;
export declare const opencodeProvider: UsageProvider<OpencodeUsageData>;
//# sourceMappingURL=opencode.d.ts.map