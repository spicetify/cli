import { satisfies } from "./semver-lite.ts";
import {
	entryUrl,
	type DisposeFn,
	type Effects,
	type JsIndex,
	type ManifestModule,
	type ModulesManifest,
} from "./types.ts";

export interface BootReport {
	loaded: string[];
	failed: Record<string, string>;
}

export interface ModuleState {
	identifier: string;
	version: string;
	loaded: boolean;
	mixedIn: boolean;
	local: boolean;
	failed?: string;
}

interface InstanceState {
	disposers: DisposeFn[];
	mixedIn: boolean;
	loaded: boolean;
}

export class Registry {
	private modules = new Map<string, ManifestModule>();
	private states = new Map<string, InstanceState>();
	private jsIndexes = new Map<string, JsIndex>();
	private manifest: ModulesManifest;
	private effects: Effects;

	constructor(manifest: ModulesManifest, effects: Effects) {
		this.manifest = manifest;
		this.effects = effects;
		for (const m of manifest.modules) {
			this.modules.set(m.identifier, m);
		}
	}

	get(identifier: string): ManifestModule | undefined {
		return this.modules.get(identifier);
	}

	isLoaded(identifier: string): boolean {
		return this.states.get(identifier)?.loaded ?? false;
	}

	private state(identifier: string): InstanceState {
		let s = this.states.get(identifier);
		if (!s) {
			s = { disposers: [], mixedIn: false, loaded: false };
			this.states.set(identifier, s);
		}
		return s;
	}

	private checkDependencies(identifier: string, seen: Set<string>): string | null {
		const m = this.modules.get(identifier);
		if (!m) return `unknown module ${identifier}`;
		if (seen.has(identifier)) return `dependency cycle involving ${identifier}`;
		seen.add(identifier);
		for (const [dep, range] of Object.entries(m.dependencies)) {
			const depModule = this.modules.get(dep);
			if (!depModule) return `${identifier} needs ${dep}, which is not installed`;
			try {
				if (!satisfies(depModule.version, range)) {
					return `${identifier} needs ${dep}@${range}, installed is ${depModule.version}`;
				}
			} catch (e) {
				return `${identifier} needs ${dep}@${range}: ${(e as Error).message}`;
			}
			const nested = this.checkDependencies(dep, seen);
			if (nested) return nested;
		}
		seen.delete(identifier);
		return null;
	}

	private topoOrder(): string[] {
		const out: string[] = [];
		const done = new Set<string>();
		const visit = (id: string) => {
			if (done.has(id)) return;
			done.add(id);
			for (const dep of Object.keys(this.modules.get(id)?.dependencies ?? {})) {
				if (this.modules.has(dep)) visit(dep);
			}
			out.push(id);
		};
		for (const id of this.modules.keys()) visit(id);
		return out;
	}

	private async jsIndexOf(m: ManifestModule): Promise<JsIndex | null> {
		if (!m.entries.js) return null;
		let index = this.jsIndexes.get(m.identifier);
		if (!index) {
			const local = this.getLocalFile(m.identifier, m.entries.js);
			if (local !== undefined) {
				index = await this.effects.importSource(local);
			} else {
				index = await this.effects.importJs(entryUrl(m.identifier, m.entries.js));
			}
			this.jsIndexes.set(m.identifier, index);
		}
		return index;
	}

	// registerLocal adds localStorage-installed modules to the registry,
	// rewriting MAP.* references against the bundled classmap at load time.
	registerLocal(record: {
		metadata: ManifestModule;
		files: Record<string, string>;
	}): void {
		this.localFiles.set(record.metadata.identifier, record.files);
		this.modules.set(record.metadata.identifier, record.metadata);
		// New content must not run behind an index cached from a previous
		// install (or from the staged copy this local install overrides).
		this.jsIndexes.delete(record.metadata.identifier);
	}

	hasLocal(identifier: string): boolean {
		return this.localFiles.has(identifier);
	}

	// unregisterLocal removes every trace of a localStorage-installed module
	// so a removed module is not one enable() away from resurrecting from
	// cached files.
	unregisterLocal(identifier: string): void {
		this.modules.delete(identifier);
		this.localFiles.delete(identifier);
		this.jsIndexes.delete(identifier);
		this.states.delete(identifier);
	}

	private localFiles = new Map<string, Record<string, string>>();

	protected getLocalFile(identifier: string, entry: string): string | undefined {
		return this.localFiles.get(identifier)?.[entry];
	}

	// Local installs carry their stylesheet as content; staged modules load
	// theirs from the app bundle.
	private async cssSheetOf(m: ManifestModule): Promise<unknown> {
		const local = this.getLocalFile(m.identifier, m.entries.css!);
		if (local !== undefined) return this.effects.cssFromSource(local);
		return this.effects.loadCss(entryUrl(m.identifier, m.entries.css!));
	}

	private eligibleOrder(report: BootReport): string[] {
		const eligible: string[] = [];
		for (const id of this.topoOrder()) {
			const problem = this.checkDependencies(id, new Set());
			if (problem) {
				// eligibleOrder runs for both mixins and loads; log once.
				if (report.failed[id] !== problem) this.effects.log("error", problem);
				report.failed[id] = problem;
			} else {
				eligible.push(id);
			}
		}
		return eligible;
	}

	// runMixins executes the mixin phase for all eligible modules. It must
	// complete before the client bundle boots for interceptions to work.
	async runMixins(report: BootReport): Promise<void> {
		const eligible = this.eligibleOrder(report);
		for (const id of eligible) {
			const m = this.modules.get(id)!;
			if (!m.hasMixins) continue;
			try {
				const index = await this.jsIndexOf(m);
				await index?.mixin?.(this.effects.createTransformer(), {
					spotifyVersion: this.manifest.spotifyVersion,
				});
				this.state(id).mixedIn = true;
			} catch (e) {
				report.failed[id] = `mixin failed: ${(e as Error).message}`;
				this.effects.log("error", `can't inject mixins for ${id}`, e);
			}
		}

	}

