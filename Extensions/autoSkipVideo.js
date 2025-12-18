// NAME: Auto Skip Video
// AUTHOR: khanhas
// DESCRIPTION: Auto skip video

/// <reference path="../globals.d.ts" />

(function SkipVideo() {
	Spicetify.Player.addEventListener("songchange", () => {
		const data = Spicetify.Player.data || Spicetify.Queue;
		const meta = data?.item?.metadata;
		if (!data) return;

		if (meta["media.type"] === "video" && !meta.is_advertisement) {
            console.log(`Skipping video: ${meta.name} by ${meta.artist_name}`);
            Spicetify.Player.next();
		}
	});
})();
