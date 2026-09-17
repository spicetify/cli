const ROOT = "http://127.0.0.1:7967/spotify";

const request = async (suffix = "", method = "GET") => {
  const token = globalThis.__SPICETIFY_DAEMON_TOKEN__;
  if (!token) throw new Error("no daemon token: apply Spicetify first");
  const response = await fetch(`${ROOT}${suffix}`, {
    method,
    headers: { "x-spicetify-token": token },
    signal: AbortSignal.timeout(suffix === "/check" ? 90000 : 15000),
  });
  if (response.status === 404 && method === "GET") return null;
  if (!response.ok) throw new Error((await response.text()).trim() || "Spotify package request failed");
  return response.json();
};

export const managedSpotify = {
  status: () => request(),
  check: () => request("/check", "POST"),
  update: () => request("/update", "POST"),
};
