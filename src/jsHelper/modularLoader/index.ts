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

async function boot(): Promise<BootReport | null> {
	const manifest = globalThis.__SPICETIFY_MODULAR_MANIFEST__;
	if (!manifest?.modules?.length) {
		log("info")("no modules manifest, nothing to load");
		return null;
	}
	const registry = new Registry(manifest, {
		importJs,
		loadCss,
		adoptCss,
		log,
	});
	const report = await registry.boot();

	globalThis.Spicetify = globalThis.Spicetify ?? {};
	(globalThis.Spicetify as Record<string, unknown>).Modules = {
		report,
		registry,
		entryUrl,
	};
	return report;
}

void boot();
