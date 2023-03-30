// Run "npm i @types/react" to have this type package available in workspace
/// <reference types="react" />

/** @type {React} */
const {
	URI,
	React: react,
	React: { useState, useEffect, useCallback },
	ReactDOM: reactDOM,
	Platform: { History },
	CosmosAsync
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

const APP_NAME = "new-releases";

const CONFIG = {
	visual: {
		type: getConfig("new-releases:visual:type", true),
		count: getConfig("new-releases:visual:count", true)
	},
	podcast: getConfig("new-releases:podcast", false),
	music: getConfig("new-releases:music", true),
	album: getConfig("new-releases:album", true),
	["single-ep"]: getConfig("new-releases:single-ep", true),
	["appears-on"]: getConfig("new-releases:appears-on", false),
	compilations: getConfig("new-releases:compilations", false),
	range: localStorage.getItem("new-releases:range") || "30",
	locale: localStorage.getItem("new-releases:locale") || navigator.language,
	relative: getConfig("new-releases:relative", false)
};

let gridList = [];
let lastScroll = 0;

let gridUpdatePostsVisual;

let today = new Date();
CONFIG.range = parseInt(CONFIG.range) || 30;
const DAY_DIVIDER = 24 * 3600 * 1000;
let limitInMs = CONFIG.range * DAY_DIVIDER;
const dateFormat = {
	year: "numeric",
	month: "short",
	day: "2-digit"
};
const relativeDateFormat = {
	numeric: "auto"
};
let separatedByDate = {};
let dateList = [];

class Grid extends react.Component {
	viewportSelector = "#main .os-viewport";

	constructor() {
		super();
		this.state = {
			cards: [],
			rest: true
		};
	}

	updatePostsVisual() {
		gridList = [];
		for (const date of dateList) {
			gridList.push(
				react.createElement(
					"div",
					{
						className: "new-releases-header"
					},
					react.createElement("h2", null, date)
				),
				react.createElement(
					"div",
					{
						className: "main-gridContainer-gridContainer main-gridContainer-fixedWidth",
						style: {
							"--minimumColumnWidth": "180px",
							"--column-width": "minmax(var(--minimumColumnWidth),1fr)",
							"--column-count": "auto-fill",
							"--grid-gap": "24px"
						}
					},
					separatedByDate[date].map(card => react.createElement(Card, card.props))
				)
			);
		}
		this.setState({ cards: [...gridList] });
	}

	async reload() {
		gridList = [];
		separatedByDate = {};
		dateList = [];

		today = new Date();
		CONFIG.range = parseInt(CONFIG.range) || 30;
		limitInMs = CONFIG.range * DAY_DIVIDER;

		this.setState({ rest: false });
		let items = [];
		if (CONFIG.music) {
			let tracks = await fetchTracks();
			items.push(...tracks.flat());
		}
		if (CONFIG.podcast) {
			let episodes = await fetchPodcasts();
			items.push(...episodes);
		}

		items = items.filter(a => a).sort((a, b) => b.time - a.time);

		let timeFormat;
		if (CONFIG.relative) {
			timeFormat = new Intl.RelativeTimeFormat(CONFIG.locale, relativeDateFormat);
		} else {
			timeFormat = new Intl.DateTimeFormat(CONFIG.locale, dateFormat);
		}

		for (const track of items) {
			track.visual = CONFIG.visual;
			let dateStr;
			if (CONFIG.relative) {
				const days = Math.ceil((track.time - today) / DAY_DIVIDER);
				dateStr = timeFormat.format(days, "day");
			} else {
				dateStr = timeFormat.format(track.time);
			}
			if (!separatedByDate[dateStr]) {
				dateList.push(dateStr);
				separatedByDate[dateStr] = [];
			}
			separatedByDate[dateStr].push(react.createElement(Card, track));
		}

		for (const date of dateList) {
			gridList.push(
				react.createElement(
					"div",
					{
						className: "new-releases-header"
					},
					react.createElement("h2", null, date)
				),
				react.createElement(
					"div",
					{
						className: "main-gridContainer-gridContainer main-gridContainer-fixedWidth",
						style: {
							"--minimumColumnWidth": "180px",
							"--column-width": "minmax(var(--minimumColumnWidth),1fr)",
							"--column-count": "auto-fill",
							"--grid-gap": "24px"
						}
					},
					separatedByDate[date]
				)
			);
		}

		this.setState({ rest: true });
	}

	async componentDidMount() {
		gridUpdatePostsVisual = this.updatePostsVisual.bind(this);

		this.configButton = new Spicetify.Menu.Item(
			"New Releases config",
			false,
			openConfig,
			'<svg viewBox="0 0 256 256" width="18px" height="18px" fill="currentColor" style="stroke: currentcolor; stroke-width: 10px;"><path d="M229.84861,182.11168q2.38762,2.80284 2.73874,6.3064t-0.98314,6.37647t-4.21345,4.83491t-6.53085,1.96199l-184.83001,0q-2.94942,0 -5.40726,-1.26128t-3.93255,-3.36341t-2.17695,-4.62469t0,-5.25533t2.52807,-4.97505l18.82008,-21.86218l0,-76.37749q0,-16.81706 6.53085,-32.02249t17.62627,-26.27666t26.33406,-17.58784t32.09245,-6.51661l2.52807,0q16.5729,0.56057 31.53065,7.70782t25.5616,18.77905t16.78358,27.18758t6.17973,32.2327l0,72.87393l18.82008,21.86218zm-193.81871,7.70782l184.83001,0l-21.62904,-25.22559l0,-77.21834q0,-14.71493 -5.40726,-28.16858t-14.60663,-23.40374t-21.90994,-16.04628t-26.61496,-6.51661l-0.63202,0l-0.56179,0l-0.49157,0l-0.56179,0q-14.32573,0 -27.45765,5.60569t-22.61218,15.06528t-15.0982,22.56289t-5.61793,27.3978l0,80.7219l-21.62904,25.22559zm116.01033,41.2018q0,9.66981 -6.95219,16.60685t-16.71335,6.93704t-16.64313,-6.93704t-6.88197,-16.60685l0,-5.88597l11.79766,0l0,5.88597q0,4.90498 3.44098,8.33846t8.35668,3.43348t8.35668,-3.43348t3.44098,-8.33846l0,-5.88597l11.79766,0l0,5.88597z"/></svg>'
		);
		this.configButton.register();

		const viewPort = document.querySelector(this.viewportSelector);

		if (gridList.length) {
			// Already loaded
			if (lastScroll > 0) {
				viewPort.scrollTo(0, lastScroll);
			}
			return;
		}

		this.reload();
	}

	componentWillUnmount() {
		const viewPort = document.querySelector(this.viewportSelector);
		lastScroll = viewPort.scrollTop;
		this.configButton.deregister();
	}

	render() {
		return react.createElement(
			"section",
			{
				className: "contentSpacing"
			},
			react.createElement(
				"div",
				{
					className: "new-releases-header"
				},
				react.createElement("h1", null, Spicetify.Locale.get("new_releases")),
				react.createElement(
					"div",
					{
						className: "new-releases-controls-container"
					},
					react.createElement(ButtonText, {
						text: Spicetify.Locale.get("playlist.extender.refresh"),
						onClick: this.reload.bind(this)
					})
				)
			),
			this.state.rest ? gridList : LoadingIcon
		);
	}
}

async function getArtistList() {
	const body = await CosmosAsync.get("sp://core-collection/unstable/@/list/artists/all?responseFormat=protobufJson", {
		policy: { list: { link: true, name: true } }
	});
	count(true);
	return body.item;
}

async function getArtistEverything(artist) {
	const uid = artist.link.replace("spotify:artist:", "");
	const body = await CosmosAsync.get(`wg://artist/v3/${uid}/desktop/entity?format=json`);
	const releases = body?.releases;
	const items = [];
	const types = [
		[CONFIG.album, releases.albums?.releases, Spicetify.Locale.get("album")],
		[CONFIG["appears-on"], releases.appears_on?.releases, Spicetify.Locale.get("artist.appears-on")],
		[CONFIG.compilations, releases.compilations?.releases, Spicetify.Locale.get("compilation")],
		[CONFIG["single-ep"], releases.singles?.releases, Spicetify.Locale.get("single") + "/" + Spicetify.Locale.get("ep")]
	];
	for (const type of types) {
		if (type[0] && type[1]) {
			for (const item of type[1]) {
				const meta = metaFromTrack(artist, item);
				if (!meta) continue;
				meta.type = type[2];
				items.push(meta);
			}
		}
	}
	return items;
}

async function getPodcastList() {
	const body = await CosmosAsync.get("sp://core-collection/unstable/@/list/shows/all?responseFormat=protobufJson");
	return body.item;
}

async function getPodcastRelease(uri) {
	const body = await CosmosAsync.get(`sp://core-show/v1/shows/${uri}?responseFormat=protobufJson`, {
		policy: { list: { link: true, name: true, publishDate: true } }
	});
	return body.items;
}

function metaFromTrack(artist, track) {
	const time = new Date(track.year, track.month - 1, track.day);
	if (today - time.getTime() < limitInMs) {
		return {
			uri: track.uri,
			title: track.name,
			artist: {
				name: artist.name,
				uri: artist.link
			},
			imageURL: track.cover.uri,
			time,
			trackCount: track.track_count
		};
	}
	return null;
}

var count = (function () {
	var counter = 0;
	return function (reset = false) {
		return reset ? (counter = 0) : counter++;
	};
})();

async function fetchTracks() {
	let artistList = await getArtistList();
	Spicetify.showNotification(`Fetching releases from ${artistList.length} artists`);

	const requests = artistList.map(async obj => {
		const artist = obj.artistMetadata;
		return await getArtistEverything(artist).catch(err => {
			console.debug("Could not fetch all releases - error code: " + err.status);
			if ((err.status = 500)) {
				console.debug(`Missing releases from ${count()} artists`);
			}
		});
	});

	return await Promise.all(requests);
}

async function fetchPodcasts() {
	const items = [];
	const itemTypeStr = Spicetify.Locale.get("card.tag.episode");
	for (const obj of await getPodcastList()) {
		const podcast = obj.showMetadata;
		const id = podcast.link.replace("spotify:show:", "");

		const tracks = await getPodcastRelease(id);
		if (!tracks) continue;

		for (const track of tracks) {
			const time = new Date(track.episodeMetadata.publishDate * 1000);

			if (today - time.getTime() > limitInMs) {
				break;
			}

			items.push({
				uri: track.episodeMetadata.link,
				title: track.episodeMetadata.name,
				artist: {
					name: podcast.name,
					uri: podcast.link
				},
				imageURL: podcast.covers.standardLink,
				time,
				type: itemTypeStr
			});
		}
	}

	return items;
}
