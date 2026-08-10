import { satisfies } from "./semver-lite.ts";
import {
	type DisposeFn,
	type Effects,
	type JsIndex,
	type ManifestModule,
	type ModulesManifest,
	entryUrl,
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
				// The installed version satisfies the range, or the dependency
				// vouches for a historical version the range admits (compat) —
				// the dependency is the party that knows whether its bump broke
				// anything, not every dependent.
				const vouched = (v: string) => satisfies(v, range);
				if (!vouched(depModule.version) && !depModule.compat?.some(vouched)) {
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
			// Mapped locals import by URL: the boot import map serves every
			// file of the tree from its local blob, entry included.
			const local = this.mappedLocals.has(m.identifier)
				? undefined
				: this.getLocalFile(m.identifier, m.entries.js);
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
		mapped?: boolean;
	}): void {
		this.localFiles.set(record.metadata.identifier, record.files);
		this.modules.set(record.metadata.identifier, record.metadata);
		if (record.mapped) this.mappedLocals.add(record.metadata.identifier);
		else this.mappedLocals.delete(record.metadata.identifier);
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
		this.mappedLocals.delete(identifier);
	}

	isMappedLocal(identifier: string): boolean {
		return this.mappedLocals.has(identifier);
	}

	// restage re-registers a staged (non-local) module from its manifest
	// metadata, dropping any local override traces so a following enable()
	// loads the on-disk staged copy. Used when a local override that shadowed
	// a staged module is removed, to revert to staged without a restart.
	restage(meta: ManifestModule): void {
		this.modules.set(meta.identifier, meta);
		this.localFiles.delete(meta.identifier);
		this.mappedLocals.delete(meta.identifier);
		this.jsIndexes.delete(meta.identifier);
		this.states.delete(meta.identifier);
	}

	private localFiles = new Map<string, Record<string, string>>();
	private mappedLocals = new Set<string>();

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

	private disabledSet(): Set<string> {
		return new Set(this.effects.disabledPref?.get() ?? []);
	}

	private eligibleOrder(report: BootReport, disabled: Set<string>): string[] {
		const eligible: string[] = [];
		for (const id of this.topoOrder()) {
			// A disabled module is skipped before its dependencies are even
			// checked: it must not mixin, load, or report a problem it is not
			// being asked to solve.
			if (disabled.has(id)) continue;
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
		const eligible = this.eligibleOrder(report, this.disabledSet());
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

	private isTheme(identifier: string): boolean {
		return this.modules.get(identifier)?.tags?.includes("theme") ?? false;
	}

	// Themes fight over the same client chrome: loading one unloads the
	// rest, so the single-theme invariant holds for every install path
	// (store, manager, dev pushes), not just the store UI.
	private async unloadOtherThemes(identifier: string): Promise<void> {
		if (!this.isTheme(identifier)) return;
		for (const id of this.modules.keys()) {
			if (id !== identifier && this.isTheme(id) && this.isLoaded(id)) {
				this.effects.log("info", `unloading theme ${id}: one theme at a time`);
				await this.unload(id);
			}
		}
	}

	// runLoads executes preload/css/load for all eligible modules, after the
	// client is up. Call runMixins first during early boot.
	async runLoads(report: BootReport): Promise<void> {
		const disabled = this.disabledSet();
		const eligible = this.eligibleOrder(report, disabled);
		// Two installed themes would otherwise both load at boot. The persisted
		// preference (last theme the user enabled) wins; without one, the last
		// eligible theme does — local installs register after staged modules,
		// so that is the most recent install.
		const themes = eligible.filter((id) => !report.failed[id] && this.isTheme(id));
		const preferred = this.effects.activeThemePref?.get();
		// A disabled preference means the user turned their theme off. Falling
		// through to the "last installed theme" rule there would promote an
		// arbitrary other theme in its place, which reads as the disable being
		// ignored.
		const bootTheme =
			preferred && disabled.has(preferred)
				? undefined
				: preferred && themes.includes(preferred)
					? preferred
					: themes[themes.length - 1];
		for (const id of eligible) {
			if (report.failed[id]) continue;
			if (this.isTheme(id) && id !== bootTheme) {
				this.effects.log("info", `skipping theme ${id}: ${bootTheme} is active (one theme at a time)`);
				continue;
			}
			const m = this.modules.get(id)!;
			// A disabled dependency is not a failure of its own, but a dependent
			// that loads against it half-works silently (stdlib's registers
			// never mount, and nothing says why).
			const blockedBy = Object.keys(m.dependencies).find((dep) => report.failed[dep] || disabled.has(dep));
			if (blockedBy) {
				report.failed[id] = disabled.has(blockedBy)
					? `dependency ${blockedBy} is disabled`
					: `dependency ${blockedBy} failed`;
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
						const schemeDisposer = await this.effects.applyScheme(
							m.identifier,
							this.getLocalFile(m.identifier, "color.ini"),
						);
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
		await this.unloadOtherThemes(identifier);
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
					const schemeDisposer = await this.effects.applyScheme(
						identifier,
						this.getLocalFile(identifier, "color.ini"),
					);
					if (schemeDisposer) state.disposers.push(schemeDisposer);
				}
			}
			const loaded = await index?.load?.(ctx);
			if (loaded) state.disposers.push(loaded);
			state.loaded = true;
			if (this.isTheme(identifier)) this.effects.activeThemePref?.set(identifier);
			// Only a load that actually succeeded clears the persisted disable,
			// so a module that cannot start is not recorded as enabled.
			this.effects.disabledPref?.remove(identifier);
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

	// disable is the explicit counterpart to enable: it records the choice so
	// the next boot skips the module, then unloads. Internal unloads (theme
	// switching, dependency cascades, reload) go through unload() directly and
	// persist nothing — otherwise switching themes would permanently disable
	// the one being replaced.
	async disable(identifier: string): Promise<boolean> {
		this.effects.disabledPref?.add(identifier);
		return this.unload(identifier);
	}

	// forget drops a removed module's persisted disable so the id does not
	// linger in the set after the module is gone.
	forgetDisabled(identifier: string): void {
		this.effects.disabledPref?.remove(identifier);
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
