// NAME: Shuffle+
// AUTHORS: khanhas, Tetrax-10
// DESCRIPTION: True shuffle with no bias.

/// <reference path="../globals.d.ts" />

(async function shufflePlus() {
	if (!(Spicetify.CosmosAsync && Spicetify.Platform)) {
		setTimeout(shufflePlus, 300);
		return;
	}
	await initShufflePlus();
})();

async function initShufflePlus() {
	const { React } = Spicetify;
	const { useState } = React;

	async function getLocalStorageDataFromKey(key) {
		return Spicetify.LocalStorage.get(key);
	}

	async function setLocalStorageDataWithKey(key, value) {
		Spicetify.LocalStorage.set(key, value);
	}

	async function getConfig() {
		try {
			const parsed = JSON.parse(await getLocalStorageDataFromKey("shufflePlus:settings"));
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
			throw "";
		} catch {
			await setLocalStorageDataWithKey("shufflePlus:settings", `{}`);
			return { artistMode: "all", artistNameMust: false };
		}
	}

	const CONFIG = await getConfig();
	await saveConfig();

	async function saveConfig() {
		await setLocalStorageDataWithKey("shufflePlus:settings", JSON.stringify(CONFIG));
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
					__html: icon
				}
			});
		}

		function checkBoxItem({ name, field, onclickFun = () => {} }) {
			let [value, setValue] = useState(CONFIG[field]);
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
							className: "checkbox" + (value ? "" : " disabled"),
							onClick: async () => {
								CONFIG[field] = !value;
								setValue(!value);
								await saveConfig();
								onclickFun();
							}
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
							onChange: async e => {
								setValue(e.target.value);
								CONFIG[field] = e.target.value;
								await saveConfig();
								onclickFun();
							}
						},
						Object.keys(options).map(item =>
							React.createElement(
								"option",
								{
									value: item
								},
								options[item]
							)
						)
					)
				)
			);
		}

		let settingsDOMContent = React.createElement(
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
					topTen: "Top 10 Songs"
				}
			}),
			React.createElement(checkBoxItem, {
				name: "Chosen artist must be included",
				field: "artistNameMust"
			})
		);

		Spicetify.PopupModal.display({
			title: "Shuffle+",
			content: settingsDOMContent
		});
	}

	new Spicetify.Menu.Item("Shuffle+", false, settingsPage).register();

	let { Type } = Spicetify.URI;

	function shouldAddShufflePlus(uri) {
		if (uri.length === 1) {
			let uriObj = Spicetify.URI.fromString(uri[0]);
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
		let uriObj = Spicetify.URI.fromString(uri[0]);
		if (Spicetify.Platform.History.location.pathname === "/collection/tracks") {
			switch (uriObj.type) {
				case Type.TRACK:
					return true;
			}
		}
		return false;
	}

	new Spicetify.ContextMenu.Item(
		"Play with Shuffle+",
		async uri => {
			if (uri.length == 1) {
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
		async uri => {
			await fetchAndPlay(uri[0]);
		},
		shouldAddShufflePlusLiked,
		"heart-active"
	).register();

	async function fetchPlaylistTracks(uri) {
		let res = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/playlist/spotify:playlist:${uri}/rows`, {
			policy: { link: true, playable: true }
		});
		return res.rows.filter(track => track.playable).map(track => track.link);
	}

	function searchFolder(rows, uri) {
		for (const r of rows) {
			if (r.type !== "folder" || r.rows == null) {
				continue;
			}

			if (r.link === uri) {
				return r;
			}

			const found = searchFolder(r.rows, uri);
			if (found) return found;
		}
	}

	async function fetchFolderTracks(uri) {
		const res = await Spicetify.CosmosAsync.get(`sp://core-playlist/v1/rootlist`, {
			policy: { folder: { rows: true, link: true } }
		});

		const requestFolder = searchFolder(res.rows, uri);
		if (requestFolder == null) {
			throw "Cannot find folder";
		}

		let requestPlaylists = [];
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

	async function fetchAlbumTracks(uri) {
		let res = await Spicetify.CosmosAsync.get(`wg://album/v1/album-app/album/${uri}/desktop`);
		const items = [];
		for (const disc of res.discs) {
			const availables = disc.tracks.filter(track => track.playable);
			items.push(...availables.map(track => track.uri));
		}
		return items;
	}

	let artistFetchTypeCount = { album: 0, single: 0 };

	async function scanForTracksFromAlbums(res, allCount, artistName, type) {
		let allTracks = [];

		for (let albums of res) {
			let albumsRes;

			try {
				if (albums.discs) {
					albumsRes = albums;
				} else {
					albumsRes = await Spicetify.CosmosAsync.get(`wg://album/v1/album-app/album/${albums.uri}/desktop`);
				}
			} catch (error) {}

			artistFetchTypeCount[type]++;
			Spicetify.showNotification(`${artistFetchTypeCount[type]} / ${allCount} ${type}s`);

			for (let disc of albumsRes.discs) {
				for (let track of disc.tracks) {
					let condition = true;
					if (CONFIG.artistNameMust) {
						let artists = track.artists.map(artist => artist.name);
						if (!artists.includes(artistName)) {
							condition = false;
						}
					}

					if (track.playable && condition) {
						allTracks.push(track.uri);
					}
				}
			}
		}

		return allTracks;
	}

	async function fetchArtistTracks(uri) {
		let artistRes = await Spicetify.CosmosAsync.get(`wg://artist/v1/${uri}/desktop?format=json`);

		let artistName = artistRes.info.name;

		let artistAlbums = artistRes.releases.albums;
		let artistSingles = artistRes.releases.singles;

		let allArtistAlbumsTracks = [];
		let allArtistSinglesTracks = [];

		let allAlbumsCount = artistAlbums.total_count;
		let allSinglesCount = artistSingles.total_count;

		if (allAlbumsCount != 0 && CONFIG.artistMode != "single") {
			allArtistAlbumsTracks = await scanForTracksFromAlbums(artistAlbums.releases, allAlbumsCount, artistName, "album");
		}

		if (allSinglesCount != 0 && CONFIG.artistMode != "album") {
			allArtistSinglesTracks = await scanForTracksFromAlbums(artistSingles.releases, allSinglesCount, artistName, "single");
		}

		let allArtistTracks = allArtistAlbumsTracks.concat(allArtistSinglesTracks);

		return allArtistTracks;
	}

	async function fetchArtistLikedTracks(uri) {
		//goto
		let artistRes = await Spicetify.CosmosAsync.get(`sp://core-collection/unstable/@/list/tracks/artist/${uri}?responseFormat=protobufJson`);

		let allTracks = [];
		if (artistRes.item) {
			allTracks = artistRes.item.map(artistTrack => {
				if (artistTrack.trackMetadata.playable) {
					return artistTrack.trackMetadata.link;
				}
			});
		}

		return allTracks;
	}

	async function fetchArtistTopTenTracks(uri) {
		let artistRes = await Spicetify.CosmosAsync.get(`wg://artist/v1/${uri}/desktop?format=json`);

		let topTenTracks = artistRes.top_tracks.tracks.map(track => track.uri);

		return topTenTracks;
	}

	async function fetchLikedTracks() {
		let res = await Spicetify.CosmosAsync.get("sp://core-collection/unstable/@/list/tracks/all?responseFormat=protobufJson");

		return res.item.filter(track => track.trackMetadata.playable).map(track => track.trackMetadata.link);
	}

	async function fetchShows(uri) {
		const res = await Spicetify.CosmosAsync.get(`sp://core-show/v1/shows/${uri}?responseFormat=protobufJson`);
		const availables = res.items.filter(track => track.episodePlayState.isPlayable);
		return availables.map(track => track.episodeMetadata.link);
	}

	function shuffle(array) {
		let counter = array.length;
		if (counter <= 1) return array;

		// While there are elements in the array
		while (counter > 0) {
			// Pick a random index
			let index = Math.floor(Math.random() * counter);

			// Decrease counter by 1
			counter--;

			// And swap the last element with it
			let temp = array[counter];
			array[counter] = array[index];
			array[index] = temp;
		}
		array.filter(track => track);
		return array;
	}

	async function Queue(list, context = null, type) {
		let count = list.length;

		list.push("spotify:delimiter");

		await Spicetify.Platform.PlayerAPI.clearQueue();

		await Spicetify.CosmosAsync.put("sp://player/v2/main/queue", {
			queue_revision: Spicetify.Queue?.queueRevision,
			next_tracks: list.map(uri => ({
				uri,
				provider: "context",
				metadata: {
					is_queued: "false"
				}
			})),
			prev_tracks: Spicetify.Queue?.prevTracks
		});

		if (context) {
			await Spicetify.CosmosAsync.post("sp://player/v2/main/update", {
				context: {
					uri: context,
					url: "context://" + context
				}
			});
		}

		Spicetify.Player.next();

		switch (type) {
			case Type.ARTIST:
				if (CONFIG.artistMode == "topTen") {
					Spicetify.showNotification(`Shuffled Top ${count} Songs`);
					break;
				}
				if (CONFIG.artistMode == "likedSongArtist") {
					Spicetify.showNotification(`Shuffled ${count} Liked Songs`);
					break;
				}
				if (CONFIG.artistMode == "single") {
					Spicetify.showNotification(`Shuffled ${artistFetchTypeCount.single} Singles, Total of ${count} Songs`);
					break;
				}
				if (CONFIG.artistMode == "album") {
					Spicetify.showNotification(`Shuffled ${artistFetchTypeCount.album} Albums, Totally ${count} Songs`);
					break;
				}
				Spicetify.showNotification(`Shuffled ${artistFetchTypeCount.album} Albums, ${artistFetchTypeCount.single} Singles, Totally ${count} Songs`);
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
			if (typeof rawUri == "object") {
				list = rawUri;
				context = null;
			} else {
				let uriObj = Spicetify.URI.fromString(rawUri);
				type = uriObj.type;
				uri = uriObj._base62Id ?? uriObj.id;

				switch (type) {
					case Type.PLAYLIST:
					case Type.PLAYLIST_V2:
						list = await fetchPlaylistTracks(uri);
						break;
					case Type.ALBUM:
						list = await fetchAlbumTracks(uri);
						break;
					case Type.ARTIST + "":
						if (CONFIG.artistMode == "likedSongArtist") {
							list = await fetchArtistLikedTracks(uri);
							break;
						}
						if (CONFIG.artistMode == "topTen") {
							list = await fetchArtistTopTenTracks(uri);
							break;
						}
						list = await fetchArtistTracks(uri);
						break;
					case Type.TRACK:
						list = await fetchLikedTracks();
						break;
					case Type.FOLDER:
						list = await fetchFolderTracks(rawUri);
						break;
					case Type.SHOW:
						list = await fetchShows(uri);
						break;
				}

				if (!list.length) {
					Spicetify.showNotification("Nothing to Play");
					return;
				}

				context = rawUri;
				if (type == "folder" || type == "collection") {
					context = null;
				}
			}

			await Queue(shuffle(list), context, type);
		} catch (error) {
			Spicetify.showNotification(`${error}`);
			console.log(error);
		}
	}
}
