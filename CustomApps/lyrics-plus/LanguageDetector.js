class LanguageDetector {
	constructor() {
		this.includeExternal();

		this.createFranc();

		this.finished = false;
	}

	includeExternal() {
		if (CONFIG.visual.translate && !document.querySelector(`script[id="languageDetecting"]`)) {
			var script = document.createElement("script");
			script.setAttribute("type", "module");
			script.setAttribute("id", 'languageDetecting');
			script[(script.innerText===undefined?"textContent":"innerText")] = "import {franc, francAll} from 'https://esm.sh/franc-min@6'; window.franc = franc; window.francAll = francAll"
			document.body.appendChild(script);
		}
	}

	injectExternals() {
		this.includeExternal();
	}

	createFranc() {
		if (typeof window.franc === "undefined") {
			//Waiting for JSDeliver to load Kuroshiro and Kuromoji
			setTimeout(this.createFranc.bind(this), 50);
			return;
		} else {
			class finished {
				constructor() {
					this.finished = true;
				}
			}
			
			finished.bind(this)
		}

	}
}
