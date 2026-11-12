const Providers = {
	lrcred: (info) => ProviderLRCRed.findLyrics(info),
	spotify: async (info) => {
		const result = {
			uri: info.uri,
			karaoke: null,
			synced: null,
			unsynced: null,
			provider: "Spotify",
			copyright: null,
		};

		const baseURL = "https://spclient.wg.spotify.com/color-lyrics/v2/track/";
		const id = info.uri.split(":")[2];
		let body;
		try {
			body = await Spicetify.CosmosAsync.get(`${baseURL + id}?format=json&vocalRemoval=false&market=from_token`);
		} catch {
			return { error: "Request error", uri: info.uri };
		}

		const lyrics = body.lyrics;
		if (!lyrics) {
			return { error: "No lyrics", uri: info.uri };
		}

		const lines = lyrics.lines;
		if (lyrics.syncType === "LINE_SYNCED") {
			result.synced = lines.map((line) => ({
				startTime: line.startTimeMs,
				text: line.words,
			}));
			result.unsynced = result.synced;
		} else {
			result.unsynced = lines.map((line) => ({
				text: line.words,
			}));
		}

		return result;
	},
	netease: async (info) => {
		const result = {
			uri: info.uri,
			karaoke: null,
			synced: null,
			unsynced: null,
			neteaseTranslation: null,
			provider: "Netease",
			copyright: null,
		};

		let list;
		try {
			list = await ProviderNetease.findLyrics(info);
		} catch {
			result.error = "No lyrics";
			return result;
		}

		const karaoke = ProviderNetease.getKaraoke(list);
		if (karaoke) {
			result.karaoke = karaoke;
		}
		const synced = ProviderNetease.getSynced(list);
		if (synced) {
			result.synced = synced;
		}
		const unsynced = synced || ProviderNetease.getUnsynced(list);
		if (unsynced) {
			result.unsynced = unsynced;
		}
		const translation = ProviderNetease.getTranslation(list);
		if ((synced || unsynced) && Array.isArray(translation)) {
			const baseLyrics = synced ?? unsynced;
			result.neteaseTranslation = baseLyrics.map((line) => ({
				...line,
				text: translation.find((t) => t.startTime === line.startTime)?.text ?? line.text,
				originalText: line.text,
			}));
		}

		return result;
	},
	lrclib: (info) => ProviderLRCLIB.findLyrics(info),
	genius: async (info) => {
		const { lyrics, versions } = await ProviderGenius.fetchLyrics(info);

		let versionIndex2 = 0;
		let genius2 = lyrics;
		if (CONFIG.visual["dual-genius"] && versions.length > 1) {
			genius2 = await ProviderGenius.fetchLyricsVersion(versions, 1);
			versionIndex2 = 1;
		}

		return {
			uri: info.uri,
			genius: lyrics,
			provider: "Genius",
			karaoke: null,
			synced: null,
			unsynced: null,
			copyright: null,
			error: null,
			versions,
			versionIndex: 0,
			genius2,
			versionIndex2,
		};
	},
	local: (info) => {
		let result = {
			uri: info.uri,
			karaoke: null,
			synced: null,
			unsynced: null,
			provider: "local",
		};

		try {
			const savedLyrics = JSON.parse(localStorage.getItem("lyrics-plus:local-lyrics"));
			const lyrics = savedLyrics[info.uri];
			if (!lyrics) {
				throw "";
			}

			result = {
				...result,
				...lyrics,
			};
		} catch {
			result.error = "No lyrics";
		}

		return result;
	},
};
