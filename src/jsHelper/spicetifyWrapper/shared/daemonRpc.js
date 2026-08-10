// The daemon's /rpc socket runs CLI actions with the user's privileges. It is
// how the client performs work it cannot do itself: staging an apply, changing
// Spotify's update policy, installing a module for real rather than into
// localStorage.
export const RPC_URL = "ws://127.0.0.1:7967/rpc";
export const HEALTH_URL = "http://127.0.0.1:7967/health";

// WebSocket cannot set request headers, so the token rides in the handshake's
// subprotocol offer, which the daemon echoes back on acceptance.
export const TOKEN_PROTOCOL_PREFIX = "spicetify.token.";

const ERROR_PREFIX = "error:";
const TIMEOUT_MS = 15000;

export const available = async () => {
  try {
    const res = await fetch(HEALTH_URL);
    return res.ok;
  } catch {
    return false;
  }
};

// A command whose reply never arrives is not necessarily a failure: `apply`
// stops the client mid-request, so the socket dies before answering. Those
// commands pass `expectReply: false` and resolve as soon as the send lands.
export const send = (uri, { expectReply = true } = {}) =>
  new Promise((resolve, reject) => {
    const token = globalThis.__SPICETIFY_DAEMON_TOKEN__;
    if (!token) {
      reject(new Error("no daemon token: this client was not patched by a v3 apply"));
      return;
    }

    let socket;
    try {
      socket = new WebSocket(RPC_URL, [`${TOKEN_PROTOCOL_PREFIX}${token}`]);
    } catch (e) {
      reject(new Error(`cannot reach the daemon: ${e.message}`));
      return;
    }

    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      try {
        socket.close();
      } catch {
        // the socket is already gone, which is the case this guards
      }
      fn(value);
    };
    const timer = setTimeout(
      () => finish(reject, new Error(`daemon did not answer ${uri} within ${TIMEOUT_MS}ms`)),
      TIMEOUT_MS,
    );

    socket.onopen = () => {
      socket.send(uri);
      if (!expectReply) finish(resolve, null);
    };
    socket.onmessage = (ev) => {
      const text = String(ev.data || "");
      if (text.startsWith(ERROR_PREFIX)) {
        finish(reject, new Error(text.slice(ERROR_PREFIX.length)));
        return;
      }
      finish(resolve, text);
    };
    // The daemon refuses the handshake for a bad token or a foreign origin,
    // and the browser reports both as a bare error with no status.
    socket.onerror = () =>
      finish(reject, new Error("daemon refused the connection (is it running, and is this a v3 apply?)"));
    socket.onclose = () => {
      if (expectReply) finish(reject, new Error("daemon closed the connection without answering"));
    };
  });

// All three restart the client: apply rebuilds the served tree, and changing
// the update policy patches Spotify's own binary, which cannot be done while
// it runs. So none of them can be awaited for a result from inside the client
// -- the socket dies with the page. They resolve once the daemon has the
// command; the client comes back on its own.
export const apply = () => send("spicetify:0:apply", { expectReply: false });
export const blockUpdates = () => send("spicetify:0:block-updates", { expectReply: false });
export const unblockUpdates = () => send("spicetify:0:unblock-updates", { expectReply: false });

// Uninstall a module the CLI staged on disk, which `Spicetify.Modules` cannot
// touch: removeLocal only owns localStorage records. `fast-delete` drops the
// enable link and the unpacked copy, but the client keeps serving the tree
// that was staged at the last apply, so the removal is only visible after one.
// The apply restarts Spotify, so the caller must warn first.
export const uninstallStaged = async (id, version) => {
  await send(`spicetify:${id}:fast-delete?id=${encodeURIComponent(`${id}@${version}`)}`);
  return apply();
};
