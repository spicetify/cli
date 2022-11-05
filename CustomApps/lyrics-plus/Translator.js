const dict1_url = "https://cdn.jsdelivr.net/gh/spicetify/spicetify-lyrics-romaji@main/dictionary/split_1.js";
const dict2_url = "https://cdn.jsdelivr.net/gh/spicetify/spicetify-lyrics-romaji@main/dictionary/split_2.js";

class Translator {
	constructor() {
		this.kuroshiro = new Kuroshiro.default();
		this.missingdicts = true;
		this.initializing = false;
		this.downloadingdicts = false;
		this.finished = false;
		this.init();
	}

	init() {
		if (typeof base_dat_gz === "undefined" || typeof tid_pos_dat_gz === "undefined") {
			if (!this.downloadingdicts) {
				setTimeout(this.include_external.bind(this), 0, dict1_url);
				setTimeout(this.include_external.bind(this), 0, dict2_url);
				this.downloadingdicts = true;
			}
			setTimeout(this.init.bind(this), 100);
			return;
		}
		this.missingdicts = false;
		this.initializing = true;
		this.kuroshiro.init(new KuromojiAnalyzer()).then(() => {
			this.initializing = false;
			this.finished = true;
		});
	}

	include_external(url) {
		var s = document.createElement("script");
		s.setAttribute("type", "text/javascript");
		s.setAttribute("src", url);
		var nodes = document.getElementsByTagName("*");
		var node = nodes[nodes.length - 1].parentNode;
		node.appendChild(s);
	}

	async romajifyText(text, target = "romaji", mode = "spaced") {
		if (!this.finished) {
			setTimeout(this.romajifyText.bind(this), 100, text, target, mode);
			return;
		}

		return this.kuroshiro.convert(text, {
			to: target,
			mode: mode
		});
	}
}
