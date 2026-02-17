/**
 * Test suite for lazy PlatformAPI resolution in spicetifyWrapper.js
 *
 * Tests Issue #3695: Spotify segfaults on Linux 1.2.82.428 after applying Spicetify
 * https://github.com/spicetify/cli/issues/3695
 *
 * Core fix: PlatformAPI getters are now lazy (Object.defineProperty) instead of eager.
 * Native code only executes when an extension actually accesses the API, not at startup.
 *
 * Run with: node jsHelper/__tests__/platformAPI.test.js
 */

const { strict: assert } = require("assert");

let testsPassed = 0;
let testsFailed = 0;
const failures = [];

function test(name, fn) {
	try {
		fn();
		testsPassed++;
		console.log(`  ✅ ${name}`);
	} catch (err) {
		testsFailed++;
		failures.push({ name, error: err });
		console.log(`  ❌ ${name}`);
		console.log(`     ${err.message}`);
	}
}

function describe(name, fn) {
	console.log(`\n${name}`);
	fn();
}

// ============================================================================
// Helpers: Simulate the patched waitForPlatform() with lazy getters
// ============================================================================

function simulateWaitForPlatform(_platform) {
	const Platform = {};
	const getterCallLog = [];

	for (const key of Object.keys(_platform)) {
		if (key.startsWith("get") && typeof _platform[key] === "function") {
			const apiName = key.slice(3);
			const getterKey = key;
			Object.defineProperty(Platform, apiName, {
				get() {
					getterCallLog.push(apiName);
					try {
						const resolved = _platform[getterKey]();
						Object.defineProperty(Platform, apiName, {
							value: resolved,
							writable: true,
							configurable: true,
						});
						return resolved;
					} catch (err) {
						Object.defineProperty(Platform, apiName, {
							value: undefined,
							writable: true,
							configurable: true,
						});
						return undefined;
					}
				},
				configurable: true,
				enumerable: true,
			});
		} else {
			Platform[key] = _platform[key];
		}
	}

	return { Platform, getterCallLog };
}

function simulateAddMissingPlatformAPIs(Platform) {
	const errors = [];
	const resolvedLazy = [];

	try {
		if (!Platform.version) {
			errors.push({ phase: "version", err: new Error("No version available") });
			return { resolvedLazy, errors };
		}
		const version = Platform.version.split(".").map((i) => Number.parseInt(i, 10));
		if (version[0] === 1 && version[1] === 2 && version[2] < 38) {
			return { resolvedLazy, errors, skippedOldVersion: true };
		}
	} catch (err) {
		errors.push({ phase: "version-parse", err });
		return { resolvedLazy, errors };
	}

	try {
		if (!Platform.Registry?._map) {
			errors.push({ phase: "registry-check", err: new Error("Registry._map not available") });
			return { resolvedLazy, errors };
		}
		for (const [key, _] of Platform.Registry._map.entries()) {
			if (typeof key?.description !== "string" || !key?.description.endsWith("API")) continue;
			const symbolName = key.description;
			if (Object.hasOwn(Platform, symbolName)) continue;
			const registryKey = key;
			Object.defineProperty(Platform, symbolName, {
				get() {
					try {
						const resolvedAPI = Platform.Registry.resolve(registryKey);
						Object.defineProperty(Platform, symbolName, {
							value: resolvedAPI,
							writable: true,
							configurable: true,
						});
						return resolvedAPI;
					} catch (err) {
						Object.defineProperty(Platform, symbolName, {
							value: undefined,
							writable: true,
							configurable: true,
						});
						return undefined;
					}
				},
				configurable: true,
				enumerable: true,
			});
			resolvedLazy.push(symbolName);
		}
	} catch (err) {
		errors.push({ phase: "registry-iterate", err });
	}

	return { resolvedLazy, errors };
}

// ============================================================================
// Test Suite
// ============================================================================

