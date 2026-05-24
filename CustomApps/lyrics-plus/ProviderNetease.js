const ProviderNetease = (() => {
	const requestHeader = {
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
		Referer: "https://music.163.com/",
	};

	async function findLyrics(info) {
		const cleanTitle = Utils.removeExtraInfo(Utils.removeSongFeat(Utils.normalize(info.title)));
		const finalURL =
			"https://music.163.com/api/cloudsearch/pc?csrf_token=&type=1&offset=0&limit=10&s=" +
			encodeURIComponent(`${cleanTitle} ${info.artist}`);
		const getArtists = (val) => (val.ar ?? val.artists ?? []).map((artist) => artist.name).filter(Boolean);

		const searchResults = await Spicetify.CosmosAsync.get(finalURL, null, requestHeader);
		const items = searchResults.result.songs;
		if (!items?.length) {
			throw "Cannot find track";
		}

		const normalizedTitle = Utils.normalize(cleanTitle);
		const normalizedArtist = Utils.normalize(info.artist);

		// normalized expected album name
		const neAlbumName = Utils.normalize(info.album);
		const expectedAlbumName = Utils.containsHanCharacter(neAlbumName) ? await Utils.toSimplifiedChinese(neAlbumName) : neAlbumName;
		const matches = items
			.map((val, index) => {
				const name = Utils.normalize(val.name);
				const album = Utils.normalize(val.al?.name ?? val.album?.name);
				const artists = Utils.normalize(getArtists(val).join(" "));
				const durationDiff = Math.abs(info.duration - (val.dt ?? val.duration));
				let score = 0;

				if (name === normalizedTitle) score += 50;
				else if (name.includes(normalizedTitle) || normalizedTitle.includes(name)) score += 20;
				if (artists && normalizedArtist && artists === normalizedArtist) score += 40;
				else if (artists && normalizedArtist && (artists.includes(normalizedArtist) || normalizedArtist.includes(artists))) score += 25;
				if (album === expectedAlbumName) score += 20;
				if (durationDiff < 3000) score += 30;
				else if (durationDiff < 10000) score += 10;

				return { index, score };
			})
			.sort((a, b) => b.score - a.score);

		const itemId = matches[0]?.score > 0 ? matches[0].index : -1;
		if (itemId === -1) {
			throw "Cannot find track";
		}

		const lyricURLs = [
			`https://music.163.com/api/song/lyric/v1?id=${items[itemId].id}&lv=1&kv=1&tv=1`,
			`https://music.163.com/api/song/lyric?id=${items[itemId].id}&lv=1&kv=1&tv=1`,
		];

		for (const url of lyricURLs) {
			const list = await Spicetify.CosmosAsync.get(url, null, requestHeader);
			if (list?.lrc?.lyric || list?.tlyric?.lyric || list?.klyric?.lyric) {
				return list;
			}
		}

		throw "Cannot find lyrics";
	}

	const creditInfo = [
		"\\s?作?\\s*词|\\s?作?\\s*曲|\\s?编\\s*曲?|\\s?监\\s*制?",
		".*编写|.*和音|.*和声|.*合声|.*提琴|.*录|.*工程|.*工作室|.*设计|.*剪辑|.*制作|.*发行|.*出品|.*后期|.*混音|.*缩混",
		"原唱|翻唱|题字|文案|海报|古筝|二胡|钢琴|吉他|贝斯|笛子|鼓|弦乐",
		"lrc|publish|vocal|guitar|program|produce|write|mix",
	];
	const creditInfoRegExp = new RegExp(`^(${creditInfo.join("|")}).*(:|：)`, "i");

	function containCredits(text) {
		return creditInfoRegExp.test(text);
	}

	function parseTimestamp(line) {
		// ["[ar:Beyond]"]
		// ["[03:10]"]
		// ["[03:10]", "lyrics"]
		// ["lyrics"]
		// ["[03:10]", "[03:10]", "lyrics"]
		// ["[1235,300]", "lyrics"]
		const matchResult = line.match(/(\[.*?\])|([^[\]]+)/g);
		if (!matchResult?.length || matchResult.length === 1) {
			return { text: line };
		}

		const textIndex = matchResult.findIndex((slice) => !slice.endsWith("]"));
		let text = "";

		if (textIndex > -1) {
			text = matchResult.splice(textIndex, 1)[0];
			text = Utils.capitalize(Utils.normalize(text, false));
		}

		const time = matchResult[0].replace("[", "").replace("]", "");

		return { time, text };
	}

	function breakdownLine(text) {
		// (0,508)Don't(0,1) (0,151)want(0,1) (0,162)to(0,1) (0,100)be(0,1) (0,157)an(0,1)
		const components = text.split(/\(\d+,(\d+)\)/g);
		// ["", "508", "Don't", "1", " ", "151", "want" , "1" ...]
		const result = [];
		for (let i = 1; i < components.length; i += 2) {
			if (components[i + 1] === " ") continue;
			result.push({
				word: `${components[i + 1]} `,
				time: Number.parseInt(components[i]),
			});
		}
		return result;
	}

	function getKaraoke(list) {
		const lyricStr = list?.klyric?.lyric;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
		const karaoke = lines
			.map((line) => {
				const { time, text } = parseTimestamp(line);
				if (!time || !text) return null;

				const [key, value] = time.split(",") || [];
				const [start, durr] = [Number.parseFloat(key), Number.parseFloat(value)];

				if (!Number.isNaN(start) && !Number.isNaN(durr) && !containCredits(text)) {
					return {
						startTime: start,
						// endTime: start + durr,
						text: breakdownLine(text),
					};
				}
				return null;
			})
			.filter(Boolean);

		if (!karaoke.length) {
			return null;
		}

		return karaoke;
	}

	function getSynced(list) {
		const lyricStr = list?.lrc?.lyric;
		let noLyrics = false;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
		const lyrics = lines
			.map((line) => {
				const { time, text } = parseTimestamp(line);
				if (text === "纯音乐, 请欣赏") noLyrics = true;
				if (!time || !text) return null;

				const [key, value] = time.split(":") || [];
				const [min, sec] = [Number.parseFloat(key), Number.parseFloat(value)];
				if (!Number.isNaN(min) && !Number.isNaN(sec) && !containCredits(text)) {
					return {
						startTime: (min * 60 + sec) * 1000,
						text: text || "",
					};
				}
				return null;
			})
			.filter(Boolean);

		if (!lyrics.length || noLyrics) {
			return null;
		}
		return lyrics;
	}

	function getTranslation(list) {
		const lyricStr = list?.tlyric?.lyric;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
		const translation = lines
			.map((line) => {
				const { time, text } = parseTimestamp(line);
				if (!time || !text) return null;

				const [key, value] = time.split(":") || [];
				const [min, sec] = [Number.parseFloat(key), Number.parseFloat(value)];
				if (!Number.isNaN(min) && !Number.isNaN(sec) && !containCredits(text)) {
					return {
						startTime: (min * 60 + sec) * 1000,
						text: text || "",
					};
				}
				return null;
			})
			.filter(Boolean);

		if (!translation.length) {
			return null;
		}
		return translation;
	}

	function getUnsynced(list) {
		const lyricStr = list?.lrc?.lyric;
		let noLyrics = false;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map((line) => line.trim());
		const lyrics = lines
			.map((line) => {
				const parsed = parseTimestamp(line);
				if (parsed.text === "纯音乐, 请欣赏") noLyrics = true;
				if (!parsed.text || containCredits(parsed.text)) return null;
				return parsed;
			})
			.filter(Boolean);

		if (!lyrics.length || noLyrics) {
			return null;
		}
		return lyrics;
	}

	return { findLyrics, getKaraoke, getSynced, getUnsynced, getTranslation };
})();
