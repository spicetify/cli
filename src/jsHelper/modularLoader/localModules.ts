import type { Classmap, ManifestModule } from "./types.ts";

export interface LocalModuleRecord {
	metadata: ManifestModule;
	sidecar: { installed_version: string; classmap_base: string; allow_stale: boolean };
	files: Record<string, string>;
	installedAt: number;
	// The classmap key the files were remapped against at install time.
	// Absent on older records, which then always defer to a staged copy.
	remapKey?: string;
}

const PREFIX = "spicetify.modules.local.";

// absolutizeLoaderUrls rewrites absolute /modules import specifiers to
// fully qualified URLs. Local installs execute through blob: URLs, whose
// non-hierarchical base cannot resolve even absolute paths; the staged
// copies those imports point at live on the page origin.
export function absolutizeLoaderUrls(src: string, origin: string): string {
	return src.replace(/(["'])\/modules\//g, (_, quote) => `${quote}${origin}/modules/`);
}

import { satisfies } from "./semver-lite.ts";

// localWins decides whether a local record overrides a staged copy of the
// same module: only when strictly newer AND remapped against the classmap
// this boot runs on. Anything else defers to staged — the copy that went
// through the full remap pipeline. Version-blind shadowing made store
// updates of staged modules silently revert on restart.
export function localWins(
	stagedVersion: string,
	record: { metadata: { version: string }; remapKey?: string },
	classmapKey: string,
): boolean {
	if (!record.remapKey || record.remapKey !== classmapKey) return false;
	try {
		return satisfies(record.metadata.version, `>${stagedVersion}`);
	} catch {
		return false;
	}
}

// A tree record carries js files beyond its single entry (stdlib-style).
// Its cross-file imports resolve by URL, so serving it locally needs the
// import-map override rather than the single-entry blob.
export function isTreeRecord(record: { metadata: { entries: { js?: string } }; files: Record<string, string> }): boolean {
	const entry = record.metadata.entries.js;
	return Object.keys(record.files).some((f) => f.endsWith(".js") && !f.endsWith(".js.map") && f !== entry);
}

// rewriteRelativeImports resolves ./ and ../ specifiers in a local file
// against its own path inside the module, emitting absolute URLs. Blob
// sources have a non-hierarchical base, so relative specifiers cannot
// survive; the emitted URLs go back through the import map.
export function rewriteRelativeImports(src: string, moduleId: string, filePath: string, origin: string): string {
	const dir = filePath.split("/").slice(0, -1);
	return src.replace(/(["'])(\.\.?\/[^"']+)\1/g, (whole, quote, spec) => {
		const parts = [...dir];
		for (const seg of (spec as string).split("/")) {
			if (seg === "." || seg === "") continue;
			else if (seg === "..") parts.pop();
			else parts.push(seg);
		}
		return `${quote}${origin}/modules/${moduleId}/${parts.join("/")}${quote}`;
	});
}

// buildImportMapEntries blobs every js file of a tree record (imports
// rewritten to absolute URLs) and returns the URL -> blob map entries.
export function buildImportMapEntries(record: LocalModuleRecord, origin: string): Record<string, string> {
	const entries: Record<string, string> = {};
	for (const [file, content] of Object.entries(record.files)) {
		if (!file.endsWith(".js") || file.endsWith(".js.map")) continue;
		const rewritten = absolutizeLoaderUrls(
			rewriteRelativeImports(content, record.metadata.identifier, file, origin),
			origin,
		);
		entries[`${origin}/modules/${record.metadata.identifier}/${file}`] = URL.createObjectURL(
			new Blob([rewritten], { type: "text/javascript" }),
		);
	}
	return entries;
}

// remapSource mirrors the CLI's RemapClassmapReferences for in-client
// installs: MAP.a.b.c references become quoted class names from the
// manifest's bundled classmap. Unresolvable paths throw so nothing ships
// half-remapped.
export function remapSource(src: string, classmap: Classmap): string {
	const unresolved: string[] = [];
	const out = src.replace(/\bMAP((?:\.[A-Za-z_][A-Za-z0-9_]*)+)/g, (match) => {
		const dotted = match.slice(4);
		const leaf = resolveClassmap(classmap, dotted);
		if (leaf === null) {
			unresolved.push(dotted);
			return match;
		}
		return JSON.stringify(leaf);
	});
	if (unresolved.length > 0) {
		throw new Error(`unresolved classmap references: ${[...new Set(unresolved)].sort().join(", ")}`);
	}
	return out;
}

function resolveClassmap(node: Classmap, dotted: string): string | null {
	let cur: unknown = node;
	for (const part of dotted.split(".")) {
		if (typeof cur !== "object" || cur === null) return null;
		cur = (cur as Record<string, unknown>)[part];
	}
	return typeof cur === "string" ? cur : null;
}

export function loadLocalModules(): LocalModuleRecord[] {
	const out: LocalModuleRecord[] = [];
	for (let i = 0; i < localStorage.length; i++) {
		const key = localStorage.key(i);
		if (!key?.startsWith(PREFIX)) continue;
		try {
			out.push(JSON.parse(localStorage.getItem(key) ?? ""));
		} catch {
			// skip malformed entries
		}
	}
	return out;
}

// What removeLocal has to do, given what the id currently has behind it.
// "record-only" is the case worth naming: a stored record that the staged
// copy already shadows has nothing running to revert, so unloading would take
// the staged module down instead of the override.
export type RemovalPlan = "nothing" | "record-only" | "requires-restart" | "unload-and-revert";

export function removalPlan(state: { running: boolean; record: boolean; mapped: boolean }): RemovalPlan {
	if (!state.running && !state.record) return "nothing";
	if (state.mapped) return "requires-restart";
	if (!state.running) return "record-only";
	return "unload-and-revert";
}

export function saveLocalModule(id: string, record: LocalModuleRecord): void {
	localStorage.setItem(PREFIX + id, JSON.stringify(record));
}

export function hasLocalRecord(id: string): boolean {
	return localStorage.getItem(PREFIX + id) !== null;
}

export function deleteLocalModule(id: string): void {
	localStorage.removeItem(PREFIX + id);
}

export function localModuleUrl(id: string): string {
	return `local:${id}`;
}
