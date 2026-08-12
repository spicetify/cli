import { pushDiagnostic } from "./diagnostics.ts";
import {
	absolutizeLoaderUrls,
	buildImportMapEntries,
	deleteLocalModule,
	hasLocalRecord,
	isTreeRecord,
	loadLocalModules,
	localWins,
	remapSource,
	removalPlan,
	saveLocalModule,
} from "./localModules.ts";
import { type BootReport, Registry } from "./registry.ts";
import { createTransformRegistry, transformPath } from "./transforms.ts";
import { applyTransformsOffthread } from "./transformWorker.ts";
import { type ModulesManifest, entryUrl } from "./types.ts";
import { captureWebpackRequire as waitForWebpackCapture } from "./webpackCapture.ts";

declare global {
	var __SPICETIFY_MODULAR_MANIFEST__: ModulesManifest;
	interface Window {
		Spicetify?: Record<string, unknown>;
	}
}

const log =
	(level: "info" | "error") =>
	(...args: unknown[]) => {
		console[level]("[modular-loader]", ...args);
		pushDiagnostic(level, ...args);
	};

async function importJs(path: string) {
	return (await import(/* webpackIgnore: true */ path)) as never;
}

// Inject an import map so the given /modules/<id>/ URLs resolve to local
// blobs. Chrome (M133+) merges multiple import maps, so this works mid-session
// for URLs that have not been imported yet.
function injectImportMap(entries: Record<string, string>): void {
	if (Object.keys(entries).length === 0) return;
	const script = document.createElement("script");
	script.type = "importmap";
	script.textContent = JSON.stringify({ imports: entries });
	document.head.appendChild(script);
}

function importSource(content: string) {
	const url = URL.createObjectURL(
		new Blob([absolutizeLoaderUrls(content, location.origin)], { type: "text/javascript" }),
	);
	return importJs(url);
}

async function cssFromSource(text: string): Promise<CSSStyleSheet | string> {
	// Constructable stylesheets silently drop @import rules (per spec),
	// which classic themes rely on for web fonts; those sheets go through
	// adoptCss's <style> element path instead, where @import works. A
	// false positive (say, "@import" in a comment) only costs the
	// constructable fast path, never correctness.
	if (/@import\b/.test(text)) return text;
	if ("adoptedStyleSheets" in document && typeof CSSStyleSheet !== "undefined") {
		const sheet = new CSSStyleSheet();
		await sheet.replace(text);
		return sheet;
	}
	return text;
}

async function loadCss(path: string): Promise<CSSStyleSheet | string> {
	const res = await fetch(path);
	return cssFromSource(await res.text());
}

// parseColorSchemes parses classic spicetify color.ini into named
// schemes: each [Section] is one scheme; keys before any section land in
// "" (single-scheme files).
export function parseColorSchemes(text: string): Record<string, Record<string, string>> {
	const out: Record<string, Record<string, string>> = {};
	let current = "";
	for (const line of text.split("\n")) {
		const raw = line.trim();
		if (!raw || raw.startsWith(";") || raw.startsWith("#")) continue;
		// Classic themes annotate values inline ("main = 000000 ; the sky").
		// Carrying that into the value makes the whole custom-property
		// declaration invalid, and the browser drops it silently, leaving the
		// key on whatever the previously applied theme set.
		const comment = raw.indexOf(";");
		const trimmed = comment < 0 ? raw : raw.slice(0, comment).trim();
		if (!trimmed) continue;
		const section = trimmed.match(/^\[(.+)\]$/);
		if (section) {
			current = section[1].trim();
			out[current] ??= {};
			continue;
		}
		const eq = trimmed.indexOf("=");
		if (eq < 0) continue;
		// The classic CLI read color.ini with ini.InsensitiveLoad, which
		// lowercases keys, so themes reference --spice-gradienttop even when
		// the file says gradientTop. Case-sensitive CSS custom properties
		// make anything else resolve to nothing. Section (scheme) names keep
		// their case: they are display labels, not variable names.
		const key = trimmed.slice(0, eq).trim().toLowerCase();
		const value = trimmed.slice(eq + 1).trim();
		if (key && value) (out[current] ??= {})[key] = value;
	}
	for (const name of Object.keys(out)) {
		if (!Object.keys(out[name]).length) delete out[name];
	}
	return out;
}

