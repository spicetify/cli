// NAME: Trashbin
// AUTHOR: khanhas
// DESCRIPTION: Throw songs to trashbin and never hear it again.

/// <reference path="../globals.d.ts" />

(function TrashBin() {
	const skipBackBtn = document.querySelector(".main-skipBackButton-button");

	if (!Spicetify.Player.data || !Spicetify.LocalStorage || !skipBackBtn) {
		setTimeout(TrashBin, 1000);
		return;
	}

	let trashSongList = {};
	let trashArtistList = {};
	let userHitBack = false;

	const THROW_TEXT = "Throw to Trashbin";
	const UNTHROW_TEXT = "Take out of Trashbin";

	trashSongList = JSON.parse(Spicetify.LocalStorage.get("TrashSongList")) || {};
	trashArtistList = JSON.parse(Spicetify.LocalStorage.get("TrashArtistList")) || {};

	putDataLocal();

	// Tracking when users hit previous button.
	// By doing that, user can return to thrown song to take it out of trashbin.
	skipBackBtn.addEventListener("click", () => (userHitBack = true));

	Spicetify.Player.addEventListener("songchange", watchChange);

	function watchChange() {
		const data = Spicetify.Player.data || Spicetify.Queue;
		if (!data) return;

		const isBanned = trashSongList[data.track.uri];

		if (userHitBack) {
			userHitBack = false;
			return;
		}

		if (isBanned) {
			Spicetify.Player.next();
			return;
		}

		let uriIndex = 0;
		let artistUri = data.track.metadata["artist_uri"];

		while (artistUri) {
			if (trashArtistList[artistUri]) {
				Spicetify.Player.next();
				return;
			}

			uriIndex++;
			artistUri = data.track.metadata["artist_uri:" + uriIndex];
		}
	}

	/**
	 *
	 * @param {string} uri
	 * @param {string} type
	 * @returns {boolean}
	 */
	function shouldSkipCurrentTrack(uri, type) {
		const curTrack = Spicetify.Player.data.track;
		if (type === Spicetify.URI.Type.TRACK) {
			if (uri === curTrack.uri) {
				return true;
			}
		}

		if (type === Spicetify.URI.Type.ARTIST) {
			let count = 1;
			let artUri = curTrack.metadata["artist_uri"];
			while (artUri) {
				if (uri === artUri) {
					return true;
				}
				artUri = curTrack.metadata[`artist_uri:${count}`];
				count++;
			}
		}

		return false;
	}

	/**
	 *
	 * @param {string[]} uris
	 */
	function toggleThrow(uris) {
		const uri = uris[0];
		const uriObj = Spicetify.URI.fromString(uri);
		const type = uriObj.type;

		let list = type === Spicetify.URI.Type.TRACK ? trashSongList : trashArtistList;

		if (!list[uri]) {
			list[uri] = true;
			if (shouldSkipCurrentTrack(uri, type)) {
				Spicetify.Player.next();
			}
		} else {
			delete list[uri];
		}

		putDataLocal();
	}

	/**
	 * Only accept one track or artist URI
	 * @param {string[]} uris
	 * @returns {boolean}
	 */
	function shouldAddContextMenu(uris) {
		if (uris.length > 1) {
			return false;
		}

		const uri = uris[0];
		const uriObj = Spicetify.URI.fromString(uri);
		if (uriObj.type === Spicetify.URI.Type.TRACK) {
			this.name = trashSongList[uri] ? UNTHROW_TEXT : THROW_TEXT;
			return true;
		}

		if (uriObj.type === Spicetify.URI.Type.ARTIST) {
			this.name = trashArtistList[uri] ? UNTHROW_TEXT : THROW_TEXT;
			return true;
		}

		return false;
	}

	const cntxMenu = new Spicetify.ContextMenu.Item(THROW_TEXT, toggleThrow, shouldAddContextMenu);
	cntxMenu.register();

	function putDataLocal() {
		Spicetify.LocalStorage.set("TrashSongList", JSON.stringify(trashSongList));
		Spicetify.LocalStorage.set("TrashArtistList", JSON.stringify(trashArtistList));
	}
})();
