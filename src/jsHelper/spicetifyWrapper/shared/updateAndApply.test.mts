import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { installUpdateJobBridge, updateAndApply, updateApiSupported } from "./updateAndApply.js";

type FetchCall = { url: string; method: string; body?: string };

const calls: FetchCall[] = [];

const response = (value: unknown, status = 200) =>
  new Response(typeof value === "string" ? value : JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });

const requestUrl = (input: string | URL | Request) => (typeof input === "string" ? input : input instanceof URL ? input.href : input.url);

afterEach(() => {
  calls.length = 0;
  delete (globalThis as { __SPICETIFY_DAEMON_TOKEN__?: string }).__SPICETIFY_DAEMON_TOKEN__;
  delete (globalThis as { Spicetify?: unknown }).Spicetify;
});

const completeUpdaterApi = {
  subscribe() {
    return { cancel() {} };
  },
  async prepareUpdate() {},
  async applyUpdate() {},
};

describe("acknowledged Spotify update job", () => {
  it("does not open the updater aperture until admission reached the renderer", async () => {
    (globalThis as { __SPICETIFY_DAEMON_TOKEN__?: string }).__SPICETIFY_DAEMON_TOKEN__ = "token";
    (globalThis as { Spicetify?: unknown }).Spicetify = { Platform: { UpdateAPI: completeUpdaterApi } };
    globalThis.fetch = async (input, options) => {
      calls.push({
        url: requestUrl(input),
        method: options?.method ?? "GET",
        body: typeof options?.body === "string" ? options.body : undefined,
      });
      return calls.length === 1 ? response({ jobId: "job-1", disposition: "accepted" }, 202) : response({ jobId: "job-1" });
    };

    const admission = await updateAndApply();
    assert.equal(admission.jobId, "job-1");
    assert.equal(calls.length, 1, "admission resolves before the aperture acknowledgement is sent");

    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(JSON.parse(calls[1]!.body!), { kind: "acceptance-flushed", jobId: "job-1" });
  });

  it("refuses admission when Spotify exposes only part of the updater API", async () => {
    (globalThis as { __SPICETIFY_DAEMON_TOKEN__?: string }).__SPICETIFY_DAEMON_TOKEN__ = "token";
    globalThis.fetch = async (input, options) => {
      calls.push({
        url: requestUrl(input),
        method: options?.method ?? "GET",
        body: typeof options?.body === "string" ? options.body : undefined,
      });
      return response({ jobId: "unexpected" }, 202);
    };

    const partialApis = [
      undefined,
      { subscribe() {} },
      { subscribe() {}, async prepareUpdate() {} },
      { subscribe() {}, async applyUpdate() {} },
    ];
    for (const UpdateAPI of partialApis) {
      (globalThis as { Spicetify?: unknown }).Spicetify = { Platform: { UpdateAPI } };
      await assert.rejects(updateAndApply(), /complete updater API is unavailable/);
    }

    assert.equal(calls.length, 0, "incomplete renderer APIs must not admit a daemon job");
  });

  it("recognizes only a complete Spotify updater API", () => {
    assert.equal(updateApiSupported({ UpdateAPI: completeUpdaterApi }), true);
    assert.equal(updateApiSupported({ UpdateAPI: { subscribe() {} } }), false);
    assert.equal(updateApiSupported(undefined), false);
  });

  it("prepares and applies only after each daemon acknowledgement", async () => {
    (globalThis as { __SPICETIFY_DAEMON_TOKEN__?: string }).__SPICETIFY_DAEMON_TOKEN__ = "token";
    let subscriber: ((event: { state: number; version: string }) => void) | undefined;
    const updaterCalls: string[] = [];
    const api = {
      subscribe(listener: (event: { state: number; version: string }) => void) {
        subscriber = listener;
        return { cancel() {} };
      },
      async prepareUpdate(applyAfterDownload: boolean) {
        updaterCalls.push(`prepare:${applyAfterDownload}`);
      },
      async applyUpdate() {
        updaterCalls.push("apply");
      },
    };
    globalThis.fetch = async (input, options) => {
      const url = requestUrl(input);
      calls.push({
        url,
        method: options?.method ?? "GET",
        body: typeof options?.body === "string" ? options.body : undefined,
      });
      if ((options?.method ?? "GET") === "GET") {
        return response({ kind: "waiting-for-update", jobId: "job-2", fromVersion: "1.2.94" });
      }
      return response({ jobId: "job-2" });
    };

    const stop = installUpdateJobBridge(() => ({ UpdateAPI: api }));
    await new Promise((resolve) => setTimeout(resolve, 5));
    subscriber!({ state: 1, version: "1.2.97" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(updaterCalls, ["prepare:false"]);
    assert.match(calls.find((call) => call.body?.includes('"offered"'))!.body!, /1\.2\.97/);

    subscriber!({ state: 3, version: "1.2.97" });
    await new Promise((resolve) => setTimeout(resolve, 5));
    assert.deepEqual(updaterCalls, ["prepare:false", "apply"]);
    assert.ok(calls.some((call) => call.body?.includes('"applying"')));
    stop();
  });
});
