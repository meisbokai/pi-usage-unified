/**
 * Z.ai / GLM usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * - Auth: API key, providers `zai` / `glm` / `zai-coding-cn`
 * - Endpoint: GET https://api.z.ai/api/monitor/usage/quota/limit
 * - Parse: every entry in `data.limits` mapped by its `unit` code to a
 *   human label, then rendered in fixed order [5h, Weekly, Tools].
 *
 * The API returns three quotas we care about:
 *   unit=3  TOKENS_LIMIT  → 5-hour token limit   (label: "5h")
 *   unit=6  TOKENS_LIMIT  → weekly token limit   (label: "Weekly")
 *   unit=5  TIME_LIMIT    → tool-call limit      (label: "Tools")
 * Unknown `unit` codes are ignored so the footer survives API additions.
 */
import type { FetchContext, Theme, UsageProvider } from "../core/types.js";
import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson, UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { formatDurationFromNow, normalizeResetAt, pct } from "../core/format.js";

const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit";

/** Human label for a Z.ai `unit` code, in the order we want to render it. */
const ZAI_UNIT_LABELS: Record<number, string> = {
  3: "5h", // 5-hour token limit
  6: "Weekly", // weekly token limit
  5: "Tools", // tool-call limit (search-prime, web-reader, zread)
};
const ZAI_LIMIT_ORDER = [3, 6, 5] as const;

export interface ZaiLimitData {
  /** Human label, e.g. "5h", "Weekly", "Tools". */
  label: string;
  /** Percent of the limit consumed (0–100). */
  usedPercent: number;
  /** Epoch seconds when the limit resets, or undefined if unknown. */
  resetAt?: number;
}

export interface ZaiUsageData {
  provider: "zai";
  label: string;
  /** All known limits, in fixed display order [5h, Weekly, Tools]. */
  limits: ZaiLimitData[];
  source: string;
}

interface ZaiLimitRaw {
  type?: string;
  unit?: number | string;
  percentage?: number;
  nextResetTime?: string | number;
}

/**
 * Parse a Z.ai quota response. Pure function — exposed for unit tests.
 *
 * Throws UsageError("nolimit") when no recognized limit is present, and
 * UsageError(`api{code}`) when the API returns `success: false`.
 */
export function parseZaiUsage(parsed: any): ZaiUsageData {
  if (parsed && typeof parsed.success === "boolean" && !parsed.success) {
    throw new UsageError(`Z.ai API error: ${parsed.msg ?? "unknown"}`, `api${parsed.code ?? "unknown"}`);
  }
  const limitsRaw: ZaiLimitRaw[] = parsed?.data?.limits ?? [];

  const limits: ZaiLimitData[] = [];
  for (const raw of limitsRaw) {
    const unit = Number(raw?.unit);
    const label = ZAI_UNIT_LABELS[unit];
    if (!label) continue;
    const used = Number(raw?.percentage);
    if (!Number.isFinite(used)) continue;
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
  limits.sort(
    (a, b) =>
      ZAI_LIMIT_ORDER.findIndex((u) => ZAI_UNIT_LABELS[u] === a.label) -
      ZAI_LIMIT_ORDER.findIndex((u) => ZAI_UNIT_LABELS[u] === b.label),
  );

  return {
    provider: "zai",
    label: "Z.ai",
    limits,
    source: "zai-api",
  };
}

async function fetchZai(ctx: FetchContext): Promise<ZaiUsageData> {
  const headers = await buildAuthHeaders(ctx.modelRegistry, ["zai", "glm", "zai-coding-cn"]);
  const parsed = await safeFetchJson(ZAI_USAGE_API_URL, { headers });
  return parseZaiUsage(parsed);
}

function renderStatus(data: ZaiUsageData, theme: Theme): string {
  const segments = data.limits.map((l) => {
    const color = colorForPercentage(l.usedPercent, theme);
    const dur = l.resetAt ? formatDurationFromNow(l.resetAt) : undefined;
    const head = color(`${pct(l.usedPercent)} used`);
    return dur ? `${head}${fg(theme, "dim", ` (${dur})`)}` : head;
  });
  return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " Z.ai ")}${segments.join(", ")}`;
}

function formatDetails(data: ZaiUsageData): string {
  const lines = data.limits.map((l) => {
    const reset = l.resetAt ? `, resets in ${formatDurationFromNow(l.resetAt)}` : "";
    return `${l.label}: ${pct(l.usedPercent)} used${reset}`;
  });
  return ["Z.ai usage", ...lines, `Source: ${data.source}`].join("\n");
}

export const zaiProvider: UsageProvider<ZaiUsageData> = {
  id: "zai",
  label: "Z.ai",
  match: (provider) => provider === "glm" || (provider?.startsWith("zai") ?? false),
  ttlMs: 30_000,
  fetch: fetchZai,
  renderStatus,
  formatDetails,
};
