// @ts-check

// NAME: Auto Skip Video
// AUTHOR: khanhas
// DESCRIPTION: Auto skip video

/// <reference path="../globals.d.ts" />

(function SkipVideo() {
    Spicetify.Player.addEventListener("songchange", () => {
        const meta = Spicetify.Player.data.track.metadata;
        // Ads are also video media type so I need to exclude them out.
        if (
            meta["media.type"] === "video" &&
            meta.is_advertisement !== "true"
        ) {
            Spicetify.Player.next();
        }
    });
})();
