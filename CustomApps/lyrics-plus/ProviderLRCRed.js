const ProviderLRCRed = (() => {
  const baseURL = "https://lrc.red";

  async function request(path) {
    const response = await fetch(`${baseURL}${path}`, {
      headers: { "X-Client-ID": `Spicetify/${Spicetify.Config.version} (https://github.com/spicetify/cli)` },
      signal: AbortSignal.timeout(10000),
    });
    if (response.status === 404) return null;
    if (!response.ok) throw new Error(`lrc.red request failed: ${response.status}`);
    return response;
  }

  function normalize(value) {
    return (value || "")
      .normalize("NFKC")
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  }

  function normalizeTitle(value) {
    return normalize(
      (value || "")
        .replace(/\s*[\[(](?:feat(?:uring)?|ft|with)\.?\s+[^)\]]*[\])]/gi, "")
        .replace(/\s+(?:[-–—]\s*)?(?:feat(?:uring)?|ft)\.?\s+.+$/i, ""),
    );
  }

  async function findTrack(info) {
    if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/i.test(info.isrc || "")) {
      const response = await request(`/s/${info.isrc.toUpperCase()}.json`);
      if (response) return response.json();
    }
    const response = await request(`/search.json?q=${encodeURIComponent(`${info.title} ${info.artist}`)}`);
    const search = response && (await response.json());
    const duration = info.duration / 1000;
    const title = normalizeTitle(info.title);
    const artists = [...(info.artists || []), info.artist].map(normalize).filter(Boolean);
    const matches = (search?.hits || []).filter(
      (track) =>
        normalizeTitle(track.title) === title &&
        artists.some((artist) => ` ${normalize(track.artist)} `.includes(` ${artist} `)) &&
        (!duration || Math.abs(track.duration - duration) <= 5),
    );
    matches.sort(
      (a, b) =>
        Number(normalize(b.title) === normalize(info.title)) - Number(normalize(a.title) === normalize(info.title)) ||
        Number(normalize(b.album) === normalize(info.album)) - Number(normalize(a.album) === normalize(info.album)) ||
        Math.abs(a.duration - duration) - Math.abs(b.duration - duration),
    );
    return matches[0] || null;
  }

  async function findLyrics(info) {
    const track = await findTrack(info);
    if (!track) return { error: "No lyrics", uri: info.uri };
    const response = await request(`/s/${encodeURIComponent(track.isrc)}.lyricsfile.yaml`);
    if (!response) return { error: "No lyrics", uri: info.uri };
    const lyrics = await Lyricsfile.parseYaml(await response.text(), info.duration);
    if (!lyrics?.unsynced?.length) return { error: "No lyrics", uri: info.uri };
    return { ...lyrics, uri: info.uri, provider: "lrc.red", copyright: null };
  }

  return { findLyrics };
})();
