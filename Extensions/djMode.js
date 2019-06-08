// @ts-check
// START METADATA
// NAME: DJ Mode
// AUTHOR: khanhas
// DESCRIPTION: Queue only mode, Hide all controls. Toggles in Profile menu.
// END METADATA

/// <reference path="../globals.d.ts" />

(function DJMode() {
    if (!Spicetify.LocalStorage || !Spicetify.addToQueue || !Spicetify.URI) {
        setTimeout(DJMode, 1000);
        return;
    }

    /**
     * @type {{enabled: boolean; hideControls: boolean}}
     */
    let setting = JSON.parse(Spicetify.LocalStorage.get("DJMode"));
    if (!setting || typeof setting !== "object") {
        setting = {
            enabled: false,
            hideControls: false,
        };
        Spicetify.LocalStorage.set("DJMode", JSON.stringify(setting));
    }

    const enableToggle = new Spicetify.Menu.Item(
        "Enabled",
        setting.enabled,
        () => {
            setting.enabled = !setting.enabled;
            Spicetify.LocalStorage.set("DJMode", JSON.stringify(setting));
            document.location.reload();
        }
    );

    const hideToggle = new Spicetify.Menu.Item(
        "Hide controls",
        setting.enabled && setting.hideControls,
        () => {
            setting.hideControls = !setting.hideControls;
            showHideControl(setting.hideControls);
            hideToggle.setState(setting.hideControls);
            Spicetify.LocalStorage.set("DJMode", JSON.stringify(setting));
        }
    );

    new Spicetify.Menu.SubMenu("DJ Mode", [
        enableToggle,
        hideToggle,
    ]).register();

    if (!setting.enabled) {
        // Do nothing when DJ Mode is off
        return;
    }

    /** @type {HTMLElement} */
    const playerControl = document.querySelector(".player-controls-container");
    /** @type {HTMLElement} */
    const extraControl = document.querySelector(".extra-controls-container");
    /** @type {HTMLElement} */
    const nowPlayingAddButton = document.querySelector(
        ".view-player .nowplaying-add-button"
    );

    const IFRAME_HIDE_ELEMENT_LIST =
        [
            '[data-ta-id="card-button-play"]',
            '[data-ta-id="card-button-add"]',
            '[data-ta-id="card-button-context-menu"]',
            "div.glue-page-header__buttons",
            "th.tl-more",
            ".tl-cell.tl-more",
            "th.tl-save",
            ".tl-cell.tl-save",
            "th.tl-feedback",
            ".tl-cell.tl-feedback",
            "th.tl-more",
            ".tl-cell.tl-more",
        ].join(",") + "{display: none !important}";

    const EMBEDDED_HIDE_ELEMENT_LIST =
        [
            "div.Header__buttons",
            '[data-ta-id="play-button"]',
            '[data-ta-id="card-button-add"]',
            '[data-ta-id="card-button-context-menu"]',
            '[data-ta-id="ta-table-cell-add"]',
            '[data-ta-id="ta-table-cell-more"]',
            'th[aria-label=""]',
        ].join(",") + "{display: none !important}";

    /**
     * @param {boolean} hide
     */
    function showHideControl(hide) {
        if (hide) {
            playerControl.style.display = "none";
            extraControl.style.display = "none";
            nowPlayingAddButton.style.display = "none";
        } else {
            playerControl.style.display = "";
            extraControl.style.display = "";
            nowPlayingAddButton.style.display = "";
        }
    }

    showHideControl(setting.hideControls);

    let interval;
    Spicetify.Player.addEventListener("appchange", ({ data: data }) => {
        interval && clearInterval(interval);
        if (data.isEmbeddedApp === true) {
            interval = setInterval(() => applyEmbedded(data.container), 500);
        } else {
            interval = setInterval(
                () => applyIframe(data.container.contentDocument),
                500
            );
        }
    });

    /**
     * @param {string} uri
     * @returns {boolean} whether input uri is supported
     */
    function isValidURI(uri) {
        const uriType = Spicetify.URI.fromString(uri).type;
        if (
            uriType === Spicetify.URI.Type.ALBUM ||
            uriType === Spicetify.URI.Type.TRACK ||
            uriType === Spicetify.URI.Type.EPISODE
        ) {
            return true;
        }
        return false;
    }

    /**
     *
     * @param {string} uri
     */
    const clickFunc = (uri) => () =>
        Spicetify.addToQueue(uri).then(() => {
            Spicetify.BridgeAPI.request("track_metadata", [uri], (_, track) => {
                Spicetify.showNotification(
                    `${track.name} - ${track.artists[0].name} added to queue.`
                );
            });
        });

    /**
     *
     * @param {Document} doc
     */
    function applyIframe(doc) {
        doc.querySelectorAll(
            ".tl-cell.tl-play, .tl-cell.tl-number, .tl-cell.tl-type"
        ).forEach((cell) => {
            const playButton = cell.querySelector("button");
            if (playButton.hasAttribute("djmode-injected")) {
                return;
            }

            const songURI = cell.parentElement.getAttribute("data-uri");
            if (!isValidURI(songURI)) {
                return;
            }

            // Remove all default interaction intent
            playButton.setAttribute("data-button", "");
            playButton.setAttribute("data-ta-id", "");
            playButton.setAttribute("data-interaction-target", "");
            playButton.setAttribute("data-interaction-intent", "");
            playButton.setAttribute("data-log-click", "");

            playButton.setAttribute("djmode-injected", "true");
            playButton.onclick = clickFunc(songURI);

            cell.parentElement.ondblclick = (event) => {
                clickFunc(songURI)();
                event.stopImmediatePropagation();
            };
        });

        if (setting.hideControls) {
            addCSS(doc, "IframeDJModeHideControl", IFRAME_HIDE_ELEMENT_LIST);
        } else {
            removeCSS(doc, "IframeDJModeHideControl");
        }
    }

    /**
     *
     * @param {HTMLElement} container
     */
    function applyEmbedded(container) {
        const cellList = container.querySelectorAll(".TableCellTrackNumber");
        cellList.forEach((/** @type {HTMLElement} */ cell) => {
            const songURI = cell.parentElement.getAttribute("data-ta-uri");

            if (!isValidURI(songURI)) {
                return;
            }

            cell.onmouseover = () => {
                const playButton = cell.querySelector(
                    ".TableCellTrackNumber__button-wrapper"
                );
                if (playButton.hasAttribute("djmode-injected")) {
                    return;
                }

                const newButton = document.createElement("button");
                newButton.setAttribute("type", "button");
                newButton.classList.add(
                    "button",
                    "button-icon-with-stroke",
                    "button-play"
                );

                playButton.removeChild(playButton.querySelector("button"));
                playButton.appendChild(newButton);
                playButton.setAttribute("djmode-injected", "true");

                newButton.onclick = clickFunc(songURI);
            };

            cell.parentElement.ondblclick = (event) => {
                clickFunc(songURI)();
                event.stopImmediatePropagation();
            };
        });

        if (setting.hideControls) {
            addCSS(
                document,
                "EmbeddedDJModeHideControl",
                EMBEDDED_HIDE_ELEMENT_LIST
            );
        } else {
            removeCSS(document, "EmbeddedDJModeHideControl");
        }
    }

    /**
     * @param {Document} doc
     * @param {string} id
     * @param {string} text
     */
    function addCSS(doc, id, text) {
        if (!doc.querySelector("head #" + id)) {
            const style = document.createElement("style");
            style.id = id;
            style.innerText = text;
            doc.querySelector("head").append(style);
        }
    }

    /**
     * @param {Document} doc
     * @param {string} id
     */
    function removeCSS(doc, id) {
        const found = doc.querySelector("head #" + id);
        if (found) {
            found.remove();
        }
    }
})();
