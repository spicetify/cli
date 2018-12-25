// @ts-check
// START METADATA
// NAME: DJ Mode
// AUTHOR: khanhas
// DESCRIPTION: Queue only mode, Hide all controls. Toggles in Profile menu.
// END METADATA

/// <reference path="../globals.d.ts" />

(function DJMode() {
    if (!Spicetify.LocalStorage || !Spicetify.addToQueue || !Spicetify.LibURI) {
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

    const item = document.createElement("div");
    item.innerText = "DJ Mode";
    item.classList.add("MenuItem", "MenuItem--has-submenu");

    const subMenu = document.createElement("div");
    subMenu.classList.add("Menu", "Menu--is-submenu");

    const enableToggle = document.createElement("button");
    enableToggle.innerText = "Enabled";
    enableToggle.classList.add("MenuItem");
    enableToggle.onclick = () => {
        setting.enabled = !setting.enabled;
        Spicetify.LocalStorage.set("DJMode", JSON.stringify(setting));
        document.location.reload();
    };

    if (setting.enabled) {
        enableToggle.classList.add(
            "MenuItemToggle--checked",
            "MenuItem--is-active"
        );
    }

    const hideToggle = document.createElement("button");
    hideToggle.innerText = "Hide controls";
    hideToggle.classList.add("MenuItem");
    hideToggle.onclick = () => {
        setting.hideControls = !setting.hideControls;
        showHideControl(setting.hideControls);
        Spicetify.LocalStorage.set("DJMode", JSON.stringify(setting));
        if (setting.hideControls) {
            hideToggle.classList.add(
                "MenuItemToggle--checked",
                "MenuItem--is-active"
            );
        } else {
            hideToggle.classList.remove(
                "MenuItemToggle--checked",
                "MenuItem--is-active"
            );
        }
    };
    if (setting.enabled && setting.hideControls) {
        hideToggle.classList.add(
            "MenuItemToggle--checked",
            "MenuItem--is-active"
        );
    }

    subMenu.appendChild(enableToggle);
    subMenu.appendChild(hideToggle);
    item.appendChild(subMenu);
    item.onmouseenter = () => {
        subMenu.classList.add("open");
        item.classList.add("selected");
    };
    subMenu.onmouseleave = () => {
        subMenu.classList.remove("open");
        item.classList.remove("selected");
    };

    var menuEl = document.querySelector("#PopoverMenu-container");

    // Observing profile menu
    var menuObserver = new MutationObserver(() => {
        const root = menuEl.querySelector(".Menu__root-items");
        if (root) {
            root.prepend(item);
        }
    });

    menuObserver.observe(menuEl, { childList: true });

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
        const uriType = Spicetify.LibURI.fromString(uri).type;
        if (
            uriType === Spicetify.LibURI.Type.ALBUM ||
            uriType === Spicetify.LibURI.Type.TRACK ||
            uriType === Spicetify.LibURI.Type.EPISODE
        ) {
            return true;
        }
        return false;
    }

    /**
     *
     * @param {string} uri
     */
    function clickFunc(uri) {
        return () =>
            Spicetify.addToQueue(uri).then(() => {
                Spicetify.BridgeAPI.request(
                    "track_metadata",
                    [uri],
                    (_, track) => {
                        Spicetify.showNotification(
                            `${track.name} - ${
                                track.artists[0].name
                            } added to queue.`
                        );
                    }
                );
            });
    }

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

                playButton.appendChild(newButton);
                playButton.setAttribute("djmode-injected", "true");

                newButton.onclick = clickFunc(songURI);
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
