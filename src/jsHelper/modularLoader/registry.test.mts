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
		cssFromSource: async (content) => {
			calls.push(`cssSource:${content.slice(0, 30)}`);
			return `sheet:${content.slice(0, 30)}`;
		},
		adoptCss: (sheet) => {
			calls.push(`adopt:${sheet}`);
			return () => calls.push(`unadopt:${sheet}`);
		},
		importSource: async (content) => {
			calls.push(`importSource:${content.slice(0, 30)}`);
			return (jsByModule.__source ?? {}) as never;
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

	// Compat vouching: a dependency may declare historical versions it still
	// answers for, so bumping it does not black out every stale dependent.
	it("loads a dependent whose range the dependency's compat list answers for", async () => {
		const r = new Registry(
			manifest([
				mod("a", "1.0.0", { dependencies: { base: "^0.3.0" } }),
				mod("base", "1.0.0", { compat: ["0.3.0"] }),
			]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.deepEqual(report.failed, {});
		assert.deepEqual(report.loaded.sort(), ["a", "base"]);
	});

	it("compat does not vouch beyond what it lists", async () => {
		const r = new Registry(
			manifest([
				mod("a", "1.0.0", { dependencies: { base: "^0.2.0" } }),
				mod("base", "1.0.0", { compat: ["0.3.0"] }),
			]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.match(report.failed.a, /needs base@\^0\.2\.0/);
		assert.deepEqual(report.loaded, ["base"]);
	});

	it("no compat list keeps the strict refusal", async () => {
		const r = new Registry(
			manifest([
				mod("a", "1.0.0", { dependencies: { base: "^0.3.0" } }),
				mod("base", "1.0.0"),
			]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.match(report.failed.a, /needs base@\^0\.3\.0/);
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

describe("module context", () => {
	it("passes identifier and defer into preload and load", async () => {
		const seen: unknown[] = [];
		const js = {
			feat: {
				preload: (ctx: { identifier: string; defer: (fn: () => void) => void }) => {
					seen.push(ctx.identifier);
					ctx.defer(() => seen.push("deferred"));
				},
				load: (ctx: { identifier: string }) => {
					seen.push(`load:${ctx.identifier}`);
				},
			},
		};
		const r = new Registry(manifest([mod("feat", "1.0.0")]), trackingEffects([], js));
		await r.boot();
		assert.deepEqual(seen.slice(0, 3), ["feat", "load:feat", "deferred"].slice(0, 2));
		await r.unload("feat");
		assert.deepEqual(seen, ["feat", "load:feat", "deferred"]);
	});
});

describe("list with boot report", () => {
	it("joins failure reasons from the report into module states", async () => {
		const js = {
			ok: { load: () => {} },
			broken: {
				load: () => {
					throw new Error("kaput");
				},
			},
		};
		const r = new Registry(manifest([mod("ok", "1.0.0"), mod("broken", "1.0.0")]), trackingEffects([], js));
		const report = await r.boot();
		const states = r.list(report);
		const broken = states.find((s) => s.identifier === "broken");
		const ok = states.find((s) => s.identifier === "ok");
		assert.match(broken!.failed!, /kaput/);
		assert.equal(ok!.failed, undefined);
		assert.equal(ok!.loaded, true);
	});

	it("reflects a failure recorded by enable() after a clean boot", async () => {
		const js: Record<string, { load: () => void }> = { feat: { load: () => {} } };
		const r = new Registry(manifest([mod("feat", "1.0.0")]), trackingEffects([], js));
		const report = await r.boot();
		assert.equal(report.failed.feat, undefined);
		await r.unload("feat");
		js.feat.load = () => {
			throw new Error("enable-time only");
		};
		await r.enable("feat", report);
		const state = r.list(report).find((s) => s.identifier === "feat");
		assert.match(state!.failed!, /enable-time only/);
	});

	it("clears a stale failure once a later enable succeeds", async () => {
		let broken = true;
		const js = {
			flaky: {
				load: () => {
					if (broken) throw new Error("first boot only");
				},
			},
		};
		const r = new Registry(manifest([mod("flaky", "1.0.0")]), trackingEffects([], js));
		const report = await r.boot();
		assert.match(report.failed.flaky, /first boot only/);
		broken = false;
		assert.equal(await r.enable("flaky", report), true);
		const state = r.list(report).find((s) => s.identifier === "flaky");
		assert.equal(state!.failed, undefined);
		assert.equal(state!.loaded, true);
	});

	it("joins mixin-phase failures into list(report)", async () => {
		const js = {
			mixy: {
				mixin: () => {
					throw new Error("mixin exploded");
				},
			},
		};
		const r = new Registry(
			manifest([mod("mixy", "1.0.0", { hasMixins: true })]),
			trackingEffects([], js),
		);
		const report = await r.boot();
		assert.match(r.list(report).find((s) => s.identifier === "mixy")!.failed!, /mixin exploded/);
	});

	it("returns no failed field without a report", () => {
		const r = new Registry(manifest([mod("solo", "1.0.0")]), trackingEffects([]));
		assert.equal(r.list().find((s) => s.identifier === "solo")!.failed, undefined);
	});
});

describe("local module registry state", () => {
	it("marks registerLocal modules local in list() and staged modules not", () => {
		const r = new Registry(manifest([mod("staged", "1.0.0")]), trackingEffects([]));
		r.registerLocal({ metadata: mod("localmod", "1.0.0"), files: { "index.js": "export const load = () => {};" } });
		const states = r.list();
		assert.equal(states.find((s) => s.identifier === "staged")!.local, false);
		assert.equal(states.find((s) => s.identifier === "localmod")!.local, true);
	});

	it("re-registerLocal runs the new code, not a cached index", async () => {
		const calls: string[] = [];
		const r = new Registry(manifest([]), {
			...trackingEffects(calls),
			importSource: async (content) => ({ load: () => calls.push(`ran:${content}`) }) as never,
		});
		const report = { loaded: [], failed: {} };
		r.registerLocal({ metadata: mod("dev", "0.1.0"), files: { "index.js": "v1" } });
		await r.enable("dev", report);
		await r.unload("dev");
		r.registerLocal({ metadata: mod("dev", "0.1.1"), files: { "index.js": "v2" } });
		await r.enable("dev", report);
		assert.deepEqual(calls.filter((c) => c.startsWith("ran:")), ["ran:v1", "ran:v2"]);
	});

	it("loads local css from pushed content, not the staged url", async () => {
		const calls: string[] = [];
		const r = new Registry(manifest([]), trackingEffects(calls));
		r.registerLocal({
			metadata: mod("styled", "1.0.0", { entries: { js: "index.js", css: "index.css" } }),
			files: { "index.js": "", "index.css": ".x{color:red}" },
		});
		await r.enable("styled", { loaded: [], failed: {} });
		assert.ok(calls.some((c) => c.startsWith("cssSource:.x{color:red}")));
		assert.ok(!calls.some((c) => c.startsWith("css:/modules/styled/")));
	});

	it("unregisterLocal removes the module entirely: gone from list, enable reports unknown", async () => {
		const r = new Registry(manifest([]), trackingEffects([]));
		r.registerLocal({ metadata: mod("gone", "1.0.0"), files: {} });
		r.unregisterLocal("gone");
		assert.equal(r.list().find((s) => s.identifier === "gone"), undefined);
		const report = { loaded: [], failed: {} };
		assert.equal(await r.enable("gone", report), false);
		assert.match(report.failed.gone, /unknown module/);
	});
});

	it("mapped locals import by URL so the boot import map serves them", async () => {
		const calls: string[] = [];
		const r = new Registry(manifest([mod("tree", "1.0.0", { entries: { js: "mod.js" } })]), trackingEffects(calls));
		r.registerLocal({
			metadata: mod("tree", "1.0.1", { entries: { js: "mod.js" } }),
			files: { "mod.js": "export default async () => {};", "deps.js": "" },
			mapped: true,
		});
		const report = await r.boot();
		assert.deepEqual(report.failed, {});
		assert.ok(calls.some((c) => c.startsWith("import:") && c.includes("/modules/tree/mod.js")));
		assert.ok(!calls.some((c) => c.startsWith("importSource:")));
	});

	it("restage reverts a local override to the on-disk staged copy", async () => {
		const calls: string[] = [];
		const js = { over: { load: () => calls.push("load:override") } };
		const r = new Registry(manifest([mod("over", "1.0.0")]), trackingEffects(calls, js));
		// a local override is registered and loaded
		r.registerLocal({ metadata: mod("over", "2.0.0"), files: { "index.js": "x" } });
		await r.enable("over", { loaded: [], failed: {} });
		assert.ok(calls.some((c) => c.startsWith("importSource:")), "override loads from pushed source");
		// remove it: unload, then restage the staged metadata and re-enable
		await r.unload("over");
		r.unregisterLocal("over");
		r.restage(mod("over", "1.0.0"));
		calls.length = 0;
		const report = { loaded: [] as string[], failed: {} };
		await r.enable("over", report);
		assert.deepEqual(report.loaded, ["over"]);
		assert.ok(calls.includes("import:/modules/over/index.js"), "staged loads from disk URL, not pushed source");
		assert.ok(!calls.some((c) => c.startsWith("importSource:")), "no pushed source used after restage");
	});

describe("single active theme", () => {
	const theme = (id: string, css: string) => mod(id, "1.0.0", { tags: ["theme"], entries: { css } });

	it("boot loads only the last eligible theme", async () => {
		const r = new Registry(
			manifest([theme("theme-a", "a.css"), mod("ext", "1.0.0"), theme("theme-b", "b.css")]),
			trackingEffects([]),
		);
		const report = await r.boot();
		assert.deepEqual(report.failed, {});
		assert.equal(r.isLoaded("theme-a"), false);
		assert.equal(r.isLoaded("theme-b"), true);
		assert.equal(r.isLoaded("ext"), true);
	});

	it("enabling a theme unloads the loaded one", async () => {
		const calls: string[] = [];
		const r = new Registry(manifest([theme("theme-a", "a.css"), theme("theme-b", "b.css")]), trackingEffects(calls));
		const report = await r.boot();
		assert.equal(r.isLoaded("theme-b"), true);
		assert.equal(await r.enable("theme-a", report), true);
		assert.equal(r.isLoaded("theme-a"), true);
		assert.equal(r.isLoaded("theme-b"), false);
		assert.ok(calls.some((c) => c.startsWith("unadopt:") && c.includes("b.css")));
	});

	it("enabling a non-theme leaves the active theme alone", async () => {
		const r = new Registry(manifest([theme("theme-a", "a.css"), mod("ext", "1.0.0")]), trackingEffects([]));
		const report = await r.boot();
		await r.unload("ext");
		await r.enable("ext", report);
		assert.equal(r.isLoaded("theme-a"), true);
	});
});

describe("active theme preference", () => {
	const theme = (id: string) => mod(id, "1.0.0", { tags: ["theme"], entries: { css: `${id}.css` } });
	const withPref = (initial: string | null) => {
		const box = { value: initial };
		const effects: Effects = {
			...trackingEffects([]),
			activeThemePref: { get: () => box.value, set: (id) => (box.value = id) },
		};
		return { box, effects };
	};

	it("boot prefers the persisted theme over manifest order", async () => {
		const { effects } = withPref("theme-a");
		const r = new Registry(manifest([theme("theme-a"), theme("theme-b")]), effects);
		await r.boot();
		assert.equal(r.isLoaded("theme-a"), true);
		assert.equal(r.isLoaded("theme-b"), false);
	});

	it("boot ignores a stale preference for a missing theme", async () => {
		const { effects } = withPref("gone");
		const r = new Registry(manifest([theme("theme-a"), theme("theme-b")]), effects);
		await r.boot();
		assert.equal(r.isLoaded("theme-b"), true);
	});

	it("enabling a theme persists it; enabling a non-theme does not", async () => {
		const { box, effects } = withPref(null);
		const r = new Registry(manifest([theme("theme-a"), mod("ext", "1.0.0")]), effects);
		const report = await r.boot();
		assert.equal(box.value, null, "boot alone records no preference");
		await r.unload("theme-a");
		await r.enable("theme-a", report);
		assert.equal(box.value, "theme-a");
		await r.unload("ext");
		await r.enable("ext", report);
		assert.equal(box.value, "theme-a");
	});
});
