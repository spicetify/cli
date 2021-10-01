// Run "npm i @type/react" to have this type package available in workspace
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
    CosmosAsync,
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
    },
    providers: {
        netease: {
            on: getConfig("lyrics-plus:provider:netease:on"),
            desc: `Crowdsourced lyrics provider ran by Chinese developers and users.`,
            modes: [KARAOKE, SYNCED, UNSYNCED],
        },
        musixmatch: {
            on: getConfig("lyrics-plus:provider:musixmatch:on"),
            desc: `Fully compatible with Spotify. Requires a token that can be retrieved from the official Musixmatch app. Follow instructions on <a href="https://github.com/khanhas/spicetify-cli/wiki/Musixmatch-Token">spicetify Wiki</a>.`,
            token: localStorage.getItem("lyrics-plus:provider:musixmatch:token") || "21051986b9886beabe1ce01c3ce94c96319411f8f2c122676365e3",
            modes: [SYNCED, UNSYNCED],
        },
        spotify: {
            on: getConfig("lyrics-plus:provider:spotify:on"),
            desc: `Lyrics officially provided by Spotify. Only available for some regions/countries' users (e.g., Japan, Vietnam, Thailand).`,
            modes: [SYNCED, UNSYNCED],
        },
        genius: {
            on: getConfig("lyrics-plus:provider:genius:on"),
            desc: `Provide unsynced lyrics with insights from artists themselves.`,
            modes: [GENIUS],
        },
    },
    providersOrder: localStorage.getItem("lyrics-plus:services-order"),
    modes: ["karaoke", "synced", "unsynced", "genius"],
    locked: localStorage.getItem("lyrics-plus:lock-mode") || "-1",
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

const CACHE = {};

const emptyState = {
    karaoke: null,
    synced: null,
    unsynced: null,
    genius: null,
};

let lyricContainerUpdate;

