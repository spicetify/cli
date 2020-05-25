// @ts-check
// NAME: Bookmark
// AUTHOR: khanhas
// VERSION: 1.0
// DESCRIPTION: Store page, track, track with time to view/listen later.

/// <reference path="../globals.d.ts" />

(function Bookmark() {
    const { Player, LocalStorage, PlaybackControl, ContextMenu, URI } = Spicetify
    if (!(Player && LocalStorage && PlaybackControl && ContextMenu && URI)) {
        setTimeout(Bookmark, 300)
        return
    }

    // UI Text
    const BUTTON_NAME_TEXT = "Bookmark"
    const REMOVE_TEXT = "Remove"

    // Local Storage keys
    const STORAGE_KEY = "bookmark_spicetify"

    class BookmarkCollection {
        constructor() {
            const menu = createMenu()
            this.container = menu.container
            this.items = menu.menu
            this.lastScroll = 0
            this.container.onclick = () => {
                this.storeScroll()
                this.container.remove()
            }
            this.filter = 0;
            this.apply()
        }

        apply() {
            this.items.textContent = '' // Remove all childs
            this.items.append(createMenuItem("Current page", storeThisPage));
            this.items.append(createMenuItem("This track", storeTrack))
            this.items.append(createMenuItem("This track with time", storeTrackWithTime))

            const select = createSortSelect(this.filter);
            select.onchange = (event) => {
                this.filter = event.srcElement.selectedIndex;
                this.apply();
            }
            this.items.append(select);

            const collection = this.getStorage();
            for (const item of collection) {
                if (this.filter !== 0) {
                    const isTrack = this.isTrack(item.uri)
                    if (this.filter === 1 && isTrack) continue;
                    if (this.filter === 2 && !isTrack) continue;
                }

                this.items.append(new CardContainer(item))
            }
        }

        isTrack(uri) {
            return uri.startsWith("spotify:track:") || uri.startsWith("spotify:episode:");
        }

        getStorage() {
            const storageRaw = LocalStorage.get(STORAGE_KEY);
            let storage = [];

            if (storageRaw) {
                storage = JSON.parse(storageRaw);
            } else {
                LocalStorage.set(STORAGE_KEY, "[]")
            }

            return storage;
        }

        addToStorage(data) {
            data.id = `${data.uri}-${new Date().getTime()}`

            /** @type {Object[]} */
            const storage = this.getStorage();
            storage.unshift(data);

            LocalStorage.set(STORAGE_KEY, JSON.stringify(storage));
            this.apply()
        }

        removeFromStorage(id) {
            const storage = this.getStorage()
                .filter(item => item.id !== id)

            LocalStorage.set(STORAGE_KEY, JSON.stringify(storage));
            this.apply()
        }

        changePosition(x, y) {
            this.items.style.left = x + "px"
            this.items.style.top = y + 10 + "px"
        }

        storeScroll() {
            this.lastScroll = this.items.scrollTop
        }

        setScroll() {
            this.items.scrollTop = this.lastScroll
        }
    }

    class CardContainer extends HTMLElement {
        constructor(info) {
            super()
            const isTrack = Spicetify.URI.isTrack(info.uri) || Spicetify.URI.isEpisode(info.uri);

            this.innerHTML = `
<div class="card card-horizontal card-type-album ${info.imageUrl ? "" : "card-hidden-image"}" data-uri="${info.uri}" data-contextmenu="">
<div class="card-attention-highlight-box"></div>
<div class="card-horizontal-interior-wrapper">
    ${info.imageUrl ? `
        <div class="card-image-wrapper">
            <div class="card-image-hit-area">
                <a href="${info.uri}" class="card-image-link">
                    <div class="card-hit-area-counter-scale-left"></div>
                    <div class="card-image-content-wrapper">
                        <div class="card-image" style="background-image: url('${info.imageUrl}')"></div>
                    </div>
                </a>
                <div class="card-overlay"></div>
                ${isTrack ? `<button class="button button-play button-icon-with-stroke card-button-play"></button>` : ""}
            </div>
        </div>
    ` : ""}
    <div class="card-info-wrapper">
        <div class="bookmark-controls">
            <button class="button button-green button-icon-only spoticon-x-16" data-tooltip="${REMOVE_TEXT}"></button>
        </div>
        <a href="${info.uri}">
            <div class="card-info-content-wrapper">
                <div class="card-info-title"><span class="card-info-title-text">${info.title}</span></div>
                <div class="card-info-subtitle-description"><span>${info.description}</span></div>
                ${info.time ? `
                    <div class="bookmark-fixed-height">
                        <div class="bookmark-progress">
                            <div class="bookmark-progress__bar" style="--progress:${info.progress}"></div>
                        </div>
                        <span class="bookmark-progress__time">${Player.formatTime(info.time)}</span>
                    </div>
                ` : ""}
            </div>
        </a>
    </div>
</div>
</div>`

            if (isTrack) {
                /** @type {HTMLButtonElement} */
                const playButton = this.querySelector("button.button-play");
                const option = {};
                if (info.time) {
                    option.seekTo = info.time;
                }
                playButton.onclick = () => {
                    PlaybackControl.playTrack(info.uri, option, () => { })
                }
            }

            /** @type {HTMLDivElement} */
            const controls = this.querySelector(".bookmark-controls")
            controls.onclick = (event) => {
                LIST.removeFromStorage(info.id)
                event.stopPropagation()
            }
        }
    }

    customElements.define("bookmark-card-container", CardContainer)

    const LIST = new BookmarkCollection()

    document.querySelector("#view-browser-navigation-top-bar")
        .append(createTopBarButton())

    // Add context menu items for Notification button
    const checkURI = ([uri]) => uri === "spotify:special:bookmark"
    new ContextMenu.Item("Current page", storeThisPage, checkURI).register()
    new ContextMenu.Item("This track", storeTrack, checkURI).register()
    new ContextMenu.Item("This track with time", storeTrackWithTime, checkURI).register()

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

    function createSortSelect(defaultOpt = 0) {
        const select = document.createElement("select");
        select.className = "GlueDropdown bookmark-filter";
        const allOpt = document.createElement("option");
        allOpt.text = "All";
        const pageOpt = document.createElement("option");
        pageOpt.text = "Page";
        const trackOpt = document.createElement("option");
        trackOpt.text = "Track";

        select.onclick = (ev) => ev.stopPropagation();
        select.append(allOpt, pageOpt, trackOpt);
        select.options[defaultOpt].selected = true;

        return select;
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
        LIST.addToStorage({
            uri: app.uri,
            title: app.title,
            description: appUriToName(app.uri),
            imageUrl: app.imageUrl,
        });
    }

    function storeTrack() {
        const uri = Player.data.track.uri;
        let description;
        if (Spicetify.URI.isEpisode(uri)) {
            description = Player.data.track.metadata.album_title;
        } else {
            description = Player.data.track.metadata.artist_name;
        }
        LIST.addToStorage({
            uri,
            title: Player.data.track.metadata.title,
            description,
            imageUrl: Player.data.track.metadata.image_url,
        });
    }

    function storeTrackWithTime() {
        const uri = Player.data.track.uri;
        let description;
        if (Spicetify.URI.isEpisode(uri)) {
            description = Player.data.track.metadata.album_title;
        } else {
            description = Player.data.track.metadata.artist_name;
        }
        LIST.addToStorage({
            uri,
            time: Player.getProgress(),
            progress: Player.getProgressPercent(),
            title: Player.data.track.metadata.title,
            description,
            imageUrl: Player.data.track.metadata.image_url,
        })
    }

    // Utilities
    function appUriToName(uri) {
        const id = URI.from(uri).id
            .replace(/\-/g, " ")
            .replace(/^.|\s./g, (char) => char.toUpperCase());

        return `${id} page`;
    }

    function createTopBarButton() {
        const button = document.createElement("button")
        button.classList.add("button", "spoticon-tag-16", "bookmark-button")
        button.setAttribute("data-tooltip", BUTTON_NAME_TEXT)
        button.setAttribute("data-contextmenu", "")
        button.setAttribute("data-uri", "spotify:special:bookmark")
        button.onclick = () => {
            const bound = button.getBoundingClientRect()
            LIST.changePosition(bound.left, bound.top)
            document.body.append(LIST.container)
            LIST.setScroll()
        }
        return button
    }

    function createMenu() {
        const container = document.createElement("div")
        container.id = "bookmark-spicetify"
        container.className = "context-menu-container"
        container.style.zIndex = "1029"

        const style = document.createElement("style")
        style.textContent = `
#bookmark-menu {
    display: inline-block;
    width: 33%;
    max-height: 70%;
    overflow: hidden auto;
    padding: 10px
}
.bookmark-filter {
    margin-top: 7px;
}
.bookmark-controls {
    position: absolute;
    right: 0;
    bottom: 0;
    padding: 0 5px 5px 0;
    z-index: 3
}

.bookmark-fixed-height {
    height: 40px;
    display: flex;
    align-items: center;
  }
  
.bookmark-progress {
    overflow: hidden;
    width: 100px;
    height: 4px;
    border-radius: 2px;
    background-color: var(--modspotify_slider_bg);
}

.bookmark-progress__bar {
    --progress: 0;
    width: calc(var(--progress) * 100%);
    height: 4px;
    background-color: var(--modspotify_main_fg);
}

.bookmark-progress__time {
    padding-left: 5px;
    color: var(--modspotify_secondary_fg);
}
`

        const menu = document.createElement("ul")
        menu.id = "bookmark-menu"
        menu.className = "context-menu"

        container.append(style, menu)

        return { container, menu }
    }
})()

