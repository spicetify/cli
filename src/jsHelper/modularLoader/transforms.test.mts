import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyTransforms, createTransformRegistry } from "./transforms.ts";

describe("transforms", () => {
	it("applies matching transforms in order", () => {
		const { factory, registered } = createTransformRegistry();
		factory(() => (str) => str.replace("foo", "bar"), { glob: /xpui/ });
		factory(() => (str) => str.replace("bar", "baz"), { glob: /xpui/ });
		factory(() => (str) => str.replace("foo", "never"), { glob: /does-not-match/ });

		const result = applyTransforms("foo", registered);
		assert.equal(result.text, "baz");
		assert.equal(result.applied, 2);
	});

	it("resolves the factory promise when the transform emits", async () => {
		const { factory, registered } = createTransformRegistry();
		const p = factory((emit) => (str) => {
			emit("captured");
			return str;
		});
		applyTransforms("input", registered);
		assert.equal(await p, "captured");
	});

	it("a throwing transform is skipped without breaking others", () => {
		const { factory, registered } = createTransformRegistry();
		factory(() => () => {
			throw new Error("boom");
		});
		factory(() => (str) => str + "+ok");
		const result = applyTransforms("x", registered);
		assert.equal(result.text, "x+ok");
		assert.equal(result.applied, 1);
	});

	it("matches hooks-era glob patterns against the snapshot bundle", () => {
		const { factory, registered } = createTransformRegistry();
		factory(() => (str) => str + "+xpui", { glob: /^\/xpui\.js/ });
		factory(() => (str) => str + "+vendor", { glob: /^\/vendor~xpui\.js/ });
		const result = applyTransforms("b", registered);
		assert.equal(result.text, "b+xpui+vendor");
	});
});
