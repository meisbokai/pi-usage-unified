# pi-usage-unified

A unified [pi](https://pi.dev/) extension that monitors **API usage, quota, and rate limits** across multiple AI providers in a single footer status line.

It replaces the captain's previous setup of three separate usage tools:

- `@alexanderfortin/pi-zai-usage` (Z.ai/GLM only)
- `pi-cursor-usage` (Cursor only)
- a local untracked `pi-usage-multi.ts` monolith

…with **one clean, extensible, tracked extension**: a plugin-registry core where each provider is its own small file. Adding a provider is **one new file + one `registerProvider()` line**.

## Screenshot

<!-- TODO: drop a screenshot of the footer status line here -->

`Usage: Codex 5h 42.5% / W 10% used (3h 12m)`

## Install

```
pi install git:github.com/meisbokai/pi-usage-unified
```

Or, to hack on it locally:

```
git clone https://github.com/meisbokai/pi-usage-unified.git
cd pi-usage-unified
npm install
npm run build
pi -e ./dist/index.js
```

## Commands

| Command | Description |
| --- | --- |
| `/pi-usage` | Show usage details for the active provider. |
| `/pi-usage refresh` | Force a fresh fetch (bypass cache) for the active provider. |
| `/pi-usage all` | Show details for **all** registered providers. |
| `/pi-usage clear` | Clear the cache + footer status (and legacy single-provider keys). |
| `/usage` | Alias for `/pi-usage`. |

The extension owns a **single footer status key** (`pi-usage`). On `session_start`, `model_select`, and `turn_end` it resolves the active provider from `ctx.model.provider`, fetches (cache-aware), and renders. Legacy status keys from older single-provider extensions (`zai-usage`, `cursor-usage`, `codex-limit`, …) are cleared on activation so nothing double-renders. Set `PI_USAGE_UNIFIED_CLEAR_LEGACY=0` to disable that cleanup.

## Providers

All six built-in providers are registered by default.

| Provider | `match` (model provider) | Auth | Env vars |
| --- | --- | --- | --- |
| **Z.ai / GLM** | `zai*`, `glm` | API key (`zai` / `glm` / `zai-coding-cn`) | — |
| **Cursor** | `cursor*` | Admin API key **or** Cursor Desktop session (SQLite) | `CURSOR_USAGE_MODE` (`auto`\|`admin`\|`dashboard`), `CURSOR_USAGE_EMAIL`, `CURSOR_ADMIN_API_KEY`, `CURSOR_API_KEY` |
| **OpenAI Codex** | `openai-codex*` | OAuth token (`openai-codex`) + `openai-codex.accountId` in `~/.pi/agent/auth.json` | — |
| **OpenCode Go** | `opencode*` | API key (`opencode-go` / `opencode`) | `OPENCODE_API_KEY`, `OPENCODE_GO_WORKSPACE_ID`, `OPENCODE_GO_AUTH_COOKIE`, `OPENCODE_GO_QUOTA_CONFIG` |
| **OpenRouter** | `openrouter*` | API key (`openrouter`) | `OPENROUTER_API_KEY` |
| **DeepSeek** | `deepseek*` | API key (`deepseek`) | `DEEPSEEK_API_KEY` |

### Provider details

- **Z.ai / GLM** — `GET https://api.z.ai/api/monitor/usage/quota/limit`, parses the `TOKENS_LIMIT` percentage and next reset time.
- **Cursor** — Two modes. **Admin API** (`POST api.cursor.com/teams/spend`, Basic auth) reads team-member spend. **Dashboard** reads the Cursor Desktop SQLite `state.vscdb` for the access/refresh token + email, then calls `POST api2.cursor.sh/.../GetCurrentPeriodUsage` (with automatic OAuth refresh). `CURSOR_USAGE_MODE=auto` (default) prefers the admin key and falls back to the dashboard on auth errors. Renders total / Auto+Composer / API percentages.
- **OpenAI Codex** — `GET chatgpt.com/backend-api/codex/usage` (fallback `/wham/usage`) with the `chatgpt-account-id` header. Renders primary (5h) + secondary (weekly) `used_percent`, reset times, plan, and credits.
- **OpenCode Go** — Probes `POST opencode.ai/zen/go/v1/chat/completions` with a 1-token ping and reads the `x-opencode-*-usage-percent` headers (rolling/weekly/monthly). Optionally scrapes dashboard quota from `opencode.ai/workspace/<id>/go` when `OPENCODE_GO_WORKSPACE_ID` + `OPENCODE_GO_AUTH_COOKIE` are set.
- **OpenRouter** — `GET openrouter.ai/api/v1/key` (spend, limit, key-limit %) and `GET openrouter.ai/api/v1/credits` (total purchased − total usage → balance). Renders key-limit %, spend, and credit balance ($).
- **DeepSeek** — `GET api.deepseek.com/user/balance`. Renders the balance object (`is_sufficient`, `discounted_balance`, `granted_balance`, `topped_up_balance`) as a credit balance — not a percentage.

### Color thresholds

Percentage- and credit-based values are colored via thresholds (accent → warning → error). Defaults: percentage warning 80 / critical 90; credit warning $5 / critical $1. Override them in `~/.pi/agent/usage-lib.json` (shared with `@alexanderfortin/pi-usage-lib`):

```json
{
  "thresholds": {
    "percentage": { "warning": 75, "critical": 85 },
    "credit": { "warning": 3, "critical": 1.5 }
  }
}
```

## Architecture

```
src/
  index.ts                 # default export: the unified extension factory
  core/
    extension.ts           # owns ONE status key + cache + event lifecycle
    registry.ts            # ProviderRegistry: registerProvider(id, def); resolve(model.provider)
    cache.ts               # per-provider TTL cache
    auth.ts                # buildAuthHeaders() — 3-way sandbox-aware (real key / "proxy-managed" / no key)
    http.ts                # safeFetch / safeFetchJson + UsageError
    theme.ts               # colorForPercentage / colorForCredit / thresholds config
    format.ts              # pct / formatDurationFromNow / normalizeResetAt
    config.ts              # read ~/.pi/agent/auth.json
    types.ts               # UsageProvider<TData> interface, shared types
  providers/
    zai.ts                 # { match, fetch, renderStatus, formatDetails, ttl }
    cursor.ts
    codex.ts
    opencode.ts
    openrouter.ts          # NEW
    deepseek.ts            # NEW
    index.ts               # registerProvider(...) calls for all built-ins
test/                      # unit tests (vitest) per provider + registry
```

### The provider plugin contract

```ts
export interface UsageProvider<TData = unknown> {
  id: string;                                          // "zai"
  label: string;                                       // "Z.ai"
  match: (provider: string | undefined) => boolean;    // detect from ctx.model.provider (lowercased)
  ttlMs?: number;                                      // cache TTL override (default 60s)
  fetch: (ctx: FetchContext) => Promise<TData>;        // auth + endpoint + parse → normalized data
  renderStatus: (data: TData, theme: Theme) => string; // single footer line
  formatDetails?: (data: TData) => string;             // multi-line breakdown for /pi-usage
  renderError?: (error: unknown, theme: Theme) => string; // optional override
}
```

The core owns exactly **one** `ctx.ui.setStatus("pi-usage", ...)` key, one shared cache keyed by provider id, and the `session_start` / `model_select` / `turn_end` / `session_shutdown` lifecycle. Adding a provider = one new file under `src/providers/` + one `registerProvider()` line in `src/providers/index.ts`.

#### Writing a new provider

```ts
// src/providers/myprovider.ts
import type { FetchContext, Theme, UsageProvider } from "../core/types.js";
import { buildAuthHeaders } from "../core/auth.js";
import { safeFetchJson } from "../core/http.js";

export interface MyData { provider: "myprovider"; usedPercent: number; source: string }

export function parseMyProvider(parsed: any): MyData { /* pure, unit-testable */ … }

async function fetchMyProvider(ctx: FetchContext): Promise<MyData> {
  const headers = await buildAuthHeaders(ctx.modelRegistry, ["myprovider"]);
  return parseMyProvider(await safeFetchJson("https://example.com/usage", { headers }));
}

export const myProvider: UsageProvider<MyData> = {
  id: "myprovider",
  label: "MyProvider",
  match: (p) => p?.startsWith("myprovider") ?? false,
  ttlMs: 60_000,
  fetch: fetchMyProvider,
  renderStatus: (d, t) => `Usage: MyProvider ${d.usedPercent}%`,
};
```

```ts
// src/providers/index.ts — add one line:
import { myProvider } from "./myprovider.js";
export { myProvider } from "./myprovider.js";
// in createDefaultRegistry():
registry.registerProvider(myProvider);
```

## Future providers (not yet implemented)

These need heavier OAuth/credential extraction or a response-header hook and are intentionally out of scope for v1:

- **Claude (Anthropic) OAuth usage API**, **Gemini OAuth quota API**, **Mistral admin API** — OAuth/credential extraction.
- **Groq**, **Anthropic/OpenAI raw-key**, **xAI** — header-only usage via an `after_provider_response` hook (the registry is designed to allow this later).
- **GitHub Copilot** — credential extraction.

## Development

```
npm run build        # tsc → dist/
npm run typecheck    # tsc --noEmit (includes test/)
npm test             # vitest run
npm run check        # typecheck + test
```

No runtime dependencies beyond the pi peers (`@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`) and optional `typebox`. Uses only Node built-ins (`node:fs`, `node:os`, `node:path`, `node:sqlite`).

## License

MIT © meisbokai
