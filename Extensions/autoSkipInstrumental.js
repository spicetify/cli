// @ts-check

// NAME: Skip Instrumental
// AUTHOR: Chrissi2812
// DESCRIPTION: Auto skip instrumental songs. Toggle in Profile menu.

/// <reference path="../globals.d.ts" />

(function NonInstrumentalSpotify() {
    if (!Spicetify.LocalStorage) {
        setTimeout(NonInstrumentalSpotify, 1000);
        return;
    }

    let isEnabled = Spicetify.LocalStorage.get("skipInstrumental") === "1";

    new Spicetify.Menu.Item("Skip Instrumental", isEnabled, (self) => {
        isEnabled = !isEnabled;
        Spicetify.LocalStorage.set("skipInstrumental", isEnabled ? "1" : "0");
        self.setState(isEnabled);
    }).register();

    Spicetify.Player.addEventListener("songchange", () => {
        if (!isEnabled) return;
        const data = Spicetify.Player.data || Spicetify.Queue;
        if (!data) return;

        if (!data.track.metadata.title) return;

        const isInstrumental = data.track.metadata.title.toLowerCase().indexOf('instrumental') !== -1;
        if (isInstrumental === true) {
            Spicetify.Player.next();
        }
    });
})();
