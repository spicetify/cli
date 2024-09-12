// Run "npm i @types/react" to have this type package available in workspace
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

const APP_NAME = "new-releases";

const CONFIG = {
	visual: {
		type: getConfig("new-releases:visual:type", true),
		count: getConfig("new-releases:visual:count", true),
	},
	podcast: getConfig("new-releases:podcast", false),
	music: getConfig("new-releases:music", true),
	album: getConfig("new-releases:album", true),
	"single-ep": getConfig("new-releases:single-ep", true),
	// ["appears-on"]: getConfig("new-releases:appears-on", false),
	compilations: getConfig("new-releases:compilations", false),
	range: localStorage.getItem("new-releases:range") || "30",
	locale: localStorage.getItem("new-releases:locale") || navigator.language,
	relative: getConfig("new-releases:relative", false),
};

let dismissed;
try {
	dismissed = JSON.parse(Spicetify.LocalStorage.get("new-releases:dismissed"));
	if (!Array.isArray(dismissed)) throw "";
} catch {
	dismissed = [];
}

let gridList = [];
let lastScroll = 0;

let gridUpdatePostsVisual;
let removeCards;

let today = Date.now();
CONFIG.range = Number.parseInt(CONFIG.range) || 30;
const DAY_DIVIDER = 24 * 3600 * 1000;
let limitInMs = CONFIG.range * DAY_DIVIDER;
const dateFormat = {
	year: "numeric",
	month: "short",
	day: "2-digit",
};
const relativeDateFormat = {
	numeric: "auto",
};
let separatedByDate = {};
let dateList = [];

class Grid extends react.Component {
	viewportSelector = document.querySelector("#main .os-viewport") ? "#main .os-viewport" : "#main .main-view-container__scroll-node";

	constructor() {
		super();
		this.state = {
			cards: [],
			rest: true,
		};
	}

	updatePostsVisual() {
		gridList = [];
		for (const date of dateList) {
			if (separatedByDate[date].every((card) => dismissed.includes(card.props.uri))) continue;

			gridList.push(
				react.createElement(
					"div",
					{
						className: "new-releases-header",
					},
					react.createElement("h2", null, date)
				),
				react.createElement(
					"div",
					{
						className: "main-gridContainer-gridContainer ",
						style: {
							"--min-container-width": "180px",
							"--column-count": "auto-fill",
							"--grid-gap": "18px",
						},
					},
					separatedByDate[date]
						.filter((card) => !dismissed.includes(card.props.uri))
						.map((card) => react.createElement(Card, { ...card.props, key: card.props.uri }))
				)
			);
		}
		this.setState({ cards: [...gridList] });
	}

	removeCards(id, type) {
		switch (type) {
			case "reset":
				Spicetify.showNotification("Reset dismissed releases");
				dismissed = [];
				break;
			case "undo":
				if (!dismissed[0]) Spicetify.showNotification("Nothing to undo", true);
				else Spicetify.showNotification("Undone dismissal");
				dismissed = id ? dismissed.filter((item) => item !== id) : dismissed.slice(0, -1);
				break;
			default:
				dismissed.push(id);
				break;
		}
		Spicetify.LocalStorage.set("new-releases:dismissed", JSON.stringify(dismissed));
		this.updatePostsVisual();
	}

	async reload() {
		gridList = [];
		separatedByDate = {};
		dateList = [];

		today = Date.now();
		CONFIG.range = Number.parseInt(CONFIG.range) || 30;
		limitInMs = CONFIG.range * DAY_DIVIDER;

		this.setState({ rest: false });
		let items = [];
		if (CONFIG.music) {
			const tracks = await fetchTracks();
			items.push(...tracks.flat());
		}
		if (CONFIG.podcast) {
			const episodes = await fetchPodcasts();
			items.push(...episodes);
		}

		items = items.filter(Boolean).sort((a, b) => b.time - a.time);

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
			separatedByDate[dateStr].push(react.createElement(Card, { ...track, key: track.uri }));
		}

		for (const date of dateList) {
			if (separatedByDate[date].every((card) => dismissed.includes(card.props.uri))) continue;

			gridList.push(
				react.createElement(
					"div",
					{
						className: "new-releases-header",
					},
					react.createElement("h2", null, date)
				),
				react.createElement(
					"div",
					{
						className: "main-gridContainer-gridContainer",
						style: {
							"--min-container-width": "180px",
							"--column-count": "auto-fill",
							"--grid-gap": "18px",
						},
					},
					separatedByDate[date].filter((card) => !dismissed.includes(card.props.uri))
				)
			);
		}

