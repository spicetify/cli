// @ts-check
// NAME: Podcast Songs
// AUTHOR: xXChampionsXx
// VERSION: 0.1
// DESCRIPTION: Makes all Songs start from 0 Seconds (So basically only applies to Podcasts)

/// <reference path="../globals.d.ts" />

(function PodcastSongs() {
    Spicetify.Player.addEventListener("songchange", (event) => {
        Spicetify.Player.seek(0);
    });
})();
