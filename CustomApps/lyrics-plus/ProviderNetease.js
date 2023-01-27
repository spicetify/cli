const ProviderNetease = (function () {
	const requestHeader = {
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:93.0) Gecko/20100101 Firefox/93.0"
	};

	async function findLyrics(info) {
		const searchURL = `https://music.xianqiao.wang/neteaseapiv2/search?limit=10&type=1&keywords=`;
		const lyricURL = `https://music.xianqiao.wang/neteaseapiv2/lyric?id=`;

		const cleanTitle = Utils.removeExtraInfo(Utils.removeSongFeat(Utils.normalize(info.title)));
		const finalURL = searchURL + encodeURIComponent(`${cleanTitle} ${info.artist}`);

		const searchResults = await CosmosAsync.get(finalURL, null, requestHeader);
		const items = searchResults.result.songs;
		if (!items?.length) {
			throw "Cannot find track";
		}

		const album = Utils.capitalize(info.album);
		let itemId = items.findIndex(val => Utils.capitalize(val.album.name) === album);
		if (itemId === -1) itemId = 0;

		return await CosmosAsync.get(lyricURL + items[itemId].id, null, requestHeader);
	}

	const creditInfo = [
		"\\s?作?\\s*词|\\s?作?\\s*曲|\\s?编\\s*曲?|\\s?监\\s*制?",
		".*编写|.*和音|.*和声|.*合声|.*提琴|.*录|.*工程|.*工作室|.*设计|.*剪辑|.*制作|.*发行|.*出品|.*后期|.*混音|.*缩混",
		"原唱|翻唱|题字|文案|海报|古筝|二胡|钢琴|吉他|贝斯|笛子|鼓|弦乐",
		"lrc|publish|vocal|guitar|program|produce|write"
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
		const matchResult = line.match(/(\[.*?\])|([^\[\]]+)/g);
		if (!matchResult?.length || matchResult.length === 1) {
			return { text: line };
		}

		const textIndex = matchResult.findIndex(slice => !slice.endsWith("]"));
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
				word: components[i + 1] + " ",
				time: parseInt(components[i])
			});
		}
		return result;
	}

	function getKaraoke(list) {
		const lyricStr = list?.klyric?.lyric;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map(line => line.trim());
		const karaoke = lines
			.map(line => {
				const { time, text } = parseTimestamp(line);
				if (!time || !text) return null;

				const [key, value] = time.split(",") || [];
				const [start, durr] = [parseFloat(key), parseFloat(value)];

				if (!isNaN(start) && !isNaN(durr) && !containCredits(text)) {
					return {
						startTime: start,
						// endTime: start + durr,
						text: breakdownLine(text)
					};
				}
				return null;
			})
			.filter(a => a);

		if (!karaoke.length) {
			return null;
		}

		return karaoke;
	}

	function getSynced(list) {
		const lyricStr = list?.lrc?.lyric;
		let isInstrumental = false;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map(line => line.trim());
		const lyrics = lines
			.map(line => {
				const { time, text } = parseTimestamp(line);
				if (text === "纯音乐, 请欣赏") {
					isInstrumental = true;
				}
				if (!time || !text) return null;

				const [key, value] = time.split(":") || [];
				const [min, sec] = [parseFloat(key), parseFloat(value)];
				if (!isNaN(min) && !isNaN(sec) && !containCredits(text)) {
					return {
						startTime: (min * 60 + sec) * 1000,
						text: text || ""
					};
				}
				return null;
			})
			.filter(a => a);

		if (!lyrics.length) {
			return null;
		}
		if (isInstrumental) {
			return [{ startTime: "0000", text: "♪ Instrumental ♪" }];
		}
		return lyrics;
	}

	function getTranslation(list) {
		const lyricStr = list?.tlyric?.lyric;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map(line => line.trim());
		const translation = lines
			.map(line => {
				const { time, text } = parseTimestamp(line);
				if (!time || !text) return null;

				const [key, value] = time.split(":") || [];
				const [min, sec] = [parseFloat(key), parseFloat(value)];
				if (!isNaN(min) && !isNaN(sec) && !containCredits(text)) {
					return {
						startTime: (min * 60 + sec) * 1000,
						text: text || ""
					};
				}
				return null;
			})
			.filter(a => a);

		if (!translation.length) {
			return null;
		}
		return translation;
	}

	function getUnsynced(list) {
		const lyricStr = list?.lrc?.lyric;
		let isInstrumental = false;

		if (!lyricStr) {
			return null;
		}

		const lines = lyricStr.split(/\r?\n/).map(line => line.trim());
		const lyrics = lines
			.map(line => {
				const parsed = parseTimestamp(line);
				if (parsed.text === "纯音乐, 请欣赏") {
					isInstrumental = true;
				}
				if (!parsed.text || containCredits(parsed.text)) return null;
				return parsed;
			})
			.filter(a => a);

		if (!lyrics.length) {
			return null;
		}

		if (isInstrumental) {
			return [{ text: "♪ Instrumental ♪" }];
		}

		return lyrics;
	}

	return { findLyrics, getKaraoke, getSynced, getUnsynced, getTranslation };
})();