describe("waitForPlatform() — Lazy getter resolution", () => {
	test("does NOT call native getters at setup time", () => {
		let callCount = 0;
		const _platform = {
			getPlayerAPI: () => {
				callCount++;
				return { play: () => {} };
			},
			getHistoryAPI: () => {
				callCount++;
				return { listen: () => {} };
			},
			version: "1.2.82",
		};

		const { Platform, getterCallLog } = simulateWaitForPlatform(_platform);

		assert.equal(callCount, 0, "No native getters should be called at setup");
		assert.equal(getterCallLog.length, 0, "No getter access should be logged");
		// Non-getter properties are set immediately
		assert.equal(Platform.version, "1.2.82", "Non-getter props should be available immediately");
	});

	test("resolves getter on first access and self-caches", () => {
		let callCount = 0;
		const _platform = {
			getPlayerAPI: () => {
				callCount++;
				return { play: () => {} };
			},
		};

		const { Platform } = simulateWaitForPlatform(_platform);

		// First access triggers the native call
		const api = Platform.PlayerAPI;
		assert.equal(callCount, 1, "Native getter should be called on first access");
		assert.ok(api, "Should return the resolved API");
		assert.ok(api.play, "Resolved API should have expected methods");

		// Second access hits the cache, not the native call
		const api2 = Platform.PlayerAPI;
		assert.equal(callCount, 1, "Should NOT call native getter again (cached)");
		assert.strictEqual(api, api2, "Should return same cached object");
	});

	test("returns undefined for failing getter without crashing", () => {
		const _platform = {
			getBrokenAPI: () => {
				throw new Error("Simulated crash");
			},
			getWorkingAPI: () => ({ ok: true }),
		};

		const { Platform } = simulateWaitForPlatform(_platform);

		// Broken API returns undefined
		const broken = Platform.BrokenAPI;
		assert.equal(broken, undefined, "Failed getter should return undefined");

		// Working API still works
		const working = Platform.WorkingAPI;
		assert.ok(working, "Other getters should still work");
		assert.equal(working.ok, true);
	});

	test("only calls the getter that is actually accessed", () => {
		const callLog = [];
		const _platform = {
			getA: () => {
				callLog.push("A");
				return "a";
			},
			getB: () => {
				callLog.push("B");
				return "b";
			},
			getC: () => {
				callLog.push("C");
				return "c";
			},
		};

		const { Platform } = simulateWaitForPlatform(_platform);

		// Only access B
		Platform.B;
		assert.deepEqual(callLog, ["B"], "Only accessed getter should be called");

		// Now access A
		Platform.A;
		assert.deepEqual(callLog, ["B", "A"], "Only accessed getters should be called");

		// C is never called
		assert.equal(callLog.includes("C"), false, "Untouched getter should never be called");
	});

	test("lazy getters appear in Object.keys() for enumeration", () => {
		const _platform = {
			getPlayerAPI: () => ({}),
			getHistoryAPI: () => ({}),
			version: "1.2.82",
		};

		const { Platform } = simulateWaitForPlatform(_platform);
		const keys = Object.keys(Platform);

		assert.ok(keys.includes("PlayerAPI"), "Lazy getter should be enumerable");
		assert.ok(keys.includes("HistoryAPI"), "Lazy getter should be enumerable");
		assert.ok(keys.includes("version"), "Direct property should be enumerable");
	});

	test("Object.hasOwn returns true for lazy getters", () => {
		const _platform = {
			getPlayerAPI: () => ({}),
		};

		const { Platform } = simulateWaitForPlatform(_platform);

		assert.ok(Object.hasOwn(Platform, "PlayerAPI"), "Lazy getter should be detected by hasOwn");
	});

	test("passes through non-getter properties untouched", () => {
		const registryObj = { _map: new Map(), resolve: () => {} };
		const _platform = {
			version: "1.2.82",
			Registry: registryObj,
			someFlag: true,
		};

		const { Platform } = simulateWaitForPlatform(_platform);

		assert.equal(Platform.version, "1.2.82");
		assert.equal(Platform.Registry, registryObj);
		assert.equal(Platform.someFlag, true);
	});
});

