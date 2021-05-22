// Run "npm i @type/react" to have this type package available in workspace
/// <reference types="react" />
/// <reference path="../../globals.d.ts" />

/** @type {React} */
const react = Spicetify.React;
const { useState, useEffect, useMemo, useRef } = react;
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

// Modes enum
const KARAOKE = 0, SYNCED = 1, UNSYNCED = 2, GENIUS = 3;

const CONFIG = {
    visual: {
        colorful: getConfig("lyrics-plus:colorful"),
    },
    providers: {
        netease: {
            on: getConfig("lyrics-plus:provider:netease:on"),
            desc: `Crowd sourced lyrics provider running by Chinese developers and users.`,
            modes: [KARAOKE, SYNCED, UNSYNCED],
        },
        musixmatch: {
            on: getConfig("lyrics-plus:provider:musixmatch:on"),
            desc: `Fully compatible with Spotify. Require a token that can be retrieved from Musixmatch offical app. Follow instructions on <a href="https://github.com/khanhas/spicetify-cli/wiki/Musixmatch-Token">spicetify Wiki</a>.`,
            token: localStorage.getItem("popup-lyrics:services:musixmatch:token") || "21051986b9886beabe1ce01c3ce94c96319411f8f2c122676365e3",
            modes: [SYNCED, UNSYNCED],
        },
        spotify: {
            on: getConfig("lyrics-plus:provider:spotify:on"),
            desc: `Lyrics are offically provided by Spotify. Only available for some regions/countries' users (e.g Japan, Vietnam, Thailand).`,
            modes: [SYNCED, UNSYNCED],
        },
        genius: {
            on: getConfig("lyrics-plus:provider:genius:on"),
            desc: `Brilliant`,
            modes: [GENIUS],
        }
    },
    providersOrder: [],
    modes: ["karaoke", "synced", "unsynced", "genius"],
    locked: localStorage.getItem("lyrics-plus:lock-mode") || "-1",
};

try {
    CONFIG.providersOrder = JSON.parse(CONFIG.providersOrder);
    if (
        !Array.isArray(CONFIG.providers) ||
        Object.keys(CONFIG.providers).length !== CONFIG.providersOrder.length
    ) {
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
        };
        this.currentTrackUri = "";
        this.nextTrackUri = "";
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
        let prominent = 0
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

    async fetchAudio(uri) {
        const audio = await Spicetify.getAudioData(uri);
        console.log(audio)
    }

    async tryServices(trackInfo, mode = -1) {
        for (const id of CONFIG.providersOrder) {
            const service = CONFIG.providers[id];
            if (!service.on) continue;
            if (mode !== -1 && !service.modes.includes(mode)) continue;

            const data = await Providers[id](trackInfo);
            if (!data.error) {
                CACHE[data.uri] = data;
                // In case user skips tracks too fast and multiple callbacks
                // set wrong lyrics to current track.
                if (data.uri === this.currentTrackUri) {
                    return CACHE[data.uri];
                }
            } else {
                CACHE[data.uri] = { ...emptyState };
            }
            return { ...emptyState };
        }
    }

    async fetchLyrics(track, mode = -1) {
        const info = this.infoFromTrack(track);
        if (!info) {
            this.setState({ error: "No track info" });
            return;
        }

        this.fetchColors(info.uri);

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
        this.setState({ ...resp, isLoading: false });
    }

    componentDidMount() {
        this.onQueueChange = async (queue) => {
            this.state.explicitMode = this.state.lockMode;
            this.currentTrackUri = queue.track.uri;
            const [nextTrack] = queue.future;
            const nextInfo = this.infoFromTrack(nextTrack);
            if (!nextInfo) {
                this.fetchLyrics(queue.track, this.state.explicitMode);
                return;
            }
            // Debounce queue change emmitter
            if (nextInfo?.uri === this.nextTrackUri) {
                return;
            }
            this.nextTrackUri = nextInfo.uri;
            await this.fetchLyrics(queue.track, this.state.explicitMode);
            // Fetch next track
            this.tryServices(nextInfo);
        };

        Utils.addQueueListener(this.onQueueChange);
    }

    componentWillUnmount() {
        Utils.removeQueueListener(this.onQueueChange);
    }

    render() {
        const colorVariables = {
            '--lyrics-color-active': "white",
            '--lyrics-color-inactive': this.state.colors.inactive,
            '--lyrics-color-background': this.state.colors.background || "black",
        };

        let mode = -1;
        if (this.state.explicitMode !== -1) {
            mode = this.state.explicitMode;

        }  else if (this.state.lockMode !== -1) {
            mode = this.state.lockMode;

        } else { // Auto switch
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
                });
            }
        }

        if (!activeItem) {
            activeItem = react.createElement("div", {
                className: "lyrics-lyricsContainer-LyricsUnavailablePage",
            }, react.createElement("span", {
                className: "lyrics-lyricsContainer-LyricsUnavailableMessage",
            }, this.state.isLoading ? LoadingIcon : "(• _ • )"));
        }

        this.state.mode = mode;

        return react.createElement("div", {
            className: "lyrics-lyricsContainer-LyricsContainer",
            style: colorVariables,
        }, react.createElement("div", {
            className: "lyrics-lyricsContainer-LyricsBackground",
        }), activeItem,
            react.createElement(TopBarContent, {
                links: CONFIG.modes,
                activeLink: CONFIG.modes[mode],
                lockLink: CONFIG.modes[this.state.lockMode],
                switchCallback: (event) => {
                    const label = event.target.value || event.target.textContent;
                    const mode  = CONFIG.modes.findIndex(a => a === label);
                    if (mode !== this.state.mode) {
                        this.setState({ explicitMode: mode });
                        this.fetchLyrics(Player.data.track, mode);
                    }
                    event.preventDefault();
                },
                lockCallback: (event) => {
                    const label = event.target.value || event.target.textContent;
                    let mode  = CONFIG.modes.findIndex(a => a === label);
                    if (mode === this.state.lockMode) {
                        mode = -1;
                    }
                    this.setState({ lockMode: mode });
                    CONFIG.locked = mode;
                    localStorage.setItem("lyrics-plus:lock-mode", mode);
                    event.preventDefault();
                },
            }));
    }
}
