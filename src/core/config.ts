/**
 * pi-usage-unified — pi auth/config file helpers.
 *
 * Reads `~/.pi/agent/auth.json` (or `$PI_CODING_AGENT_DIR/auth.json`) for
 * provider account metadata (e.g. the OpenAI Codex `accountId`).
 */
import { homedir } from "node:os";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** Resolve the path to pi's auth.json. */
export function authJsonPath(): string {
  return process.env.PI_CODING_AGENT_DIR
    ? join(process.env.PI_CODING_AGENT_DIR, "auth.json")
    : join(homedir(), ".pi", "agent", "auth.json");
}

/** Read and JSON-parse a file, returning undefined on any error. */
export function readJson(path: string): any {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return undefined;
  }
}
