const ProviderMusixmatch = (function () {
	const headers = {
		authority: "apic-desktop.musixmatch.com",
		cookie: "x-mxm-token-guid="
	};

	async function findLyrics(info) {
		const baseURL = `https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&namespace=lyrics_richsynched&subtitle_format=mxm&app_id=web-desktop-app-v1.0&`;

		const durr = info.duration / 1000;
		const tokens = CONFIG.providers.musixmatch.token.split("|");
		const usertoken = tokens[Math.floor(Math.random() * tokens.length)];

		const params = {
			q_album: info.album,
			q_artist: info.artist,
			q_artists: info.artist,
			q_track: info.title,
			track_spotify_id: info.uri,
			q_duration: durr,
			f_subtitle_length: Math.floor(durr),
			usertoken
		};

		const finalURL =
			baseURL +
			Object.keys(params)
				.map(key => key + "=" + encodeURIComponent(params[key]))
				.join("&");

		let body = await CosmosAsync.get(finalURL, null, headers);

		body = body.message.body.macro_calls;

		if (body["matcher.track.get"].message.header.status_code !== 200) {
			return {
				error: `Requested error: ${body["matcher.track.get"].message.header.mode}`,
				uri: info.uri
			};
		} else if (body["track.lyrics.get"]?.message?.body?.lyrics?.restricted) {
			return {
				error: "Unfortunately we're not authorized to show these lyrics.",
				uri: info.uri
			};
		}

		return body;
	}

	function getSynced(body) {
		const meta = body?.["matcher.track.get"]?.message?.body;
		if (!meta) {
			return null;
		}

		const hasSynced = meta?.track?.has_subtitles;

		const isInstrumental = meta?.track?.instrumental;

		if (isInstrumental) {
			return [{ text: "♪ Instrumental ♪", startTime: "0000" }];
		} else if (hasSynced) {
			const subtitle = body["track.subtitles.get"]?.message?.body.subtitle_list?.[0]?.subtitle;
			if (!subtitle) {
				return null;
			}

			return JSON.parse(subtitle.subtitle_body).map(line => ({
				text: line.text || "♪",
				startTime: line.time.total * 1000
			}));
		}

		return null;
	}

	function getUnsynced(body) {
		const meta = body?.["matcher.track.get"]?.message?.body;
		if (!meta) {
			return null;
		}

		const hasUnSynced = meta.track.has_lyrics || meta.track.has_lyrics_crowd;

		const isInstrumental = meta?.track?.instrumental;

		if (isInstrumental) {
			return [{ text: "♪ Instrumental ♪" }];
		} else if (hasUnSynced) {
			const lyrics = body["track.lyrics.get"]?.message?.body?.lyrics?.lyrics_body;
			if (!lyrics) {
				return null;
			}
			return lyrics.split("\n").map(text => ({ text }));
		}

		return null;
	}

	return { findLyrics, getSynced, getUnsynced };
})();
