import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseColorIni } from "./index.ts";

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
});