	// runLoads executes preload/css/load for all eligible modules, after the
	// client is up. Call runMixins first during early boot.
	async runLoads(report: BootReport): Promise<void> {
		const eligible = this.eligibleOrder(report);
		for (const id of eligible) {
			if (report.failed[id]) continue;
			const m = this.modules.get(id)!;
			const blockedBy = Object.keys(m.dependencies).find((dep) => report.failed[dep]);
			if (blockedBy) {
				report.failed[id] = `dependency ${blockedBy} failed`;
				continue;
			}
			if (m.hasMixins && !this.state(id).mixedIn) {
				report.failed[id] = "mixins not loaded";
				continue;
			}
			const loadOnce = async () => {
				const index = await this.jsIndexOf(m);
				const state = this.state(id);

				const preloaded = await index?.preload?.({
					spotifyVersion: this.manifest.spotifyVersion,
					identifier: id,
					defer: (fn) => state.disposers.push(fn),
				});
				if (preloaded) state.disposers.push(preloaded);

				if (m.entries.css) {
					const sheet = await this.cssSheetOf(m);
					state.disposers.push(this.effects.adoptCss(sheet));
					if (this.effects.applyScheme) {
						const schemeDisposer = await this.effects.applyScheme(m.identifier);
						if (schemeDisposer) state.disposers.push(schemeDisposer);
					}
				}

				const loaded = await index?.load?.({
					spotifyVersion: this.manifest.spotifyVersion,
					identifier: id,
					defer: (fn) => state.disposers.push(fn),
				});
				if (loaded) state.disposers.push(loaded);

				state.loaded = true;
				report.loaded.push(id);
				this.effects.log("info", `loaded module ${id}@${m.version}`);
			};
			try {
				try {
					await loadOnce();
				} catch (e) {
					// Module-script fetches can fail transiently during boot;
					// failed dynamic imports are not cached, so one retry heals.
					if (!/Failed to fetch/i.test((e as Error).message)) throw e;
					this.effects.log("error", `retrying ${id} after fetch failure`, e);
					for (const dispose of this.state(id).disposers.splice(0).reverse()) {
						try {
							await dispose();
						} catch {}
					}
					await loadOnce();
				}
			} catch (e) {
				report.failed[id] = `load failed: ${(e as Error).message}`;
				this.effects.log("error", `can't load ${id}`, e);
			}
		}

	}

	async boot(): Promise<BootReport> {
		const report: BootReport = { loaded: [], failed: {} };
		await this.runMixins(report);
		await this.runLoads(report);
		return report;
	}

	list(report?: BootReport): ModuleState[] {
		const out: ModuleState[] = [];
		for (const m of this.modules.values()) {
			const s = this.states.get(m.identifier);
			const failed = report?.failed[m.identifier];
			out.push({
				identifier: m.identifier,
				version: m.version,
				loaded: s?.loaded ?? false,
				mixedIn: s?.mixedIn ?? false,
				local: this.localFiles.has(m.identifier),
				...(failed !== undefined ? { failed } : {}),
			});
		}
		return out;
	}

	// enable loads one module on demand (dependencies first), after boot.
	async enable(identifier: string, report: BootReport): Promise<boolean> {
		const m = this.modules.get(identifier);
		if (!m) {
			report.failed[identifier] = "unknown module";
			return false;
		}
		if (this.isLoaded(identifier)) return false;
		const problem = this.checkDependencies(identifier, new Set());
		if (problem) {
			report.failed[identifier] = problem;
			return false;
		}
		try {
			const index = await this.jsIndexOf(m);
			const state = this.state(identifier);
			const ctx = {
				spotifyVersion: this.manifest.spotifyVersion,
				identifier,
				defer: (fn: () => void | Promise<void>) => state.disposers.push(fn),
			};
			const preloaded = await index?.preload?.(ctx);
			if (preloaded) state.disposers.push(preloaded);
			if (m.entries.css) {
				const sheet = await this.cssSheetOf(m);
				state.disposers.push(this.effects.adoptCss(sheet));
				if (this.effects.applyScheme) {
					const schemeDisposer = await this.effects.applyScheme(identifier);
					if (schemeDisposer) state.disposers.push(schemeDisposer);
				}
			}
			const loaded = await index?.load?.(ctx);
			if (loaded) state.disposers.push(loaded);
			state.loaded = true;
			// A module that failed earlier (boot or a previous enable) is no
			// longer failed; leaving the stale reason makes list() lie.
			delete report.failed[identifier];
			report.loaded.push(identifier);
			return true;
		} catch (e) {
			report.failed[identifier] = `load failed: ${(e as Error).message}`;
			return false;
		}
	}

	async reload(identifier: string, report: BootReport): Promise<boolean> {
		await this.unload(identifier);
		return this.enable(identifier, report);
	}

	async unload(identifier: string): Promise<boolean> {
		const state = this.states.get(identifier);
		if (!state?.loaded) return false;

		for (const [id, m] of this.modules) {
			if (id !== identifier && this.isLoaded(id) && identifier in m.dependencies) {
				await this.unload(id);
			}
		}

		for (const dispose of state.disposers.splice(0).reverse()) {
			try {
				await dispose();
			} catch (e) {
				this.effects.log("error", `error unloading ${identifier}`, e);
			}
		}
		state.loaded = false;
		return true;
	}
}
