const ProviderApple = (() => {
	const LYRICS_BASE_URL = "https://lyrics.paxsenix.org/";
	const SEARCH_BASE_URL = "https://itunes.apple.com/search";

	/**
	 * Search for a song using iTunes Search API (public, no auth)
	 * @param {Object} query - { songName, artistName }
	 * @returns {Promise<Object|null>}
	 */
	async function getSongInfo(query) {
		if (!query.songName?.trim() && !query.artistName?.trim()) return null;
		const searchTerm = `${query.artistName ?? ""} ${query.songName ?? ""}`.trim();
		if (!searchTerm) return null;

		const url = `${SEARCH_BASE_URL}?` + `term=${encodeURIComponent(searchTerm)}&` + `entity=song&` + `limit=10`;

		let signal, timerId;
		if (AbortSignal.timeout) {
			signal = AbortSignal.timeout(10000);
		} else {
			const controller = new AbortController();
			timerId = setTimeout(() => controller.abort(), 10000);
			signal = controller.signal;
		}

		try {
			const response = await fetch(url, { signal });
			clearTimeout(timerId);
			if (!response.ok) {
				console.error("[ProviderApple] iTunes search failed:", response.status);
				return null;
			}
			let data = await response.json();

			if (typeof data === "string") {
				try {
					data = JSON.parse(data);
				} catch (e) {
					console.error("[ProviderApple] Failed to parse search response string:", e);
					return null;
				}
			}

			if (!data.results || data.results.length === 0) {
				console.log("[ProviderApple] No results from iTunes search");
				return null;
			}

			// Find best match
			const normalizedTitle = query.songName?.toLowerCase().trim() ?? "";
			const normalizedArtist = query.artistName?.toLowerCase().trim() ?? "";

			// Try to find exact match first
			let match = data.results.find(
				(r) => r.trackName?.toLowerCase().trim() === normalizedTitle && r.artistName?.toLowerCase().includes(normalizedArtist)
			);

			// If no exact match, take first result
			if (!match) {
				match = data.results[0];
			}

			if (!match.trackId) {
				console.log("[ProviderApple] No trackId in iTunes result");
				return null;
			}

			return {
				songName: match.trackName,
				artistName: match.artistName,
				appleID: match.trackId.toString(),
				albumName: match.collectionName,
				artworkUrl: match.artworkUrl100,
			};
		} catch (e) {
			clearTimeout(timerId);
			if (e.name === "AbortError" || e.name === "TimeoutError") console.error("[ProviderApple] iTunes search timeout");
			else if (e.message === "Failed to fetch") console.warn("[ProviderApple] iTunes search failed to fetch");
			else console.error("[ProviderApple] getSongInfo error:", e);
			return null;
		}
	}

	/**
	 * Gets synced lyrics using the song ID from paxsenix.org
	 * @param {string|number} id - The Apple Music song ID
	 * @returns {Promise<Object|null>}
	 */
	async function getSyncedLyrics(id) {
		const token = CONFIG?.providers?.apple?.token;
		let url = `${LYRICS_BASE_URL}apple-music/lyrics?id=${id}`;
		const headers = {};

		if (token) {
			url = `https://api.paxsenix.org/lyrics/applemusic?id=${id}`;
			headers["Authorization"] = `Bearer ${token}`;
			headers["Content-Type"] = "application/json";
		}

		let signal, timerId;
		if (AbortSignal.timeout) {
			signal = AbortSignal.timeout(10000);
		} else {
			const controller = new AbortController();
			timerId = setTimeout(() => controller.abort(), 10000);
			signal = controller.signal;
		}

		try {
			const fetchResponse = await fetch(url, { headers, signal });
			clearTimeout(timerId);
			if (!fetchResponse.ok) return null;
			const response = await fetchResponse.json();

			if (!response) return null;

			// Handle string or object response
			if (typeof response === "string") {
				try {
					return JSON.parse(response);
				} catch (e) {
					console.error("[ProviderApple] Failed to parse lyrics response string:", e);
					return null;
				}
			}
			return response;
		} catch (e) {
			clearTimeout(timerId);
			if (e.name === "AbortError" || e.name === "TimeoutError") console.error("[ProviderApple] getSyncedLyrics timeout");
			else if (e.message === "Failed to fetch") console.warn("[ProviderApple] getSyncedLyrics failed to fetch");
			else console.error("[ProviderApple] getSyncedLyrics error:", e);
			return null;
		}
	}

	function parseJSON(lyricsJson) {
		const karaoke = [];
		const synced = [];
		const unsynced = [];

		if (!lyricsJson || !lyricsJson.content) return { karaoke, synced, unsynced };

		function processWords(rawWords, lineStartTime, isBackground) {
			const processed = [];
			let currentTime = lineStartTime;

			rawWords.forEach((w) => {
				const wordStart = w.timestamp;
				const wordEnd = w.endtime;
				const wordDuration = w.duration;

				// Skip words with missing timing to protect currentTime state
				if (wordStart == null || wordEnd == null || wordDuration == null) {
					return;
				}
				const text = w.text || "";

				if (wordStart > currentTime + 10) {
					// 10ms tolerance
					processed.push({
						word: "",
						time: wordStart - currentTime,
						isBackground: isBackground,
						startTime: currentTime,
					});
				}

				const hasSpaceAfter = !w.part;
				const cleanWord = text + (hasSpaceAfter ? " " : "");

				processed.push({
					word: cleanWord,
					time: wordDuration,
					startTime: wordStart,
					isBackground: isBackground,
				});

				currentTime = wordEnd;
			});

			return processed;
		}

		lyricsJson.content.forEach((line) => {
			const lineStartTime = line.timestamp;
			const lineEndTime = line.endtime;

			if (lineStartTime == null) return;

			// Process Main Text
			const mainWords = processWords(line.text || [], lineStartTime, false);

			// Process Background Text
			let backgroundWords = [];
			if (line.backgroundText && Array.isArray(line.backgroundText) && line.backgroundText.length > 0) {
				backgroundWords = processWords(line.backgroundText, lineStartTime, true);
			}

			const mainTextStr = (line.text || [])
				.map((w) => (w.text || "") + (!w.part ? " " : ""))
				.join("")
				.trim();
			const bgTextStr = (line.backgroundText || [])
				.map((w) => (w.text || "") + (!w.part ? " " : ""))
				.join("")
				.trim();

			if (lyricsJson.type && lyricsJson.type !== "None") {
				karaoke.push({
					startTime: lineStartTime,
					endTime: lineEndTime,
					text: mainWords,
					isBackground: false,
					background: backgroundWords.length > 0 ? backgroundWords : undefined,
				});

				synced.push({
					startTime: lineStartTime,
					endTime: lineEndTime,
					text: mainTextStr,
					background: backgroundWords,
				});
			}

			// Unsynced contains combined text
			let valText = mainTextStr;
			if (bgTextStr) valText += ` (${bgTextStr})`;
			// Allow empty lines if they have background text?
			// Or only if valText is not empty.
			if (valText) {
				unsynced.push({ text: valText });
			}
		});

		return { karaoke, synced, unsynced };
	}

	/**
	 * Main function to find and fetch lyrics
	 * @param {Object} info - Track info with artist, title, duration
	 * @returns {Promise<Object>}
	 */
	async function findLyrics(info) {
		const result = {
			uri: info.uri,
			provider: "Apple Music",
			karaoke: null,
			synced: null,
			unsynced: null,
			copyright: null,
			error: null,
		};

		try {
			// Search for song
			const songInfo = await getSongInfo({ songName: info.title, artistName: info.artist });
			if (!songInfo || !songInfo.appleID) {
				console.log("[ProviderApple] Song not found in Apple Music");
				result.error = "Song not found";
				return result;
			}

			// Fetch lyrics
			const lyricsData = await getSyncedLyrics(songInfo.appleID);
			if (!lyricsData) {
				console.log("[ProviderApple] No lyrics data found");
				result.error = "No lyrics found";
				return result;
			}

			// Parse content
			let parsed;
			if (lyricsData.content) {
				parsed = parseJSON(lyricsData);
			}

			if (!parsed) {
				result.error = "Invalid lyrics format";
				return result;
			}

			const { karaoke, synced, unsynced } = parsed;

			if (karaoke.length === 0 && synced.length === 0 && unsynced.length === 0) {
				result.error = "Empty lyrics";
				return result;
			}

			result.karaoke = karaoke.length > 0 ? karaoke : null;
			result.synced = synced.length > 0 ? synced : null;
			result.unsynced = unsynced.length > 0 ? unsynced : result.synced ? result.synced.map((item) => ({ text: item.text })) : null;

			// Extract songwriters from metadata into copyright
			if (lyricsData.metadata && Array.isArray(lyricsData.metadata.songwriters) && lyricsData.metadata.songwriters.length > 0) {
				result.copyright = `Writer(s): ${lyricsData.metadata.songwriters.join(", ")}`;
			}

			return result;
		} catch (e) {
			console.error("[ProviderApple] Error:", e);
			result.error = "Request error";
			return result;
		}
	}

	return {
		findLyrics,
	};
})();
