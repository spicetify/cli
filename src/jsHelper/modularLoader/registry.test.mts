import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Registry } from "./registry.ts";
import { satisfies } from "./semver-lite.ts";
import type { Effects, ManifestModule, ModulesManifest } from "./types.ts";

function mod(id: string, version: string, over: Partial<ManifestModule> = {}): ManifestModule {
	return {
		identifier: id,
		name: id,
		tags: [],
		version,
		authors: [],
		description: "",
		entries: { js: "index.js" },
		hasMixins: false,
		dependencies: {},
		...over,
	};
}

function manifest(modules: ManifestModule[]): ModulesManifest {
	return { spotifyVersion: "1.2.94", classmapKey: "1020094", modules };
}

function trackingEffects(calls: string[], jsByModule: Record<string, unknown> = {}): Effects {
	return {
		importJs: async (path) => {
			calls.push(`import:${path}`);
			const id = path.split("/")[2];
			return (jsByModule[id] ?? {}) as never;
		},
		loadCss: async (path) => {
			calls.push(`css:${path}`);
			return `sheet:${path}`;
		},
		adoptCss: (sheet) => {
			calls.push(`adopt:${sheet}`);
			return () => calls.push(`unadopt:${sheet}`);
		},
		createTransformer: () => () => Promise.resolve(undefined),
		log: () => {},
	};
}

describe("semver-lite", () => {
	it("satisfies common ranges", () => {
		assert.ok(satisfies("0.2.2", "^0.2.0"));
		assert.ok(satisfies("1.0.0", "^0.2.0") === false);
		assert.ok(satisfies("0.2.9", "~0.2.2"));
		assert.ok(satisfies("0.3.0", "~0.2.2") === false);
		assert.ok(satisfies("1.2.3", ">=1.0.0"));
		assert.ok(satisfies("1.2.3", "*"));
		assert.ok(satisfies("1.2.3", "1.2.3"));
		assert.ok(satisfies("0.0.3", "^0.0.3"));
		assert.ok(satisfies("0.0.4", "^0.0.3") === false);
	});
});

