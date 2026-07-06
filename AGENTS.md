# AGENTS.md — pi-usage-unified

Agent guidance for working in this repo.

## What this is

A unified pi extension (`pi-usage`) that monitors API usage / quota / rate
limits across multiple AI providers in a single footer status line. It is a
plugin-registry core where each provider is its own small file. Built to
replace three prior tools (see README) with one clean, publishable package.

## Architecture in one breath

- `src/core/extension.ts` owns **exactly one** status key (`pi-usage`), one
  shared `UsageCache` keyed by provider id, and the lifecycle
  (`session_start` / `model_select` / `turn_end` / `session_shutdown`).
- `src/core/registry.ts` (`ProviderRegistry`) resolves the active provider from
  `ctx.model.provider` (lowercased) by calling each provider's `match`.
- Each provider in `src/providers/*.ts` implements the `UsageProvider<TData>`
  contract: `{ id, label, match, ttlMs?, fetch, renderStatus, formatDetails?,
  renderError? }`.
- `src/providers/index.ts` `createDefaultRegistry()` registers all built-ins.
  **Adding a provider = one new file + one `registerProvider()` line there.**
- On activation, legacy single-provider status keys (`zai-usage`,
  `cursor-usage`, `codex-limit`, `pi-usage-multi`, …) are cleared so old
  extensions don't double-render. Disable with
  `PI_USAGE_UNIFIED_CLEAR_LEGACY=0`.

## Porting provenance (do not regress behavior)

The four ported providers (zai, cursor, codex, opencode) are **faithful ports**
of the working local monolith `~/.pi/agent/extensions/pi-usage-multi.ts`. The
goal was structure, not new logic — preserve their fetch/parse/render behavior.
The two NEW providers are openrouter and deepseek. When changing a ported
provider, diff against the monolith first.

The 3-way sandbox-aware auth strategy (`buildAuthHeaders`) mirrors
`@alexanderfortin/pi-usage-lib`: real key → `Bearer`; `"proxy-managed"`
sentinel → no header (Docker sandbox proxy injects it); no key → no header.
Always set `Accept-Encoding: identity` (undici EnvHttpProxyAgent gzip quirk).

## Conventions

- **ESM + TypeScript**, `NodeNext` module resolution → use `.js` extensions in
  all relative imports (incl. test imports of `../src/...`).
- Build: `tsc` with `rootDir: "src"` → `dist/` (so `dist/index.js` matches the
  `package.json` `pi.extensions` entry). `tsconfig.test.json` extends it with
  `rootDir: "."` + `noEmit` for typechecking `test/`. **`dist/` is committed to
  the repo on purpose** — it ships as build output so `pi install git:...` loads
  the extension without a build step (git-package installs run
  `npm install --omit=dev`, which has no `typescript` to build with). After
  changing `src/`, run `npm run build` and commit the rebuilt `dist/`.
- **No runtime deps** beyond pi peers + optional `typebox`. Use only Node
  built-ins. `node:sqlite` is imported dynamically (experimental). No
  `temporal-polyfill` — use `Date` math.
- Parse logic is factored into **pure exported functions**
  (`parseZaiUsage`, `normalizeCodexUsage`, `resolveCursorPercentages`,
  `parseOpenRouterKey`, `parseDeepSeekBalance`, …) so they can be unit-tested
  with fixture JSON without `fetch`.
- The registry erases provider data-type params to `UsageProvider<any>` on
  insert (function params are contravariant, so `UsageProvider<ZaiData>` is not
  assignable to `UsageProvider<unknown>`).
- Color thresholds are shared with `@alexanderfortin/pi-usage-lib` via
  `~/.pi/agent/usage-lib.json`.

## Commands

- `npm run check` — typecheck + test (run before committing)
- `npm run build` — `tsc` → `dist/`
- `npm test` — vitest

## Provider `match` reference

The registry lowercases `ctx.model.provider` before calling `match`:

| provider | matches |
| --- | --- |
| zai | `glm`, `zai*` |
| cursor | `cursor*` |
| codex | `openai-codex*` |
| opencode | `opencode*` |
| openrouter | `openrouter*` |
| deepseek | `deepseek*` |
