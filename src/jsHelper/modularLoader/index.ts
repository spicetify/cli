import { Registry, type BootReport } from "./registry.ts";
import { entryUrl, type ModulesManifest } from "./types.ts";

declare global {
	var __SPICETIFY_MODULAR_MANIFEST__: ModulesManifest;
	interface Window {
		Spicetify?: Record<string, unknown>;
	}
}

const log =
	(level: "info" | "error") =>
	(...args: unknown[]) =>
		console[level]("[modular-loader]", ...args);

async function importJs(path: string) {
	return (await import(/* webpackIgnore: true */ path)) as never;
}

async function loadCss(path: string): Promise<CSSStyleSheet | string> {
	if ("adoptedStyleSheets" in document && typeof CSSStyleSheet !== "undefined") {
		const res = await fetch(path);
		const sheet = new CSSStyleSheet();
		await sheet.replace(await res.text());
		return sheet;
	}
	const res = await fetch(path);
	return res.text();
}

function adoptCss(sheet: unknown): () => void {
	if (sheet instanceof CSSStyleSheet) {
		document.adoptedStyleSheets.push(sheet);
		return () => {
			document.adoptedStyleSheets = document.adoptedStyleSheets.filter((s) => s !== sheet);
		};
	}
	const el = document.createElement("style");
	el.textContent = String(sheet);
	document.head.appendChild(el);
	return () => el.remove();
}

async function fetchManifest(): Promise<ModulesManifest | null> {
	try {
		const res = await fetch("/modules/manifest.json");
		return res.ok ? ((await res.json()) as ModulesManifest) : null;
	} catch {
		return null;
	}
}

const SNAPSHOT_SELECTOR = 'script[src*="xpui-snapshot"]';

// When the apply staged modules, preprocess strips the xpui-snapshot tag so
// this loader controls when the client boots: mixins must run first, or
// pre-boot interceptions (webpack require capture, defineProperty patches)
// miss the client bootstrap.
function bootClient() {
	if (document.querySelector(SNAPSHOT_SELECTOR)) return;
	const script = document.createElement("script");
	script.src = "/xpui-snapshot.js";
	document.head.appendChild(script);
}

async function waitForClient(timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		if (document.querySelector("main") && (globalThis as never as Window).Spicetify?.Platform) {
			return true;
		}
		await new Promise((r) => setTimeout(r, 200));
	}
	return false;
}

async function boot(): Promise<BootReport | null> {
	const manifest = globalThis.__SPICETIFY_MODULAR_MANIFEST__ ?? (await fetchManifest());
	if (!manifest?.modules?.length) {
		log("info")("no modules manifest, nothing to load");
		bootClient();
		return null;
	}
	const registry = new Registry(manifest, {
		importJs,
		loadCss,
		adoptCss,
		// Modules register xpui source transforms through this factory. Runtime
		// source interception does not exist in this model (rewrites happen
		// offline at apply time), so registrations are accepted and dropped.
		createTransformer: () => () => Promise.resolve(undefined),
		log,
	});

	const report: BootReport = { loaded: [], failed: {} };
	await registry.runMixins(report);
	bootClient();

	if (!(await waitForClient(15000))) {
		log("error")("client did not come up in time; running module loads anyway");
	}
	await registry.runLoads(report);

	globalThis.Spicetify = globalThis.Spicetify ?? {};
	(globalThis.Spicetify as Record<string, unknown>).Modules = {
		report,
		registry,
		entryUrl,
	};
	return report;
}

void boot();
