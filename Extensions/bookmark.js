// @ts-check
// NAME: Bookmark
// AUTHOR: khanhas
// VERSION: 0.1
// DESCRIPTION: Store page, track, track with time to view/listen later.

/// <reference path="../globals.d.ts" />

(function Bookmark() {
    if (!Spicetify.LocalStorage) {
        setTimeout(Bookmark, 1000);
        return;
    }

    const STORAGE_KEY = "bookmark_spicetify";

    const bookmarkButton = createButton();

    document.querySelector("#view-browser-navigation-top-bar")
        .append(bookmarkButton);

    function createButton() {
        const button = document.createElement("button");
        button.classList.add("button", "button-icon-only", "spoticon-tag-16");
        button.setAttribute("type", "button");
        button.setAttribute("data-tooltip", "Bookmark");
        button.setAttribute("aria-label", "Bookmark");
        button.onclick = () => {
            const bound = button.getBoundingClientRect();
            document.body.append(createMenu(bound.left, bound.bottom));
        };
        return button
    }

    /**
     * 
     * @param {number} x Position of the bookmark button
     * @param {number} y 
     */
    function createMenu(x, y) {
        const container = document.createElement("div");
        container.id = "bookmark-spicetify";
        container.classList.add("context-menu-container");
        Object.assign(container.style, {
            zIndex: "2147483647",
            height: "100%",
            width: "100%",
            position: "absolute",
            top: "0",
        });

        container.onclick = () => container.remove();

        const menu = document.createElement("div");
        menu.classList.add("context-menu");
        menu.style.left = `${x}px`;
        menu.style.top = `${y}px`;
        menu.style.display = "inline-block";
        menu.style.opacity = "1";
        menu.style.height = "auto";

        menu.append(createMenuItem("Current page", storeThisPage));
        menu.append(createMenuItem("This track", storeTrack))
        menu.append(createMenuItem("This track with time", storeTrackWithTime))

        container.append(menu);

        return container;
    }

    /**
     * 
     * @param {string} name 
     * @param {() => void} callback 
     */
    function createMenuItem(name, callback) {
        const item = document.createElement("div");
        item.classList.add("item");
        item.onclick = callback;
        item.onmouseover = () => item.classList.add("hover");
        item.onmouseleave = () => item.classList.remove("hover");

        const text = document.createElement("span");
        text.classList.add("text");
        text.innerText = name;

        item.append(text);

        return item;
    }

    function getActiveApp() {
        const uriRaw = localStorage[`${__spotify.username}:activeApp`];
        let uri = "";
        if (!uriRaw) {
            return;
        }

        uri = JSON.parse(uriRaw).uri;

        if (!uri) {
            return;
        }

        /** @type {HTMLIFrameElement} */
        const iframe = document.querySelector("iframe.active");
        if (iframe) {
            const header = iframe.contentDocument.querySelector("#header, header");
            let imageUrl = "";
            const bgImage = header
                .querySelector(".glue-page-header__background-image");
            if (!bgImage) {
                const cardImage = header.querySelector(".card-image");
                if (cardImage) {
                    imageUrl = cardImage.getAttribute("data-image-url");
                }
            } else {
                imageUrl = bgImage
                    .getAttribute("data-glue-page-header-background-image-url");
            }

            return {
                title: header.querySelector(".glue-page-header__title").innerText,
                uri,
                imageUrl,
            };
        }

        /** @type {HTMLDivElement} */
        const embebbed = document.querySelector(".embedded-app.active");
        if (embebbed) {
            let imageUrl = "";
            const cardImage = embebbed.querySelector(".Card__image");
            if (cardImage) {
                imageUrl = cardImage.style
                    .backgroundImage
                    .replace(`url("`, "").replace(`")`, "");
            }

            return {
                title: embebbed.querySelector(".Header__title-text").innerText,
                uri,
                imageUrl,
            };
        }
    }

    function storeThisPage() {
        const app = getActiveApp();
        if (!app) {
            Spicetify.showNotification && 
                Spicetify.showNotification("Cannot recognize page.");
            return;
        }
        writeToLocalStorage({
            uri: app.uri,
            title: app.title,
            description: appUriToName(app.uri),
            imageUrl: app.imageUrl,
        });
    }

    function storeTrack() {
        writeToLocalStorage({
            uri: Spicetify.Player.data.track.uri,
            title: Spicetify.Player.data.track.metadata.title,
            description: Spicetify.Player.data.track.metadata.artist_name,
            imageUrl: Spicetify.Player.data.track.metadata.image_url,
        });
    }

    function storeTrackWithTime() {
        const progress = Spicetify.Player.getProgress();
        writeToLocalStorage({
            uri: Spicetify.Player.data.track.uri,
            time: progress,
            progress: Spicetify.Player.getProgressPercent(),
            title: Spicetify.Player.data.track.metadata.title,
            description: Spicetify.Player.data.track.metadata.artist_name,
            imageUrl: Spicetify.Player.data.track.metadata.image_url,
        })
    }

    function getStorage() {
        const storageRaw = Spicetify.LocalStorage.get(STORAGE_KEY);
        let storage = [];

        if (storageRaw) {
            storage = JSON.parse(storageRaw);
        } else {
            Spicetify.LocalStorage.set(STORAGE_KEY, "[]")
        }

        return storage;
    }

    /**
     * 
     * @param {Object} data 
     */
    function writeToLocalStorage(data) {
        data.id = `${data.uri}-${new Date().getTime()}`

        /** @type {Object[]} */
        const storage = getStorage();
        storage.unshift(data);

        Spicetify.LocalStorage.set(STORAGE_KEY, JSON.stringify(storage));

        // Emit to Bookmark app to update content
        const app = document.getElementById("app-bookmark");
        if (app) {
            app.contentDocument.dispatchEvent(new Event("bookmark-update"));
        }
    }

    // Utilities
    function appUriToName(uri) {
        const id = Spicetify.URI.from(uri).id
            .replace(/\-/g, " ")
            .replace(/^.|\s./g, (char) => char.toUpperCase());
            
        return `${id} page`;
    }
})();
