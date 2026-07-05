/**
 * OpenRouter usage provider. (NEW)
 *
 * - Auth: API key provider `openrouter`, or `OPENROUTER_API_KEY`
 * - Endpoints:
 *   - GET https://openrouter.ai/api/v1/key   (rate limit + spend/limit dollars)
 *   - GET https://openrouter.ai/api/v1/credits (total purchased, total usage)
 * - Output: key-limit %, spend, credit balance ($)
 */
import type { FetchContext, Theme, UsageProvider } from "../core/types.js";
import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson } from "../core/http.js";
import { colorForCredit, colorForPercentage, fg } from "../core/theme.js";
import { pct } from "../core/format.js";

const OPENROUTER_KEY_URL = "https://openrouter.ai/api/v1/key";
const OPENROUTER_CREDITS_URL = "https://openrouter.ai/api/v1/credits";

export interface OpenRouterUsageData {
  provider: "openrouter";
  label: string;
  /** usage/limit*100 when a spend limit is set. */
  keyUsagePercent?: number;
  /** spend so far this period, in USD. */
  keySpend?: number;
  /** spend limit for the period, in USD. */
  keyLimit?: number;
  /** total_credits - total_usage, in USD. */
  creditBalance?: number;
  source: string;
}

function toFinite(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  const n = Number(value);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Parse an OpenRouter `/api/v1/key` response `{ data: { usage, limit, ... } }`.
 * Pure function — unit tested. Returns undefined fields when data is missing.
 */
export function parseOpenRouterKey(parsed: any): {
  keyUsagePercent?: number;
  keySpend?: number;
  keyLimit?: number;
} {
  const data = parsed?.data ?? parsed;
  const usage = toFinite(data?.usage);
  const limit = toFinite(data?.limit);
  const result: { keyUsagePercent?: number; keySpend?: number; keyLimit?: number } = {};
  if (usage !== undefined) result.keySpend = usage;
  if (limit !== undefined) result.keyLimit = limit;
  if (usage !== undefined && limit !== undefined && limit > 0) {
    result.keyUsagePercent = Math.round((usage / limit) * 1000) / 10;
  }
  return result;
}

/**
 * Parse an OpenRouter `/api/v1/credits` response `{ total_credits, total_usage }`
 * into a credit balance. Pure function — unit tested.
 */
export function parseOpenRouterCredits(parsed: any): { creditBalance?: number } {
  const totalCredits = toFinite(parsed?.total_credits ?? parsed?.totalCredits);
  const totalUsage = toFinite(parsed?.total_usage ?? parsed?.totalUsage);
  if (totalCredits === undefined && totalUsage === undefined) return {};
  const balance = (totalCredits ?? 0) - (totalUsage ?? 0);
  return { creditBalance: Number.isFinite(balance) ? Math.round(balance * 1000) / 1000 : undefined };
}

async function fetchOpenRouter(ctx: FetchContext): Promise<OpenRouterUsageData> {
  const headers = await buildAuthHeaders(ctx.modelRegistry, ["openrouter"]);

  // The key endpoint is the primary one; credits is best-effort supplemental.
  const keyParsed = await safeFetchJson(OPENROUTER_KEY_URL, { headers });
  const key = parseOpenRouterKey(keyParsed);

  let credits: { creditBalance?: number } = {};
  try {
    const creditsParsed = await safeFetchJson(OPENROUTER_CREDITS_URL, { headers });
    credits = parseOpenRouterCredits(creditsParsed);
  } catch {
    /* credits endpoint optional */
  }

  return {
    provider: "openrouter",
    label: "OpenRouter",
    ...key,
    ...credits,
    source: "openrouter-api",
  };
}

function money(value: number | undefined): string {
  if (value === undefined || !Number.isFinite(value)) return "$?";
  return `$${Math.round(value * 100) / 100}`;
}

function renderStatus(data: OpenRouterUsageData, theme: Theme): string {
  const main =
    data.keyUsagePercent !== undefined
      ? colorForPercentage(data.keyUsagePercent, theme)(`${pct(data.keyUsagePercent)} used`)
      : data.keyLimit !== undefined
        ? fg(theme, "muted", "no limit set")
        : fg(theme, "muted", "n/a");
  const balance =
    data.creditBalance !== undefined
      ? `${fg(theme, "dim", " bal ")}${colorForCredit(data.creditBalance, theme)(money(data.creditBalance))}`
      : "";
  const spend =
    data.keySpend !== undefined ? `${fg(theme, "dim", " spent ")}${fg(theme, "dim", money(data.keySpend))}` : "";
  return `${fg(theme, "muted", "Usage:")}${fg(theme, "muted", " OpenRouter ")}${main}${spend}${balance}`;
}

function formatDetails(data: OpenRouterUsageData): string {
  return [
    "OpenRouter usage",
    data.keyUsagePercent !== undefined ? `Limit: ${pct(data.keyUsagePercent)} used` : undefined,
    data.keySpend !== undefined ? `Spend: ${money(data.keySpend)}` : undefined,
    data.keyLimit !== undefined ? `Limit cap: ${money(data.keyLimit)}` : undefined,
    data.creditBalance !== undefined ? `Credit balance: ${money(data.creditBalance)}` : undefined,
    `Source: ${data.source}`,
  ]
    .filter(Boolean)
    .join("\n");
}

export const openrouterProvider: UsageProvider<OpenRouterUsageData> = {
  id: "openrouter",
  label: "OpenRouter",
  match: (provider) => provider?.startsWith("openrouter") ?? false,
  ttlMs: 60_000,
  fetch: fetchOpenRouter,
  renderStatus,
  formatDetails,
};
