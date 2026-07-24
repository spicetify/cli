import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { absolutizeLoaderUrls, remapSource } from "./localModules.ts";

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
	it("qualifies absolute /modules and /hooks specifiers for blob execution", () => {
		const src = `import{a}from"/modules/stdlib/mod.js";import("/hooks/util.js");fetch('/modules/x/y.css')`;
		const out = absolutizeLoaderUrls(src, "https://xpui.app.spotify.com");
		assert.equal(
			out,
			`import{a}from"https://xpui.app.spotify.com/modules/stdlib/mod.js";import("https://xpui.app.spotify.com/hooks/util.js");fetch('https://xpui.app.spotify.com/modules/x/y.css')`,
		);
	});

	it("leaves relative and already-qualified urls alone", () => {
		const src = 'import "./chunk.js"; import "https://esm.sh/x"; const s = "modules/plain";';
		assert.equal(absolutizeLoaderUrls(src, "https://o"), src);
	});
});
