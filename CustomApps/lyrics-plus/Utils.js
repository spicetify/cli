class Utils {
	static addQueueListener(callback) {
		Spicetify.Player.origin._events.addListener("queue_update", callback);
	}

	static removeQueueListener(callback) {
		Spicetify.Player.origin._events.removeListener("queue_update", callback);
	}

	static convertIntToRGB(colorInt, div = 1) {
		const rgb = {
			r: Math.round(((colorInt >> 16) & 0xff) / div),
			g: Math.round(((colorInt >> 8) & 0xff) / div),
			b: Math.round((colorInt & 0xff) / div)
		};
		return `rgb(${rgb.r},${rgb.g},${rgb.b})`;
	}

	static normalize(s, emptySymbol = true) {
		const result = s
			.replace(/（/g, "(")
			.replace(/）/g, ")")
			.replace(/【/g, "[")
			.replace(/】/g, "]")
			.replace(/。/g, ". ")
			.replace(/；/g, "; ")
			.replace(/：/g, ": ")
			.replace(/？/g, "? ")
			.replace(/！/g, "! ")
			.replace(/、|，/g, ", ")
			.replace(/‘|’|′|＇/g, "'")
			.replace(/“|”/g, '"')
			.replace(/〜/g, "~")
			.replace(/·|・/g, "•");
		if (emptySymbol) {
			result.replace(/-/g, " ").replace(/\//g, " ");
		}
		return result.replace(/\s+/g, " ").trim();
	}

	static removeSongFeat(s) {
		return (
			s
				.replace(/-\s+(feat|with).*/i, "")
				.replace(/(\(|\[)(feat|with)\.?\s+.*(\)|\])$/i, "")
				.trim() || s
		);
	}

	static removeExtraInfo(s) {
		return s.replace(/\s-\s.*/, "");
	}

	static capitalize(s) {
		return s.replace(/^(\w)/, $1 => $1.toUpperCase());
	}

	static isJapanese(lyrics) {
		for (let lyric of lyrics)
			if (/[\u3000-\u303F]|[\u3040-\u309F]|[\u30A0-\u30FF]|[\uFF00-\uFFEF]|[\u4E00-\u9FAF]|[\u2605-\u2606]|[\u2190-\u2195]|\u203B/g.test(lyric.text))
				return true;
		return false;
	}

	static rubyTextToReact(s) {
		const react = Spicetify.React;

		const rubyElems = s.split("<ruby>");
		const reactChildren = [];

		reactChildren.push(rubyElems[0]);

		for (let i = 1; i < rubyElems.length; i++) {
			const kanji = rubyElems[i].split("<rp>")[0];
			const furigana = rubyElems[i].split("<rt>")[1].split("</rt>")[0];

			reactChildren.push(react.createElement("ruby", null, kanji, react.createElement("rt", null, furigana)));

			reactChildren.push(rubyElems[i].split("</ruby>")[1]);
		}

		return react.createElement("p1", null, reactChildren);
	}

	static formatTime(timestamp) {
		if (isNaN(timestamp)) return timestamp.toString();
		let minutes = Math.trunc(timestamp / 60000),
			seconds = ((timestamp - minutes * 60000) / 1000).toFixed(2);

		if (minutes < 10) minutes = "0" + minutes;
		if (seconds < 10) seconds = "0" + seconds;

		return `${minutes}:${seconds}`;
	}

	static convertParsedToLRC(lyrics) {
		function formatTime(timestamp) {
		if (isNaN(timestamp)) return timestamp.toString();
		let minutes = Math.trunc(timestamp / 60000),
			seconds = ((timestamp - minutes * 60000) / 1000).toFixed(2);
		if (minutes < 10) minutes = "0" + minutes;
		if (seconds < 10) seconds = "0" + seconds;
		return `${minutes}:${seconds}`;
		}

		function processText(text, startTime = 0) {
			if (text.props?.children) {
				return text.props.children
					.map(child => {
						if (typeof child === "string") {
							return child;
						} else if (child.props?.children) {
							return child.props?.children[0];
						}
					})
					.join("");
			} else if (Array.isArray(text)) {
				let wordTime = startTime;
				return text
					.map(word => {
						wordTime += word.time;
						return `${word.word}<${formatTime(wordTime)}>`;
					})
					.join("");
			} else return text;
		}

		return lyrics
			.map(line => {
				if (!line.startTime) return line.text;
				return `[${formatTime(line.startTime)}]${processText(line.text, line.startTime)}`;
			})
			.join("\n");
	}

	static parseLocalLyrics(lyrics) {
		// Preprocess lyrics by removing [tags] and empty lines
		const lines = lyrics
			.replaceAll(/\[[a-zA-Z]+:.+\]/g, "")
			.trim()
			.split("\n");

		const syncedTimestamp = /\[([0-9:.]+)\]/;
		const karaokeTimestamp = /\<([0-9:.]+)\>/;

		const unsynced = [];

		const isSynced = lines[0].match(syncedTimestamp);
		const synced = isSynced ? [] : null;

		const isKaraoke = lines[0].match(karaokeTimestamp);
		const karaoke = isKaraoke ? [] : null;

		function timestampToMs(timestamp) {
			const [minutes, seconds] = timestamp.replace(/\[\]\<\>/, "").split(":");
			return Number(minutes) * 60 * 1000 + Number(seconds) * 1000;
		}

		function parseKaraokeLine(line, startTime) {
			let wordTime = timestampToMs(startTime);
			const karaokeLine = [];
			const karaoke = line.matchAll(/(\S+ ?)\<([0-9:.]+)\>/g);
			for (const match of karaoke) {
				const word = match[1];
				const time = match[2];
				karaokeLine.push({ word, time: timestampToMs(time) - wordTime });
				wordTime = timestampToMs(time);
			}
			return karaokeLine;
		}

		lines.forEach((line, i) => {
			const time = line.match(syncedTimestamp)?.[1];
			let lyricContent = line.replace(syncedTimestamp, "").trim();
			const lyric = lyricContent.replaceAll(/\<([0-9:.]+)\>/g, "").trim();

			if (line.trim() !== "") {
				if (isKaraoke) {
					if (!lyricContent.endsWith(">")) {
						// For some reason there are a variety of formats for karaoke lyrics, Wikipedia is also inconsisent in their examples
						const endTime = lines[i + 1]?.match(syncedTimestamp)?.[1] || this.formatTime(Number(Spicetify.Player.data.track.metadata.duration));
						lyricContent += `<${endTime}>`;
					}
					const karaokeLine = parseKaraokeLine(lyricContent, time);
					karaoke.push({ text: karaokeLine, startTime: timestampToMs(time) });
				}
				isSynced && time && synced.push({ text: lyric || "♪", startTime: timestampToMs(time) });
				unsynced.push({ text: lyric || "♪" });
			}
		});

		return { synced, unsynced, karaoke };
	}
}
