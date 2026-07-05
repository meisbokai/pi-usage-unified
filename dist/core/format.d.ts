/**
 * pi-usage-unified — formatting helpers shared by providers.
 *
 * Ported from the monolithic pi-usage-multi.ts (`pct`, `formatDurationFromNow`,
 * `usedFromLeft`). Uses plain `Date` math — no temporal polyfill required.
 */
/** Format a 0–100 number as a rounded percentage string, e.g. `71.3%`. */
export declare function pct(value: number | undefined): string;
/** Round a number to one decimal place, treating non-finite values as 0. */
export declare function roundPercent(value: unknown): number;
/** Given a "percent remaining" value, return the "percent used" (0–100). */
export declare function usedFromLeft(leftPercent: number | undefined): number | undefined;
/**
 * Format the duration from now until an epoch-seconds timestamp as a short
 * human string (`5m`, `3h`, `2d 5h`). Returns undefined if no timestamp.
 */
export declare function formatDurationFromNow(epochSeconds: number | undefined): string | undefined;
/**
 * Normalize an epoch timestamp that may be in milliseconds or seconds.
 * Values above 10_000_000_000 are treated as milliseconds and divided by 1000.
 */
export declare function normalizeResetAt(value: unknown): number | undefined;
//# sourceMappingURL=format.d.ts.map