import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { DAEMON_TEMPLATE, HOSTED_TEMPLATE, applyTemplate, proxiedFetch, proxiedURL, templates } from "./corsProxy.js";

const TARGET = "https://lrclib.net/api/search?q=test";

const setOverride = (value: string | null) => {
  (globalThis as { window?: unknown }).window = {
    localStorage: { getItem: () => value },
  };
};

const stubFetch = (impl: (url: string) => Promise<Response>) => {
  const calls: string[] = [];
  (globalThis as { fetch?: unknown }).fetch = (url: string) => {
    calls.push(url);
    return impl(url);
  };
  return calls;
};

const refused = () => Promise.reject(new TypeError("Failed to fetch"));
const ok = (url: string) => Promise.resolve({ ok: true, url } as Response);

afterEach(() => {
  setOverride(null);
});

describe("templates", () => {
  it("prefers the local daemon and keeps the hosted proxy as backup", () => {
    setOverride(null);
    assert.deepEqual(templates(), [DAEMON_TEMPLATE, HOSTED_TEMPLATE]);
  });

  it("lets an explicit override replace the chain rather than extend it", () => {
    setOverride("https://my-proxy.example/{url}");
    assert.deepEqual(templates(), ["https://my-proxy.example/{url}"]);
  });

  it("ignores an override that cannot produce a URL", () => {
    setOverride("not-a-url-template");
    assert.deepEqual(templates(), [DAEMON_TEMPLATE, HOSTED_TEMPLATE]);
  });
});

describe("applyTemplate", () => {
  it("substitutes the target verbatim, so the query survives", () => {
    assert.equal(applyTemplate(DAEMON_TEMPLATE, TARGET), `http://127.0.0.1:7967/proxy/${TARGET}`);
  });

  it("resolves through the preferred template", () => {
    setOverride(null);
    assert.ok(proxiedURL(TARGET).startsWith("http://127.0.0.1:7967/proxy/"));
  });
});

describe("proxiedFetch", () => {
  it("uses the daemon when it answers", async () => {
    setOverride(null);
    const calls = stubFetch(ok);
    await proxiedFetch(TARGET);
    assert.equal(calls.length, 1);
    assert.ok(calls[0].startsWith("http://127.0.0.1:7967/"));
  });

  it("falls back to the hosted proxy when the daemon is not running", async () => {
    setOverride(null);
    const calls = stubFetch((url) => (url.includes("127.0.0.1") ? refused() : ok(url)));
    const res = await proxiedFetch(TARGET);
    assert.equal(calls.length, 2);
    assert.ok(calls[1].startsWith("https://cors-proxy.spicetify.app/"));
    assert.ok(res.ok);
  });

  // An error status is the upstream's own answer; retrying it elsewhere would
  // hide a real 404 behind a second request to a different proxy.
  it("does not fall back on an HTTP error", async () => {
    setOverride(null);
    const calls = stubFetch((url) => Promise.resolve({ ok: false, status: 404, url } as Response));
    const res = await proxiedFetch(TARGET);
    assert.equal(calls.length, 1);
    assert.equal(res.status, 404);
  });

  it("rethrows when no template answers", async () => {
    setOverride(null);
    stubFetch(refused);
    await assert.rejects(() => proxiedFetch(TARGET), TypeError);
  });

  it("does not reach the daemon when an override is set", async () => {
    setOverride("https://my-proxy.example/{url}");
    const calls = stubFetch(ok);
    await proxiedFetch(TARGET);
    assert.deepEqual(calls, [`https://my-proxy.example/${TARGET}`]);
  });
});
