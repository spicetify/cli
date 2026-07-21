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

export interface ModulesManifest {
	spotifyVersion: string;
	classmapKey: string;
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

export interface JsIndex {
	mixin?: (ctx: MixinContext) => SyncOrAsync<void>;
	preload?: (ctx: PreloadContext) => SyncOrAsync<DisposeFn | void>;
	load?: (ctx: LoadContext) => SyncOrAsync<DisposeFn | void>;
}

export interface Effects {
	importJs(path: string): Promise<JsIndex>;
	loadCss(path: string): Promise<unknown>;
	adoptCss(sheet: unknown): DisposeFn;
	log(level: "info" | "error", ...args: unknown[]): void;
}

export function entryUrl(identifier: string, entry: string): string {
	return `/modules/${identifier}/${entry}`;
}
