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

		const getURL = (queryParams) => `${baseURL}?${Object.keys(queryParams)
			.map((key) => `${key}=${encodeURIComponent(queryParams[key])}`)
			.join("&")}`;
		const headers = {
			"x-user-agent": `spicetify v${Spicetify.Config.version} (https://github.com/spicetify/cli)`,
		};

		let body;
		try {
			body = await fetch(getURL(params), { headers });
		} catch {
			body = null;
		}

		if (body?.status === 200) {
			return await body.json();
		}

		const fallbackParams = { ...params };
		delete fallbackParams.duration;
		body = await fetch(getURL(fallbackParams), {
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

		return await body.json();
	}

	function getUnsynced(body) {
		const unsyncedLyrics = body?.plainLyrics;
		const isInstrumental = body.instrumental;
		if (isInstrumental) return [{ text: "♪ Instrumental ♪" }];

		if (!unsyncedLyrics) return null;

		return Utils.parseLocalLyrics(unsyncedLyrics).unsynced;
	}

	function getKaraoke(body) {
		const lyricsFile = body?.lyricsfile;
		if (typeof lyricsFile !== "string") return null;

		const result = [];
		let line;
		let word;

		function parseValue(value) {
			const trimmed = value.trim();
			if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
				return trimmed.slice(1, -1).replaceAll("''", "'");
			}
			return trimmed;
		}

		function finishWord() {
			if (!line || !word || word.text === undefined || word.start_ms === undefined || word.end_ms === undefined) return;
			line.words.push({ word: word.text, time: Math.max(word.end_ms - word.start_ms, 0) });
			word = null;
		}

		function finishLine() {
			finishWord();
			if (line && line.start_ms !== undefined && line.words.length) {
				result.push({ startTime: line.start_ms, text: line.words });
			}
			line = null;
		}

		for (const rawLine of lyricsFile.split(/\r?\n/)) {
			const indentation = rawLine.match(/^\s*/)[0].length;
			const content = rawLine.trim();
			if (indentation === 2 && content.startsWith("- text:")) {
				finishLine();
				line = { start_ms: undefined, words: [] };
				continue;
			}
			if (indentation === 6 && content.startsWith("- text:")) {
				finishWord();
				word = { text: parseValue(content.slice("- text:".length)) };
				continue;
			}
			const timestamp = content.match(/^start_ms:\s*(\d+(?:\.\d+)?)/) || content.match(/^end_ms:\s*(\d+(?:\.\d+)?)/);
			if (timestamp) {
				const key = content.startsWith("start_ms:") ? "start_ms" : "end_ms";
				if (word) word[key] = Number(timestamp[1]);
				else if (line) line[key] = Number(timestamp[1]);
			}
		}
		finishLine();

		return result.length ? result : null;
	}

	function getSynced(body) {
		const syncedLyrics = body?.syncedLyrics;
		const isInstrumental = body.instrumental;
		if (isInstrumental) return [{ text: "♪ Instrumental ♪" }];

		if (!syncedLyrics) return null;

		return Utils.parseLocalLyrics(syncedLyrics).synced;
	}

	return { findLyrics, getKaraoke, getSynced, getUnsynced };
})();