describe("Registry boot", () => {
	it("loads dependencies before dependants, mixins before loads", async () => {
		const calls: string[] = [];
		const js: Record<string, unknown> = {
			base: {
				mixin: () => calls.push("mixin:base"),
				load: () => calls.push("load:base"),
			},
			feature: {
				mixin: () => calls.push("mixin:feature"),
				load: () => calls.push("load:feature"),
			},
		};
		const r = new Registry(
			manifest([
				mod("feature", "1.0.0", { hasMixins: true, dependencies: { base: "^1.0.0" } }),
				mod("base", "1.0.1", { hasMixins: true }),
			]),
			trackingEffects(calls, js),
		);
		const report = await r.boot();
		assert.deepEqual(report.failed, {});
		assert.deepEqual(report.loaded.sort(), ["base", "feature"]);
		assert.deepEqual(
			calls.filter((c) => !c.startsWith("import:")),
			["mixin:base", "mixin:feature", "load:base", "load:feature"],
		);
	});

	it("adopts css between preload and load", async () => {
		const calls: string[] = [];
		const js = {
			styled: {
				preload: () => calls.push("preload"),
				load: () => calls.push("load"),
			},
		};
		const r = new Registry(
			manifest([mod("styled", "1.0.0", { entries: { js: "index.js", css: "index.css" } })]),
			trackingEffects(calls, js),
		);
		await r.boot();
		assert.deepEqual(calls, [
			"import:/modules/styled/index.js",
			"preload",
			"css:/modules/styled/index.css",
			"adopt:sheet:/modules/styled/index.css",
			"load",
		]);
	});

	it("fails only the module with a missing dependency", async () => {
		const r = new Registry(
			manifest([mod("a", "1.0.0", { dependencies: { ghost: "^1.0.0" } }), mod("b", "1.0.0")]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.match(report.failed.a, /not installed/);
		assert.deepEqual(report.loaded, ["b"]);
	});

	it("fails on unsatisfied dependency version", async () => {
		const r = new Registry(
			manifest([
				mod("a", "1.0.0", { dependencies: { base: "^2.0.0" } }),
				mod("base", "1.0.1"),
			]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.match(report.failed.a, /needs base@\^2\.0\.0/);
		assert.deepEqual(report.loaded, ["base"]);
	});

	it("fails dependency cycles", async () => {
		const r = new Registry(
			manifest([
				mod("a", "1.0.0", { dependencies: { b: "*" } }),
				mod("b", "1.0.0", { dependencies: { a: "*" } }),
			]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.match(report.failed.a ?? "", /cycle/);
		assert.match(report.failed.b ?? "", /cycle/);
	});

	it("blocks modules whose mixin phase failed", async () => {
		const js = {
			bad: {
				mixin: () => {
					throw new Error("boom");
				},
				load: () => {},
			},
		};
		const r = new Registry(manifest([mod("bad", "1.0.0", { hasMixins: true })]), trackingEffects([], js));
		const report = await r.boot();
		assert.match(report.failed.bad, /mixin failed: boom/);
		assert.deepEqual(report.loaded, []);
	});

	it("loads css-only modules", async () => {
		const calls: string[] = [];
		const r = new Registry(
			manifest([mod("theme", "1.0.0", { entries: { css: "index.css" } })]),
			trackingEffects(calls),
		);
		const report = await r.boot();
		assert.deepEqual(report.loaded, ["theme"]);
		assert.ok(calls.includes("adopt:sheet:/modules/theme/index.css"));
	});
});

describe("Registry unload", () => {
	it("disposes in reverse order and unloads dependants first", async () => {
		const calls: string[] = [];
		const js: Record<string, unknown> = {
			base: { load: () => () => calls.push("dispose:base") },
			feature: {
				preload: () => () => calls.push("dispose:feature-preload"),
				load: () => () => calls.push("dispose:feature-load"),
			},
		};
		const r = new Registry(
			manifest([mod("base", "1.0.0"), mod("feature", "1.0.0", { dependencies: { base: "*" } })]),
			trackingEffects(calls, js),
		);
		await r.boot();
		calls.length = 0;
		const ok = await r.unload("base");
		assert.ok(ok);
		assert.deepEqual(calls, ["dispose:feature-load", "dispose:feature-preload", "dispose:base"]);
		assert.ok(!r.isLoaded("base"));
		assert.ok(!r.isLoaded("feature"));
	});

	it("returns false for modules that are not loaded", async () => {
		const r = new Registry(manifest([mod("a", "1.0.0")]), trackingEffects([]));
		assert.equal(await r.unload("a"), false);
	});
});

describe("Registry runtime manager", () => {
	it("lists module states", async () => {
		const r = new Registry(
			manifest([mod("a", "1.0.0"), mod("b", "2.0.0", { dependencies: { a: "*" } })]),
			trackingEffects([]),
		);
		await r.boot();
		const states = r.list();
		assert.equal(states.length, 2);
		assert.deepEqual(
			states.map((s) => [s.identifier, s.loaded]),
			[
				["a", true],
				["b", true],
			],
		);
	});

	it("enables a module on demand and disables it", async () => {
		const calls: string[] = [];
		const js = { feat: { load: () => calls.push("load:feat") } };
		const r = new Registry(manifest([]), trackingEffects(calls, js));
		const report = { loaded: [], failed: {} };
		// runtime registration: enable() needs the module in the registry
		(r as never as { modules: Map<string, unknown> }).modules.set(
			"feat",
			mod("feat", "1.0.0"),
		);
		assert.equal(await r.enable("feat", report), true);
		assert.deepEqual(report.loaded, ["feat"]);
		assert.equal(await r.enable("feat", report), false, "already loaded");
		assert.equal(await r.unload("feat"), true);
		assert.equal(await r.enable("feat", report), true, "re-enable works");
	});

	it("reloads a module", async () => {
		const calls: string[] = [];
		const js = {
			feat: { load: () => () => calls.push("dispose") },
		};
		const r = new Registry(manifest([mod("feat", "1.0.0")]), trackingEffects(calls, js));
		const report = { loaded: [], failed: {} };
		await r.boot();
		calls.length = 0;
		assert.equal(await r.reload("feat", report), true);
		assert.deepEqual(calls, ["dispose"]);
	});

	it("refuses to enable unknown or dependency-broken modules", async () => {
		const r = new Registry(manifest([mod("x", "1.0.0", { dependencies: { ghost: "*" } })]), trackingEffects([]));
		const report = { loaded: [], failed: {} };
		assert.equal(await r.enable("nope", report), false);
		assert.equal(await r.enable("x", report), false);
	});
});
