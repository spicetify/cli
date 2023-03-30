// NAME: WebNowPlaying
// AUTHOR: khanhas, keifufu (based on https://github.com/keifufu/WebNowPlaying-Redux)
// DESCRIPTION: Provides media information and controls to WebNowPlaying-Redux-Rainmeter, but also supports WebNowPlaying for Rainmeter 0.5.0 and older.

/// <reference path="../globals.d.ts" />

(function WebNowPlaying() {
	if (!Spicetify.CosmosAsync || !Spicetify.Platform) {
		setTimeout(WebNowPlaying, 500);
		return;
	}

	const socket = new WNPReduxWebSocket();
	window.addEventListener("beforeunload", () => {
		socket.close();
	});
})();

class WNPReduxWebSocket {
	_ws = null;
	cache = new Map();
	reconnectCount = 0;
	updateInterval = null;
	communicationRevision = null;
	connectionTimeout = null;
	reconnectTimeout = null;
	isClosed = false;
	spicetifyInfo = {
		Player: "Spotify Desktop",
		State: "STOPPED",
		Title: "",
		Artist: "",
		Album: "",
		Cover: "",
		Duration: "0:00",
		// Position and Volume are fetched in sendUpdate()
		Position: "0:00",
		Volume: 100,
		Rating: 0,
		Repeat: "NONE",
		Shuffle: false
	};

	constructor() {
		this.init();
		Spicetify.CosmosAsync.sub("sp://player/v2/main", this.updateSpicetifyInfo.bind(this));
	}

	updateSpicetifyInfo(data) {
		if (!data?.track?.metadata) return;
		const meta = data.track.metadata;
		this.spicetifyInfo.Title = meta.title;
		this.spicetifyInfo.Album = meta.album_title;
		this.spicetifyInfo.Duration = timeInSecondsToString(Math.round(parseInt(meta.duration) / 1000));
		this.spicetifyInfo.State = !data.is_paused ? "PLAYING" : "PAUSED";
		this.spicetifyInfo.Repeat = data.options.repeating_track ? "ONE" : data.options.repeating_context ? "ALL" : "NONE";
		this.spicetifyInfo.Shuffle = data.options.shuffling_context;
		this.spicetifyInfo.Artist = meta.artist_name;
		let artistCount = 1;
		while (meta["artist_name:" + artistCount]) {
			this.spicetifyInfo.Artist += ", " + meta["artist_name:" + artistCount];
			artistCount++;
		}
		if (!this.spicetifyInfo.Artist) this.spicetifyInfo.Artist = meta.album_title; // Podcast

		Spicetify.Platform.LibraryAPI.contains(data.track.uri).then(([added]) => (this.spicetifyInfo.Rating = added ? 5 : 0));

		const cover = meta.image_xlarge_url;
		if (cover?.indexOf("localfile") === -1) this.spicetifyInfo.Cover = "https://i.scdn.co/image/" + cover.substring(cover.lastIndexOf(":") + 1);
		else this.spicetifyInfo.Cover = "";
	}

	init() {
		try {
			this._ws = new WebSocket("ws://localhost:8974");
			this._ws.onopen = this.onOpen.bind(this);
			this._ws.onclose = this.onClose.bind(this);
			this._ws.onerror = this.onError.bind(this);
			this._ws.onmessage = this.onMessage.bind(this);
		} catch {
			this.retry();
		}
	}

	close(cleanupOnly = false) {
		if (!cleanupOnly) this.isClosed = true;
		this.cache = new Map();
		this.communicationRevision = null;
		if (this.reconnectTimeout) clearTimeout(this.reconnectTimeout);
		if (this.connectionTimeout) clearTimeout(this.connectionTimeout);
		if (this.ws) {
			this.ws.onclose = null;
			this.ws.close();
		}
	}

	// Clean up old variables and retry connection
	retry() {
		if (this.isClosed) return;
		this.close(true);
		// Reconnects once per second for 30 seconds, then with a exponential backoff of (2^reconnectAttempts) up to 60 seconds
		this.reconnectTimeout = setTimeout(() => {
			this.init();
			this.reconnectAttempts += 1;
		}, Math.min(1000 * (this.reconnectAttempts <= 30 ? 1 : 2 ** (this.reconnectAttempts - 30)), 60000));
	}

	send(data) {
		if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
		this._ws.send(data);
	}

	onOpen() {
		this.reconnectCount = 0;
		this.updateInterval = setInterval(this.sendUpdate.bind(this), 500);
		// If no communication revision is received within 1 second, assume it's WNP for Rainmeter < 0.5.0 (legacy)
		this.connectionTimeout = setTimeout(() => {
			if (this.communicationRevision === null) this.communicationRevision = "legacy";
		}, 1000);
	}

