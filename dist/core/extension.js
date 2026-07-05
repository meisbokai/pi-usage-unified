import { createCache } from "./cache.js";
import { fg } from "./theme.js";
import { UsageError } from "./http.js";
/** The single footer status key used by this extension. */
export const STATUS_KEY = "pi-usage";
/**
 * Status keys previously written by single-provider extensions or older builds
 * of pi-usage-unified. Cleared on every activation so they don't double-render
 * alongside this extension's own `pi-usage` key. (`pi-usage` itself is our key,
 * so it is deliberately not in this list.)
 */
export const LEGACY_STATUS_KEYS = [
    "zai-usage",
    "cursor-usage",
    "codex-limit",
    "codex-usage",
    "chatgpt-limit",
    "pi-usage-multi",
    "usage-multi",
    "usage-limits",
];
/** Set to `0` to disable clearing of legacy status keys. */
const CLEAR_LEGACY_ENV = "PI_USAGE_UNIFIED_CLEAR_LEGACY";
function clearLegacyStatuses(ctx) {
    if (process.env[CLEAR_LEGACY_ENV] === "0")
        return;
    for (const key of LEGACY_STATUS_KEYS) {
        ctx.ui.setStatus(key, undefined);
    }
}
function defaultRenderError(providerId, error, theme) {
    const code = error instanceof UsageError ? error.code : "fetch";
    return `${fg(theme, "muted", "Usage:")} ${fg(theme, "error", `${providerId} <err:${code}>`)}`;
}
/**
 * Create the unified pi extension factory bound to a registry.
 *
 * Usage:
 * ```ts
 * export default function (pi: ExtensionAPI) {
 *   return createUnifiedExtension(createDefaultRegistry())(pi);
 * }
 * ```
 */
export function createUnifiedExtension(registry) {
    return function extension(pi) {
        const cache = createCache();
        async function updateActive(ctx, force = false, notifyErrors = false) {
            clearLegacyStatuses(ctx);
            const provider = registry.resolve(ctx.model?.provider);
            if (!provider) {
                ctx.ui.setStatus(STATUS_KEY, undefined);
                return;
            }
            try {
                const data = await cache.get(provider, { modelRegistry: ctx.modelRegistry }, force);
                ctx.ui.setStatus(STATUS_KEY, provider.renderStatus(data, ctx.ui.theme));
            }
            catch (error) {
                const line = provider.renderError
                    ? provider.renderError(error, ctx.ui.theme)
                    : defaultRenderError(provider.id, error, ctx.ui.theme);
                ctx.ui.setStatus(STATUS_KEY, line);
                if (notifyErrors) {
                    ctx.ui.notify(error instanceof Error ? error.message : String(error), "error");
                }
            }
        }
        pi.on("session_start", async (_event, ctx) => {
            await updateActive(ctx);
        });
        pi.on("model_select", async (_event, ctx) => {
            await updateActive(ctx, true);
        });
        pi.on("turn_end", async (_event, ctx) => {
            await updateActive(ctx);
        });
        pi.on("session_shutdown", async (_event, ctx) => {
            ctx.ui.setStatus(STATUS_KEY, undefined);
            clearLegacyStatuses(ctx);
            cache.clear();
        });
        async function showUsage(args, ctx) {
            const parts = String(args ?? "").trim().split(/\s+/).filter(Boolean);
            const command = parts[0]?.toLowerCase();
            const force = parts.includes("refresh") || command === "refresh";
            if (command === "clear") {
                cache.clear();
                ctx.ui.setStatus(STATUS_KEY, undefined);
                clearLegacyStatuses(ctx);
                ctx.ui.notify("pi-usage cache/status cleared", "info");
                return;
            }
            const providers = command === "all"
                ? registry.list()
                : [registry.resolve(ctx.model?.provider)].filter(Boolean);
            if (providers.length === 0) {
                ctx.ui.notify("Active model is not supported by any usage provider.", "info");
                return;
            }
            const lines = [];
            for (const provider of providers) {
                if (!provider)
                    continue;
                try {
                    const data = await cache.get(provider, { modelRegistry: ctx.modelRegistry }, force);
                    const detail = provider.formatDetails ? provider.formatDetails(data) : JSON.stringify(data, null, 2);
                    lines.push(detail);
                }
                catch (error) {
                    lines.push(`${provider.id}: ${error instanceof Error ? error.message : String(error)}`);
                }
            }
            await updateActive(ctx, force);
            ctx.ui.notify(lines.join("\n\n"), "info");
        }
        pi.registerCommand("pi-usage", {
            description: "Show API usage/quota for the active provider (args: refresh | all | clear)",
            handler: showUsage,
        });
        pi.registerCommand("usage", {
            description: "Alias for /pi-usage",
            handler: showUsage,
        });
    };
}
//# sourceMappingURL=extension.js.map