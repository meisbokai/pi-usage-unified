/**
 * pi-usage-unified — formatting helpers shared by providers.
 *
 * Ported from the monolithic pi-usage-multi.ts (`pct`, `formatDurationFromNow`,
 * `usedFromLeft`). Uses plain `Date` math — no temporal polyfill required.
 */
/** Format a 0–100 number as a rounded percentage string, e.g. `71.3%`. */
export function pct(value) {
    if (value === undefined || !Number.isFinite(value))
        return "?%";
    return `${Math.round(value * 10) / 10}%`;
}
/** Round a number to one decimal place, treating non-finite values as 0. */
export function roundPercent(value) {
    return Math.round((Number(value) || 0) * 10) / 10;
}
/** Given a "percent remaining" value, return the "percent used" (0–100). */
export function usedFromLeft(leftPercent) {
    return leftPercent === undefined ? undefined : Math.max(0, Math.min(100, 100 - leftPercent));
}
/**
 * Format the duration from now until an epoch-seconds timestamp as a short
 * human string (`5m`, `3h`, `2d 5h`). Returns undefined if no timestamp.
 */
export function formatDurationFromNow(epochSeconds) {
    if (!epochSeconds)
        return undefined;
    const seconds = Math.max(0, Math.round(epochSeconds - Date.now() / 1000));
    const days = Math.floor(seconds / 86400);
    const hours = Math.floor((seconds % 86400) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    if (days > 0)
        return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0)
        return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes || 1}m`;
}
/**
 * Normalize an epoch timestamp that may be in milliseconds or seconds.
 * Values above 10_000_000_000 are treated as milliseconds and divided by 1000.
 */
export function normalizeResetAt(value) {
    const n = Number(value);
    if (!Number.isFinite(n))
        return undefined;
    return n > 10_000_000_000 ? Math.round(n / 1000) : n;
}
//# sourceMappingURL=format.js.map