		this.setState({ rest: true });
	}

	async componentDidMount() {
		gridUpdatePostsVisual = this.updatePostsVisual.bind(this);
		removeCards = this.removeCards.bind(this);

		this.configButton = new Spicetify.Menu.Item(
			"New Releases config",
			false,
			openConfig,
			'<svg viewBox="0 0 256 256" width="16" height="16" fill="currentColor" style="stroke: currentcolor; stroke-width: 10px;"><path d="M229.84861,182.11168q2.38762,2.80284 2.73874,6.3064t-0.98314,6.37647t-4.21345,4.83491t-6.53085,1.96199l-184.83001,0q-2.94942,0 -5.40726,-1.26128t-3.93255,-3.36341t-2.17695,-4.62469t0,-5.25533t2.52807,-4.97505l18.82008,-21.86218l0,-76.37749q0,-16.81706 6.53085,-32.02249t17.62627,-26.27666t26.33406,-17.58784t32.09245,-6.51661l2.52807,0q16.5729,0.56057 31.53065,7.70782t25.5616,18.77905t16.78358,27.18758t6.17973,32.2327l0,72.87393l18.82008,21.86218zm-193.81871,7.70782l184.83001,0l-21.62904,-25.22559l0,-77.21834q0,-14.71493 -5.40726,-28.16858t-14.60663,-23.40374t-21.90994,-16.04628t-26.61496,-6.51661l-0.63202,0l-0.56179,0l-0.49157,0l-0.56179,0q-14.32573,0 -27.45765,5.60569t-22.61218,15.06528t-15.0982,22.56289t-5.61793,27.3978l0,80.7219l-21.62904,25.22559zm116.01033,41.2018q0,9.66981 -6.95219,16.60685t-16.71335,6.93704t-16.64313,-6.93704t-6.88197,-16.60685l0,-5.88597l11.79766,0l0,5.88597q0,4.90498 3.44098,8.33846t8.35668,3.43348t8.35668,-3.43348t3.44098,-8.33846l0,-5.88597l11.79766,0l0,5.88597z"/></svg>'
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
		const expFeatures = JSON.parse(localStorage.getItem("spicetify-exp-features") || "{}");
		const isGlobalNav = expFeatures?.enableGlobalNavBar?.value !== "control";
		const version = Spicetify.Platform.version.split(".").map((i) => Number.parseInt(i));

		const tabBarMargin = {
			marginTop: isGlobalNav || (version[0] === 1 && version[1] === 2 && version[2] >= 45) ? "60px" : "0px",
		};
		return react.createElement(
			"section",
			{
				className: "contentSpacing",
			},
			react.createElement(
				"div",
				{
					className: "new-releases-header",
					style: tabBarMargin,
				},
				react.createElement("h1", null, Spicetify.Locale.get("new_releases")),
				react.createElement(
					"div",
					{
						className: "new-releases-controls-container",
					},
					react.createElement(ButtonText, {
						text: Spicetify.Locale.get("playlist.extender.refresh"),
						onClick: this.reload.bind(this),
					}),
					react.createElement(ButtonText, {
						text: "undo", // no locale for this
						onClick: this.removeCards.bind(this, null, "undo"),
					})
				)
			),
			this.state.rest ? gridList : LoadingIcon
		);
	}
}

async function getArtistList() {
	const config = {
		filters: ["1"],
		sortOrder: ["0"],
		textFilter: "",
		offset: 0,
		limit: 50000,
	};
	const artists = await Spicetify.Platform.LibraryAPI.getContents(config);
	count(true);
	return artists.items ?? [];
}

async function getArtistEverything(artist) {
	const { data, errors } = await Spicetify.GraphQL.Request(
		{
			name: "queryArtistDiscographyAll",
			operation: "query",
			sha256Hash: "9380995a9d4663cbcb5113fef3c6aabf70ae6d407ba61793fd01e2a1dd6929b0",
			value: null,
		},
		{
			uri: artist.uri,
			offset: 0,
			// Limit 100 since GraphQL has resource limit
			limit: 100,
		}
	);
	if (errors) throw errors;

	const releases = data?.artistUnion.discography.all.items.flatMap((r) => r.releases.items);
	const items = [];
	const types = [
		[CONFIG.album, releases.filter((r) => r.type === "ALBUM"), Spicetify.Locale.get("album")],
		// Appears on has a separate GraphQL query but does not provide enough information (release date), which requires recursively making requests for each album
		// [CONFIG["appears-on"], releases.appears_on?.releases, Spicetify.Locale.get("artist.appears-on")],
		[CONFIG.compilations, releases.filter((r) => r.type === "COMPILATION"), Spicetify.Locale.get("compilation")],
		[
			CONFIG["single-ep"],
			releases.filter((r) => r.type === "SINGLE" || r.type === "EP"),
			`${Spicetify.Locale.get("single")}/${Spicetify.Locale.get("ep")}`,
		],
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
	const body = await Spicetify.Platform.LibraryAPI.getShows({ limit: 50000 });
	return body.items ?? [];
}

async function getPodcastRelease(uri) {
	const body = await Spicetify.Platform.ShowAPI.getContents(uri, { limit: 50000 });
	return body.items;
}

function metaFromTrack(artist, track) {
	const time = Date.parse(track.date.isoString);
	if (today - time < limitInMs) {
		return {
			uri: track.uri,
			title: track.name,
			artist: {
				name: artist.name,
				uri: artist.uri,
			},
			imageURL: track.coverArt.sources.reduce((prev, curr) => (prev.width > curr.width ? prev : curr)).url,
			time,
			trackCount: track.tracks.totalCount,
		};
	}
	return null;
}

const count = (() => {
	let counter = 0;
	return (reset = false) => {
		if (reset) counter = 0;
		else counter++;
	};
})();

async function fetchTracks() {
	const artistList = await getArtistList();
	Spicetify.showNotification(`Fetching releases from ${artistList.length} artists`);

	const requests = artistList.map(async (obj) => {
		return await getArtistEverything(obj).catch((err) => {
			console.debug("Could not fetch all releases", err);
			console.debug(`Missing releases from ${count()} artists`);
		});
	});

	return await Promise.all(requests);
}

async function fetchPodcasts() {
	const items = [];
	const itemTypeStr = Spicetify.Locale.get("card.tag.episode");
	for (const podcast of await getPodcastList()) {
		const tracks = await getPodcastRelease(podcast.uri);
		if (!tracks) continue;

		for (const track of tracks) {
			const time = new Date(track.releaseDate.isoString);

			if (today - time.getTime() > limitInMs) {
				break;
			}

			items.push({
				uri: track.uri,
				title: track.name,
				artist: {
					name: podcast.name,
					uri: podcast.uri,
				},
				imageURL: track.coverArt.reduce((prev, curr) => (prev.width > curr.width ? prev : curr)).url,
				time,
				type: itemTypeStr,
			});
		}
	}

	return items;
}
