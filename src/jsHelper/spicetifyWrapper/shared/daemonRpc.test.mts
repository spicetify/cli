import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";

import { acquireWindowControls, send, TOKEN_PROTOCOL_PREFIX } from "./daemonRpc.js";

type Handler = ((ev: { data?: unknown }) => void) | null;

// A WebSocket stand-in that records the handshake and lets each test drive the
// socket's lifecycle, since the real one needs a daemon listening.
class FakeSocket {
  static last: FakeSocket | null = null;
  onopen: (() => void) | null = null;
  onmessage: Handler = null;
  onerror: (() => void) | null = null;
  onclose: (() => void) | null = null;
  sent: string[] = [];
  closed = false;

  url: string;
  protocols?: string[];

  constructor(url: string, protocols?: string[]) {
    this.url = url;
    this.protocols = protocols;
    FakeSocket.last = this;
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closed = true;
  }
}

const setToken = (value: string | undefined) => {
  (globalThis as { __SPICETIFY_DAEMON_TOKEN__?: string }).__SPICETIFY_DAEMON_TOKEN__ = value;
};

const install = () => {
  (globalThis as { WebSocket?: unknown }).WebSocket = FakeSocket;
  setToken("tok123");
};

afterEach(() => {
  setToken(undefined);
  FakeSocket.last = null;
});

describe("daemon rpc", () => {
  it("holds native controls until release is acknowledged", async () => {
    install();
    let disconnected = false;
    const pending = acquireWindowControls(() => {
      disconnected = true;
    });
    const socket = FakeSocket.last!;
    assert.equal(socket.url, "ws://127.0.0.1:7967/window-controls");
    assert.deepEqual(socket.protocols, [`${TOKEN_PROTOCOL_PREFIX}tok123`]);
    socket.onmessage!({ data: "ready" });
    const lease = await pending;
    assert.equal(socket.closed, false);
    const release = lease.release();
    assert.equal(lease.release(), release);
    assert.deepEqual(socket.sent, ["release"]);
    assert.equal(socket.closed, false);
    socket.onmessage!({ data: "released" });
    await release;
    socket.onclose!();
    assert.equal(disconnected, false);
  });

  it("reports an unexpected native disconnect once", async () => {
    install();
    let disconnected = 0;
    const pending = acquireWindowControls(() => {
      disconnected++;
    });
    const socket = FakeSocket.last!;
    socket.onmessage!({ data: "ready" });
    const lease = await pending;
    socket.onerror!();
    socket.onclose!();
    await lease.release();
    assert.equal(disconnected, 1);
  });

  it("rejects native acquisition when the daemon is incompatible", async () => {
    install();
    const pending = acquireWindowControls(() => {});
    FakeSocket.last!.onerror!();
    await assert.rejects(pending, /compatible running daemon/);
  });

  it("rejects a lost release acknowledgement", async () => {
    install();
    const pending = acquireWindowControls(() => {}, { timeoutMs: 10 });
    const socket = FakeSocket.last!;
    socket.onmessage!({ data: "ready" });
    const lease = await pending;
    await assert.rejects(lease.release(), /timed out/);
    assert.equal(socket.closed, true);
  });
  it("carries the token in the subprotocol, because WebSocket cannot set headers", async () => {
    install();
    const pending = send("spicetify:client:block-updates");
    const socket = FakeSocket.last!;
    socket.onopen!();
    socket.onmessage!({ data: "spicetify:client:1" });
    assert.equal(await pending, "spicetify:client:1");
    assert.deepEqual(socket.protocols, [`${TOKEN_PROTOCOL_PREFIX}tok123`]);
    assert.deepEqual(socket.sent, ["spicetify:client:block-updates"]);
  });

  it("rejects with the daemon's message when the command fails", async () => {
    install();
    const pending = send("spicetify:client:block-updates");
    const socket = FakeSocket.last!;
    socket.onopen!();
    socket.onmessage!({ data: "error:permission denied" });
    await assert.rejects(pending, /permission denied/);
  });

  it("resolves on send for a command that kills the client before replying", async () => {
    install();
    const pending = send("spicetify:0:apply", { expectReply: false });
    const socket = FakeSocket.last!;
    socket.onopen!();
    assert.equal(await pending, null);
    assert.deepEqual(socket.sent, ["spicetify:0:apply"]);
  });

  it("rejects when the socket closes with no answer", async () => {
    install();
    const pending = send("spicetify:client:block-updates");
    FakeSocket.last!.onclose!();
    await assert.rejects(pending, /without answering/);
  });

  it("refuses to dial without a token rather than opening an unauthorised socket", async () => {
    install();
    setToken(undefined);
    FakeSocket.last = null;
    await assert.rejects(send("spicetify:client:block-updates"), /no daemon token/);
    assert.equal(FakeSocket.last, null, "no socket should have been opened");
  });
});