// parseColorIni keeps the flat view (all sections merged) for callers
// that only care about a single scheme's worth of variables.
export function parseColorIni(text: string): Record<string, string> {
	return Object.assign({}, ...Object.values(parseColorSchemes(text)));
}

// chooseScheme picks the scheme to apply: the saved preference when it
// still exists, otherwise the file's first scheme (the classic default).
export function chooseScheme(
	schemes: Record<string, Record<string, string>>,
	saved: string | null,
): string | null {
	if (saved !== null && schemes[saved]) return saved;
	return Object.keys(schemes)[0] ?? null;
}

function hexToRgb(hex: string): string | null {
	const h = hex.replace("#", "");
	if (!/^[0-9a-fA-F]{3}$|^[0-9a-fA-F]{6}$/.test(h)) return null;
	const full = h.length === 3 ? [...h].map((c) => c + c).join("") : h;
	return `${Number.parseInt(full.slice(0, 2), 16)},${Number.parseInt(full.slice(2, 4), 16)},${Number.parseInt(full.slice(4, 6), 16)}`;
}

// Canonical keys a theme may omit, each with the keys to derive it from;
// first match wins. Order is load-bearing: entries resolve against keys
// filled earlier in the same pass, so the mutually-referential
// main-elevated/card pair both land on `main` when neither is declared.
const DERIVED_COLORS: Array<[string, string[]]> = [
	["subtext", ["text"]],
	["main-elevated", ["card", "main"]],
	["card", ["main-elevated", "main"]],
	["highlight", ["card-hover", "main-elevated", "main"]],
	["highlight-elevated", ["highlight", "main"]],
	["sidebar", ["main"]],
	["player", ["main"]],
	["tab-active", ["card", "main"]],
	["selected-row", ["text"]],
	["misc", ["subtext", "text"]],
	["button", ["button-active", "text"]],
	["button-active", ["button", "text"]],
	["button-disabled", ["subtext", "text"]],
	["shadow", ["text"]],
	["notification", ["card", "main"]],
	["notification-error", ["notification", "main"]],
];

// Returns the scheme with omitted canonical keys derived from declared
// ones. A declared key is never overwritten.
export function fillCanonical(scheme: Record<string, string>): Record<string, string> {
	const out = { ...scheme };
	for (const [key, sources] of DERIVED_COLORS) {
		if (out[key] !== undefined) continue;
		const from = sources.find((s) => out[s] !== undefined);
		if (from) out[key] = out[from];
	}
	return out;
}

// Present on <html> while a theme's variables are on :root; stdlib's
// client-color bridge is scoped to it.
export const THEMED_CLASS = "spicetify-themed";

// applyVars sets one scheme's --spice-* variables on :root, mirroring
// the classic pipeline's getColorCSS. Returns a disposer that restores
// the previous values.
function applyVars(rawScheme: Record<string, string>): () => void {
	const root = document.documentElement;
	const scheme = fillCanonical(rawScheme);
	root.classList.add(THEMED_CLASS);
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
	return () => {
		for (const [name, value] of Object.entries(previous)) {
			if (value) root.style.setProperty(name, value);
			else root.style.removeProperty(name);
		}
		// A scheme switch applies the new vars before disposing the old, so
		// the mark only lifts once nothing themed is left on :root.
		if (!root.style.getPropertyValue("--spice-main")) root.classList.remove(THEMED_CLASS);
	};
}

const SCHEME_PREF = (identifier: string) => `spicetify:scheme:${identifier}`;

const DISABLED_KEY = "spicetify:modules:disabled";

