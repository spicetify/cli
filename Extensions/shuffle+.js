// NAME: Shuffle+
// AUTHORS: khanhas, Tetrax-10
// DESCRIPTION: True shuffle with no bias.

/// <reference path="../globals.d.ts" />

(async function shufflePlus() {
	if (!(Spicetify.CosmosAsync && Spicetify.Platform)) {
		setTimeout(shufflePlus, 300);
		return;
	}

	const { React } = Spicetify;
	const { useState } = React;
	let playbarButton = null;

	function getConfig() {
		try {
			const parsed = JSON.parse(Spicetify.LocalStorage.get("shufflePlus:settings"));
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
			throw "";
		} catch {
			Spicetify.LocalStorage.set("shufflePlus:settings", "{}");
			return { artistMode: "all", artistNameMust: false, enableQueueButton: false };
		}
	}

	const CONFIG = getConfig();
	saveConfig();

	function saveConfig() {
		Spicetify.LocalStorage.set("shufflePlus:settings", JSON.stringify(CONFIG));
	}

	function settingsPage() {
		const style = React.createElement(
			"style",
			null,
			`.popup-row::after {
				content: "";
				display: table;
				clear: both;
			}
			.popup-row .col {
				display: flex;
				padding: 10px 0;
				align-items: center;
			}
			.popup-row .col.description {
				float: left;
				padding-right: 15px;
			}
			.popup-row .col.action {
				float: right;
				text-align: right;
			}
			.popup-row .div-title {
				color: var(--spice-text);
			}
			.popup-row .divider {
				height: 2px;
				border-width: 0;
				background-color: var(--spice-button-disabled);
			}
			button.checkbox {
				align-items: center;
				border: 0px;
				border-radius: 50%;
				background-color: rgba(var(--spice-rgb-shadow), 0.7);
				color: var(--spice-text);
				cursor: pointer;
				display: flex;
				margin-inline-start: 12px;
				padding: 8px;
			}
			button.checkbox.disabled {
				color: rgba(var(--spice-rgb-text), 0.3);
			}
			select {
				color: var(--spice-text);
				background: rgba(var(--spice-rgb-shadow), 0.7);
				border: 0;
				height: 32px;
			}
			::-webkit-scrollbar {
				width: 8px;
			}`
		);

		function DisplayIcon({ icon, size }) {
			return React.createElement("svg", {
				width: size,
				height: size,
				viewBox: "0 0 16 16",
				fill: "currentColor",
				dangerouslySetInnerHTML: {
					__html: icon,
				},
			});
		}

		function checkBoxItem({ name, field, onclickFun = () => {} }) {
			const [value, setValue] = useState(CONFIG[field]);
			return React.createElement(
				"div",
				{ className: "popup-row" },
				React.createElement("label", { className: "col description" }, name),
				React.createElement(
					"div",
					{ className: "col action" },
					React.createElement(
						"button",
						{
							className: `checkbox${value ? "" : " disabled"}`,
							onClick: () => {
								CONFIG[field] = !value;
								setValue(!value);
								saveConfig();
								onclickFun();
							},
						},
						React.createElement(DisplayIcon, { icon: Spicetify.SVGIcons.check, size: 16 })
					)
				)
			);
		}

		function dropDownItem({ name, field, options, onclickFun = () => {} }) {
			const [value, setValue] = useState(CONFIG[field]);
			return React.createElement(
				"div",
				{ className: "popup-row" },
				React.createElement("label", { className: "col description" }, name),
				React.createElement(
					"div",
					{ className: "col action" },
					React.createElement(
						"select",
						{
							value,
							onChange: (e) => {
								setValue(e.target.value);
								CONFIG[field] = e.target.value;
								saveConfig();
								onclickFun();
							},
						},
						Object.keys(options).map((item) =>
							React.createElement(
								"option",
								{
									value: item,
								},
								options[item]
							)
						)
					)
				)
			);
		}

		const settingsDOMContent = React.createElement(
			"div",
			null,
			style,
			React.createElement("div", { className: "popup-row" }, React.createElement("h3", { className: "div-title" }, "Artist Shuffle")),
			React.createElement("div", { className: "popup-row" }, React.createElement("hr", { className: "divider" }, null)),
			React.createElement(dropDownItem, {
				name: "Shuffle mode Artist Page",
				field: "artistMode",
				options: {
					all: "All",
					album: "Albums",
					single: "Singles & EP",
					likedSongArtist: "Artist's Liked Songs",
					topTen: "Top 10 Songs",
				},
			}),
			React.createElement(checkBoxItem, {
				name: "Chosen artist must be included",
				field: "artistNameMust",
			}),
			React.createElement(checkBoxItem, {
				name: "Enable Shuffle+ Queue Tracks button in Playbar",
				field: "enableQueueButton",
				onclickFun: () => renderQueuePlaybarButton(),
			})
		);

		Spicetify.PopupModal.display({
			title: "Shuffle+",
			content: settingsDOMContent,
			isLarge: true,
		});
	}

	new Spicetify.Menu.Item("Shuffle+", false, settingsPage, "shuffle").register();

	const { Type } = Spicetify.URI;

	function shouldAddShufflePlus(uri) {
		if (uri.length === 1) {
			const uriObj = Spicetify.URI.fromString(uri[0]);
			switch (uriObj.type) {
				case Type.PLAYLIST:
				case Type.PLAYLIST_V2:
				case Type.ALBUM:
				case Type.ARTIST:
				case Type.COLLECTION:
				case Type.FOLDER:
				case Type.SHOW:
					return true;
			}
			return false;
		}
		return true;
	}

	function shouldAddShufflePlusLiked(uri) {
		const uriObj = Spicetify.URI.fromString(uri[0]);
		if (Spicetify.Platform.History.location.pathname === "/collection/tracks") {
			switch (uriObj.type) {
				case Type.TRACK:
					return true;
			}
		}
		return false;
	}

	function shouldAddShufflePlusLocal(uri) {
		const uriObj = Spicetify.URI.fromString(uri[0]);
		if (Spicetify.Platform.History.location.pathname === "/collection/local-files") {
			switch (uriObj.type) {
				case Type.TRACK:
				case Type.LOCAL_TRACK:
					return true;
			}
		}
		return false;
	}

	new Spicetify.ContextMenu.Item(
		"Play with Shuffle+",
		async (uri) => {
			if (uri.length === 1) {
				await fetchAndPlay(uri[0]);
				return;
			}
			await fetchAndPlay(uri);
		},
		shouldAddShufflePlus,
		"shuffle"
	).register();

	new Spicetify.ContextMenu.Item(
		"Shuffle+ Liked Songs",
		async (uri) => {
			await fetchAndPlay(uri[0]);
		},
		shouldAddShufflePlusLiked,
		"heart-active"
	).register();

	new Spicetify.ContextMenu.Item(
		"Shuffle+ Local Files",
		async (uri) => {
			await fetchAndPlay(uri[0]);
		},
		shouldAddShufflePlusLocal,
		"playlist-folder"
	).register();

	renderQueuePlaybarButton();
	function renderQueuePlaybarButton() {
		if (!playbarButton) {
			playbarButton = new Spicetify.Playbar.Button(
				"Shuffle+ Queue Tracks",
				"enhance",
				async () => {
					await fetchAndPlay("queue");
				},
				false,
				false
			);
		}

		if (CONFIG.enableQueueButton) playbarButton.register();
		else playbarButton.deregister();
	}

	async function fetchPlaylistTracks(uri) {
		const res = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/playlist/spotify:playlist:${uri}/rows`, {
			policy: { link: true, playable: true },
		});
		return res.rows.filter((track) => track.playable).map((track) => track.link);
	}

	function searchFolder(rows, uri) {
		for (const r of rows) {
			if (r.type !== "folder" || !r.rows) continue;

			if (r.link === uri) return r;

			const found = searchFolder(r.rows, uri);
			if (found) return found;
		}
	}

	async function fetchFolderTracks(uri) {
		const res = await Spicetify.CosmosAsync.get("sp://core-playlist/v1/rootlist", {
			policy: { folder: { rows: true, link: true } },
		});

		const requestFolder = searchFolder(res.rows, uri);
		if (!requestFolder) throw "Cannot find folder";

		const requestPlaylists = [];
		async function fetchNested(folder) {
			if (!folder.rows) return;

			for (const i of folder.rows) {
				if (i.type === "playlist") requestPlaylists.push(await fetchPlaylistTracks(i.link.split(":")[2]));
				else if (i.type === "folder") await fetchNested(i);
			}
		}

		await fetchNested(requestFolder);

		return requestPlaylists.flat();
	}

	async function fetchAlbumTracks(uri, includeMetadata = false) {
		const { queryAlbumTracks } = Spicetify.GraphQL.Definitions;
		const { data, errors } = await Spicetify.GraphQL.Request(queryAlbumTracks, { uri, offset: 0, limit: 100 });

		if (errors) throw errors[0].message;
		if (data.albumUnion.playability.playable === false) throw "Album is not playable";

		return (data.albumUnion?.tracksV2 ?? data.albumUnion?.tracks ?? []).items
			.filter(({ track }) => track.playability.playable)
			.map(({ track }) => (includeMetadata ? track : track.uri));
	}

	const artistFetchTypeCount = { album: 0, single: 0 };

	async function scanForTracksFromAlbums(res, artistName, type) {
		const allTracks = [];

		for (const album of res) {
			let albumRes;

			try {
				albumRes = await fetchAlbumTracks(album.uri, true);
			} catch (error) {
				console.error(album, error);
				continue;
			}

			artistFetchTypeCount[type]++;
			Spicetify.showNotification(`${artistFetchTypeCount[type]} / ${res.length} ${type}s`);

			for (const track of albumRes) {
				if (!CONFIG.artistNameMust || track.artists.items.some((artist) => artist.profile.name === artistName)) allTracks.push(track.uri);
			}
		}

		return allTracks;
	}

	async function fetchArtistTracks(uri) {
		// Definitions from older Spotify version
		const queryArtistOverview = {
			name: "queryArtistOverview",
			operation: "query",
			sha256Hash: "35648a112beb1794e39ab931365f6ae4a8d45e65396d641eeda94e4003d41497",
			value: null,
		};
		const queryArtistDiscographyAll = {
			name: "queryArtistDiscographyAll",
			operation: "query",
			sha256Hash: "9380995a9d4663cbcb5113fef3c6aabf70ae6d407ba61793fd01e2a1dd6929b0",
			value: null,
		};

		const discography = await Spicetify.GraphQL.Request(queryArtistDiscographyAll, {
			uri,
			offset: 0,
			// Limit 100 since GraphQL has resource limit
			limit: 100,
		});
		if (discography.errors) throw discography.errors[0].message;

		const overview = await Spicetify.GraphQL.Request(queryArtistOverview, {
			uri,
			locale: Spicetify.Locale.getLocale(),
			includePrerelease: false,
		});
		if (overview.errors) throw overview.errors[0].message;

		const artistName = overview.data.artistUnion.profile.name;
		const releases = discography.data.artistUnion.discography.all.items.flatMap(({ releases }) => releases.items);

		const artistAlbums = releases.filter((album) => album.type === "ALBUM");
		const artistSingles = releases.filter((album) => album.type === "SINGLE" || album.type === "EP");

		if (artistAlbums.length === 0 && artistSingles.length === 0) throw "Artist has no releases";

		const allArtistAlbumsTracks = CONFIG.artistMode !== "single" ? await scanForTracksFromAlbums(artistAlbums, artistName, "album") : [];
		const allArtistSinglesTracks = CONFIG.artistMode !== "album" ? await scanForTracksFromAlbums(artistSingles, artistName, "single") : [];

		return allArtistAlbumsTracks.concat(allArtistSinglesTracks);
	}

	async function fetchArtistLikedTracks(uri) {
		const artistRes = await Spicetify.CosmosAsync.get(`sp://core-collection/unstable/@/list/tracks/artist/${uri}?responseFormat=protobufJson`);

		const allTracks = artistRes.item?.map((artistTrack) => {
			if (artistTrack.trackMetadata.playable) return artistTrack.trackMetadata.link;
		});

		return allTracks ?? [];
	}

	async function fetchArtistTopTenTracks(uri) {
		const { queryArtistOverview } = Spicetify.GraphQL.Definitions;
		const { data, errors } = await Spicetify.GraphQL.Request(queryArtistOverview, {
			uri,
			locale: Spicetify.Locale.getLocale(),
			includePrerelease: false,
		});
		if (errors) throw errors[0].message;
		return data.artistUnion.discography.topTracks.items.map(({ track }) => track.uri);
	}

	async function fetchLikedTracks() {
		const res = await Spicetify.CosmosAsync.get("sp://core-collection/unstable/@/list/tracks/all?responseFormat=protobufJson");

		return res.item.filter((track) => track.trackMetadata.playable).map((track) => track.trackMetadata.link);
	}

	async function fetchLocalTracks() {
		const res = await Spicetify.Platform.LocalFilesAPI.getTracks();

		return res.map((track) => track.uri);
	}

	function fetchQueue() {
		const { _queueState } = Spicetify.Platform.PlayerAPI._queue;
		const nextUp = _queueState.nextUp.map((track) => track.uri);
		const queued = _queueState.queued.map((track) => track.uri);
		const array = [...new Set([...nextUp, ...queued])];
		const current = _queueState.current?.uri;
		if (current) array.push(current);
		return array;
	}

	async function fetchCollection(uriObj) {
		const { category, type } = uriObj;
		const { pathname } = Spicetify.Platform.History.location;

		switch (type) {
			case Type.TRACK:
			case Type.LOCAL_TRACK:
				switch (pathname) {
					case "/collection/tracks":
						return await fetchLikedTracks();
					case "/collection/local-files":
						return await fetchLocalTracks();
				}
				break;
			case Type.COLLECTION:
				switch (category) {
					case "tracks":
						return await fetchLikedTracks();
					case "local-files":
						return await fetchLocalTracks();
				}
		}
	}

	async function fetchShows(uri) {
		const res = await Spicetify.CosmosAsync.get(`sp://core-show/v1/shows/${uri}?responseFormat=protobufJson`);
		return res.items.filter((track) => track.episodePlayState.isPlayable).map((track) => track.episodeMetadata.link);
	}

	function shuffle(array) {
		let counter = array.length;
		if (counter <= 1) return array;

		// While there are elements in the array
		while (counter > 0) {
			// Pick a random index
			const index = Math.floor(Math.random() * counter);

			// Decrease counter by 1
			counter--;

			// And swap the last element with it
			const temp = array[counter];
			array[counter] = array[index];
			array[index] = temp;
		}
		return array.filter(Boolean);
	}

	async function Queue(list, context, type) {
		const count = list.length;

		// Delimits the end of our list, as Spotify may add new context tracks to the queue
		list.push("spotify:delimiter");

		const { _queue, _client } = Spicetify.Platform.PlayerAPI._queue;
		const { prevTracks, queueRevision } = _queue;

		// Format tracks with default values
		const nextTracks = list.map((uri) => ({
			contextTrack: {
				uri,
				uid: "",
				metadata: {
					is_queued: "false",
				},
			},
			removed: [],
			blocked: [],
			provider: "context",
		}));

		// Lowest level setQueue method from vendor~xpui.js
		_client.setQueue({
			nextTracks,
			prevTracks,
			queueRevision,
		});

		if (context) {
			const { sessionId } = Spicetify.Platform.PlayerAPI.getState();
			Spicetify.Platform.PlayerAPI.updateContext(sessionId, { uri: context, url: `context://${context}` });
		}

		Spicetify.Player.next();

		switch (type) {
			case Type.ARTIST:
				if (CONFIG.artistMode === "topTen") {
					Spicetify.showNotification(`Shuffled Top ${count} Songs`);
					break;
				}
				if (CONFIG.artistMode === "likedSongArtist") {
					Spicetify.showNotification(`Shuffled ${count} Liked Songs`);
					break;
				}
				if (CONFIG.artistMode === "single") {
					Spicetify.showNotification(`Shuffled ${artistFetchTypeCount.single} Singles, Total of ${count} Songs`);
					break;
				}
				if (CONFIG.artistMode === "album") {
					Spicetify.showNotification(`Shuffled ${artistFetchTypeCount.album} Albums, Total of ${count} Songs`);
					break;
				}
				Spicetify.showNotification(`Shuffled ${artistFetchTypeCount.album} Albums, ${artistFetchTypeCount.single} Singles, Total of ${count} Songs`);
				break;
			default:
				Spicetify.showNotification(`Shuffled ${count} Songs`);
		}

		artistFetchTypeCount.album = 0;
		artistFetchTypeCount.single = 0;
	}

	async function fetchAndPlay(rawUri) {
		let list;
		let context;
		let type = null;
		let uri;

		try {
			if (rawUri === "queue") {
				list = fetchQueue();
				context = null;
			} else if (typeof rawUri === "object") {
				list = rawUri;
				context = null;
			} else {
				const uriObj = Spicetify.URI.fromString(rawUri);
				type = uriObj.type;
				uri = uriObj._base62Id ?? uriObj.id;

				switch (type) {
					case Type.PLAYLIST:
					case Type.PLAYLIST_V2:
						list = await fetchPlaylistTracks(uri);
						break;
					case Type.ALBUM:
						list = await fetchAlbumTracks(rawUri);
						break;
					case `${Type.ARTIST}`:
						if (CONFIG.artistMode === "likedSongArtist") {
							list = await fetchArtistLikedTracks(uri);
							break;
						}
						if (CONFIG.artistMode === "topTen") {
							list = await fetchArtistTopTenTracks(rawUri);
							break;
						}
						list = await fetchArtistTracks(rawUri);
						break;
					case Type.TRACK:
					case Type.LOCAL_TRACK:
					case Type.COLLECTION:
						list = await fetchCollection(uriObj);
						break;
					case Type.FOLDER:
						list = await fetchFolderTracks(rawUri);
						break;
					case Type.SHOW:
						list = await fetchShows(uri);
						break;
				}

				if (!list?.length) {
					Spicetify.showNotification("Nothing to play", true);
					return;
				}

				context = rawUri;
				if (type === "folder" || type === "collection" || type === "local") {
					context = null;
				}
			}

			await Queue(shuffle(list), context, type);
		} catch (error) {
			Spicetify.showNotification(String(error), true);
			console.error(error);
		}
	}
})();
