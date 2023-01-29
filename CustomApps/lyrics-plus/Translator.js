const kuroshiroPath = "https://cdn.jsdelivr.net/npm/kuroshiro@1.2.0/dist/kuroshiro.min.js";
const kuromojiPath = "https://cdn.jsdelivr.net/npm/kuroshiro-analyzer-kuromoji@1.1.0/dist/kuroshiro-analyzer-kuromoji.min.js";

const dictPath = "https:/cdn.jsdelivr.net/npm/kuromoji@0.1.2/dict";

class Translator {
	constructor() {
		this.includeExternal(kuroshiroPath);
		this.includeExternal(kuromojiPath);

		this.createKuroshiro();

		this.finished = false;
	}

	includeExternal(url) {
		if (CONFIG.visual.translate && !document.querySelector(`script[src="${url}"]`)) {
			var script = document.createElement("script");
			script.setAttribute("type", "text/javascript");
			script.setAttribute("src", url);
			document.body.appendChild(script);
		}
	}

	injectExternals() {
		this.includeExternal(kuroshiroPath);
		this.includeExternal(kuromojiPath);
	}

	/**
	 * Fix an issue with kuromoji when loading dict from external urls
	 * Adapted from: https://github.com/mobilusoss/textlint-browser-runner/pull/7
	 */
	applyKuromojiFix() {
		if (typeof XMLHttpRequest.prototype.realOpen !== "undefined") return;
		XMLHttpRequest.prototype.realOpen = XMLHttpRequest.prototype.open;
		XMLHttpRequest.prototype.open = function (method, url, bool) {
			if (url.indexOf(dictPath.replace("https://", "https:/")) === 0) {
				this.realOpen(method, url.replace("https:/", "https://"), bool);
			} else {
				this.realOpen(method, url, bool);
			}
		};
	}

	async createKuroshiro() {
		if (typeof Kuroshiro === "undefined" || typeof KuromojiAnalyzer === "undefined") {
			//Waiting for JSDeliver to load Kuroshiro and Kuromoji
			setTimeout(this.createKuroshiro.bind(this), 50);
			return;
		}

		this.kuroshiro = new Kuroshiro.default();

		this.applyKuromojiFix();

		this.kuroshiro.init(new KuromojiAnalyzer({ dictPath: dictPath })).then(
			function () {
				this.finished = true;
			}.bind(this)
		);
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