	onClose() {
		this.retry();
	}

	onError() {
		this.retry();
	}

	onMessage(event) {
		if (this.communicationRevision) {
			switch (this.communicationRevision) {
				case "legacy":
					OnMessageLegacy(this, event.data);
					break;
				case "1":
					OnMessageRev1(this, event.data);
					break;
			}

			// Sending an update immediately would normally do nothing, as it takes some time for
			// spicetifyInfo to be updated via the Cosmos subscription. However, we try to
			// optimistically update spicetifyInfo after receiving events.
			this.sendUpdate();
		} else {
			if (event.data.startsWith("Version:")) {
				// 'Version:' WNP for Rainmeter 0.5.0 (legacy)
				this.communicationRevision = "legacy";
			} else if (event.data.startsWith("ADAPTER_VERSION ")) {
				// Any WNPRedux adapter will send 'ADAPTER_VERSION <version>;WNPRLIB_REVISION <revision>' after connecting
				this.communicationRevision = event.data.split(";")[1].split(" ")[1];
			} else {
				// The first message wasn't version related, so it's probably WNP for Rainmeter < 0.5.0 (legacy)
				this.communicationRevision = "legacy";
			}
		}
	}

	sendUpdate() {
		if (!this._ws || this._ws.readyState !== WebSocket.OPEN) return;
		switch (this.communicationRevision) {
			case "legacy":
				SendUpdateLegacy(this);
				break;
			case "1":
				SendUpdateRev1(this);
				break;
		}
	}
}

function OnMessageLegacy(self, message) {
	// Quite lengthy functions because we optimistically update spicetifyInfo after receiving events.
	try {
		const [type, data] = message.toUpperCase().split(" ");
		switch (type) {
			case "PLAYPAUSE": {
				Spicetify.Player.togglePlay();
				self.spicetifyInfo.State = self.spicetifyInfo.State === "PLAYING" ? "PAUSED" : "PLAYING";
				break;
			}
			case "NEXT":
				Spicetify.Player.next();
				break;
			case "PREVIOUS":
				Spicetify.Player.back();
				break;
			case "SETPOSITION": {
				// Example string: SetPosition 34:SetProgress 0,100890207715134:
				const [, positionPercentage] = message.toUpperCase().split(":")[1].split("SETPROGRESS ");
				Spicetify.Player.seek(parseFloat(positionPercentage.replace(",", ".")));
				break;
			}
			case "SETVOLUME":
				Spicetify.Player.setVolume(parseInt(data) / 100);
				break;
			case "REPEAT": {
				Spicetify.Player.toggleRepeat();
				self.spicetifyInfo.Repeat = self.spicetifyInfo.Repeat === "NONE" ? "ALL" : self.spicetifyInfo.Repeat === "ALL" ? "ONE" : "NONE";
				break;
			}
			case "SHUFFLE": {
				Spicetify.Player.toggleShuffle();
				self.spicetifyInfo.Shuffle = !self.spicetifyInfo.Shuffle;
				break;
			}
			case "TOGGLETHUMBSUP": {
				Spicetify.Player.toggleHeart();
				self.spicetifyInfo.Rating = self.spicetifyInfo.Rating === 5 ? 0 : 5;
				break;
			}
			// Spotify doesn't have a negative rating
			// case 'TOGGLETHUMBSDOWN': break
			case "RATING": {
				const rating = parseInt(data);
				const isLiked = storage.RATING > 3;
				if (rating >= 3 && !isLiked) Spicetify.Player.toggleHeart();
				else if (rating < 3 && isLiked) Spicetify.Player.toggleHeart();
				self.spicetifyInfo.Rating = rating;
				break;
			}
		}
	} catch (e) {
		self.send(`Error:Error sending event to ${self.spicetifyInfo.Player}`);
		self.send(`ErrorD:${e}`);
	}
}

