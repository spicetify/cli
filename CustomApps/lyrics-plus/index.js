// Run "npm i @types/react" to have this type package available in workspace
/// <reference types="react" />
/// <reference path="../../globals.d.ts" />

/** @type {React} */
const react = Spicetify.React;
const { useState, useEffect, useCallback, useMemo, useRef } = react;
/** @type {import("react").ReactDOM} */
const reactDOM = Spicetify.ReactDOM;

const {
	URI,
	Platform: { History },
	Player,
	CosmosAsync
} = Spicetify;

// Define a function called "render" to specify app entry point
// This function will be used to mount app to main view.
function render() {
	return react.createElement(LyricsContainer, null);
}

function getConfig(name, defaultVal = true) {
	const value = localStorage.getItem(name);
	return value ? value === "true" : defaultVal;
}

const APP_NAME = "lyrics-plus";

// Modes enum
const KARAOKE = 0,
	SYNCED = 1,
	UNSYNCED = 2,
	GENIUS = 3;

const CONFIG = {
	visual: {
		colorful: getConfig("lyrics-plus:visual:colorful"),
		noise: getConfig("lyrics-plus:visual:noise"),
		["background-color"]: localStorage.getItem("lyrics-plus:visual:background-color") || "var(--spice-main)",
		["active-color"]: localStorage.getItem("lyrics-plus:visual:active-color") || "var(--spice-text)",
		["inactive-color"]: localStorage.getItem("lyrics-plus:visual:inactive-color") || "rgba(var(--spice-rgb-subtext),0.5)",
		["highlight-color"]: localStorage.getItem("lyrics-plus:visual:highlight-color") || "var(--spice-button)",
		alignment: localStorage.getItem("lyrics-plus:visual:alignment") || "center",
		["lines-before"]: localStorage.getItem("lyrics-plus:visual:lines-before") || "0",
		["lines-after"]: localStorage.getItem("lyrics-plus:visual:lines-after") || "2",
		["font-size"]: localStorage.getItem("lyrics-plus:visual:font-size") || "32",
		["translation-mode"]: localStorage.getItem("lyrics-plus:visual:translation-mode") || "furigana",
		["translate"]: getConfig("lyrics-plus:visual:translate"),
		["fade-blur"]: getConfig("lyrics-plus:visual:fade-blur"),
		["fullscreen-key"]: localStorage.getItem("lyrics-plus:visual:fullscreen-key") || "f12",
		["synced-compact"]: getConfig("lyrics-plus:visual:synced-compact"),
		["dual-genius"]: getConfig("lyrics-plus:visual:dual-genius"),
		delay: 0
	},
	providers: {
		netease: {
			on: getConfig("lyrics-plus:provider:netease:on"),
			desc: `Crowdsourced lyrics provider ran by Chinese developers and users.`,
			modes: [KARAOKE, SYNCED, UNSYNCED]
		},
		musixmatch: {
			on: getConfig("lyrics-plus:provider:musixmatch:on"),
			desc: `Fully compatible with Spotify. Requires a token that can be retrieved from the official Musixmatch app. Follow instructions on <a href="https://spicetify.app/docs/faq#sometimes-popup-lyrics-andor-lyrics-plus-seem-to-not-work">Spicetify Docs</a>.`,
			token: localStorage.getItem("lyrics-plus:provider:musixmatch:token") || "21051986b9886beabe1ce01c3ce94c96319411f8f2c122676365e3",
			modes: [SYNCED, UNSYNCED]
		},
		spotify: {
			on: getConfig("lyrics-plus:provider:spotify:on"),
			desc: `Lyrics sourced from official Spotify API.`,
			modes: [SYNCED, UNSYNCED]
		},
		genius: {
			on: getConfig("lyrics-plus:provider:genius:on"),
			desc: `Provide unsynced lyrics with insights from artists themselves.`,
			modes: [GENIUS]
		}
	},
	providersOrder: localStorage.getItem("lyrics-plus:services-order"),
	modes: ["karaoke", "synced", "unsynced", "genius"],
	locked: localStorage.getItem("lyrics-plus:lock-mode") || "-1"
};

