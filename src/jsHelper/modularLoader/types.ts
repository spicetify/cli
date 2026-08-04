export type DisposeFn = () => void | Promise<void>;
export type SyncOrAsync<T> = T | Promise<T>;

export interface ModuleMetadata {
	name: string;
	tags: string[];
	version: string;
	authors: string[];
	description: string;
	entries: { js?: string; css?: string };
	hasMixins: boolean;
	dependencies: Record<string, string>;
	/**
	 * Versions this module still answers for, e.g. stdlib 1.0.0 declaring
	 * ["0.3.0"]. A dependent whose range admits a compat entry loads against
	 * this version, so bumping a shared dependency does not black out every
	 * dependent that has not re-declared its range yet. Omit an entry on a
	 * truly breaking release and the strict refusal returns.
	 */
	compat?: string[];
}

export interface ManifestModule extends ModuleMetadata {
	identifier: string;
}

export type Classmap = Record<string, unknown>;

export interface ModulesManifest {
	spotifyVersion: string;
	classmapKey: string;
	// Apply-time environment facts (absent in manifests from older CLIs).
	cliVersion?: string;
	updatesBlocked?: boolean;
	classmap?: Classmap;
	modules: ManifestModule[];
}

export interface MixinContext {
	spotifyVersion: string;
}

export interface PreloadContext {
	spotifyVersion: string;
	identifier: string;
	defer: (fn: DisposeFn) => void;
}

export interface LoadContext {
	spotifyVersion: string;
	identifier: string;
	defer: (fn: DisposeFn) => void;
}

export type TransformerShim = (register: unknown, opts?: unknown) => Promise<unknown>;

export interface JsIndex {
	mixin?: (transformer: TransformerShim, ctx?: MixinContext) => SyncOrAsync<void>;
	preload?: (ctx: PreloadContext) => SyncOrAsync<DisposeFn | void>;
	load?: (ctx: LoadContext) => SyncOrAsync<DisposeFn | void>;
}

export interface Effects {
	importJs(path: string): Promise<JsIndex>;
	importSource(content: string): Promise<JsIndex>;
	loadCss(path: string): Promise<unknown>;
	cssFromSource(content: string): Promise<unknown>;
	adoptCss(sheet: unknown): DisposeFn;
	createTransformer(): TransformerShim;
	applyScheme?(identifier: string, source?: string): Promise<DisposeFn | null>;
	// Persisted "last theme the user enabled": boot prefers it over manifest
	// order, so a runtime theme switch survives restarts even though module
	// enabled/disabled state otherwise does not.
	activeThemePref?: { get(): string | null; set(identifier: string): void };
	log(level: "info" | "error", ...args: unknown[]): void;
}

export function entryUrl(identifier: string, entry: string): string {
	return `/modules/${identifier}/${entry}`;
}