// The persisted disable set. Reads tolerate anything (a hand-edited key, a
// half-written value) by falling back to "nothing is disabled": refusing to
// boot any module because one localStorage entry is malformed would be a far
// worse failure than ignoring the preference.
const disabledPref = {
	get(): string[] {
		try {
			const raw: unknown = JSON.parse(localStorage.getItem(DISABLED_KEY) ?? "[]");
			return Array.isArray(raw) ? raw.filter((id): id is string => typeof id === "string") : [];
		} catch {
			return [];
		}
	},
	write(ids: string[]): void {
		try {
			if (ids.length) localStorage.setItem(DISABLED_KEY, JSON.stringify(ids));
			else localStorage.removeItem(DISABLED_KEY);
		} catch {
			// Storage being unavailable must not stop the unload itself.
		}
	},
	add(identifier: string): void {
		const ids = this.get();
		if (!ids.includes(identifier)) this.write([...ids, identifier]);
	},
	remove(identifier: string): void {
		const ids = this.get();
		if (ids.includes(identifier)) this.write(ids.filter((id) => id !== identifier));
	},
};

// Live scheme state per module, so schemes can be listed and switched
// without a reload.
const schemeState = new Map<
	string,
	{ schemes: Record<string, Record<string, string>>; active: string; dispose: () => void }
>();

