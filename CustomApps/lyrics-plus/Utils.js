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

	static convertParsedToLRC(lyrics) {
		return lyrics
			.map(line => {
				// Process converted Japanese lyrics
				if (line.text.props?.children) {
					line.rawText = line.text.props.children
						.map(child => {
							if (typeof child === "string") {
								return child;
							} else if (child.props?.children) {
								return child.props?.children[0];
							}
						})
						.join("");
				}
				if (!line.startTime) return line.text;
				let startTimeString = "";

				// Convert milliseconds to mm:ss format
				if (!isNaN(line.startTime)) {
					let minutes = Math.trunc(line.startTime / 60000),
						seconds = ((line.startTime - minutes * 60000) / 1000).toFixed(2);

					if (minutes < 10) minutes = "0" + minutes;
					if (seconds < 10) seconds = "0" + seconds;

					startTimeString = `${minutes}:${seconds}`;
				} else {
					startTimeString = line.startTime.toString();
				}

				return `[${startTimeString}]${line.rawText || line.text}`;
			})
			.join("\n");
	}
}
