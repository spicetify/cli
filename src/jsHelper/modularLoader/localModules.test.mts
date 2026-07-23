import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { remapSource } from "./localModules.ts";

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
