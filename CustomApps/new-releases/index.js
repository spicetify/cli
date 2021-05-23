// Run "npm i @type/react" to have this type package available in workspace
/// <reference types="react" />

/** @type {React} */
const {
    URI,
    React: react,
    React: { useState, useEffect, useCallback },
    ReactDOM: reactDOM,
    Platform: { History },
    CosmosAsync,
} = Spicetify;

// Define a function called "render" to specify app entry point
// This function will be used to mount app to main view.
function render() {
    return react.createElement(Grid);
}

function getConfig(name, defaultVal = true) {
    const value = localStorage.getItem(name);
    return value ? value === "true" : defaultVal;
}

const CONFIG = {
    visual: {
        type: getConfig("new-release:type"),
    },
    podcast: getConfig("new-release:podcast", false),
    tracks: getConfig("new-release:tracks", true),
    everything: getConfig("new-release:everything", true),
};

let gridList = [];
let lastScroll = 0;

let gridUpdatePostsVisual;
const today = new Date();
const DAYS_LIMIT = 30;
const limitInMs = DAYS_LIMIT * 24 * 3600 * 1000;
var options = {
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "numeric"
};
let seperatedByDate = {};
let dateList = [];

class Grid extends react.Component {
    constructor() {
        super();
        this.state = {
            cards: [],
            rest: true,
        }
    }

    updatePostsVisual() {
        gridList = gridList.map(card => {
            return react.createElement(Card, card.props);
        });
        this.setState({ cards: [...gridList] });
    }

    async loadAmount() {
        if (dateList.length) {
            this.setState({ cards: [...gridList] });
            return;
        }

        this.setState({ rest: false });
        let items = [];
        if (CONFIG.tracks) {
            let tracks = await fetchTracks();
            items.push(...(tracks.flat()));
        }
        if (CONFIG.podcast) {
            let episodes = await fetchPodcasts();
            items.push(...episodes);
        }

        // TODO: Config sort Asc, desc
        items = items.filter(a => a).sort((a, b) => b.time - a.time);

        for (const track of items) {
            track.visual = CONFIG.visual;
            track.time = track.time.toLocaleDateString(navigator.language, options);
            if (!seperatedByDate[track.time]) {
                dateList.push(track.time);
                seperatedByDate[track.time] = [];
            }
            seperatedByDate[track.time].push(react.createElement(Card, track));
        }

        for (const date of dateList) {
            gridList.push(react.createElement("div", {
                className: "new-releases-header"
            }, react.createElement("h2", null, date)),
            react.createElement("div", {
                className: "main-gridContainer-gridContainer",
                style: {
                    "--minimumColumnWidth": "180px"
                },
            }, seperatedByDate[date]));
        }

        this.setState({ cards: [...gridList] });
        this.setState({ rest: true });
    }

    async componentDidMount() {
        gridUpdatePostsVisual = this.updatePostsVisual.bind(this);

        const viewPort = document.querySelector("main .os-viewport");

        if (gridList.length) { // Already loaded
            if (lastScroll > 0) {
                viewPort.scrollTo(0, lastScroll);
            }
            return;
        }

        this.loadAmount();
    }

    componentWillUnmount() {
        const viewPort = document.querySelector("main .os-viewport");
        lastScroll = viewPort.scrollTop;
    }

    render() {
        return react.createElement("section", {
            className: "contentSpacing"
        },  this.state.rest ? gridList : LoadingIcon);
    }
}

async function getArtistList() {
    const body = await CosmosAsync.get("sp://core-collection/unstable/@/list/artists/all?responseFormat=protobufJson");
    return body.item;
}

async function getArtistNewRelease(uri) {
    const body = await CosmosAsync.get(`hm://artist/v3/${uri}/desktop/entity?format=json`);
    return body.latest_release;
}

async function getArtistEverything(uri) {
    const body = await CosmosAsync.get(`hm://artist/v3/${uri}/desktop/entity?format=json`);
    const releases = body?.releases;
    const items = [];
    if (releases?.albums?.releases) items.push(...releases.albums.releases);
    if (releases?.appears_on?.releases) items.push(...releases.appears_on.releases);
    if (releases?.compilations?.releases) items.push(...releases.compilations.releases);
    if (releases?.singles?.releases) items.push(...releases.singles.releases);
    return items;
}

async function getPodcastList() {
    const body = await CosmosAsync.get("sp://core-collection/unstable/@/list/shows/all?responseFormat=protobufJson");
    return body.item;
}

async function getPodcastRelease(uri) {
    const body = await CosmosAsync.get(`sp://core-show/unstable/show/${uri}`);
    return body.items;
}

function metaFromTrack(artist, track) {
    const time = new Date(track.year, track.month - 1, track.day)
    if ((today - time.getTime()) < limitInMs) {
        let type;
        if (track.track_count <= 3) {
            type = "Single"
        } else if (track.track_count <= 6) {
            type = "EP"
        } else {
            type = "Album"
        }

        return ({
            uri: track.uri,
            title: track.name,
            artist,
            imageURL: track.cover.uri,
            time,
            type,
        })
    }
    return null;
}

async function fetchTracks() {
    let artistList = await getArtistList()

    const requests = artistList.map(async (obj) => {
        const artist = obj.artistMetadata;
        var isfollowed = obj.artistCollectionState.followed;

	/*if (CONFIG.everything) {
            const releases = await getArtistEverything(artist.link.replace("spotify:artist:", ""))
            return releases.map(r => metaFromTrack(artist.name, r));
        }*/

        if (isfollowed) {
        const track = await getArtistNewRelease(artist.link.replace("spotify:artist:", ""))
        if (!track) return null;
        return metaFromTrack(artist.name, track);
        } else {
	return null;
	}
    })

    return await Promise.all(requests)
}

async function fetchPodcasts() {
    const items = [];
    for (const obj of await getPodcastList()) {
        const podcast = obj.showMetadata;
        const id = podcast.link.replace("spotify:show:", "");

        const tracks = await getPodcastRelease(id);
        if (!tracks) continue;

        for (const track of tracks) {
            const time = new Date(track.publishDate * 1000);

            if ((today - time.getTime()) > limitInMs) {
                break;
            }

            items.push(({
                uri: track.link,
                title: track.name,
                artist: podcast.name,
                imageURL: track.covers.default,
                time,
                type: "Episode",
            }));
        }
    }

    return items;
}
