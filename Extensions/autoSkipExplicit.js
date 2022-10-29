// NAME: Christian Spotify
// AUTHOR: khanhas
// DESCRIPTION: Auto skip explicit songs. Toggle in Profile menu.

/// <reference path="../globals.d.ts" />

(function ChristianSpotify() {
	if (!Spicetify.LocalStorage) {
		setTimeout(ChristianSpotify, 1000);
		return;
	}

	let isEnabled = Spicetify.LocalStorage.get("ChristianMode") === "1";

	new Spicetify.Menu.Item("Christian mode", isEnabled, self => {
		isEnabled = !isEnabled;
		Spicetify.LocalStorage.set("ChristianMode", isEnabled ? "1" : "0");
		self.setState(isEnabled);
	}).register();

	Spicetify.Player.addEventListener("songchange", () => {
		if (!isEnabled) return;
		const data = Spicetify.Player.data || Spicetify.Queue;
		if (!data) return;

		const isExplicit = data.track.metadata.is_explicit;
		if (isExplicit === "true") {
			Spicetify.Player.next();
		}
	});
})();
