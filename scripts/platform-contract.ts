#!/usr/bin/env node
/**
 * Platform contract check against a live Spotify desktop client via CDP.
 *
 * Requires Node.js >= 24 (runs as TypeScript through type stripping, and uses
 * the global WebSocket client).
 *
 * The client wrapper (src/jsHelper/spicetifyWrapper) reads fields from
 * Spotify's runtime: Spicetify.Platform and its *API services, PlatformData,
 * PlayerAPI internals, and the React/webpack modules it captures. Spotify can
 * remove or rename any of them in a release. scripts/platform-contract.json
 * lists each path with the wrapper file:line that reads it; this script reads
 * every path in the running client and reports it as present, missing or of
 * another type. It only reads properties: it calls no client function and
 * changes nothing.
 *
 * Prerequisites
 * -------------
 * 1. Spicetify applied: the paths hang off window.Spicetify.
 * 2. Spotify started with --remote-debugging-port, as for
 *    classmap-cdp-verify.mjs.
 *
 * Usage
 * -----
 *   node scripts/platform-contract.ts --port 9222
 *   node scripts/platform-contract.ts --port 9230 --out /tmp/platform-contract.json
 *
 * Flags
 * -----
 *   --port <n>          CDP port (default 9222)
 *   --host <host>       CDP host (default 127.0.0.1)
 *   --timeout-ms <n>    Budget for CDP and for the wrapper to finish loading (default 15000)
 *   --contract <file>   Path list (default scripts/platform-contract.json)
 *   --out <file>        Also write the JSON report here
 *
 * Exit codes
 * ----------
 *   0  every required path is present with its expected type
 *   1  CDP/runtime failure, or the client has no Spicetify global
 *   2  a required path is missing or has another type
 */

import fs from "node:fs";
import path from "node:path";
import { parseArgs } from "node:util";

import { CdpSession, pickXpuiTarget, waitForCdp } from "./classmap-cdp-verify.mjs";

const VALUE_TYPES = ["object", "function", "string", "number", "boolean", "map"] as const;
type ValueType = (typeof VALUE_TYPES)[number];

export type ContractEntry = {
  path?: string;
  anyOf?: string[];
  type: ValueType | ValueType[];
  required: boolean;
  usedBy: string[];
  feature: string;
  note?: string;
};

/** What one path resolved to in the client. `missingAt` is the first prefix that was null or undefined. */
export type Probe = { path: string; type: string; missingAt?: string; error?: string };

export type Status = "present" | "missing" | "type-mismatch";

export type Result = {
  path: string;
  status: Status;
  required: boolean;
  expected: ValueType[];
  actual: string;
  matched?: string;
  missingAt?: string;
  usedBy: string[];
  feature: string;
  note?: string;
};

export type Page = { evaluate(expression: string): Promise<unknown> };

export const DEFAULT_CONTRACT = path.join(import.meta.dirname, "platform-contract.json");

export function loadContract(file: string): ContractEntry[] {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  if (!Array.isArray(data?.entries)) throw new Error(`${file}: expected an "entries" array`);
  data.entries.forEach((entry: ContractEntry, i: number) => {
    const where = `${file}: entry ${i}`;
    if (Boolean(entry.path) === Boolean(entry.anyOf?.length)) throw new Error(`${where}: set exactly one of "path" or "anyOf"`);
    const types = [entry.type].flat();
    if (!types.length || types.some((t) => !VALUE_TYPES.includes(t))) throw new Error(`${where}: invalid type ${JSON.stringify(entry.type)}`);
    if (typeof entry.required !== "boolean") throw new Error(`${where}: "required" must be a boolean`);
    if (!entry.usedBy?.length) throw new Error(`${where}: "usedBy" must cite at least one wrapper file:line`);
  });
  return data.entries;
}

export function contractPaths(entries: ContractEntry[]): string[] {
  return [...new Set(entries.flatMap((e) => e.anyOf ?? [e.path as string]))];
}

/**
 * Resolves dotted paths from `root`. It runs inside the client through
 * Function.prototype.toString, so it must not reference anything outside its
 * own body.
 */
export function probePaths(root: unknown, paths: string[]): Probe[] {
  return paths.map((path) => {
    const keys = path.split(".");
    let value = root;
    try {
      for (let i = 0; i < keys.length; i++) {
        value = (value as Record<string, unknown>)[keys[i]];
        if (value === undefined || value === null) {
          if (i < keys.length - 1) return { path, type: "undefined", missingAt: keys.slice(0, i + 1).join(".") };
          return { path, type: value === null ? "null" : "undefined" };
        }
      }
    } catch (error) {
      return { path, type: "undefined", error: String((error as Error)?.message ?? error) };
    }
    return { path, type: Object.prototype.toString.call(value) === "[object Map]" ? "map" : typeof value };
  });
}

export function probeExpression(paths: string[]): string {
  return `(() => ({
    spicetify: typeof globalThis.Spicetify,
    version: globalThis.Spicetify?.Platform?.version ?? null,
    probes: (${probePaths.toString()})(globalThis, ${JSON.stringify(paths)}),
  }))()`;
}

export function classify(entries: ContractEntry[], probes: Probe[]): Result[] {
  const byPath = new Map(probes.map((p) => [p.path, p]));
  return entries.map((entry) => {
    const candidates = entry.anyOf ?? [entry.path as string];
    const expected = [entry.type].flat();
    const seen = candidates.map((p) => byPath.get(p) ?? { path: p, type: "undefined" });
    const match = seen.find((p) => expected.includes(p.type as ValueType));
    const other = seen.find((p) => p.type !== "undefined");
    const base = {
      path: candidates.join(" | "),
      required: entry.required,
      expected,
      usedBy: entry.usedBy,
      feature: entry.feature,
      ...(entry.note ? { note: entry.note } : {}),
    };
    if (match) return { ...base, status: "present", actual: match.type, matched: match.path };
    if (other) return { ...base, status: "type-mismatch", actual: other.type, matched: other.path };
    const missingAt = seen[0].missingAt;
    return { ...base, status: "missing", actual: "undefined", ...(missingAt ? { missingAt } : {}) };
  });
}

