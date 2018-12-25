// @ts-check

// NAME: Christian Spotify
// AUTHOR: khanhas
// DESCRIPTION: Auto skip explicit songs. Toggle in Profile menu.

/// <reference path="../globals.d.ts" />

(function ChristianSpotify() {
    if (!Spicetify.LocalStorage) {
        setTimeout(ChristianSpotify, 200);
        return;
    }

    const BUTTON_TEXT = "Christian mode";

    let isEnabled = Spicetify.LocalStorage.get("ChristianMode") === "1";

    const item = document.createElement("div");
    item.classList.add("MenuItem");
    if (isEnabled) {
        item.classList.add("MenuItemToggle--checked");
    }

    item.innerText = BUTTON_TEXT;
    item.onclick = () => {
        isEnabled = !isEnabled;
        Spicetify.LocalStorage.set("ChristianMode", isEnabled ? "1" : "0");
        if (isEnabled) {
            item.classList.add(
                "MenuItemToggle--checked",
                "MenuItem--is-active"
            );
        } else {
            item.classList.remove(
                "MenuItemToggle--checked",
                "MenuItem--is-active"
            );
        }
    };

    let menuEl = document.getElementById("PopoverMenu-container");

    // Observing profile menu
    let menuObserver = new MutationObserver(() => {
        const menuRoot = menuEl.querySelector(".Menu__root-items");
        if (menuRoot) {
            menuRoot.prepend(item);
        }
    });

    menuObserver.observe(menuEl, { childList: true });

    Spicetify.Player.addEventListener("songchange", () => {
        if (!Spicetify.Player.data) return;

        const isExplicit =
            isEnabled &&
            Spicetify.Player.data.track.metadata.is_explicit === "true";
        if (isExplicit) {
            Spicetify.Player.next();
        }
    });
})();
