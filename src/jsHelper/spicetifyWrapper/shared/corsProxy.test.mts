import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import {
  DAEMON_TEMPLATE,
  HOSTED_TEMPLATE,
  applyTemplate,
  configuration,
  configure,
  isValidTemplate,
  proxiedFetch,
  proxiedURL,
  templates,
} from "./corsProxy.js";

const TARGET = "https://lrclib.net/api/search?q=test";

let storedOverride: string | null = null;
const setOverride = (value: string | null) => {
  storedOverride = value;
  (globalThis as { window?: unknown }).window = {
    localStorage: {
      getItem: () => storedOverride,
      setItem: (_key: string, next: string) => {
        storedOverride = next;
      },
      removeItem: () => {
        storedOverride = null;
      },
    },
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

  it("ignores a URL that cannot substitute the requested target", () => {
    setOverride("https://my-proxy.example/static");
    assert.deepEqual(templates(), [DAEMON_TEMPLATE, HOSTED_TEMPLATE]);
  });
});

describe("configuration", () => {
  it("describes the automatic daemon-to-hosted chain", () => {
    setOverride(null);
    assert.deepEqual(configuration(), {
      mode: "automatic",
      template: null,
      automaticTemplates: [DAEMON_TEMPLATE, HOSTED_TEMPLATE],
    });
  });

  it("switches between a validated custom template and the automatic chain", () => {
    setOverride(null);
    const custom = "https://my-proxy.example/{url}";
    assert.equal(isValidTemplate(custom), true);
    assert.deepEqual(configure({ mode: "custom", template: custom }), {
      mode: "custom",
      template: custom,
      automaticTemplates: [DAEMON_TEMPLATE, HOSTED_TEMPLATE],
    });
    assert.deepEqual(templates(), [custom]);
    assert.equal(configure({ mode: "automatic" }).mode, "automatic");
    assert.deepEqual(templates(), [DAEMON_TEMPLATE, HOSTED_TEMPLATE]);
  });

  it("rejects invalid modes and custom templates without changing the active chain", () => {
    setOverride(null);
    assert.throws(() => configure({ mode: "custom", template: "https://example.com/static" }), TypeError);
    assert.throws(() => configure({ mode: "elsewhere" }), TypeError);
    assert.equal(isValidTemplate("javascript:{url}"), false);
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

describe("daemon token", () => {
  const setToken = (value: string | undefined) => {
    (globalThis as { __SPICETIFY_DAEMON_TOKEN__?: string }).__SPICETIFY_DAEMON_TOKEN__ = value;
  };

  // The URL-only stub above cannot see headers, so this one records both.
  const stubFetchWithOptions = () => {
    const calls: { url: string; token: string | null }[] = [];
    (globalThis as { fetch?: unknown }).fetch = (url: string, options?: RequestInit) => {
      const headers = new Headers(options?.headers || undefined);
      calls.push({ url, token: headers.get("x-spicetify-token") });
      return ok(url);
    };
    return calls;
  };

  afterEach(() => setToken(undefined));

  it("sends the token to the daemon", async () => {
    setOverride(null);
    setToken("deadbeef");
    const calls = stubFetchWithOptions();
    await proxiedFetch(TARGET);
    assert.equal(calls[0].url, applyTemplate(DAEMON_TEMPLATE, TARGET));
    assert.equal(calls[0].token, "deadbeef");
  });

  it("never sends the token to the hosted proxy", async () => {
    setOverride(HOSTED_TEMPLATE);
    setToken("deadbeef");
    const calls = stubFetchWithOptions();
    await proxiedFetch(TARGET);
    assert.equal(calls[0].token, null);
  });

  it("never sends the token to a user override", async () => {
    setOverride("https://my-proxy.example/{url}");
    setToken("deadbeef");
    const calls = stubFetchWithOptions();
    await proxiedFetch(TARGET);
    assert.equal(calls[0].token, null);
  });

  it("never sends the token to a loopback custom override", async () => {
    setOverride("http://localhost:9000/custom/{url}");
    setToken("deadbeef");
    const calls = stubFetchWithOptions();
    await proxiedFetch(TARGET);
    assert.equal(calls[0].token, null);
  });

  it("omits the header entirely when the client was not given a token", async () => {
    setOverride(null);
    setToken(undefined);
    const calls = stubFetchWithOptions();
    await proxiedFetch(TARGET);
    assert.equal(calls[0].token, null);
  });

  it("keeps caller headers alongside the token", async () => {
    setOverride(null);
    setToken("deadbeef");
    const calls = stubFetchWithOptions();
    await proxiedFetch(TARGET, { headers: { accept: "application/json" } });
    assert.equal(calls[0].token, "deadbeef");
  });
});
