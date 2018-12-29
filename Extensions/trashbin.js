//@ts-check

// NAME: Trashbin
// AUTHOR: khanhas
// DESCRIPTION: Throw songs to trashbin and never hear it again.

/// <reference path="../globals.d.ts" />

(function TrashBin() {
    /**
     * By default, trash songs list is saved in Spicetify.LocalStorage but
     * everything will be cleaned if Spotify is uninstalled. So instead
     * of collecting trash songs again, you can use JsonBin service to
     * store your list, which is totally free and fast. Go to website
     * https://jsonbin.io/ , create a jsonbin with default object:

{
    "trashSongList": {},
    "trashArtistList": {}
}

     * and hit Create. After that, it will generate an Access URL, hit Copy and
     * paste it to constant jsonBinURL below. URL should look like this:

        https://api.jsonbin.io/b/XXXXXXXXXXXXXXXXXXXX

     * Save this file, run "apply" command in Spicetify to push change.
     */
    const jsonBinURL = "";

    if (!Spicetify.Player.data || (!jsonBinURL && !Spicetify.LocalStorage)) {
        setTimeout(TrashBin, 1000);
        return;
    }

    let trashSongList = {};
    let trashArtistList = {};
    let userHitBack = false;
    /** @type {HTMLElement} */
    let trashIcon;

    let banSong = () => {};

    const THROW_TEXT = "Throw To Trashbin";
    const UNTHROW_TEXT = "Take Out Of Trashbin";

    function createTrashArtistButton() {
        const div = document.createElement("div");
        div.classList.add("glue-page-header__button", "throw-artist");

        const button = document.createElement("button");
        button.classList.add(
            "button",
            "button-icon-with-stroke",
            "spoticon-browse-active-16"
        );
        button.setAttribute("data-tooltip", THROW_TEXT);

        div.appendChild(button);
        return div;
    }

    function createTrashTrackButton() {
        const button = document.createElement("button");
        button.classList.add(
            "button",
            "button-icon-only",
            "spoticon-browse-active-16"
        );
        button.setAttribute("data-tooltip-text", THROW_TEXT);
        button.style.position = "absolute";
        button.style.right = "24px";
        button.style.top = "-6px";
        button.style.transform = "scaleX(0.75)";
        return button;
    }

    // Fetch stored trash tracks and artists list
    if (jsonBinURL) {
        fetch(`${jsonBinURL}/latest`)
            .then((res) => res.json())
            .then((data) => {
                trashSongList = data["trashSongList"];
                trashArtistList = data["trashArtistList"];

                if (!trashSongList || !trashArtistList) {
                    trashSongList = trashSongList || {};
                    trashArtistList = trashArtistList || {};

                    putDataOnline();
                }
            })
            .catch(console.log);
    } else {
        trashSongList =
            JSON.parse(Spicetify.LocalStorage.get("TrashSongList")) || {};
        trashArtistList =
            JSON.parse(Spicetify.LocalStorage.get("TrashArtistList")) || {};

        putDataLocal();
    }

    trashIcon = createTrashTrackButton();
    trashIcon.onclick = () => {
        banSong();
        const uri = Spicetify.Player.data.track.uri;
        const isBanned = !trashSongList[uri];
        if (isBanned) {
            trashSongList[uri] = true;
            Spicetify.Player.next();
        } else {
            delete trashSongList[uri];
        }

        updateTrackIconState(isBanned);

        storeList();
    };

    document.querySelector(".track-text-item").appendChild(trashIcon);

    // Tracking when users hit previous button.
    // By doing that, user can return to threw song to take it out of trashbin.
    document
        .getElementById("player-button-previous")
        .addEventListener("click", () => (userHitBack = true));

    updateIconPosition();
    updateTrackIconState(trashSongList[Spicetify.Player.data.track.uri]);

    Spicetify.Player.addEventListener("songchange", watchChange);

    Spicetify.Player.addEventListener("appchange", ({ data: data }) => {
        if (data.isEmbeddedApp === true) return;
        if (data.id !== "artist") return;
        if (data.container.contentDocument.querySelector(".throw-artist"))
            return;

        const headers = data.container.contentDocument.querySelectorAll(
            ".glue-page-header__buttons"
        );

        if (headers.length < 1) return;

        const uri = `spotify:artist:${data.uri.split(":")[3]}`;

        headers.forEach((h) => {
            const button = createTrashArtistButton();
            button.onclick = () => {
                const isBanned = !trashArtistList[uri];
                if (isBanned) {
                    trashArtistList[uri] = true;
                } else {
                    delete trashArtistList[uri];
                }

                storeList();
                updateArtistIconState(button, isBanned);
            };
            h.appendChild(button);
            updateArtistIconState(button, trashArtistList[uri] !== undefined);
        });
    });

    function watchChange() {
        const data = Spicetify.Player.data || Spicetify.Queue;
        if (!data) return;

        const isBanned = trashSongList[data.track.uri];
        updateIconPosition();
        updateTrackIconState(isBanned);

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

    // Change trash icon position based on playlist context
    // In normal playlists, track-text-item has one icon and its padding-left
    // is 32px, just enough for one icon. By appending two-icons class, its
    // padding-left is expanded to 64px.
    // In Discovery Weekly playlist, track-text-item has two icons: heart and ban.
    // Ban functionality is the kind of the same as our so instead of crowding
    // that tiny zone with 3 icons, I hide Spotify's Ban button and replace it with
    // trash icon. Nevertheless, I still activate Ban button context menu whenever
    // user clicks at trash icon.
    function updateIconPosition() {
        const trackContainer = document.querySelector(".track-text-item");

        if (!trackContainer.classList.contains("two-icons")) {
            trackContainer.classList.add("two-icons");
            trashIcon.style.right = "24px";
            return;
        }

        /** @type {HTMLElement} */
        const banButton = document.querySelector(
            ".track-text-item .nowplaying-ban-button"
        );

        if (banButton.style.display !== "none") {
            banButton.style.visibility = "hidden";
            trashIcon.style.right = "0px";
            banSong = banButton.click.bind(banButton);
        } else {
            banSong = () => {};
        }
    }

    /**
     *
     * @param {boolean} isBanned
     */
    function updateTrackIconState(isBanned) {
        if (
            Spicetify.Player.data.track.metadata["is_advertisement"] === "true"
        ) {
            trashIcon.setAttribute("disabled", "true");
            return;
        }

        trashIcon.removeAttribute("disabled");

        if (isBanned) {
            trashIcon.classList.add("active");
            trashIcon.setAttribute("data-tooltip-text", UNTHROW_TEXT);
        } else {
            trashIcon.classList.remove("active");
            trashIcon.setAttribute("data-tooltip-text", THROW_TEXT);
        }
    }

    /**
     *
     * @param {HTMLElement} button
     * @param {boolean} isBanned
     */
    function updateArtistIconState(button, isBanned) {
        const inner = button.querySelector("button");
        if (isBanned) {
            inner.classList.add("contextmenu-active");
            inner.setAttribute("data-tooltip", UNTHROW_TEXT);
        } else {
            inner.classList.remove("contextmenu-active");
            inner.setAttribute("data-tooltip", THROW_TEXT);
        }
    }

    function storeList() {
        if (jsonBinURL) {
            putDataOnline();
        } else {
            putDataLocal();
        }
    }

    function putDataOnline() {
        fetch(`${jsonBinURL}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                trashSongList,
                trashArtistList,
            }),
        }).catch(console.log);
    }

    function putDataLocal() {
        Spicetify.LocalStorage.set(
            "TrashSongList",
            JSON.stringify(trashSongList)
        );
        Spicetify.LocalStorage.set(
            "TrashArtistList",
            JSON.stringify(trashArtistList)
        );
    }
})();
