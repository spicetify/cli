import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { Window } from "happy-dom";

import { adoptCss } from "./index.ts";

const win = new Window();
Object.assign(globalThis, { document: win.document, CSSStyleSheet: win.CSSStyleSheet });

const sheet = (name: string) => {
	const s = new win.CSSStyleSheet();
	s.replaceSync(`.${name} {}`);
	return s;
};
const order = () => document.adoptedStyleSheets.map((s) => s.cssRules[0].cssText.split(" ")[0]);

describe("adoptCss", () => {
	it("keeps theme sheets after extension sheets adopted later", () => {
		document.adoptedStyleSheets = [];
		const disposeTheme = adoptCss(sheet("theme"), { theme: true });
		adoptCss(sheet("alpha"));
		adoptCss(sheet("beta"));
		assert.deepEqual(order(), [".alpha", ".beta", ".theme"]);
		disposeTheme();
		adoptCss(sheet("gamma"));
		assert.deepEqual(order(), [".alpha", ".beta", ".gamma"]);
	});

	it("keeps theme <style> fallbacks after extension ones", () => {
		document.head.replaceChildren();
		adoptCss("@import url(x.css); .theme {}", { theme: true });
		adoptCss("@import url(y.css); .alpha {}");
		assert.deepEqual(
			[...document.head.querySelectorAll("style")].map((el) => el.textContent.split("; ")[1]),
			[".alpha {}", ".theme {}"],
		);
	});
});
