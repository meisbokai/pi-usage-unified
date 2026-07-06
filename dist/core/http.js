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
export class UsageError extends Error {
    code;
    name = "UsageError";
    constructor(message, code = "error") {
        super(message);
        this.code = code;
    }
}
/**
 * Fetch a URL and parse the response as JSON, wrapping network / HTTP / parse
 * failures in `UsageError`. Sets a short snippet of the body on HTTP errors.
 */
export async function safeFetchJson(url, init = {}) {
    const response = await safeFetch(url, init);
    try {
        return await response.json();
    }
    catch (error) {
        throw new UsageError(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`, "badjson");
    }
}
/**
 * Fetch with error wrapping. Network failures → `UsageError("fetch")`. HTTP
 * non-2xx → `UsageError("http{status}")` with a short body snippet. Returns
 * the raw `Response` so callers can read headers (used by the opencode probe).
 */
export async function safeFetch(url, init = {}) {
    let response;
    try {
        response = await fetch(url, init);
    }
    catch (error) {
        throw new UsageError(`Network error: ${error instanceof Error ? error.message : String(error)}`, "fetch");
    }
    if (!response.ok) {
        let body = "";
        try {
            body = await response.text();
        }
        catch {
            /* ignore */
        }
        throw new UsageError(`HTTP ${response.status}${body ? `: ${body.slice(0, 180)}` : ""}`, `http${response.status}`);
    }
    return response;
}
/** Coerce a value to a finite number, or undefined if not finite. */
export function toFiniteNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : undefined;
}
//# sourceMappingURL=http.js.map