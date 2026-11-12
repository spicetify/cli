const ProviderLRCLIB = (() => {
  async function findLyrics(info) {
    const baseURL = "https://lrclib.net/api/get";
    const durr = info.duration / 1000;
    const params = {
      track_name: info.title,
      artist_name: info.artist,
      album_name: info.album,
      duration: durr,
    };

    const finalURL = `${baseURL}?${Object.keys(params)
      .map((key) => `${key}=${encodeURIComponent(params[key])}`)
      .join("&")}`;

    const body = await fetch(finalURL, {
      headers: {
        "x-user-agent": `spicetify v${Spicetify.Config.version} (https://github.com/spicetify/cli)`,
      },
    });

    if (body.status !== 200) {
      return {
        error: "Request error: Track wasn't found",
        uri: info.uri,
      };
    }

    const data = await body.json();
    const lyrics = data.lyricsfile
      ? await Lyricsfile.parseYaml(data.lyricsfile, info.duration)
      : { karaoke: null, synced: getSynced(data), unsynced: getUnsynced(data) || getSynced(data) };
    return { ...lyrics, uri: info.uri, provider: "LRCLIB", copyright: null };
  }

  function getUnsynced(body) {
    const unsyncedLyrics = body?.plainLyrics;
    const isInstrumental = body.instrumental;
    if (isInstrumental) return [{ text: "♪ Instrumental ♪" }];

    if (!unsyncedLyrics) return null;

    return Utils.parseLocalLyrics(unsyncedLyrics).unsynced;
  }

  function getSynced(body) {
    const syncedLyrics = body?.syncedLyrics;
    const isInstrumental = body.instrumental;
    if (isInstrumental) return [{ text: "♪ Instrumental ♪" }];

    if (!syncedLyrics) return null;

    return Utils.parseLocalLyrics(syncedLyrics).synced;
  }

  return { findLyrics };
})();
