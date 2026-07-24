import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { pushDiagnostic, type DiagnosticsEntry } from "./diagnostics.ts";

const buffer = () => (globalThis as never as { __SPICETIFY_DIAGNOSTICS__?: DiagnosticsEntry[] }).__SPICETIFY_DIAGNOSTICS__;

describe("diagnostics buffer", () => {
	beforeEach(() => {
		delete (globalThis as never as Record<string, unknown>).__SPICETIFY_DIAGNOSTICS__;
	});

	it("creates the buffer and records level and joined message", () => {
		pushDiagnostic("error", "boot", "went sideways");
		pushDiagnostic("info", "loaded module x");
		const entries = buffer()!;
		assert.equal(entries.length, 2);
		assert.equal(entries[0].level, "error");
		assert.equal(entries[0].message, "boot went sideways");
		assert.equal(typeof entries[0].ts, "number");
		assert.equal(entries[1].level, "info");
	});

	it("never throws on hostile arguments", () => {
		const hostile = {
			toString() {
				throw new Error("gotcha");
			},
		};
		pushDiagnostic("error", "boot", hostile, "tail");
		const entries = buffer()!;
		assert.equal(entries.length, 1);
		assert.equal(entries[0].message, "boot [unprintable] tail");
	});

	it("survives a clobbered global buffer", () => {
		(globalThis as never as Record<string, unknown>).__SPICETIFY_DIAGNOSTICS__ = {
			push() {
				throw new Error("clobbered");
			},
		};
		pushDiagnostic("info", "still fine");
	});

	it("caps the buffer, evicting the oldest entries", () => {
		for (let i = 0; i < 230; i++) pushDiagnostic("info", `entry ${i}`);
		const entries = buffer()!;
		assert.equal(entries.length, 200);
		assert.equal(entries[0].message, "entry 30");
		assert.equal(entries[entries.length - 1].message, "entry 229");
	});
});
