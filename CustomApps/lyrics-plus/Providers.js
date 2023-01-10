const Providers = {
	spotify: async info => {
		const result = {
			uri: info.uri,
			karaoke: null,
			synced: null,
			unsynced: null,
			provider: "Spotify",
			copyright: null
		};

		const baseURL = "wg://lyrics/v1/track/";
		const id = info.uri.split(":")[2];
		let body;
		try {
			body = await CosmosAsync.get(baseURL + id);
		} catch {
			return { error: "Request error", uri: info.uri };
		}

		const lines = body.lines;
		if (!lines || !lines.length) {
			return { error: "No lyrics", uri: info.uri };
		}

		if (typeof lines[0].time === "number") {
			result.synced = lines.map(line => ({
				startTime: line.time,
				text: line.words.map(b => b.string).join(" ")
			}));
			result.unsynced = result.synced;
		} else {
			result.unsynced = lines.map(line => ({
				text: line.words.map(b => b.string).join(" ")
			}));
		}

		result.provider = body.provider;

		return result;
	},

	musixmatch: async info => {
		const result = {
			error: null,
			uri: info.uri,
			karaoke: null,
			synced: null,
			unsynced: null,
			provider: "Musixmatch",
			copyright: null
		};

		let list;
		try {
			list = await ProviderMusixmatch.findLyrics(info);
			if (list.error) {
				throw "";
			}
		} catch {
			result.error = "No lyrics";
			return result;
		}

		const synced = ProviderMusixmatch.getSynced(list);
		if (synced) {
			result.synced = synced;
			result.copyright = list["track.subtitles.get"].message?.body?.subtitle_list?.[0]?.subtitle.lyrics_copyright.trim();
		}
		const unsynced = synced || ProviderMusixmatch.getUnsynced(list);
		if (unsynced) {
			result.unsynced = unsynced;
			result.copyright = list["track.lyrics.get"].message?.body?.lyrics?.lyrics_copyright?.trim();
		}

		return result;
	},

	netease: async info => {
		const result = {
			uri: info.uri,
			karaoke: null,
			synced: null,
			unsynced: null,
			neteaseTranslation: null,
			provider: "Netease",
			copyright: null
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
		if (translation) {
			result.neteaseTranslation = translation;
		}

		return result;
	},
	genius: async info => {
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
			versionIndex2
		};
	}
};
