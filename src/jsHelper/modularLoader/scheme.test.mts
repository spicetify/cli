import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseScheme, fillCanonical, parseColorIni, parseColorSchemes } from "./index.ts";

describe("parseColorIni", () => {
	it("parses classic color.ini with sections and comments", () => {
		const ini = `; comment
[Base]
main_fg = f8f8f2
main_bg = 191414
# another comment
[Text]
text = #f8f8f2

[Button]
button_bg = bd93f9
`;
		assert.deepEqual(parseColorIni(ini), {
			main_fg: "f8f8f2",
			main_bg: "191414",
			text: "#f8f8f2",
			button_bg: "bd93f9",
		});
	});

	it("skips malformed lines", () => {
		assert.deepEqual(parseColorIni("nonsense\na=b\n= x\n"), { a: "b" });
	});

	it("lowercases keys like the classic CLI's InsensitiveLoad", () => {
		// Themes reference --spice-gradienttop; a camelCase gradientTop key
		// must land on the same variable name.
		const ini = "[Pink]\ngradientTop = ebaf98\nGradientBottom = f5d4b7\n";
		assert.deepEqual(parseColorIni(ini), { gradienttop: "ebaf98", gradientbottom: "f5d4b7" });
	});

	it("strips inline comments from values", () => {
		const ini = "[Base]\nmain = 000000 ; becomes transparent via javascript\nsidebar = 142b44; bottom of sky\ntext = FFFFFF\n";
		assert.deepEqual(parseColorIni(ini), { main: "000000", sidebar: "142b44", text: "FFFFFF" });
	});
});

describe("parseColorSchemes", () => {
	it("keeps sections separate and preserves order", () => {
		const ini = "[Deep]\ntext = ffffff\nmain = 111111\n[Coral]\ntext = 000000\nmain = eeeeee\n";
		const schemes = parseColorSchemes(ini);
		assert.deepEqual(Object.keys(schemes), ["Deep", "Coral"]);
		assert.equal(schemes.Deep.text, "ffffff");
		assert.equal(schemes.Coral.text, "000000");
	});

	it("collects sectionless keys under the default scheme", () => {
		assert.deepEqual(parseColorSchemes("text = abc123\n"), { "": { text: "abc123" } });
	});

	it("drops empty sections", () => {
		assert.deepEqual(Object.keys(parseColorSchemes("[Empty]\n[Real]\na = b\n")), ["Real"]);
	});

	it("strips inline comments from section headers", () => {
		assert.deepEqual(Object.keys(parseColorSchemes("[Base] ; the default sky\na = b\n")), ["Base"]);
	});
});

describe("chooseScheme", () => {
	const schemes = { Deep: { a: "1" }, Coral: { a: "2" } };
	it("prefers the saved scheme when it still exists", () => {
		assert.equal(chooseScheme(schemes, "Coral"), "Coral");
	});
	it("falls back to the first scheme when the saved one is gone", () => {
		assert.equal(chooseScheme(schemes, "Removed"), "Deep");
		assert.equal(chooseScheme(schemes, null), "Deep");
	});
	it("returns null for an empty file", () => {
		assert.equal(chooseScheme({}, null), null);
	});
});

describe("fillCanonical", () => {
	it("derives an omitted card from the theme's own background, not a dark default", () => {
		const out = fillCanonical({ main: "ffe8d9", text: "8f7878" });
		assert.equal(out.card, "ffe8d9");
		assert.equal(out["main-elevated"], "ffe8d9");
	});

	it("never overwrites a declared key", () => {
		const out = fillCanonical({ main: "ffe8d9", card: "e6cfd7", text: "8f7878" });
		assert.equal(out.card, "e6cfd7");
	});

	it("resolves the mutually-referential pair when only one side is declared", () => {
		assert.equal(fillCanonical({ main: "111", card: "222" })["main-elevated"], "222");
		assert.equal(fillCanonical({ main: "111", "main-elevated": "333" }).card, "333");
	});

	it("prefers card-hover for highlight when the theme names one", () => {
		const out = fillCanonical({ main: "ffe8d9", "card-hover": "ffece4" });
		assert.equal(out.highlight, "ffece4");
	});

	it("leaves a scheme that declares everything untouched", () => {
		const full = { text: "a", subtext: "b", main: "c", card: "d" };
		assert.deepEqual({ ...full }, { ...full, ...Object.fromEntries(Object.entries(fillCanonical(full)).filter(([k]) => k in full)) });
	});
});
