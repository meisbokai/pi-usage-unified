/**
 * Z.ai / GLM usage provider.
 *
 * Ported verbatim in behavior from the monolithic pi-usage-multi.ts.
 *
 * - Auth: API key, providers `zai` / `glm` / `zai-coding-cn`
 * - Endpoint: GET https://api.z.ai/api/monitor/usage/quota/limit
 * - Parse: `data.limits` find `type === "TOKENS_LIMIT"` → percentage + nextResetTime
 */
import type { FetchContext, Theme, UsageProvider } from "../core/types.js";
import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson, UsageError } from "../core/http.js";
import { colorForPercentage, fg } from "../core/theme.js";
import { formatDurationFromNow, pct } from "../core/format.js";

const ZAI_USAGE_API_URL = "https://api.z.ai/api/monitor/usage/quota/limit";

export interface ZaiUsageData {
  provider: "zai";
  label: string;
  usedPercent: number;
  resetAt?: number;
  source: string;
}

interface ZaiLimit {
  type?: string;
  percentage?: number;
  nextResetTime?: string | number;
}

/**
 * Parse a Z.ai quota response. Pure function — exposed for unit tests.
 *
 * Throws UsageError("nolimit") when no TOKENS_LIMIT is present, and
 * UsageError(`api{code}`) when the API returns `success: false`.
 */
export function parseZaiUsage(parsed: any): ZaiUsageData {
  if (parsed && typeof parsed.success === "boolean" && !parsed.success) {
    throw new UsageError(`Z.ai API error: ${parsed.msg ?? "unknown"}`, `api${parsed.code ?? "unknown"}`);
  }
  const tokensLimit: ZaiLimit | undefined = parsed?.data?.limits?.find?.(
    (limit: ZaiLimit) => limit?.type === "TOKENS_LIMIT",
  );
  if (!tokensLimit) throw new UsageError("TOKENS_LIMIT not found", "nolimit");
  const nextReset = tokensLimit.nextResetTime;
  return {
    provider: "zai",
    label: "Z.ai",
    usedPercent: Number(tokensLimit.percentage),
    resetAt: nextReset ? Math.round(Number(nextReset) / 1000) : undefined,
    source: "zai-api",
  };
}

async function fetchZai(ctx: FetchContext): Promise<ZaiUsageData> {
  const headers = await buildAuthHeaders(ctx.modelRegistry, ["zai", "glm", "zai-coding-cn"]);
  const parsed = await safeFetchJson(ZAI_USAGE_API_URL, { headers });
  return parseZaiUsage(parsed);
}

function renderStatus(data: ZaiUsageData, theme: Theme): string {
  const color = colorForPercentage(data.usedPercent, theme);
  const reset = data.resetAt ? fg(theme, "dim", ` (${formatDurationFromNow(data.resetAt)})`) : "";
  return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " Z.ai ")}${color(`${pct(data.usedPercent)} used`)}${reset}`;
}

function formatDetails(data: ZaiUsageData): string {
  return [
    "Z.ai usage",
    `Tokens: ${pct(data.usedPercent)} used`,
    data.resetAt ? `Resets in: ${formatDurationFromNow(data.resetAt)}` : undefined,
    `Source: ${data.source}`,
  ]
    .filter(Boolean)
    .join("\n");
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
