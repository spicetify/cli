import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { isVersionBefore } from "./version.js";

describe("isVersionBefore", () => {
  it("compares each component in order instead of independently", () => {
    assert.equal(isVersionBefore("1.2.56.502", [1, 2, 57]), true);
    assert.equal(isVersionBefore("1.2.57.463", [1, 2, 57]), false);
    assert.equal(isVersionBefore("1.2.94.522", [1, 2, 57]), false);
    assert.equal(isVersionBefore("1.3.3.264", [1, 2, 57]), false);
    assert.equal(isVersionBefore("2.0.0", [1, 2, 57]), false);
    assert.equal(isVersionBefore("1.1.99", [1, 2, 57]), true);
  });
});
