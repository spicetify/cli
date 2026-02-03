const ProviderMusixmatch = (() => {
	const headers = {
		authority: "apic-desktop.musixmatch.com",
		cookie: "x-mxm-token-guid=",
	};

	function findTranslationStatus(body) {
		if (!body || typeof body !== "object") {
			return null;
		}

		if (Array.isArray(body)) {
			for (const item of body) {
				const result = findTranslationStatus(item);
				if (result) {
					return result;
				}
			}

			return null;
		}

		if (Array.isArray(body.track_lyrics_translation_status)) {
			return body.track_lyrics_translation_status;
		}

		for (const value of Object.values(body)) {
			const result = findTranslationStatus(value);
			if (result) {
				return result;
			}
		}

		return null;
	}

	async function findLyrics(info) {
		const baseURL =
			"https://apic-desktop.musixmatch.com/ws/1.1/macro.subtitles.get?format=json&namespace=lyrics_richsynched&subtitle_format=mxm&app_id=web-desktop-app-v1.0&";

		const durr = info.duration / 1000;

		const params = {
			q_album: info.album,
			q_artist: info.artist,
			q_artists: info.artist,
			q_track: info.title,
			track_spotify_id: info.uri,
			q_duration: durr,
			f_subtitle_length: Math.floor(durr),
			usertoken: CONFIG.providers.musixmatch.token,
			part: "track_lyrics_translation_status,track_structure,track_performer_tagging",
		};

		const finalURL =
			baseURL +
			Object.keys(params)
				.map((key) => `${key}=${encodeURIComponent(params[key])}`)
				.join("&");

		let body = await Spicetify.CosmosAsync.get(finalURL, null, headers);

		body = body.message.body.macro_calls;

		if (body["matcher.track.get"].message.header.status_code !== 200) {
			return {
				error: `Requested error: ${body["matcher.track.get"].message.header.mode}`,
				uri: info.uri,
			};
		}
		if (body["track.lyrics.get"]?.message?.body?.lyrics?.restricted) {
			return {
				error: "Unfortunately we're not authorized to show these lyrics.",
				uri: info.uri,
			};
		}

		const translationStatus = findTranslationStatus(body);
		const meta = body?.["matcher.track.get"]?.message?.body;
		const availableTranslations = Array.isArray(translationStatus) ? [...new Set(translationStatus.map((status) => status?.to).filter(Boolean))] : [];

		Object.defineProperties(body, {
			__musixmatchTranslationStatus: {
				value: availableTranslations,
			},
			__musixmatchTrackId: {
				value: meta?.track?.track_id ?? null,
			},
		});

		return body;
	}

	function parsePerformerData(meta) {
		const tagging = meta.track.performer_tagging;
		const miscTags = meta.track.performer_tagging_misc_tags || {};
		let performerMap = [];
		if (tagging && tagging.content && tagging.content.length > 0) {
			const resources = tagging.resources?.artists || [];
			const resourcesList = Array.isArray(resources) ? resources : Object.values(resources);

			performerMap = tagging.content
				.map((c) => {
					if (!c.performers || c.performers.length === 0) return null;

					const resolvedPerformers = c.performers.map((p) => {
						let name = "Unknown";
						if (p.type === "artist") {
							const fqid = p.fqid;
							const idFromFqid = fqid ? parseInt(fqid.split(":")[2]) : null;

							const artist = resourcesList.find((r) => r.artist_id === idFromFqid);
							if (artist) name = artist.artist_name;
						} else if (miscTags[p.type]) {
							name = miscTags[p.type];
						}
						return {
							fqid: p.fqid,
							artist_id: p.fqid ? parseInt(p.fqid.split(":")[2]) : null,
							name: name,
						};
					});

					const names = resolvedPerformers.map((p) => p.name).filter((n) => n !== "Unknown");
					if (names.length === 0) return null;

					return {
						name: names.join(", "),
						snippet: c.snippet,
						performers: resolvedPerformers,
					};
				})
				.filter(Boolean);
		}

		const normalizeForMatch = (text) => text.replace(/\s+/g, "").toLowerCase();

		const snippetQueue = [];
		if (performerMap.length > 0) {
			for (const tag of performerMap) {
				if (!tag.snippet) continue;
				const snippetLines = tag.snippet
					.split(/\n+/)
					.map((s) => s.trim())
					.filter(Boolean);
				for (const sLine of snippetLines) {
					if (sLine.length < 2 && !/^[\u3131-\uD79D]/.test(sLine)) continue;
					snippetQueue.push({
						text: normalizeForMatch(sLine),
						raw: sLine,
						performers: tag.performers,
					});
				}
			}
		}
		return snippetQueue;
	}

	function matchSequential(lyricsLines, snippetQueue, getTextCallback = (l) => l.text) {
		if (!snippetQueue || snippetQueue.length === 0) return lyricsLines;

		const normalizeForMatch = (text) => text.replace(/\s+/g, "").toLowerCase();
		let queueCursor = 0;
		const LOOKAHEAD = 5;

		return lyricsLines.map((line) => {
			const lineText = getTextCallback(line) || "♪";
			let normalizedLine = normalizeForMatch(lineText);

			let matchedPerformers = [];

			while (queueCursor < snippetQueue.length) {
				let matchFoundAtOffset = -1;

				for (let i = 0; i < LOOKAHEAD && queueCursor + i < snippetQueue.length; i++) {
					const snippet = snippetQueue[queueCursor + i];

					if (normalizedLine.includes(snippet.text) && snippet.text.length > 0) {
						matchFoundAtOffset = i;
						break;
					}
				}

				if (matchFoundAtOffset !== -1) {
					queueCursor += matchFoundAtOffset;
					const matchedSnippet = snippetQueue[queueCursor];
					matchedPerformers.push(...matchedSnippet.performers);
					normalizedLine = normalizedLine.replace(matchedSnippet.text, "");
					queueCursor++;
				} else {
					break;
				}
			}

			const uniquePerformers = [];
			const sawMap = new Set();
			for (const p of matchedPerformers) {
				const key = p.fqid || p.name;
				if (!sawMap.has(key)) {
					sawMap.add(key);
					uniquePerformers.push(p);
				}
			}

			return {
				...line,
				performers: uniquePerformers,
			};
		});
	}

	async function getKaraoke(body) {
		const meta = body?.["matcher.track.get"]?.message?.body;
		if (!meta) {
			return null;
		}

		if (!meta.track.has_richsync || meta.track.instrumental) {
			return null;
		}

		const baseURL = "https://apic-desktop.musixmatch.com/ws/1.1/track.richsync.get?format=json&subtitle_format=mxm&app_id=web-desktop-app-v1.0&";

		const params = {
			f_subtitle_length: meta.track.track_length,
			q_duration: meta.track.track_length,
			commontrack_id: meta.track.commontrack_id,
			usertoken: CONFIG.providers.musixmatch.token,
		};

		const finalURL =
			baseURL +
			Object.keys(params)
				.map((key) => `${key}=${encodeURIComponent(params[key])}`)
				.join("&");

		let result = await Spicetify.CosmosAsync.get(finalURL, null, headers);

		if (result.message.header.status_code !== 200) {
			return null;
		}

		result = result.message.body;

		const snippetQueue = parsePerformerData(meta);

		const parsedKaraoke = JSON.parse(result.richsync.richsync_body).map((line) => {
			const startTime = line.ts * 1000;
			const endTime = line.te * 1000;
			const words = line.l;

			const text = words.map((word, index, words) => {
				const wordText = word.c;
				const wordStartTime = word.o * 1000;
				const nextWordStartTime = words[index + 1]?.o * 1000;

				const time = !Number.isNaN(nextWordStartTime) ? nextWordStartTime - wordStartTime : endTime - (wordStartTime + startTime);

				return {
					word: wordText,
					time,
				};
			});
			return {
				startTime,
				endTime,
				text,
			};
		});

		return matchSequential(parsedKaraoke, snippetQueue, (line) => {
			if (Array.isArray(line.text)) {
				return line.text.map((t) => t.word).join("");
			}
			return line.text;
		}).map((line) => {
			const performerNames = (line.performers || [])
				.map((p) => p.name)
				.filter(Boolean)
				.join(", ");
			return {
				...line,
				performer: performerNames || null,
			};
		});
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
		}
		if (hasSynced) {
			const subtitle = body["track.subtitles.get"]?.message?.body?.subtitle_list?.[0]?.subtitle;
			if (!subtitle) {
				return null;
			}

			const snippetQueue = parsePerformerData(meta);
			const rawLines = JSON.parse(subtitle.subtitle_body);

			return matchSequential(rawLines, snippetQueue, (l) => l.text).map((line) => {
				const lineText = line.text || "♪";
				const performerNames = (line.performers || [])
					.map((p) => p.name)
					.filter(Boolean)
					.join(", ");

				return {
					text: lineText,
					startTime: line.time.total * 1000,
					performer: performerNames || null,
				};
			});
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
		}
		if (hasUnSynced) {
			const lyrics = body["track.lyrics.get"]?.message?.body?.lyrics?.lyrics_body;
			if (!lyrics) {
				return null;
			}

			const snippetQueue = parsePerformerData(meta);
			const rawLines = lyrics.split("\n").map((text) => ({ text }));

			return matchSequential(rawLines, snippetQueue, (l) => l.text).map((line) => {
				const performerNames = (line.performers || [])
					.map((p) => p.name)
					.filter(Boolean)
					.join(", ");

				return {
					...line,
					performer: performerNames || null,
				};
			});
		}

		return null;
	}

	async function getTranslation(trackId) {
		if (!trackId) return null;

		const selectedLanguage = CONFIG.visual["musixmatch-translation-language"] || "none";
		if (selectedLanguage === "none") return null;

		const baseURL =
			"https://apic-desktop.musixmatch.com/ws/1.1/crowd.track.translations.get?translation_fields_set=minimal&comment_format=text&format=json&app_id=web-desktop-app-v1.0&";

		const params = {
			track_id: trackId,
			selected_language: selectedLanguage,
			usertoken: CONFIG.providers.musixmatch.token,
		};

		const finalURL =
			baseURL +
			Object.keys(params)
				.map((key) => `${key}=${encodeURIComponent(params[key])}`)
				.join("&");

		let result = await Spicetify.CosmosAsync.get(finalURL, null, headers);

		if (result.message.header.status_code !== 200) return null;

		result = result.message.body;

		if (!result.translations_list?.length) return null;

		return result.translations_list.map(({ translation }) => ({
			translation: translation.description,
			matchedLine: translation.matched_line,
		}));
	}

	let languageMap = null;
	async function getLanguages() {
		if (languageMap) return languageMap;

		try {
			const cached = localStorage.getItem("lyrics-plus:musixmatch-languages");
			if (cached) {
				const tempMap = JSON.parse(cached);
				// Check cache version
				if (tempMap.__version === 1) {
					delete tempMap.__version;
					languageMap = tempMap;
					return languageMap;
				}
			}
		} catch (e) {
			console.warn("Failed to parse cached languages", e);
		}

		const baseURL = "https://apic-desktop.musixmatch.com/ws/1.1/languages.get?app_id=web-desktop-app-v1.0&get_romanized_info=1&";

		const params = {
			usertoken: CONFIG.providers.musixmatch.token,
		};

		const finalURL =
			baseURL +
			Object.keys(params)
				.map((key) => `${key}=${encodeURIComponent(params[key])}`)
				.join("&");

		try {
			let body = await Spicetify.CosmosAsync.get(finalURL, null, headers);
			if (body?.message?.body?.language_list) {
				languageMap = {};
				body.message.body.language_list.forEach((item) => {
					const lang = item.language;
					if (lang.language_name) {
						const name = lang.language_name.charAt(0).toUpperCase() + lang.language_name.slice(1);
						if (lang.language_iso_code_1) languageMap[lang.language_iso_code_1] = name;
						if (lang.language_iso_code_3) languageMap[lang.language_iso_code_3] = name;
					}
				});
				localStorage.setItem("lyrics-plus:musixmatch-languages", JSON.stringify({ ...languageMap, __version: 1 }));
				return languageMap;
			}
		} catch (e) {
			console.error("Failed to fetch languages", e);
		}
		return {};
	}

	return { findLyrics, getKaraoke, getSynced, getUnsynced, getTranslation, getLanguages };
})();
