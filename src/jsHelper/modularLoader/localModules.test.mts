import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	absolutizeLoaderUrls,
	isTreeRecord,
	localWins,
	remapSource,
	removalPlan,
	removalRefusal,
	rewriteRelativeImports,
} from "./localModules.ts";

describe("removalPlan", () => {
	it("drops a shadowed record without unloading the staged copy that serves it", () => {
		assert.equal(
			removalPlan({ running: false, record: true, mapped: false }),
			"record-only",
			"unloading here takes down the staged module, and the revert path is skipped, so it stays down until restart",
		);
	});

	it("unloads and reverts only when the override is the code actually running", () => {
		assert.equal(removalPlan({ running: true, record: true, mapped: false }), "unload-and-revert");
	});

	it("defers a mapped tree module to a restart", () => {
		assert.equal(removalPlan({ running: true, record: true, mapped: true }), "requires-restart");
	});

	it("does nothing when the id has no local anything", () => {
		assert.equal(removalPlan({ running: false, record: false, mapped: false }), "nothing");
	});
});

describe("removalRefusal", () => {
	it("refuses to remove the running store when no staged copy would remain", () => {
		assert.match(removalRefusal("store", false, "unload-and-revert") ?? "", /cannot be uninstalled/);
		assert.match(removalRefusal("store", false, "requires-restart") ?? "", /cannot be uninstalled/);
	});

	it("allows reverting a store override to its staged copy", () => {
		assert.equal(removalRefusal("store", true, "unload-and-revert"), null);
	});

	it("allows clearing a dead store record that is not running", () => {
		// A record that failed to parse or remap never ran; deleting it
		// changes nothing live, and refusing would make it unremovable.
		assert.equal(removalRefusal("store", false, "record-only"), null);
	});

	it("never blocks any other module", () => {
		assert.equal(removalRefusal("bookmark", false, "unload-and-revert"), null);
		assert.equal(removalRefusal("stdlib", false, "requires-restart"), null);
	});
});

describe("remapSource", () => {
	const classmap = {
		main: { topbar: { wrapper: "hashTop1" }, playbar: { buttons: { play: "hashPlay1" } } },
	};

	it("rewrites MAP references to quoted leaves", () => {
		const src = `const a = MAP.main.topbar.wrapper; el.className = MAP.main.playbar.buttons.play;`;
		const out = remapSource(src, classmap);
		assert.ok(out.includes('"hashTop1"'));
		assert.ok(out.includes('"hashPlay1"'));
	});

	it("throws on unresolvable paths", () => {
		assert.throws(() => remapSource("const x = MAP.nope.nope;", classmap), /unresolved classmap references: nope\.nope/);
	});
});

describe("absolutizeLoaderUrls", () => {
	it("qualifies absolute /modules specifiers for blob execution", () => {
		const src = `import{a}from"/modules/stdlib/mod.js";fetch('/modules/x/y.css')`;
		const out = absolutizeLoaderUrls(src, "https://xpui.app.spotify.com");
		assert.equal(
			out,
			`import{a}from"https://xpui.app.spotify.com/modules/stdlib/mod.js";fetch('https://xpui.app.spotify.com/modules/x/y.css')`,
		);
	});

	it("leaves relative and already-qualified urls alone", () => {
		const src = 'import "./chunk.js"; import "https://esm.sh/x"; const s = "modules/plain";';
		assert.equal(absolutizeLoaderUrls(src, "https://o"), src);
	});
});

describe("rewriteRelativeImports", () => {
	const origin = "https://xpui.app.spotify.com";

	it("rewrites ./ and ../ against the file's own directory", () => {
		const src = 'import { a } from "./load.js";\nexport { b } from "../shared/util.js";';
		const out = rewriteRelativeImports(src, "stdlib", "src/expose/React.js", origin);
		assert.match(out, /"https:\/\/xpui\.app\.spotify\.com\/modules\/stdlib\/src\/expose\/load\.js"/);
		assert.match(out, /"https:\/\/xpui\.app\.spotify\.com\/modules\/stdlib\/src\/shared\/util\.js"/);
	});

	it("rewrites a root-level entry's siblings", () => {
		const out = rewriteRelativeImports('import "./deps.js";', "stdlib", "mod.js", origin);
		assert.equal(out, `import "${origin}/modules/stdlib/deps.js";`);
	});

	it("rewrites dynamic imports and leaves absolute, bare, and https specifiers alone", () => {
		const src = [
			'const x = await import("./vendor/rxjs.js");',
			'import y from "/modules/stdlib/mod.js";',
			'import z from "https://esm.sh/left-alone";',
			'import w from "react";',
		].join("\n");
		const out = rewriteRelativeImports(src, "stdlib", "deps.js", origin);
		assert.match(out, /import\("https:\/\/xpui\.app\.spotify\.com\/modules\/stdlib\/vendor\/rxjs\.js"\)/);
		assert.match(out, /"\/modules\/stdlib\/mod\.js"/);
		assert.match(out, /"https:\/\/esm\.sh\/left-alone"/);
		assert.match(out, /"react"/);
	});

	it("collapses .. past the module root instead of escaping it", () => {
		const out = rewriteRelativeImports('import "../../../etc.js";', "stdlib", "a.js", origin);
		assert.equal(out, `import "${origin}/modules/stdlib/etc.js";`);
	});
});

describe("isTreeRecord", () => {
	const rec = (files: Record<string, string>, js = "index.js") =>
		({ metadata: { entries: { js } }, files }) as never;

	it("a single-entry record is not a tree", () => {
		assert.equal(isTreeRecord(rec({ "index.js": "", "index.css": "" })), false);
	});

	it("extra js files make a tree", () => {
		assert.equal(isTreeRecord(rec({ "mod.js": "", "deps.js": "" }, "mod.js")), true);
		assert.equal(isTreeRecord(rec({ "mod.js": "", "src/expose/React.js": "" }, "mod.js")), true);
	});

	it("sourcemaps and css do not make a tree", () => {
		assert.equal(isTreeRecord(rec({ "index.js": "", "index.js.map": "", "index.css": "" })), false);
	});
});

describe("localWins", () => {
	const rec = (version: string, remapKey?: string) =>
		({ metadata: { version }, ...(remapKey ? { remapKey } : {}) }) as never;

	it("newer local remapped against the current classmap wins", () => {
		assert.equal(localWins("1.0.0", rec("1.0.1", "1020094"), "1020094"), true);
	});

	it("same or older local defers to staged", () => {
		assert.equal(localWins("1.0.0", rec("1.0.0", "1020094"), "1020094"), false);
		assert.equal(localWins("1.0.1", rec("1.0.0", "1020094"), "1020094"), false);
	});

	it("a classmap mismatch defers to staged even when newer", () => {
		assert.equal(localWins("1.0.0", rec("1.0.1", "1020092"), "1020094"), false);
	});

	it("records without a remap key (older installs) defer to staged", () => {
		assert.equal(localWins("1.0.0", rec("1.0.1"), "1020094"), false);
	});

	it("an unparsable version defers to staged", () => {
		assert.equal(localWins("1.0.0", rec("garbage", "1020094"), "1020094"), false);
	});
});