try {
	CONFIG.providersOrder = JSON.parse(CONFIG.providersOrder);
	if (!Array.isArray(CONFIG.providersOrder) || Object.keys(CONFIG.providers).length !== CONFIG.providersOrder.length) {
		throw "";
	}
} catch {
	CONFIG.providersOrder = Object.keys(CONFIG.providers);
	localStorage.setItem("lyrics-plus:services-order", JSON.stringify(CONFIG.providersOrder));
}

CONFIG.locked = parseInt(CONFIG.locked);
CONFIG.visual["lines-before"] = parseInt(CONFIG.visual["lines-before"]);
CONFIG.visual["lines-after"] = parseInt(CONFIG.visual["lines-after"]);
CONFIG.visual["font-size"] = parseInt(CONFIG.visual["font-size"]);

const CACHE = {};

const emptyState = {
	karaoke: null,
	synced: null,
	unsynced: null,
	genius: null,
	genius2: null
};

let lyricContainerUpdate;

const fontSizeLimit = { min: 16, max: 256, step: 4 };

class LyricsContainer extends react.Component {
	constructor() {
		super();
		this.state = {
			karaoke: null,
			synced: null,
			unsynced: null,
			genius: null,
			genius2: null,
			romaji: null,
			furigana: null,
			hiragana: null,
			katakana: null,
			neteaseTranslation: null,
			uri: "",
			provider: "",
			colors: {
				background: "",
				inactive: ""
			},
			tempo: "0.25s",
			explicitMode: -1,
			lockMode: CONFIG.locked,
			mode: -1,
			isLoading: false,
			versionIndex: 0,
			versionIndex2: 0,
			isFullscreen: false,
			isFADMode: false
		};
		this.currentTrackUri = "";
		this.nextTrackUri = "";
		this.availableModes = [];
		this.styleVariables = {};
		this.fullscreenContainer = document.createElement("div");
		this.fullscreenContainer.id = "lyrics-fullscreen-container";
		this.mousetrap = new Spicetify.Mousetrap();
		this.containerRef = react.createRef(null);
		this.translator = new Translator();
	}

	infoFromTrack(track) {
		const meta = track?.metadata;
		if (!meta) {
			return null;
		}
		return {
			duration: Number(meta.duration),
			album: meta.album_title,
			artist: meta.artist_name,
			title: meta.title,
			uri: track.uri,
			image: meta.image_url
		};
	}

	async fetchColors(uri) {
		let prominent = 0;
		try {
			const colors = await CosmosAsync.get(`wg://colorextractor/v1/extract-presets?uri=${uri}&format=json`);
			prominent = colors.entries[0].color_swatches[4].color;
		} catch {
			prominent = 0;
		}

		this.setState({
			colors: {
				background: Utils.convertIntToRGB(prominent),
				inactive: Utils.convertIntToRGB(prominent, 3)
			}
		});
	}

