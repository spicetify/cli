// NAME: WebNowPlaying Companion
// AUTHOR: khanhas (based on https://github.com/tjhrulz/WebNowPlaying-BrowserExtension)
// DESCRIPTION: Get song information and control player

/// <reference path="../globals.d.ts" />

(function WebNowPlaying() {
	if (!Spicetify.CosmosAsync || !Spicetify.Platform) {
		setTimeout(WebNowPlaying, 500);
		return;
	}

	let currentMusicInfo;
	let ws;
	let currState = 0;
	const storage = {};
	function updateStorage(data) {
		if (!data?.track?.metadata) {
			return;
		}
		const meta = data.track.metadata;
		storage.TITLE = meta.title;
		storage.ALBUM = meta.album_title;
		storage.DURATION = convertTimeToString(parseInt(meta.duration));
		storage.STATE = !data.is_paused ? 1 : 2;
		storage.REPEAT = data.options.repeating_track ? 2 : data.options.repeating_context ? 1 : 0;
		storage.SHUFFLE = data.options.shuffling_context ? 1 : 0;
		storage.ARTIST = meta.artist_name;
		let artistCount = 1;
		while (meta["artist_name:" + artistCount]) {
			storage.ARTIST += ", " + meta["artist_name:" + artistCount];
			artistCount++;
		}
		if (!storage.ARTIST) {
			storage.ARTIST = meta.album_title; // Podcast
		}

		Spicetify.Platform.LibraryAPI.contains(data.track.uri).then(([added]) => (storage.RATING = added ? 5 : 0));

		const cover = meta.image_xlarge_url;
		if (cover?.indexOf("localfile") === -1) {
			storage.COVER = "https://i.scdn.co/image/" + cover.substring(cover.lastIndexOf(":") + 1);
		} else {
			storage.COVER = "";
		}
	}

	Spicetify.CosmosAsync.sub("sp://player/v2/main", updateStorage);

	function updateInfo() {
		if (!Spicetify.Player.data && currState !== 0) {
			ws.send("STATE:" + 0);
			currState = 0;
			return;
		}

		storage.POSITION = convertTimeToString(Spicetify.Player.getProgress());
		storage.VOLUME = Math.round(Spicetify.Player.getVolume() * 100);

		for (const field in storage) {
			try {
				const data = storage[field];
				if (data !== undefined && currentMusicInfo[field] !== data) {
					ws.send(`${field}:${data}`);
					currentMusicInfo[field] = data;
				}
			} catch (e) {
				ws.send(`Error:Error updating ${field} for Spotify Desktop`);
				ws.send("ErrorD:" + e);
			}
		}
	}

	function fireEvent(event) {
		const m = event.data;
		const n = m.indexOf(" ");
		let type = n === -1 ? m : m.substring(0, n);
		type = type.toUpperCase();
		const info = m.substring(n + 1);

		switch (type) {
			case "PLAYPAUSE":
				Spicetify.Player.togglePlay();
				break;
			case "NEXT":
				Spicetify.Player.next();
				break;
			case "PREVIOUS":
				Spicetify.Player.back();
				break;
			case "SETPOSITION":
				Spicetify.Player.seek(parseInt(info) * 1000);
				break;
			case "SETVOLUME":
				Spicetify.Player.setVolume(parseInt(info) / 100);
				break;
			case "REPEAT":
				Spicetify.Player.toggleRepeat();
				break;
			case "SHUFFLE":
				Spicetify.Player.toggleShuffle();
				break;
			case "RATING":
				const like = parseInt(info) > 3;
				const isLiked = storage.RATING > 3;
				if ((like && !isLiked) || (!like && isLiked)) {
					Spicetify.Player.toggleHeart();
				}
				break;
			case "TOGGLETHUMBSUP":
				if (!(storage.RATING > 3)) {
					Spicetify.Player.toggleHeart();
				}
				break;
			case "TOGGLETHUMBSDOWN":
				if (storage.RATING > 3) {
					Spicetify.Player.toggleHeart();
				}
				break;
		}
	}

	(function init() {
		ws = new WebSocket("ws://127.0.0.1:8974/");
		let sendData;

		ws.onopen = () => {
			ws.send("PLAYER:Spotify Desktop");
			currState = 1;
			currentMusicInfo = {};
			sendData = setInterval(updateInfo, 500);
		};

		ws.onclose = () => {
			clearInterval(sendData);
			setTimeout(init, 2000);
		};

		ws.onmessage = fireEvent;
	})();

	window.onbeforeunload = () => {
		ws.onclose = null; // disable onclose handler first
		ws.close();
	};

	/**
	 * Zero padding a number
	 * @param {number} number number to pad
	 * @param {number} length
	 */
	function pad(number, length) {
		var str = String(number);
		while (str.length < length) {
			str = "0" + str;
		}
		return str;
	}

	/**
	 * Convert seconds to a time string acceptable to Rainmeter
	 * @param {number} timeInMs
	 * @returns {string}
	 */
	function convertTimeToString(timeInMs) {
		const seconds = Math.round(timeInMs / 1000);
		const minutes = Math.floor(seconds / 60);
		if (minutes < 60) {
			return `${minutes}:${pad(seconds % 60, 2)}`;
		}
		return `${Math.floor(minutes / 60)}:${pad(minutes % 60, 2)}:${pad(seconds % 60, 2)}`;
	}
})();