export async function checkContract(page: Page, entries: ContractEntry[]): Promise<{ version: string | null; results: Result[] }> {
  const value = (await page.evaluate(probeExpression(contractPaths(entries)))) as {
    spicetify: string;
    version: string | null;
    probes: Probe[];
  };
  if (value?.spicetify !== "object") throw new Error("the client has no Spicetify global; apply Spicetify to it first");
  return { version: value.version, results: classify(entries, value.probes) };
}

export function summarize(results: Result[]) {
  const failures = results.filter((r) => r.required && r.status !== "present");
  const warnings = results.filter((r) => !r.required && r.status !== "present");
  return {
    total: results.length,
    present: results.filter((r) => r.status === "present").length,
    missing: results.filter((r) => r.status === "missing").length,
    typeMismatch: results.filter((r) => r.status === "type-mismatch").length,
    failures: failures.length,
    warnings: warnings.length,
    exitCode: failures.length ? 2 : 0,
  };
}

export function formatResults(results: Result[]): string {
  const line = (r: Result) => {
    const detail =
      r.status === "missing"
        ? `missing${r.missingAt ? ` (${r.missingAt} is undefined)` : ""}`
        : `${r.actual}, expected ${r.expected.join(" or ")}${r.matched && r.matched !== r.path ? ` at ${r.matched}` : ""}`;
    return `  ${r.required ? "FAIL" : "WARN"} ${r.path}: ${detail}\n       ${r.feature}; read at ${r.usedBy.join(", ")}`;
  };
  const failing = results.filter((r) => r.status !== "present");
  const out = [`Present: ${results.length - failing.length}/${results.length}`];
  for (const r of failing.sort((a, b) => Number(b.required) - Number(a.required))) out.push(line(r));
  return out.join("\n");
}

/** Waits until the wrapper has fired webpackLoaded, by which point it has filled Spicetify.Platform and its captures. */
async function waitForWrapper(page: Page, timeoutMs: number): Promise<boolean> {
  return Boolean(
    await page.evaluate(`(async () => {
      const deadline = Date.now() + ${timeoutMs};
      const loaded = () => {
        const event = globalThis.Spicetify?.Events?.webpackLoaded;
        return Boolean(event && !event.callbacks && globalThis.Spicetify.Platform?.version);
      };
      while (!loaded() && Date.now() < deadline) await new Promise((r) => setTimeout(r, 200));
      return loaded();
    })()`),
  );
}

function parseCli(argv: string[]) {
  const { values } = parseArgs({
    args: argv,
    options: {
      port: { type: "string", default: "9222" },
      host: { type: "string", default: "127.0.0.1" },
      "timeout-ms": { type: "string", default: "15000" },
      contract: { type: "string", default: DEFAULT_CONTRACT },
      out: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const port = Number(values.port);
  const timeoutMs = Number(values["timeout-ms"]);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error(`invalid port: ${values.port}`);
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) throw new Error(`invalid timeout: ${values["timeout-ms"]}`);
  return {
    port,
    timeoutMs,
    host: values.host,
    contract: path.resolve(values.contract),
    out: values.out ? path.resolve(values.out) : null,
    help: values.help ?? false,
  };
}

export async function main(argv: string[]): Promise<number> {
  const args = parseCli(argv);
  if (args.help) {
    console.log(fs.readFileSync(import.meta.filename, "utf8").split("*/")[0]);
    return 0;
  }
  const entries = loadContract(args.contract);

  console.log(`Waiting for CDP at ${args.host}:${args.port} …`);
  const { version, targets } = await waitForCdp(args.host, args.port, args.timeoutMs);
  const target = pickXpuiTarget(targets);
  if (!target?.webSocketDebuggerUrl) throw new Error(`No xpui page target in CDP list (${targets.length} targets)`);
  console.log(`Page: ${target.url}`);

  const session = new CdpSession(target.webSocketDebuggerUrl);
  await session.connect();
  try {
    if (!(await waitForWrapper(session, args.timeoutMs))) {
      console.warn(`  wrapper did not finish loading within ${args.timeoutMs}ms; probing anyway`);
    }
    const { version: spotifyVersion, results } = await checkContract(session, entries);
    const summary = summarize(results);
    console.log(`Spotify ${spotifyVersion ?? "(unknown version)"}`);
    console.log(formatResults(results));

    if (args.out) {
      const report = {
        generatedAt: new Date().toISOString(),
        cdp: { host: args.host, port: args.port, page: target.url, browser: version },
        spotifyVersion,
        summary,
        results,
      };
      fs.mkdirSync(path.dirname(args.out), { recursive: true });
      fs.writeFileSync(args.out, `${JSON.stringify(report, null, 2)}\n`);
      console.log(`\nWrote ${args.out}`);
    }

    if (summary.exitCode) console.error(`\nFAIL: ${summary.failures} required path(s) missing or of another type`);
    else console.log(`\nPASS${summary.warnings ? ` (${summary.warnings} optional path(s) absent)` : ""}`);
    return summary.exitCode;
  } finally {
    session.close();
  }
}

if (import.meta.main) {
  process.exitCode = await main(process.argv.slice(2)).catch((error) => {
    console.error(error?.message ?? error);
    return 1;
  });
}