	async fetchTempo(uri) {
		const audio = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/audio-features/${uri.split(":")[2]}`);
		let tempo = audio.tempo;

		const MIN_TEMPO = 60,
			MAX_TEMPO = 150;
		const MAX_PERIOD = 0.4;
		if (!tempo) tempo = 105;
		if (tempo < MIN_TEMPO) tempo = MIN_TEMPO;
		if (tempo > MAX_TEMPO) tempo = MAX_TEMPO;

		let period = MAX_PERIOD - ((tempo - MIN_TEMPO) / (MAX_TEMPO - MIN_TEMPO)) * MAX_PERIOD;
		period = Math.round(period * 100) / 100;

		this.setState({
			tempo: String(period) + "s"
		});
	}

	async tryServices(trackInfo, mode = -1) {
		let unsynclyrics;
		for (const id of CONFIG.providersOrder) {
			const service = CONFIG.providers[id];
			if (!service.on) continue;
			if (mode !== -1 && !service.modes.includes(mode)) continue;

			const data = await Providers[id](trackInfo);
			if (!data.error && (data.karaoke || data.synced || data.genius)) {
				CACHE[data.uri] = data;
				return data;
			} else if (!data.error && data.unsynced) {
				unsynclyrics = data;
			}
		}
		if (unsynclyrics) {
			CACHE[unsynclyrics.uri] = unsynclyrics;
			return unsynclyrics;
		}
		const empty = { ...emptyState, uri: trackInfo.uri };
		CACHE[trackInfo.uri] = empty;
		return empty;
	}

	async fetchLyrics(track, mode = -1) {
		this.state.furigana = this.state.romaji = this.state.hiragana = this.state.katakana = this.state.neteaseTranslation = null;
		const info = this.infoFromTrack(track);
		if (!info) {
			this.setState({ error: "No track info" });
			return;
		}

		if (CONFIG.visual.colorful) {
			this.fetchColors(info.uri);
		}

		this.fetchTempo(info.uri);

		if (mode !== -1) {
			if (CACHE[info.uri]?.[CONFIG.modes[mode]]) {
				this.resetDelay();
				this.setState({ ...CACHE[info.uri] });
				this.translateLyrics();
				return;
			}
		} else {
			if (CACHE[info.uri]) {
				this.resetDelay();
				this.setState({ ...CACHE[info.uri] });
				this.translateLyrics();
				return;
			}
		}

		this.setState({ ...emptyState, isLoading: true });
		const resp = await this.tryServices(info, mode);

		// In case user skips tracks too fast and multiple callbacks
		// set wrong lyrics to current track.
		if (resp.uri === this.currentTrackUri) {
			this.resetDelay();
			this.setState({ ...resp, isLoading: false });
		}

		this.translateLyrics();
	}

	async translateLyrics() {
		if (!this.translator || !this.translator.finished) {
			setTimeout(this.translateLyrics.bind(this), 100);
			return;
		}

		const lyricsToTranslate = this.state.synced ?? this.state.unsynced;

		if (!lyricsToTranslate || !Utils.isJapanese(lyricsToTranslate)) return;

		let lyricText = "";
		for (let lyric of lyricsToTranslate) lyricText += lyric.text + "\n";

		[
			["romaji", "spaced", "romaji"],
			["hiragana", "furigana", "furigana"],
			["hiragana", "normal", "hiragana"],
			["katakana", "normal", "katakana"]
		].map(params =>
			this.translator.romajifyText(lyricText, params[0], params[1]).then(result => {
				const translatedLines = result.split("\n");

				this.state[params[2]] = [];

				for (let i = 0; i < lyricsToTranslate.length; i++)
					this.state[params[2]].push({
						startTime: lyricsToTranslate[i].startTime || 0,
						text: Utils.rubyTextToReact(translatedLines[i])
					});
				lyricContainerUpdate && lyricContainerUpdate();
			})
		);
	}

	resetDelay() {
		CONFIG.visual.delay = Number(localStorage.getItem(`lyrics-delay:${Spicetify.Player.data.track.uri}`)) || 0;
	}

	async onVersionChange(items, index) {
		if (this.state.mode === GENIUS) {
			this.setState({
				...emptyLine,
				genius2: this.state.genius2,
				isLoading: true
			});
			const lyrics = await ProviderGenius.fetchLyricsVersion(items, index);
			this.setState({
				genius: lyrics,
				versionIndex: index,
				isLoading: false
			});
		}
	}

	async onVersionChange2(items, index) {
		if (this.state.mode === GENIUS) {
			this.setState({
				...emptyLine,
				genius: this.state.genius,
				isLoading: true
			});
			const lyrics = await ProviderGenius.fetchLyricsVersion(items, index);
			this.setState({
				genius2: lyrics,
				versionIndex2: index,
				isLoading: false
			});
		}
	}

	parseLocalLyrics(lyrics) {
		// Preprocess lyrics by removing [tags] and empty lines
		const lines = lyrics
			.replaceAll(/\[[a-zA-Z]+:.+\]/g, "")
			.trim()
			.split("\n");
		const isSynced = lines[0].match(/\[([0-9:.]+)\]/);
		const unsynced = [];
		const synced = isSynced ? [] : null;

		// TODO: support for karaoke
		// const karaoke = [];
		// const isKaraoke = lyrics.match(/\<([0-9:.]+)\>/);

		function timestampToMiliseconds(timestamp) {
			const [minutes, seconds] = timestamp.replace(/\[\]/, "").split(":");
			return Number(minutes) * 60 * 1000 + Number(seconds) * 1000;
		}

		for (const line of lines) {
			const time = line.match(/\[([0-9:.]+)\]/);
			const lyric = line.replace(/\[([0-9:.]+)\]/, "").trim();

			if (line.trim() !== "") {
				isSynced && time && synced.push({ text: lyric || "♪", startTime: timestampToMiliseconds(time[1]) });
				unsynced.push({ text: lyric || "♪" });
			}
		}

		this.setState({ synced, unsynced, provider: "local" });
		CACHE[this.currentTrackUri] = { synced, unsynced, provider: "local", uri: this.currentTrackUri };
	}

	processLyricsFromFile(event) {
		const file = event.target.files;
		if (!file.length) return;
		const reader = new FileReader();

		if (file[0].size > 1024 * 1024) {
			Spicetify.showNotification("File too large", true);
			return;
		}
		reader.onload = e => {
			this.parseLocalLyrics(e.target.result);
		};
		reader.onerror = e => {
			console.error(e);
			Spicetify.showNotification("Failed to read file", true);
		};

		reader.readAsText(file[0]);
		event.target.value = "";
	}

	componentDidMount() {
		this.onQueueChange = async queue => {
			queue = queue.data;
			this.state.explicitMode = this.state.lockMode;
			this.currentTrackUri = queue.current.uri;

			let nextTrack;
			if (queue.queued.length) {
				nextTrack = queue.queued[0];
			} else {
				nextTrack = queue.nextUp[0];
			}

			const nextInfo = this.infoFromTrack(nextTrack);
			if (!nextInfo) {
				this.fetchLyrics(queue.current, this.state.explicitMode);
				return;
			}
			// Debounce queue change emitter
			if (nextInfo.uri === this.nextTrackUri) {
				return;
			}
			this.nextTrackUri = nextInfo.uri;
			await this.fetchLyrics(queue.current, this.state.explicitMode);
			this.viewPort.scrollTo(0, 0);
			// Fetch next track
			this.tryServices(nextInfo, this.state.explicitMode);
		};

		if (Spicetify.Player?.data?.track) {
			this.state.explicitMode = this.state.lockMode;
			this.currentTrackUri = Spicetify.Player.data.track.uri;
			this.fetchLyrics(Spicetify.Player.data.track, this.state.explicitMode);
		}

		this.updateVisualOnConfigChange();
		Utils.addQueueListener(this.onQueueChange);

		lyricContainerUpdate = () => {
			this.updateVisualOnConfigChange();
			this.forceUpdate();
		};

		this.viewPort = document.querySelector(".Root__main-view .os-viewport");

		this.configButton = new Spicetify.Menu.Item("Lyrics Plus config", false, openConfig);
		this.configButton.register();

		this.onFontSizeChange = event => {
			if (!event.ctrlKey) return;
			let dir = event.deltaY < 0 ? 1 : -1;
			let temp = CONFIG.visual["font-size"] + dir * fontSizeLimit.step;
			if (temp < fontSizeLimit.min) {
				temp = fontSizeLimit.min;
			} else if (temp > fontSizeLimit.max) {
				temp = fontSizeLimit.max;
			}
			CONFIG.visual["font-size"] = temp;
			localStorage.setItem("lyrics-plus:visual:font-size", temp);
			lyricContainerUpdate();
		};

		this.toggleFullscreen = () => {
			const isEnabled = !this.state.isFullscreen;
			if (isEnabled) {
				document.body.append(this.fullscreenContainer);
				document.documentElement.requestFullscreen();
				this.mousetrap.bind("esc", this.toggleFullscreen);
			} else {
				this.fullscreenContainer.remove();
				document.exitFullscreen();
				this.mousetrap.unbind("esc");
			}

			this.setState({
				isFullscreen: isEnabled
			});
		};
		this.mousetrap.reset();
		this.mousetrap.bind(CONFIG.visual["fullscreen-key"], this.toggleFullscreen);
		window.addEventListener("fad-request", lyricContainerUpdate);
	}

	componentWillUnmount() {
		Utils.removeQueueListener(this.onQueueChange);
		this.configButton.deregister();
		this.mousetrap.reset();
		window.removeEventListener("fad-request", lyricContainerUpdate);
	}

	updateVisualOnConfigChange() {
		this.availableModes = CONFIG.modes.filter((_, id) => {
			return Object.values(CONFIG.providers).some(p => p.on && p.modes.includes(id));
		});

		if (!CONFIG.visual.colorful) {
			this.styleVariables = {
				"--lyrics-color-active": CONFIG.visual["active-color"],
				"--lyrics-color-inactive": CONFIG.visual["inactive-color"],
				"--lyrics-color-background": CONFIG.visual["background-color"],
				"--lyrics-highlight-background": CONFIG.visual["highlight-color"],
				"--lyrics-background-noise": CONFIG.visual.noise ? "var(--background-noise)" : "unset"
			};
		}

		this.styleVariables = {
			...this.styleVariables,
			"--lyrics-align-text": CONFIG.visual.alignment,
			"--lyrics-font-size": CONFIG.visual["font-size"] + "px",
			"--animation-tempo": this.state.tempo
		};

		this.mousetrap.reset();
		this.mousetrap.bind(CONFIG.visual["fullscreen-key"], this.toggleFullscreen);
	}

	render() {
		const fadLyricsContainer = document.getElementById("fad-lyrics-plus-container");
		this.state.isFADMode = !!fadLyricsContainer;

		if (this.state.isFADMode) {
			// Text colors will be set by FAD extension
			this.styleVariables = {};
		} else if (CONFIG.visual.colorful) {
			this.styleVariables = {
				"--lyrics-color-active": "white",
				"--lyrics-color-inactive": this.state.colors.inactive,
				"--lyrics-color-background": this.state.colors.background || "transparent",
				"--lyrics-highlight-background": this.state.colors.inactive,
				"--lyrics-background-noise": CONFIG.visual.noise ? "var(--background-noise)" : "unset"
			};
		}

		this.styleVariables = {
			...this.styleVariables,
			"--lyrics-align-text": CONFIG.visual.alignment,
			"--lyrics-font-size": CONFIG.visual["font-size"] + "px",
			"--animation-tempo": this.state.tempo
		};

		let mode = -1;
		if (this.state.explicitMode !== -1) {
			mode = this.state.explicitMode;
		} else if (this.state.lockMode !== -1) {
			mode = this.state.lockMode;
		} else {
			// Auto switch
			if (this.state.karaoke) {
				mode = KARAOKE;
			} else if (this.state.synced) {
				mode = SYNCED;
			} else if (this.state.unsynced) {
				mode = UNSYNCED;
			} else if (this.state.genius) {
				mode = GENIUS;
			}
		}

		const translatedLyrics = this.state[CONFIG.visual["translation-mode"]];
		let activeItem;

		if (mode !== -1) {
			if (mode === KARAOKE && this.state.karaoke) {
				activeItem = react.createElement(CONFIG.visual["synced-compact"] ? SyncedLyricsPage : SyncedExpandedLyricsPage, {
					isKara: true,
					trackUri: this.state.uri,
					lyrics: this.state.karaoke,
					provider: this.state.provider,
					copyright: this.state.copyright
				});
			} else if (mode === SYNCED && this.state.synced) {
				activeItem = react.createElement(CONFIG.visual["synced-compact"] ? SyncedLyricsPage : SyncedExpandedLyricsPage, {
					trackUri: this.state.uri,
					lyrics: CONFIG.visual["translate"] && translatedLyrics ? translatedLyrics : this.state.synced,
					provider: this.state.provider,
					copyright: this.state.copyright
				});
			} else if (mode === UNSYNCED && this.state.unsynced) {
				activeItem = react.createElement(UnsyncedLyricsPage, {
					trackUri: this.state.uri,
					lyrics: CONFIG.visual["translate"] && translatedLyrics ? translatedLyrics : this.state.unsynced,
					provider: this.state.provider,
					copyright: this.state.copyright
				});
			} else if (mode === GENIUS && this.state.genius) {
				activeItem = react.createElement(GeniusPage, {
					isSplitted: CONFIG.visual["dual-genius"],
					trackUri: this.state.uri,
					lyrics: this.state.genius,
					provider: this.state.provider,
					copyright: this.state.copyright,
					versions: this.state.versions,
					versionIndex: this.state.versionIndex,
					onVersionChange: this.onVersionChange.bind(this),
					lyrics2: this.state.genius2,
					versionIndex2: this.state.versionIndex2,
					onVersionChange2: this.onVersionChange2.bind(this)
				});
			}
		}

		if (!activeItem) {
			activeItem = react.createElement(
				"div",
				{
					className: "lyrics-lyricsContainer-LyricsUnavailablePage"
				},
				react.createElement(
					"span",
					{
						className: "lyrics-lyricsContainer-LyricsUnavailableMessage"
					},
					this.state.isLoading ? LoadingIcon : "(• _ • )"
				)
			);
		}

		this.state.mode = mode;
		const hasNeteaseTranslation = this.state.neteaseTranslation !== null;
		const isJapanese = (this.state.synced || this.state.unsynced) && Utils.isJapanese(this.state.synced || this.state.unsynced);
		const showTranslationButton = (isJapanese || hasNeteaseTranslation) && (mode == SYNCED || mode == UNSYNCED);
		const translatorLoaded = this.translator.finished;

		const out = react.createElement(
			"div",
			{
				className:
					"lyrics-lyricsContainer-LyricsContainer" + (CONFIG.visual["fade-blur"] ? " blur-enabled" : "") + (fadLyricsContainer ? " fad-enabled" : ""),
				style: this.styleVariables,
				ref: el => {
					if (!el) return;
					el.onmousewheel = this.onFontSizeChange;
				}
			},
			react.createElement("div", {
				className: "lyrics-lyricsContainer-LyricsBackground"
			}),
			react.createElement(
				"div",
				{
					className: "lyrics-config-button-container"
				},
				react.createElement(TranslationMenu, {
					showTranslationButton,
					translatorLoaded,
					isJapanese,
					hasNeteaseTranslation
				}),
				react.createElement(AdjustmentsMenu, { mode }),
				react.createElement(
					Spicetify.ReactComponent.TooltipWrapper,
					{
						label: "Lyrics from file",
						showDelay: 100
					},
					react.createElement(
						"button",
						{
							className: "lyrics-config-button",
							onClick: () => {
								document.getElementById("lyrics-file-input").click();
							}
						},
						react.createElement("input", {
							type: "file",
							id: "lyrics-file-input",
							accept: ".lrc,.txt",
							onChange: this.processLyricsFromFile.bind(this),
							style: {
								display: "none"
							}
						}),
						react.createElement("svg", {
							width: 16,
							height: 16,
							viewBox: "0 0 16 16",
							fill: "currentColor",
							dangerouslySetInnerHTML: {
								__html: Spicetify.SVGIcons["plus-alt"]
							}
						})
					)
				)
			),
			activeItem,
			!!document.querySelector(".main-topBar-topbarContentWrapper") &&
				react.createElement(TopBarContent, {
					links: this.availableModes,
					activeLink: CONFIG.modes[mode],
					lockLink: CONFIG.modes[this.state.lockMode],
					switchCallback: label => {
						const mode = CONFIG.modes.findIndex(a => a === label);
						if (mode !== this.state.mode) {
							this.setState({ explicitMode: mode });
							this.state.provider !== "local" && this.fetchLyrics(Player.data.track, mode);
						}
					},
					lockCallback: label => {
						let mode = CONFIG.modes.findIndex(a => a === label);
						if (mode === this.state.lockMode) {
							mode = -1;
						}
						this.setState({ explicitMode: mode, lockMode: mode });
						this.fetchLyrics(Player.data.track, mode);
						CONFIG.locked = mode;
						localStorage.setItem("lyrics-plus:lock-mode", mode);
					}
				})
		);

		if (this.state.isFullscreen) {
			return reactDOM.createPortal(out, this.fullscreenContainer);
		} else if (fadLyricsContainer) {
			return reactDOM.createPortal(out, fadLyricsContainer);
		} else {
			return out;
		}
	}
}
