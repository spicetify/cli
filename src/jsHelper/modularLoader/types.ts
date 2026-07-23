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
}

export interface ManifestModule extends ModuleMetadata {
	identifier: string;
}

export type Classmap = Record<string, unknown>;

export interface ModulesManifest {
	spotifyVersion: string;
	classmapKey: string;
	classmap?: Classmap;
	modules: ManifestModule[];
}

export interface MixinContext {
	spotifyVersion: string;
}

export interface PreloadContext {
	spotifyVersion: string;
}

export interface LoadContext {
	spotifyVersion: string;
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
	adoptCss(sheet: unknown): DisposeFn;
	createTransformer(): TransformerShim;
	applyScheme?(identifier: string): Promise<DisposeFn | null>;
	log(level: "info" | "error", ...args: unknown[]): void;
}

export function entryUrl(identifier: string, entry: string): string {
	return `/modules/${identifier}/${entry}`;
}
