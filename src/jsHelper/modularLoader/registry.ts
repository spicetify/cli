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
			index = await this.effects.importJs(entryUrl(m.identifier, m.entries.js));
			this.jsIndexes.set(m.identifier, index);
		}
		return index;
	}

	private eligibleOrder(report: BootReport): string[] {
		const eligible: string[] = [];
		for (const id of this.topoOrder()) {
			const problem = this.checkDependencies(id, new Set());
			if (problem) {
				this.effects.log("error", problem);
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
			try {
				const index = await this.jsIndexOf(m);
				const state = this.state(id);

				const preloaded = await index?.preload?.({
					spotifyVersion: this.manifest.spotifyVersion,
				});
				if (preloaded) state.disposers.push(preloaded);

				if (m.entries.css) {
					const sheet = await this.effects.loadCss(entryUrl(m.identifier, m.entries.css));
					state.disposers.push(this.effects.adoptCss(sheet));
				}

				const loaded = await index?.load?.({
					spotifyVersion: this.manifest.spotifyVersion,
				});
				if (loaded) state.disposers.push(loaded);

				state.loaded = true;
				report.loaded.push(id);
				this.effects.log("info", `loaded module ${id}@${m.version}`);
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
