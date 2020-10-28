// @ts-check

// NAME: Non-festive Spotify
// AUTHOR: Zedeldi (based on https://github.com/khanhas/spicetify-cli/blob/master/Extensions/autoSkipExplicit.js)
// VERSION: 1.0
// DESCRIPTION: Auto skip festive songs. Toggle in Profile menu.

/// <reference path="../globals.d.ts" />

(function NonFestiveSpotify() {
    if (!Spicetify.LocalStorage) {
        setTimeout(NonFestiveSpotify, 1000);
        return;
    }

    let isEnabled = Spicetify.LocalStorage.get("NonFestiveMode") === "1";

    new Spicetify.Menu.Item("Non-festive mode", isEnabled, (self) => {
        isEnabled = !isEnabled;
        Spicetify.LocalStorage.set("NonFestiveMode", isEnabled ? "1" : "0");
        self.setState(isEnabled);
    }).register();

    Spicetify.Player.addEventListener("songchange", () => {
        if (!isEnabled) return;
        const data = Spicetify.Player.data || Spicetify.Queue;
        if (!data) return;

        const regexList = [/christmas/i, /xmas/i, /santa/i, /claus/i, /mistletoe/i, /winter wonderland/i, /rudolph/i, /feliz navidad/i, /no[ëe]l/i];
        const text = data.track.metadata.title + ' ' + data.track.metadata.album_title;
        if (regexList.some(rx => rx.test(text))) {
            Spicetify.Player.next();
        }
    });
})();
