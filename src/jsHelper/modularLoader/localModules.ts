import type { Classmap, ManifestModule } from "./types.ts";

export interface LocalModuleRecord {
	metadata: ManifestModule;
	sidecar: { installed_version: string; classmap_base: string; allow_stale: boolean };
	files: Record<string, string>;
	installedAt: number;
}

const PREFIX = "spicetify.modules.local.";

// absolutizeLoaderUrls rewrites absolute /modules and /hooks import
// specifiers to fully qualified URLs. Local installs execute through
// blob: URLs, whose non-hierarchical base cannot resolve even absolute
// paths; the staged copies those imports point at live on the page
// origin.
export function absolutizeLoaderUrls(src: string, origin: string): string {
	return src.replace(/(["'])\/(modules|hooks)\//g, (_, quote, root) => `${quote}${origin}/${root}/`);
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

export function saveLocalModule(id: string, record: LocalModuleRecord): void {
	localStorage.setItem(PREFIX + id, JSON.stringify(record));
}

export function deleteLocalModule(id: string): void {
	localStorage.removeItem(PREFIX + id);
}

export function localModuleUrl(id: string): string {
	return `local:${id}`;
}