function SendUpdateLegacy(self) {
	if (!Spicetify.Player.data && cache.get("state") !== 0) {
		cache.set("state", 0);
		ws.send("STATE:0");
		return;
	}

	self.spicetifyInfo.Position = timeInSecondsToString(Math.round(Spicetify.Player.getProgress() / 1000));
	self.spicetifyInfo.Volume = Math.round(Spicetify.Player.getVolume() * 100);

	Object.keys(self.spicetifyInfo).forEach(key => {
		try {
			let value = self.spicetifyInfo[key];
			// For numbers, round it to an integer
			if (typeof value === "number") value = Math.round(value);

			// Conversion to legacy values
			if (key === "State") value = value === "PLAYING" ? 1 : value === "PAUSED" ? 2 : 0;
			else if (key === "Repeat") value = value === "ALL" ? 2 : value === "ONE" ? 1 : 0;
			else if (key === "Shuffle") value = value ? 1 : 0;

			// Check for null, and not just falsy, because 0 and '' are falsy
			if (value !== null && value !== self.cache.get(key)) {
				self.send(`${key.toUpperCase()}:${value}`);
				self.cache.set(key, value);
			}
		} catch (e) {
			self.send(`Error: Error updating ${key} for ${self.spicetifyInfo.Player}`);
			self.send(`ErrorD:${e}`);
		}
	});
}

function OnMessageRev1(self, message) {
	// Quite lengthy functions because we optimistically update spicetifyInfo after receiving events.
	const [type, data] = message.split(" ");

	try {
		switch (type) {
			case "TOGGLE_PLAYING": {
				Spicetify.Player.togglePlay();
				self.spicetifyInfo.State = self.spicetifyInfo.State === "PLAYING" ? "PAUSED" : "PLAYING";
				break;
			}
			case "NEXT":
				Spicetify.Player.next();
				break;
			case "PREVIOUS":
				Spicetify.Player.back();
				break;
			case "SET_POSITION": {
				const [, positionPercentage] = data.split(":");
				Spicetify.Player.seek(parseFloat(positionPercentage.replace(",", ".")));
				break;
			}
			case "SET_VOLUME":
				Spicetify.Player.setVolume(parseInt(data) / 100);
				break;
			case "TOGGLE_REPEAT": {
				Spicetify.Player.toggleRepeat();
				self.spicetifyInfo.Repeat = self.spicetifyInfo.Repeat === "NONE" ? "ALL" : self.spicetifyInfo.Repeat === "ALL" ? "ONE" : "NONE";
				break;
			}
			case "TOGGLE_SHUFFLE": {
				Spicetify.Player.toggleShuffle();
				self.spicetifyInfo.Shuffle = !self.spicetifyInfo.Shuffle;
				break;
			}
			case "TOGGLE_THUMBS_UP": {
				Spicetify.Player.toggleHeart();
				self.spicetifyInfo.Rating = self.spicetifyInfo.Rating === 5 ? 0 : 5;
				break;
			}
			// Spotify doesn't have a negative rating
			// case 'TOGGLE_THUMBS_DOWN': break
			case "SET_RATING":
				const rating = parseInt(data);
				const isLiked = storage.RATING > 3;
				if (rating >= 3 && !isLiked) Spicetify.Player.toggleHeart();
				else if (rating < 3 && isLiked) Spicetify.Player.toggleHeart();
				self.spicetifyInfo.Rating = rating;
				break;
		}
	} catch (e) {
		self.send(`ERROR Error sending event to ${self.spicetifyInfo.Player}`);
		self.send(`ERRORDEBUG ${e}`);
	}
}

function SendUpdateRev1(self) {
	if (!Spicetify.Player.data && cache.get("state") !== "STOPPED") {
		cache.set("state", "STOPPED");
		ws.send("STATE STOPPED");
		return;
	}

	self.spicetifyInfo.Position = timeInSecondsToString(Math.round(Spicetify.Player.getProgress() / 1000));
	self.spicetifyInfo.Volume = Math.round(Spicetify.Player.getVolume() * 100);

	Object.keys(self.spicetifyInfo).forEach(key => {
		try {
			let value = self.spicetifyInfo[key];
			// For numbers, round it to an integer
			if (typeof value === "number") value = Math.round(value);
			// Check for null, and not just falsy, because 0 and '' are falsy
			if (value !== null && value !== self.cache.get(key)) {
				self.send(`${key.toUpperCase()} ${value}`);
				self.cache.set(key, value);
			}
		} catch (e) {
			self.send(`ERROR Error updating ${key} for ${self.spicetifyInfo.Player}`);
			self.send(`ERRORDEBUG ${e}`);
		}
	});
}

// Convert seconds to a time string acceptable to Rainmeter
function pad(num, size) {
	return num.toString().padStart(size, "0");
}
function timeInSecondsToString(timeInSeconds) {
	const timeInMinutes = Math.floor(timeInSeconds / 60);
	if (timeInMinutes < 60) return timeInMinutes + ":" + pad(Math.floor(timeInSeconds % 60), 2);

	return Math.floor(timeInMinutes / 60) + ":" + pad(Math.floor(timeInMinutes % 60), 2) + ":" + pad(Math.floor(timeInSeconds % 60), 2);
}