class LyricsContainer extends react.Component {
    constructor() {
        super();
        this.state = {
            karaoke: null,
            synced: null,
            unsynced: null,
            genius: null,
            uri: "",
            provider: "",
            colors: {
                background: "",
                inactive: "",
            },
            explicitMode: -1,
            lockMode: CONFIG.locked,
            mode: -1,
            isLoading: false,
            versionIndex: 0,
        };
        this.currentTrackUri = "";
        this.nextTrackUri = "";
        this.availableModes = [];
        this.styleVariables = {};
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
            image: meta.image_url,
        };
    }

    async fetchColors(uri) {
        let prominent = 0;
        try {
            const colors = await CosmosAsync.get(`hm://colorextractor/v1/extract-presets?uri=${uri}&format=json`);
            prominent = colors.entries[0].color_swatches[4].color;
        } catch {
            prominent = 0;
        }

        this.setState({
            colors: {
                background: Utils.convertIntToRGB(prominent),
                inactive: Utils.convertIntToRGB(prominent, 3),
            },
        });
    }

    async tryServices(trackInfo, mode = -1) {
        for (const id of CONFIG.providersOrder) {
            const service = CONFIG.providers[id];
            if (!service.on) continue;
            if (mode !== -1 && !service.modes.includes(mode)) continue;

            const data = await Providers[id](trackInfo);
            if (!data.error && (data.karaoke || data.synced || data.unsynced || data.genius)) {
                CACHE[data.uri] = data;
                return data;
            }
        }
        const empty = { ...emptyState, uri: trackInfo.uri };
        CACHE[trackInfo.uri] = empty;
        return empty;
    }

    async fetchLyrics(track, mode = -1) {
        const info = this.infoFromTrack(track);
        if (!info) {
            this.setState({ error: "No track info" });
            return;
        }

        if (CONFIG.visual.colorful) {
            this.fetchColors(info.uri);
        }

        if (mode !== -1) {
            if (CACHE[info.uri]?.[CONFIG.modes[mode]]) {
                this.setState({ ...CACHE[info.uri] });
                return;
            }
        } else {
            if (CACHE[info.uri]) {
                this.setState({ ...CACHE[info.uri] });
                return;
            }
        }

        this.setState({ ...emptyState, isLoading: true });
        const resp = await this.tryServices(info, mode);
        // In case user skips tracks too fast and multiple callbacks
        // set wrong lyrics to current track.
        if (resp.uri === this.currentTrackUri) {
            this.setState({ ...resp, isLoading: false });
        }
    }

    async onVersionChange(items, index) {
        if (this.state.mode === GENIUS) {
            this.setState({ ...emptyState, isLoading: true });
            const lyrics = await ProviderGenius.fetchLyricsVersion(items, index);
            this.setState({
                genius: lyrics,
                versionIndex: index,
                isLoading: false,
            });
        }
    }

    componentDidMount() {
        this.onQueueChange = async (queue) => {
            queue = queue.data;
            this.state.explicitMode = this.state.lockMode;
            this.currentTrackUri = queue.current.uri;
            const nextTrack = queue.nextUp[0];
            const nextInfo = this.infoFromTrack(nextTrack);
            if (!nextInfo) {
                this.fetchLyrics(queue.current, this.state.explicitMode);
                return;
            }
            // Debounce queue change emitter
            if (nextInfo?.uri === this.nextTrackUri) {
                return;
            }
            this.nextTrackUri = nextInfo.uri;
            await this.fetchLyrics(queue.current, this.state.explicitMode);
            this.viewPort.scrollTo(0, 0);
            // Fetch next track
            this.tryServices(nextInfo, this.state.explicitMode);
        };

        if (Spicetify.Player && Spicetify.Player.data && Spicetify.Player.data.track) {
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
    }

    componentWillUnmount() {
        Utils.removeQueueListener(this.onQueueChange);
        this.configButton.deregister();
    }

    updateVisualOnConfigChange() {
        this.availableModes = CONFIG.modes.filter((_, id) => {
            return Object.values(CONFIG.providers).some((p) => p.on && p.modes.includes(id));
        });

        if (!CONFIG.visual.colorful) {
            this.styleVariables = {
                "--lyrics-color-active": CONFIG.visual["active-color"],
                "--lyrics-color-inactive": CONFIG.visual["inactive-color"],
                "--lyrics-color-background": CONFIG.visual["background-color"],
                "--lyrics-highlight-background": CONFIG.visual["highlight-color"],
                "--lyrics-background-noise": CONFIG.visual.noise ? "var(--background-noise)" : "unset",
            };
        }

        this.styleVariables = {
            ...this.styleVariables,
            "--lyrics-align-text": CONFIG.visual.alignment,
        };
    }

    render() {
        if (CONFIG.visual.colorful) {
            this.styleVariables = {
                "--lyrics-color-active": "white",
                "--lyrics-color-inactive": this.state.colors.inactive,
                "--lyrics-color-background": this.state.colors.background || "transparent",
                "--lyrics-highlight-background": this.state.colors.inactive,
                "--lyrics-background-noise": CONFIG.visual.noise ? "var(--background-noise)" : "unset",
            };
        }

        this.styleVariables = {
            ...this.styleVariables,
            "--lyrics-align-text": CONFIG.visual.alignment,
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

        let activeItem;

        if (mode !== -1) {
            if (mode === KARAOKE && this.state.karaoke) {
                activeItem = react.createElement(KaraokeLyricsPage, {
                    trackUri: this.state.uri,
                    lyrics: this.state.karaoke,
                    provider: this.state.provider,
                    copyright: this.state.copyright,
                });
            } else if (mode === SYNCED && this.state.synced) {
                activeItem = react.createElement(SyncedLyricsPage, {
                    trackUri: this.state.uri,
                    lyrics: this.state.synced,
                    provider: this.state.provider,
                    copyright: this.state.copyright,
                });
            } else if (mode === UNSYNCED && this.state.unsynced) {
                activeItem = react.createElement(UnsyncedLyricsPage, {
                    trackUri: this.state.uri,
                    lyrics: this.state.unsynced,
                    provider: this.state.provider,
                    copyright: this.state.copyright,
                });
            } else if (mode === GENIUS && this.state.genius) {
                activeItem = react.createElement(GeniusPage, {
                    trackUri: this.state.uri,
                    lyrics: this.state.genius,
                    provider: this.state.provider,
                    copyright: this.state.copyright,
                    versions: this.state.versions,
                    versionIndex: this.state.versionIndex,
                    onVersionChange: this.onVersionChange.bind(this),
                });
            }
        }

        if (!activeItem) {
            activeItem = react.createElement(
                "div",
                {
                    className: "lyrics-lyricsContainer-LyricsUnavailablePage",
                },
                react.createElement(
                    "span",
                    {
                        className: "lyrics-lyricsContainer-LyricsUnavailableMessage",
                    },
                    this.state.isLoading ? LoadingIcon : "(• _ • )"
                )
            );
        }

        this.state.mode = mode;

        return react.createElement(
            "div",
            {
                className: "lyrics-lyricsContainer-LyricsContainer",
                style: this.styleVariables,
            },
            react.createElement("div", {
                className: "lyrics-lyricsContainer-LyricsBackground",
            }),
            activeItem,
            react.createElement(TopBarContent, {
                links: this.availableModes,
                activeLink: CONFIG.modes[mode],
                lockLink: CONFIG.modes[this.state.lockMode],
                switchCallback: (label) => {
                    const mode = CONFIG.modes.findIndex((a) => a === label);
                    if (mode !== this.state.mode) {
                        this.setState({ explicitMode: mode });
                        this.fetchLyrics(Player.data.track, mode);
                    }
                },
                lockCallback: (label) => {
                    let mode = CONFIG.modes.findIndex((a) => a === label);
                    if (mode === this.state.lockMode) {
                        mode = -1;
                    }
                    this.setState({ explicitMode: mode, lockMode: mode });
                    this.fetchLyrics(Player.data.track, mode);
                    CONFIG.locked = mode;
                    localStorage.setItem("lyrics-plus:lock-mode", mode);
                },
            })
        );
    }
}
