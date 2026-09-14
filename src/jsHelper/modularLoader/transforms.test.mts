import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTransforms, createTransformRegistry, transformPath } from "./transforms.ts";

describe("transforms", () => {
	it("applies matching transforms in order", () => {
		const { factory, registered } = createTransformRegistry();
		factory(() => (str) => str.replace("foo", "bar"), { glob: /xpui/ });
		factory(() => (str) => str.replace("bar", "baz"), { glob: /xpui/ });
		factory(() => (str) => str.replace("foo", "never"), { glob: /does-not-match/ });

		const result = applyTransforms("foo", "/xpui.js", registered);
		assert.equal(result.text, "baz");
		assert.equal(result.applied, 2);
	});

	it("resolves the factory promise when the transform emits", async () => {
		const { factory, registered } = createTransformRegistry();
		const p = factory((emit) => (str) => {
			emit("captured");
			return str;
		});
		applyTransforms("input", "/xpui.js", registered);
		assert.equal(await p, "captured");
	});

	it("a throwing transform is skipped without breaking others", () => {
		const { factory, registered } = createTransformRegistry();
		factory(() => () => {
			throw new Error("boom");
		});
		factory(() => (str) => str + "+ok");
		const result = applyTransforms("x", "/xpui.js", registered);
		assert.equal(result.text, "x+ok");
		assert.equal(result.applied, 1);
	});

	it("applies only transforms matching the bundle that will boot", () => {
		const { factory, registered } = createTransformRegistry();
		factory(() => (str) => str + "+xpui", { glob: /^\/xpui\.js/ });
		factory(() => (str) => str + "+vendor", { glob: /^\/vendor~xpui\.js/ });
		const result = applyTransforms("b", "/xpui.js", registered);
		assert.equal(result.text, "b+xpui");
		assert.equal(result.applied, 1);
	});

	it("matches transforms against the client bundle that will actually boot", () => {
		assert.equal(transformPath(/^\/xpui-modules/, "/xpui.js"), null);
		assert.equal(transformPath(/^\/xpui\.js/, "/xpui.js"), "/xpui.js");
	});
});
