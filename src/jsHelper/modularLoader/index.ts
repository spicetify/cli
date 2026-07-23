import { deleteLocalModule, loadLocalModules, remapSource, saveLocalModule } from "./localModules.ts";
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

function importSource(content: string) {
	const url = URL.createObjectURL(new Blob([content], { type: "text/javascript" }));
	return importJs(url);
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

// parseColorIni parses classic spicetify color.ini (sections with
// key = hex) into CSS variable values.
export function parseColorIni(text: string): Record<string, string> {
	const out: Record<string, string> = {};
	for (const line of text.split("\n")) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith(";") || trimmed.startsWith("#") || trimmed.startsWith("[")) continue;
		const eq = trimmed.indexOf("=");
		if (eq < 0) continue;
		const key = trimmed.slice(0, eq).trim();
		const value = trimmed.slice(eq + 1).trim();
		if (key && value) out[key] = value;
	}
	return out;
}

function hexToRgb(hex: string): string | null {
	const h = hex.replace("#", "");
	if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) return null;
	const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
	return `${parseInt(full.slice(0, 2), 16)},${parseInt(full.slice(2, 4), 16)},${parseInt(full.slice(4, 6), 16)}`;
}

// applyScheme fetches a module's color.ini and sets --spice-* variables on
// :root, mirroring the classic pipeline's getColorCSS. Returns a disposer
// that restores the previous values.
async function applyScheme(identifier: string): Promise<(() => void) | null> {
	const url = entryUrl(identifier, "color.ini");
	let text: string;
	try {
		const res = await fetch(url);
		if (!res.ok) return null;
		text = await res.text();
	} catch {
		return null;
	}
	const scheme = parseColorIni(text);
	if (Object.keys(scheme).length === 0) return null;

	const root = document.documentElement;
	const previous: Record<string, string> = {};
	for (const [key, value] of Object.entries(scheme)) {
		const name = `--spice-${key}`;
		previous[name] = root.style.getPropertyValue(name);
		root.style.setProperty(name, value.startsWith("#") ? value : `#${value}`);
		const rgb = hexToRgb(value);
		if (rgb) {
			const rgbName = `--spice-rgb-${key}`;
			previous[rgbName] = root.style.getPropertyValue(rgbName);
			root.style.setProperty(rgbName, rgb);
		}
	}
	log("info")(`applied color scheme from ${identifier} (${Object.keys(scheme).length} colors)`);
	return () => {
		for (const [name, value] of Object.entries(previous)) {
			if (value) root.style.setProperty(name, value);
			else root.style.removeProperty(name);
		}
	};
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

const pendingLocal = new Map<string, { metadata: ModulesManifest["modules"][number]; files: Record<string, string> }>();

async function boot(): Promise<BootReport | null> {
	// Module bugs must not brick the client: its global handler turns any
	// unhandled rejection into the full-page "Something went wrong" screen.
	// Rejections whose stack points into module or hooks code are reported
	// honestly and stopped here (this listener registers before the client
	// boots, so it runs first); client-originated rejections pass through.
	window.addEventListener("unhandledrejection", (event) => {
		const stack = (event.reason as Error | undefined)?.stack ?? "";
		if (/\/(modules|hooks)\//.test(stack)) {
			log("error")("module code caused an unhandled rejection:", event.reason);
			event.stopImmediatePropagation();
			event.preventDefault();
		}
	});

	const manifest = globalThis.__SPICETIFY_MODULAR_MANIFEST__ ?? (await fetchManifest());
	if (!manifest?.modules?.length) {
		log("info")("no modules manifest, nothing to load");
		void bootClient(createTransformRegistry());
		return null;
	}
	// Merge localStorage-installed modules (the store) into the manifest,
	// remapping their MAP.* sources against the bundled classmap.
	if (manifest.classmap) {
		for (const record of loadLocalModules()) {
			try {
				const files: Record<string, string> = {};
				for (const [name, content] of Object.entries(record.files)) {
					files[name] = remapSource(content, manifest.classmap);
				}
				manifest.modules.push({ ...record.metadata });
				// registerLocal below wires the file contents into the registry
				pendingLocal.set(record.metadata.identifier, { metadata: record.metadata, files });
			} catch (e) {
				log("error")(`local module ${record.metadata.identifier} failed to remap: ${(e as Error).message}`);
			}
		}
	}

	const transforms = createTransformRegistry();
	const registry = new Registry(manifest, {
		importJs,
		loadCss,
		adoptCss,
		applyScheme,
		createTransformer: () => transforms.factory,
		log,
	});

	for (const record of pendingLocal.values()) {
		registry.registerLocal(record);
	}

	const report: BootReport = { loaded: [], failed: {} };
	// hooks-era modules reference the CHUNKS global for chunk-load tracking;
	// the 2024 mixin machinery created it. Define it empty so references are
	// inert instead of fatal.
	(globalThis as never as Record<string, unknown>).CHUNKS ??= {};
	await registry.runMixins(report);
	await bootClient(transforms);

	if (!(await waitForClient(15000))) {
		log("error")("client did not come up in time; running module loads anyway");
	}
	void captureWebpackRequire();
	await registry.runLoads(report);

	globalThis.Spicetify = globalThis.Spicetify ?? {};
	const modules = (globalThis.Spicetify as Record<string, unknown>).Modules = {
		report,
		registry,
		entryUrl,
		list: () => registry.list(),
		enable: (id: string) => registry.enable(id, report),
		disable: (id: string) => registry.unload(id),
		reload: (id: string) => registry.reload(id, report),
	};

	// Local installs (store): remap against the bundled classmap, persist to
	// localStorage, register, and enable immediately.
	(modules as Record<string, unknown>).installLocal = async (
		id: string,
		record: { metadata: ModulesManifest["modules"][number]; files: Record<string, string>; sidecar: object },
	) => {
		if (!manifest.classmap) throw new Error("no bundled classmap in manifest");
		const files: Record<string, string> = {};
		for (const [name, content] of Object.entries(record.files)) {
			files[name] = remapSource(content, manifest.classmap);
		}
		saveLocalModule(id, { ...record, files, installedAt: Date.now() } as never);
		registry.registerLocal({ metadata: record.metadata, files });
		return registry.enable(id, report);
	};
	(modules as Record<string, unknown>).removeLocal = async (id: string) => {
		await registry.unload(id);
		deleteLocalModule(id);
	};
	(modules as Record<string, unknown>).listLocal = () => loadLocalModules();
	return report;
}

if (typeof document !== "undefined") {
	void boot();
}
