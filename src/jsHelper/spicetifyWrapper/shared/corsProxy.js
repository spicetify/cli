// The local daemon proxies same-origin-blocked requests without a round trip
// to a third party, so it is preferred whenever it is running. The hosted
// proxy stays as the backup for clients with no daemon. Both accept the target
// substituted verbatim into {url}, so the two are interchangeable.
export const DAEMON_TEMPLATE = "http://127.0.0.1:7967/proxy/{url}";
export const HOSTED_TEMPLATE = "https://cors-proxy.spicetify.app/{url}";

const OVERRIDE_KEY = "spicetify:corsProxyTemplate";

export const applyTemplate = (template, target) => template.replace("{url}", target);

// A template that cannot produce a URL would fail every proxied request, so a
// typo degrades to the normal chain instead of taking the client's fetches
// down with it.
const override = () => {
  let stored = null;
  try {
    stored = window.localStorage.getItem(OVERRIDE_KEY) || null;
  } catch {
    return null;
  }
  if (!stored) return null;
  try {
    void new URL(applyTemplate(stored, "https://example.com/"));
    return stored;
  } catch {
    console.error(`[spicetifyWrapper] ignoring invalid ${OVERRIDE_KEY}: ${stored}`);
    return null;
  }
};

// An explicit override is a deliberate choice, so it replaces the whole chain
// rather than becoming a third rung in it.
export const templates = () => {
  const chosen = override();
  return chosen ? [chosen] : [DAEMON_TEMPLATE, HOSTED_TEMPLATE];
};

export const proxiedURL = (target) => applyTemplate(templates()[0], target);

// Each later template becomes the previous attempt's rejection handler, so a
// request only moves down the chain when it never got an answer: an HTTP error
// is the upstream's own reply and belongs to the caller. The attempts stay
// sequential because a fallback is only worth making once the preferred proxy
// has actually failed.
// The daemon only answers requests carrying the token apply injected into this
// page, which is what keeps other local software off it. The token is scoped to
// that hop, so it is never attached to a template pointing anywhere else.
export const TOKEN_HEADER = "x-spicetify-token";

const isLoopback = (template) => {
  try {
    const { hostname } = new URL(applyTemplate(template, "https://example.com/"));
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
  } catch {
    return false;
  }
};

export const withToken = (template, options) => {
  const token = globalThis.__SPICETIFY_DAEMON_TOKEN__;
  if (!token || !isLoopback(template)) return options;
  const headers = new Headers(options?.headers || undefined);
  headers.set(TOKEN_HEADER, token);
  return { ...options, headers };
};

export const proxiedFetch = (target, options) => {
  const attempt = (template) => fetch(applyTemplate(template, target), withToken(template, options));
  const [preferred, ...backups] = templates();
  return backups.reduce((pending, template) => pending.catch(() => attempt(template)), attempt(preferred));
};
