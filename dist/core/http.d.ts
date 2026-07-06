/**
 * pi-usage-unified — HTTP helpers and structured errors.
 *
 * Ported from the monolithic pi-usage-multi.ts `safeFetchJson` and the
 * `UsageError` class. The 3-way sandbox-aware auth header strategy lives in
 * `./auth.ts`.
 */
/**
 * Error thrown by API interactions; carries a short code for footer display.
 * Codes include: `fetch`, `http{status}`, `badjson`, `noauth`, `nodata`,
 * `noquotadata`, `ratelimited`, `multiuser`, `api{code}`, `nolimit`.
 */
export declare class UsageError extends Error {
    code: string;
    name: string;
    constructor(message: string, code?: string);
}
/**
 * Fetch a URL and parse the response as JSON, wrapping network / HTTP / parse
 * failures in `UsageError`. Sets a short snippet of the body on HTTP errors.
 */
export declare function safeFetchJson(url: string, init?: RequestInit): Promise<any>;
/**
 * Fetch with error wrapping. Network failures → `UsageError("fetch")`. HTTP
 * non-2xx → `UsageError("http{status}")` with a short body snippet. Returns
 * the raw `Response` so callers can read headers (used by the opencode probe).
 */
export declare function safeFetch(url: string, init?: RequestInit): Promise<Response>;
/** Coerce a value to a finite number, or undefined if not finite. */
export declare function toFiniteNumber(value: unknown): number | undefined;
//# sourceMappingURL=http.d.ts.map