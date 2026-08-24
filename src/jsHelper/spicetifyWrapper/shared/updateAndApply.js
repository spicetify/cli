const JOB_URL = "http://127.0.0.1:7967/jobs/update-and-apply";
const EVENT_URL = `${JOB_URL}/event`;
const POLL_MS = 1000;

const listeners = new Set();
let pollTimer = null;
let lastStatus = { kind: "idle" };

class DaemonJobError extends Error {}

const token = () => {
  const value = globalThis.__SPICETIFY_DAEMON_TOKEN__;
  if (!value) throw new Error("no daemon token: this client was not patched by a v3 apply");
  return value;
};

const request = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      "x-spicetify-token": token(),
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...options.headers,
    },
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    if (response.status === 404) {
      throw new DaemonJobError("this daemon does not support one-step Spotify updates; apply a newer Spicetify build first");
    }
    throw new DaemonJobError(detail || `daemon update job failed (${response.status})`);
  }
  return response.json();
};

const emit = (status) => {
  lastStatus = status;
  for (const listener of listeners) listener(status);
};

export const updateJobStatus = async () => {
  const status = await request(JOB_URL);
  emit(status);
  return status;
};

const poll = async () => {
  try {
    await updateJobStatus();
  } catch {
    // Observation is best-effort; the mutating call reports admission errors.
  }
};

const maintainPolling = () => {
  if (listeners.size && pollTimer === null) {
    void poll();
    pollTimer = setInterval(poll, POLL_MS);
  } else if (!listeners.size && pollTimer !== null) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
};

export const sendUpdateEvent = (event) => request(EVENT_URL, { method: "POST", body: JSON.stringify(event) });

export const updateAndApply = async () => {
  const admission = await request(JOB_URL, { method: "POST" });
  // The admission response has reached the renderer. Only this second,
  // acknowledged message lets the daemon open the updater aperture. A lost
  // response therefore leaves Spotify physically blocked.
  setTimeout(() => {
    void sendUpdateEvent({ kind: "acceptance-flushed", jobId: admission.jobId }).catch((error) => {
      console.error("[spicetifyWrapper] could not acknowledge Spotify update admission", error);
    });
  }, 0);
  return admission;
};

updateAndApply.observe = (listener) => {
  listeners.add(listener);
  listener(lastStatus);
  maintainPolling();
  return () => {
    listeners.delete(listener);
    maintainPolling();
  };
};

const workByTarget = new Map();
let subscription = null;
let subscribedJob = null;

const normalizeTarget = (value) => {
  if (typeof value !== "string") return null;
  const match = value.trim().match(/^\d+\.\d+\.\d+(?:\.\d+)?$/);
  return match ? match[0] : null;
};

const reportFailure = async (jobId, error) => {
  try {
    await sendUpdateEvent({ kind: "update-api-failed", jobId, message: error instanceof Error ? error.message : String(error) });
  } catch (reportError) {
    console.error("[spicetifyWrapper] Spotify updater failed and the daemon could not be notified", error, reportError);
  }
};

const offered = (api, jobId, target) => {
  const key = `${jobId}:${target}:offered`;
  if (!workByTarget.has(key)) {
    workByTarget.set(
      key,
      (async () => {
        await sendUpdateEvent({ kind: "offered", jobId, targetVersion: target });
        await api.prepareUpdate(false);
        await sendUpdateEvent({ kind: "prepared", jobId, targetVersion: target });
      })(),
    );
  }
  return workByTarget.get(key);
};

const applying = (api, jobId, target) => {
  const key = `${jobId}:${target}:applying`;
  if (!workByTarget.has(key)) {
    workByTarget.set(
      key,
      (async () => {
        await offered(api, jobId, target);
        await sendUpdateEvent({ kind: "applying", jobId, targetVersion: target });
        await api.applyUpdate();
      })(),
    );
  }
  return workByTarget.get(key);
};

const cancelSubscription = () => {
  try {
    subscription?.cancel?.();
  } catch {
    // Spotify owns the subscription object; cancellation is best-effort.
  }
  subscription = null;
  subscribedJob = null;
};

const attachUpdater = (api, status) => {
  if (subscribedJob === status.jobId) return;
  cancelSubscription();
  subscribedJob = status.jobId;
  subscription = api.subscribe((event) => {
    const target = normalizeTarget(event?.version);
    if (!target) return;
    if (status.kind === "downloading" && status.targetVersion === target) {
      workByTarget.set(`${status.jobId}:${target}:offered`, Promise.resolve());
    }
    let work;
    if (event.state === 1) work = offered(api, status.jobId, target);
    if (event.state === 2) {
      work = sendUpdateEvent({ kind: "prepared", jobId: status.jobId, targetVersion: target });
    }
    if (event.state === 3) work = applying(api, status.jobId, target);
    if (work) {
      void work.catch((error) => {
        if (error instanceof DaemonJobError) {
          console.error("[spicetifyWrapper] daemon refused a Spotify updater transition", error);
          return;
        }
        return reportFailure(status.jobId, error);
      });
    }
  });
};

let bridgeTimer = null;

export const installUpdateJobBridge = (platform) => {
  if (bridgeTimer !== null) return () => {};
  const sync = async () => {
    let status;
    try {
      status = await updateJobStatus();
    } catch {
      return;
    }
    const api = platform()?.UpdateAPI;
    if (!api || typeof api.subscribe !== "function") return;
    if (["waiting-for-update", "downloading"].includes(status.kind)) {
      attachUpdater(api, status);
    } else {
      cancelSubscription();
    }
  };
  void sync();
  bridgeTimer = setInterval(sync, POLL_MS);
  return () => {
    clearInterval(bridgeTimer);
    bridgeTimer = null;
    cancelSubscription();
  };
};