// applyScheme loads a module's color.ini (from pushed content for local
// installs, the staged copy otherwise) and applies the preferred scheme.
// Returns a disposer that restores the previous values.
async function applyScheme(identifier: string, source?: string): Promise<(() => void) | null> {
	let text = source;
	if (text === undefined) {
		try {
			const res = await fetch(entryUrl(identifier, "color.ini"));
			if (!res.ok) return null;
			text = await res.text();
		} catch {
			return null;
		}
	}
	const schemes = parseColorSchemes(text);
	const name = chooseScheme(schemes, localStorage.getItem(SCHEME_PREF(identifier)));
	if (name === null) return null;

	const dispose = applyVars(schemes[name]);
	schemeState.set(identifier, { schemes, active: name, dispose });
	log("info")(`applied color scheme ${name || "(default)"} from ${identifier}`);
	return () => {
		schemeState.get(identifier)?.dispose();
		schemeState.delete(identifier);
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
	const globals = globalThis as never as Record<string, unknown>;
	try {
		const captured = await waitForWebpackCapture({
			maxWaitMs,
			now: Date.now,
			wait: () => new Promise((resolve) => setTimeout(resolve, 500)),
			getQueue: () => {
				const queue = globals.rspackChunkclient_web as unknown[];
				return Array.isArray(queue) && queue.push !== Array.prototype.push ? queue : undefined;
			},
			getCaptured: () => globals.__webpack_require__,
			setCaptured: (require) => (globals.__webpack_require__ = require),
		});
		if (captured) {
			log("info")("captured webpack require");
			return;
		}
	} catch (e) {
		log("error")("webpack require capture failed", e);
		return;
	}
	log("error")("webpack require capture timed out");
}

async function waitForClient(timeoutMs: number): Promise<boolean> {
	const deadline = Date.now() + timeoutMs;
	const spice = () => (globalThis as never as Window).Spicetify as Record<string, any> | undefined;
	// Base gate: the main view is mounted and the Platform API is up.
	while (Date.now() < deadline) {
		if (document.querySelector("main") && spice()?.Platform) break;
		await new Promise((r) => setTimeout(r, 200));
	}
	if (!(document.querySelector("main") && spice()?.Platform)) return false;
	// Platform lands before the webpack-extracted surface (URI, Mousetrap,
	// React, ...); a module that touches those at load() time otherwise races
	// the client and fails to boot. Wait for the client's own webpackLoaded
	// signal when it exists — it replays for late subscribers, so this resolves
	// instantly once extraction is done, and is bounded by the same deadline.
	// Older clients without the signal skip this rather than stalling.
	const webpackLoaded = spice()?.Events?.webpackLoaded;
	if (typeof webpackLoaded?.on === "function") {
		const remaining = Math.max(0, deadline - Date.now());
		await Promise.race([
			new Promise<void>((resolve) => webpackLoaded.on(() => resolve())),
			new Promise<void>((resolve) => setTimeout(resolve, remaining)),
		]);
	}
	return true;
}

const pendingLocal = new Map<
	string,
	{ metadata: ModulesManifest["modules"][number]; files: Record<string, string>; mapped?: boolean }
>();

async function boot(): Promise<BootReport | null> {
	// Module bugs must not brick the client: its global handler turns any
	// unhandled rejection into the full-page "Something went wrong" screen.
	// Rejections whose stack points into module or hooks code are reported
	// honestly and stopped here (this listener registers before the client
	// boots, so it runs first); client-originated rejections pass through.
	window.addEventListener("unhandledrejection", (event) => {
		const stack = (event.reason as Error | undefined)?.stack ?? "";
		// esm.sh code only ever runs on behalf of modules.
		if (/\/modules\/|\besm\.sh\//.test(stack)) {
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
	// The staged truth, captured before local installs mutate the manifest, so
	// removeLocal can revert an override to its staged copy.
	const stagedMeta = new Map(manifest.modules.map((m) => [m.identifier, { ...m }]));

	// Merge localStorage-installed modules (the store) into the manifest,
	// remapping their MAP.* sources against the bundled classmap. A staged
	// copy of the same module defers to the local one only when the local is
	// strictly newer and was remapped against this boot's classmap; otherwise
	// staged wins (it went through the full remap pipeline).
	const importMapEntries: Record<string, string> = {};
	if (manifest.classmap) {
		for (const record of loadLocalModules()) {
			const id = record.metadata.identifier;
			try {
				const stagedAt = manifest.modules.findIndex((m) => m.identifier === id);
				if (stagedAt >= 0) {
					const staged = manifest.modules[stagedAt];
					if (!localWins(staged.version, record, manifest.classmapKey)) {
						log("info")(
							`local module ${id}@${record.metadata.version} shadowed by staged install (${staged.version})`,
						);
						continue;
					}
					log("info")(`local module ${id}@${record.metadata.version} overrides staged ${staged.version}`);
					manifest.modules.splice(stagedAt, 1, { ...record.metadata });
				} else {
					manifest.modules.push({ ...record.metadata });
				}
				const files: Record<string, string> = {};
				for (const [name, content] of Object.entries(record.files)) {
					files[name] = remapSource(content, manifest.classmap);
				}
				// Tree records (js beyond the entry) resolve cross-file imports
				// by URL; an import map serves every file from a blob, so the
				// code that runs is the code the registry claims.
				const mapped = isTreeRecord(record);
				if (mapped) {
					Object.assign(importMapEntries, buildImportMapEntries({ ...record, files }, location.origin));
				}
				// registerLocal below wires the file contents into the registry
				pendingLocal.set(id, { metadata: record.metadata, files, mapped });
			} catch (e) {
				log("error")(`local module ${id} failed to remap: ${(e as Error).message}`);
			}
		}
	}
	// Injected before any module import so every /modules/<id>/ URL of an
	// overridden tree module resolves to its local blob.
	injectImportMap(importMapEntries);

	const transforms = createTransformRegistry();
	const registry = new Registry(manifest, {
		importJs,
		importSource,
		loadCss,
		cssFromSource,
		adoptCss,
		applyScheme,
		activeThemePref: {
			get: () => localStorage.getItem("spicetify:modules:activeTheme"),
			set: (id) => localStorage.setItem("spicetify:modules:activeTheme", id),
		},
		disabledPref,
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
	await captureWebpackRequire();
	await registry.runLoads(report);

	globalThis.Spicetify = globalThis.Spicetify ?? {};
	const modules = (globalThis.Spicetify as Record<string, unknown>).Modules = {
		report,
		registry,
		manifest,
		entryUrl,
		list: () => registry.list(report),
		// Scheme surface for theme modules: names come from color.ini
		// sections; switching swaps :root variables live and persists.
		schemes: (id: string) => {
			const s = schemeState.get(id);
			return s ? { active: s.active, names: Object.keys(s.schemes) } : null;
		},
		setScheme: (id: string, name: string) => {
			const s = schemeState.get(id);
			if (!s || !s.schemes[name]) return false;
			s.dispose();
			s.dispose = applyVars(s.schemes[name]);
			s.active = name;
			try {
				localStorage.setItem(SCHEME_PREF(id), name);
			} catch {}
			return true;
		},
		// The user turning a module on: load it, and only if that succeeds
		// clear the persisted disable. enable() itself no longer touches the
		// pref, so this is the one path that records "on".
		enable: async (id: string) => {
			const ok = await registry.enable(id, report);
			if (ok) registry.markEnabled(id);
			return ok;
		},
		disable: (id: string) => registry.disable(id),
		// Transient unload: no persisted disable, for callers that stop a
		// module without the user asking (single-theme enforcement in the
		// store, theme-report's bare-client capture, probes). Using disable()
		// there would durably turn the module off — a crash mid-capture left
		// the user with no theme booting.
		unload: (id: string) => registry.unload(id),
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
		saveLocalModule(id, { ...record, files, installedAt: Date.now(), remapKey: manifest.classmapKey } as never);

		const tree = isTreeRecord({ metadata: record.metadata, files });
		// A tree module's cross-file imports resolve by URL. If it is already
		// loaded this session those URLs are in the ES module cache and cannot
		// be swapped — the new code only takes over on the next boot. A tree
		// module that is not loaded yet gets an import map so its entry and
		// siblings all resolve to these blobs, and it enables live.
		if (tree && registry.isLoaded(id)) {
			return { requiresRestart: true };
		}
		if (tree) {
			injectImportMap(buildImportMapEntries({ ...record, files }, location.origin));
		}
		// Clear any live instance of a prior version transiently — a persisted
		// disable here would outlive the reinstall. registerLocal then swaps in
		// the new files.
		await registry.unload(id);
		registry.registerLocal({ metadata: record.metadata, files, mapped: tree });
		// The manifest is the row source for management UIs; mirror the boot
		// merge so a live install is visible without a restart.
		if (!manifest.modules.some((m) => m.identifier === id)) {
			manifest.modules.push({ ...record.metadata });
		}
		// Updating a module the user disabled installs the new files but must
		// not turn it back on: it stays off this session and every boot after.
		if (registry.isDisabled(id)) return { disabled: true };
		return registry.enable(id, report);
	};
	(modules as Record<string, unknown>).removeLocal = async (id: string) => {
		const plan = removalPlan({
			running: registry.hasLocal(id),
			record: hasLocalRecord(id),
			mapped: registry.isMappedLocal(id),
		});
		if (plan === "nothing") return;
		// A mapped tree module's files are cached in the module graph; the
		// removal lands, but the running code only reverts on restart.
		if (plan === "requires-restart") {
			deleteLocalModule(id);
			// No staged copy is coming back, so a lingering disable would
			// silently skip the id if it is ever installed again.
			if (!stagedMeta.has(id)) registry.forgetDisabled(id);
			return { requiresRestart: true };
		}
		// A record the staged copy already shadowed: deleting it changes
		// nothing that is running, so say which version stays.
		if (plan === "record-only") {
			deleteLocalModule(id);
			const shadowedBy = stagedMeta.get(id);
			if (!shadowedBy) registry.forgetDisabled(id);
			return shadowedBy ? { revertedTo: shadowedBy.version } : undefined;
		}
		// Whether the override was actually running decides whether the staged
		// copy should come up: reverting a module the user had disabled (or one
		// simply not loaded) must not start it, and for a theme that would also
		// unload the active theme and steal activeThemePref.
		const wasLoaded = registry.isLoaded(id);
		await registry.unload(id);
		deleteLocalModule(id);
		registry.unregisterLocal(id);
		delete report.failed[id];
		const staged = stagedMeta.get(id);
		if (staged) {
			// The override shadowed a staged copy — revert to it live instead
			// of leaving the module gone until restart. The module is still
			// installed afterwards, which callers have to be able to tell:
			// reporting this as a removal is how "Remove" came to leave a
			// module running.
			registry.restage(staged);
			const at = manifest.modules.findIndex((m) => m.identifier === id);
			if (at >= 0) manifest.modules[at] = staged;
			else manifest.modules.push(staged);
			if (wasLoaded && !registry.isDisabled(id)) await registry.enable(id, report);
			return { revertedTo: staged.version };
		}
		registry.forgetDisabled(id);
		const at = manifest.modules.findIndex((m) => m.identifier === id);
		if (at >= 0) manifest.modules.splice(at, 1);
	};
	(modules as Record<string, unknown>).listLocal = () => loadLocalModules();
	return report;
}

if (typeof document !== "undefined") {
	void boot();
}