describe("addMissingPlatformAPIs() — Lazy Registry resolution", () => {
	test("sets up lazy getters for Registry APIs without resolving them", () => {
		let resolveCount = 0;
		const map = new Map();
		map.set(Symbol.for("ExtraAPI"), {});

		const Platform = {
			version: "1.2.82",
			Registry: {
				_map: map,
				resolve: () => {
					resolveCount++;
					return { extra: true };
				},
			},
		};

		const { resolvedLazy } = simulateAddMissingPlatformAPIs(Platform);

		assert.equal(resolveCount, 0, "Should NOT call resolve at setup time");
		assert.ok(resolvedLazy.includes("ExtraAPI"), "Should track lazy getters");
	});

	test("resolves Registry API on first access", () => {
		let resolveCount = 0;
		const map = new Map();
		map.set(Symbol.for("ExtraAPI"), {});

		const Platform = {
			version: "1.2.82",
			Registry: {
				_map: map,
				resolve: () => {
					resolveCount++;
					return { extra: true };
				},
			},
		};

		simulateAddMissingPlatformAPIs(Platform);
		const api = Platform.ExtraAPI;

		assert.equal(resolveCount, 1, "Should call resolve on first access");
		assert.ok(api, "Should return resolved API");
		assert.equal(api.extra, true);
	});

	test("returns undefined for failing Registry resolve", () => {
		const map = new Map();
		map.set(Symbol.for("CrashingAPI"), {});
		map.set(Symbol.for("WorkingAPI"), {});

		const Platform = {
			version: "1.2.82",
			Registry: {
				_map: map,
				resolve: (key) => {
					if (key.description === "CrashingAPI") throw new Error("crash");
					return { name: key.description };
				},
			},
		};

		simulateAddMissingPlatformAPIs(Platform);

		assert.equal(Platform.CrashingAPI, undefined, "Failed API should return undefined");
		assert.ok(Platform.WorkingAPI, "Working API should resolve");
	});

	test("skips APIs already on Platform (from waitForPlatform)", () => {
		const map = new Map();
		map.set(Symbol.for("PlayerAPI"), {});

		const Platform = {
			version: "1.2.82",
			PlayerAPI: { existing: true },
			Registry: {
				_map: map,
				resolve: () => {
					throw new Error("Should not be called");
				},
			},
		};

		const { resolvedLazy } = simulateAddMissingPlatformAPIs(Platform);
		assert.equal(resolvedLazy.length, 0, "Should skip existing APIs");
	});

	test("handles missing Registry gracefully", () => {
		const Platform = { version: "1.2.82" };
		const { errors } = simulateAddMissingPlatformAPIs(Platform);
		assert.ok(errors.some((e) => e.phase === "registry-check"));
	});

	test("skips old Spotify versions", () => {
		const Platform = {
			version: "1.2.37",
			Registry: { _map: new Map([[Symbol.for("SomeAPI"), {}]]) },
		};
		const { skippedOldVersion } = simulateAddMissingPlatformAPIs(Platform);
		assert.ok(skippedOldVersion);
	});
});

describe("Integration: Full lazy PlatformAPI pipeline", () => {
	test("simulates Linux 1.2.82 — no native calls at startup, crash avoided", () => {
		const callLog = [];
		const _platform = {
			getPlayerAPI: () => {
				callLog.push("PlayerAPI");
				return { play: () => {} };
			},
			getRemoteConfigDebugAPI: () => {
				callLog.push("RemoteConfigDebugAPI");
				throw new Error("SIGSEGV crash");
			},
			getHistoryAPI: () => {
				callLog.push("HistoryAPI");
				throw new Error("crash");
			},
			getLibraryAPI: () => {
				callLog.push("LibraryAPI");
				return { add: () => {} };
			},
			version: "1.2.82",
			Registry: { _map: new Map(), resolve: () => {} },
		};

		const { Platform } = simulateWaitForPlatform(_platform);
		simulateAddMissingPlatformAPIs(Platform);

		// At this point, NO native calls have been made
		assert.equal(callLog.length, 0, "Zero native calls at startup");

		// Access a working API
		assert.ok(Platform.PlayerAPI, "PlayerAPI should resolve on access");
		assert.deepEqual(callLog, ["PlayerAPI"]);

		// Access a broken API — returns undefined, doesn't crash
		assert.equal(Platform.HistoryAPI, undefined, "Broken API returns undefined");
		assert.deepEqual(callLog, ["PlayerAPI", "HistoryAPI"]);

		// Broken API stays undefined on subsequent access (cached)
		assert.equal(Platform.HistoryAPI, undefined);
		assert.equal(callLog.length, 2, "Should not retry failed getter");

		// The crashing API is never called because nothing accesses it
		assert.ok(!callLog.includes("RemoteConfigDebugAPI"), "Unused API never called");
	});

	test("simulates normal operation (Windows/macOS) — everything resolves on access", () => {
		const _platform = {
			getPlayerAPI: () => ({ play: () => {} }),
			getRemoteConfigDebugAPI: () => ({ setOverride: () => {} }),
			getHistoryAPI: () => ({ listen: () => {}, location: { pathname: "/" } }),
			version: "1.2.82",
			Registry: { _map: new Map(), resolve: () => {} },
		};

		const { Platform } = simulateWaitForPlatform(_platform);

		// All APIs resolve correctly on access
		assert.ok(Platform.PlayerAPI);
		assert.ok(Platform.RemoteConfigDebugAPI);
		assert.ok(Platform.HistoryAPI);
		assert.ok(Platform.HistoryAPI.listen);
	});
});

// ============================================================================
// Report
// ============================================================================

console.log("\n" + "=".repeat(60));
console.log(`Results: ${testsPassed} passed, ${testsFailed} failed, ${testsPassed + testsFailed} total`);

if (failures.length > 0) {
	console.log("\nFailures:");
	for (const { name, error } of failures) {
		console.log(`  ❌ ${name}`);
		console.log(`     ${error.stack || error.message}`);
	}
}

console.log("=".repeat(60));
process.exit(testsFailed > 0 ? 1 : 0);
