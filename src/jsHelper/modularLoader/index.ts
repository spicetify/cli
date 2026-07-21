import { Registry, type BootReport } from "./registry.ts";
import { createTransformRegistry, transformPath } from "./transforms.ts";
import { applyTransformsOffthread } from "./transformWorker.ts";
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
// miss the client bootstrap. The patched modules bundle must execute before
// the snapshot runtime, which reads __webpack_modules__ as a free global.
async function bootClient(transforms: ReturnType<typeof createTransformRegistry>): Promise<void> {
	if (document.querySelector(SNAPSHOT_SELECTOR)) return;
	const inject = (src: string) => {
		const script = document.createElement("script");
		script.src = src;
		script.async = false;
		document.head.appendChild(script);
	};

	let modulesSrc = "/xpui-modules.js";
	// Source transforms run offthread, but most hooks-era transforms close over
	// module imports and cannot survive eval-isolation, and unverifiable pure
	// ones can break the bundle. They are opt-in for experiments only.
	const applyEnabled = (globalThis as never as Record<string, unknown>).__SPICETIFY_APPLY_TRANSFORMS__ === true;
	const matching = transforms.registered.filter((t) => transformPath(t.glob) !== null);
	if (matching.length > 0 && !applyEnabled) {
		log("info")(`dropping ${matching.length} source transform(s) (set __SPICETIFY_APPLY_TRANSFORMS__ to experiment)`);
	}
	if (matching.length > 0 && applyEnabled) {
		try {
			const res = await fetch(modulesSrc);
			if (res.ok) {
				const result = await applyTransformsOffthread(await res.text(), matching, 10000);
				if (result && result.applied > 0) {
					modulesSrc = URL.createObjectURL(new Blob([result.text], { type: "text/javascript" }));
					log("info")(`applied ${result.applied} source transform(s) to the client bundle`);
				}
			}
		} catch (e) {
			log("error")("bundle transform failed, booting stock bundle", e);
		}
	}

	inject(modulesSrc);
	inject("/xpui-snapshot.js");
}

// captureWebpackRequire registers a capture chunk after the client is up
// (post-render pushes execute the chunk factory; earlier pushes are either
// fatal to boot or silently deferred). hooks-era modules read the result
// through the wpunpk compat proxy.
async function captureWebpackRequire(maxWaitMs = 30000): Promise<void> {
	const deadline = Date.now() + maxWaitMs;
	while (Date.now() < deadline) {
		const q = (globalThis as never as Record<string, unknown>).rspackChunkclient_web as unknown[];
		if (Array.isArray(q) && q.push !== Array.prototype.push) {
			try {
				q.push([
					[`spicetify.webpack.chunk.id.${Date.now()}`],
					{},
					(re: unknown) => {
						(globalThis as never as Record<string, unknown>).__webpack_require__ = re;
						return re;
					},
				]);
				log("info")("captured webpack require");
			} catch (e) {
				log("error")("webpack require capture failed", e);
			}
			return;
		}
		await new Promise((r) => setTimeout(r, 500));
	}
	log("error")("webpack require capture timed out");
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
		void bootClient(createTransformRegistry());
		return null;
	}
	const transforms = createTransformRegistry();
	const registry = new Registry(manifest, {
		importJs,
		loadCss,
		adoptCss,
		createTransformer: () => transforms.factory,
		log,
	});

	const report: BootReport = { loaded: [], failed: {} };
	await registry.runMixins(report);
	await bootClient(transforms);

	if (!(await waitForClient(15000))) {
		log("error")("client did not come up in time; running module loads anyway");
	}
	void captureWebpackRequire();
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
