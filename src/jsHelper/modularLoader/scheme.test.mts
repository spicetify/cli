import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { chooseScheme, parseColorIni, parseColorSchemes } from "./index.ts";

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
