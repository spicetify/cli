// @ts-check
// NAME: Bookmark
// AUTHOR: khanhas
// VERSION: 2.0
// DESCRIPTION: Store page, track, track with time to view/listen later.

/// <reference path="../globals.d.ts" />

(function Bookmark() {
    const topBar = document.querySelector(".main-topBar-historyButtons");
    const { CosmosAsync, Player, LocalStorage, PlaybackControl, ContextMenu, URI } = Spicetify;
    if (!(CosmosAsync && URI && topBar)) {
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
            this.items.append(createMenuItem("Track", storeTrack))
            this.items.append(createMenuItem("Track with timestamp", storeTrackWithTime))

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
            this.apply();
        }

        removeFromStorage(id) {
            const storage = this.getStorage()
                .filter(item => item.id !== id)

            LocalStorage.set(STORAGE_KEY, JSON.stringify(storage));
            this.apply();
        }

        changePosition(x, y) {
            this.items.style.left = x + "px"
            this.items.style.top = y + 40 + "px"
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
            const uri = URI.fromString(info.uri);
            const isPlayable = uri.type === URI.Type.TRACK ||
                uri.type === URI.Type.PLAYLIST_V2 ||
                uri.type === URI.Type.ALBUM ||
                uri.type === URI.Type.EPISODE ||
                uri.type === URI.Type.PLAYLIST;

            this.innerHTML = `
<div class="bookmark-card">
    ${info.imageUrl ? `<img aria-hidden="false" draggable="false" loading="eager" src="${info.imageUrl}" alt="${info.title}" class="bookmark-card-image">` : ""}
    <div class="bookmark-card-info">
        <div class="main-type-balladBold"><span>${info.title}</span></div>
        <div class="main-type-mesto"><span>${info.description}</span></div>
        ${info.time ? `
            <div class="bookmark-fixed-height">
                <div class="bookmark-progress">
                    <div class="bookmark-progress__bar" style="--progress:${info.progress}"></div>
                </div>
                <span class="bookmark-progress__time main-type-mesto">${Player.formatTime(info.time)}</span>
            </div>
        ` : ""}
    </div>
    ${isPlayable ? `<button class="main-playButton-PlayButton main-playButton-primary" aria-label="Play" title="Play" style="--size:48px;"><svg role="img" height="24" width="24" viewBox="0 0 16 16" fill="currentColor"><path d="M4.018 14L14.41 8 4.018 2z"></path></svg></button>` : ""}
    <button class="bookmark-controls" title="${REMOVE_TEXT}"><svg width="8" height="8" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons.x}</svg></button>
</div>
`

            if (isPlayable) {
                /** @type {HTMLButtonElement} */
                const playButton = this.querySelector("button.main-playButton-PlayButton");
                playButton.onclick = (event) => {
                    onPlayClick(info);
                    event.stopPropagation();
                }
            }

            /** @type {HTMLDivElement} */
            const controls = this.querySelector(".bookmark-controls");
            controls.onclick = (event) => {
                LIST.removeFromStorage(info.id);
                event.stopPropagation();
            }

            this.onclick = () => onLinkClick(info);
        }
    }

    customElements.define("bookmark-card-container", CardContainer)

    const LIST = new BookmarkCollection()

    topBar.append(createTopBarButton())

    /**
     * 
     * @param {string} name 
     * @param {() => void} callback 
     */
    function createMenuItem(name, callback) {
        const item = document.createElement("div");
        item.classList.add("bookmark-menuitem");
        item.onclick = callback;

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

    async function storeThisPage() {
        let title;
        let description;
        
        const context = Spicetify.Platform.History.location.pathname;
        const contextUri = Spicetify.URI.fromString(context);
        const uri = contextUri.toURI();

        let titleElem = document.querySelector(".Root__main-view h1") ||
            document.querySelector(".Root__main-view h2") ||
            document.querySelector(".Root__main-view h3") || 
            document.querySelector(".Root__main-view a");

        if (titleElem) {
            title = titleElem.innerText;
        }

        if (contextUri.type === URI.Type.APPLICATION) {
            title = idToProperName(contextUri.id);
            description = "Application";
        } else {
            description = contextUri.type.replace(/\-.+$/, "");
            const tail = context.split("/");
            if (tail.length > 3) {
                description += " " + tail[3];
            }
            description = idToProperName(description);
        }

        const headerElem = document.querySelector(".Root__main-view .main-entityHeader-background");
        let imageUrl = headerElem?.style
            .backgroundImage
            .replace('url(\"', "")
            .replace('")', "");

        if (!imageUrl) {
            const firstImgElem = document.querySelector(".Root__main-view img");
            imageUrl = firstImgElem?.src;
        }

        LIST.addToStorage({
            uri,
            title,
            description,
            imageUrl,
            context,
        });
    }

    function getTrackMeta() {
        const meta = {
            title: Player.data.track.metadata.title,
            imageUrl: Player.data.track.metadata.image_url,
        };
        meta.uri = Player.data.track.uri;
        if (URI.isEpisode(meta.uri)) {
            meta.description = Player.data.track.metadata.album_title;
        } else {
            meta.description = Player.data.track.metadata.artist_name;
        }
        const contextUri = URI.fromString(Spicetify.Player.data.context_uri);
        if (
            contextUri && (
                contextUri.type === URI.Type.PLAYLIST ||
                contextUri.type === URI.Type.PLAYLIST_V2 ||
                contextUri.type === URI.Type.ALBUM
            )
        ) {
            meta.context = `/${contextUri.toURLPath()}?uid=${Player.data.track.uid}`;
        }

        return meta;
    }

    function storeTrack() {
        LIST.addToStorage(getTrackMeta());
    }

    function storeTrackWithTime() {
        const meta = getTrackMeta();
        meta.time = Player.getProgress();
        meta.progress = Player.getProgressPercent();
        LIST.addToStorage(meta);
    }

    // Utilities
    function idToProperName(id) {
        id = id
            .replace(/\-/g, " ")
            .replace(/^.|\s./g, (char) => char.toUpperCase());

        return id;
    }

    function createTopBarButton() {
        const button = document.createElement("button");
        button.classList.add("main-topBar-button", "bookmark-button");
        button.setAttribute("title", BUTTON_NAME_TEXT);
        button.innerHTML = `<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor"><path d="M 13.350175,0.37457282 C 9.7802043,0.37457282 6.2102339,0.37457282 2.6402636,0.37457282 2.1901173,0.43000784 2.3537108,0.94911284 2.3229329,1.2621688 2.3229329,5.9446788 2.3229329,10.62721 2.3229329,15.309742 2.4084662,15.861041 2.9630936,15.536253 3.1614158,15.248148 4.7726941,13.696623 6.3839408,12.145098 7.9952191,10.593573 9.7069009,12.241789 11.418583,13.890005 13.130265,15.53822 13.626697,15.863325 13.724086,15.200771 13.667506,14.853516 13.667506,10.132999 13.667506,5.4124518 13.667506,0.69190384 13.671726,0.52196684 13.520105,0.37034182 13.350175,0.37457282 Z M 13.032844,14.563698 C 11.426929,13.017345 9.8210448,11.470993 8.2151293,9.9246401 7.8614008,9.6568761 7.6107412,10.12789 7.3645243,10.320193 5.8955371,11.734694 4.4265815,13.149196 2.9575943,14.563698 2.9575943,10.045543 2.9575943,5.5273888 2.9575943,1.0092338 6.3160002,1.0092338 9.674438,1.0092338 13.032844,1.0092338 13.032844,5.5273888 13.032844,10.045543 13.032844,14.563698 Z"></path></svg>`;
        button.onclick = () => {
            const bound = button.getBoundingClientRect();
            LIST.changePosition(bound.left, bound.top);
            document.body.append(LIST.container);
            LIST.setScroll();
        }
        return button;
    }

    function createMenu() {
        const container = document.createElement("div");
        container.id = "bookmark-spicetify";
        container.className = "context-menu-container";
        container.style.zIndex = "1029";

        const style = document.createElement("style");
        style.textContent = `
#bookmark-spicetify {
    position: absolute;
    left: 0;
    right: 0;
    width: 100vw;
    height: 100vh;
    background-color: #40404040;
    z-index: 5000;
}
#bookmark-menu {
    display: inline-block;
    width: 25%;
    min-width: 380px;
    max-height: 70%;
    overflow: hidden auto;
    padding: 10px;
    position: absolute;
    z-index: 5001;
    background: var(--spice-card);
    border-radius: 5px;
    box-shadow: 0 4px 12px 4px rgba(var(--spice-rgb-shadow),.5);
}
.bookmark-card {
    display: flex;
    flex-direction: row;
    justify-content: flex-start;
    align-items: center;
    margin-top: 20px;
    cursor: pointer;
}
.bookmark-card-image {
    width: 70px;
    height: 70px;
    object-fit: cover;
    object-position: center center;
    border-radius: 4px;
}
.bookmark-card-info {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    padding: 10px 20px;
    color: var(--spice-text);
}
.bookmark-card-info span {
    -webkit-line-clamp: 1;
    -webkit-box-orient: vertical;
    display: -webkit-box;
    white-space: normal;
    overflow: hidden;
    text-overflow: ellipsis;
}
.bookmark-filter {
    margin-top: 7px;
    margin-left: 8px;
    border-radius: 4px;
    padding: 0 8px 0 12px;
    height: 32px;
    align-items: center;
    background-color: var(--spice-button);
    border: 0;
    color: var(--spice-text);
}
.bookmark-controls {
    margin: 10px 0 10px 10px;
    width: 24px;
    height: 24px;
    align-items: center;
    background-color: rgba(var(--spice-rgb-shadow),.7);
    border: none;
    border-radius: 50%;
    color: var(--spice-text);
    cursor: pointer;
    display: inline-flex;
    justify-content: center;
    padding: 8px;
}
.bookmark-fixed-height {
    height: 30px;
    display: flex;
    align-items: center;
}
.bookmark-progress {
    overflow: hidden;
    width: 100px;
    height: 4px;
    border-radius: 2px;
    background-color: var(--spice-subtext);
}

.bookmark-progress__bar {
    --progress: 0;
    width: calc(var(--progress) * 100%);
    height: 4px;
    background-color: var(--spice-button-active);
}

.bookmark-progress__time {
    padding-left: 5px;
    color: var(--spice-subtext);
}
.bookmark-menuitem {
    padding: 10px 20px;
    transition: background-color,color 0.1s ease;
    background-color: transparent;
    border-radius: 3px;
    color: var(--spice-text);
}
.bookmark-menuitem:hover {
    background-color: var(--spice-button);
}
`;

        const menu = document.createElement("ul");
        menu.id = "bookmark-menu";
        menu.className = "context-menu";
        menu.onclick = (e) => e.stopPropagation();

        container.append(style, menu);

        return { container, menu };
    }

    /**
     * Handle Link click event when item context is a playlist
     */
    async function onLinkClick(info) {
        console.log(info);
        if (info?.context?.startsWith("/")) {
            Spicetify.Platform.History.push(info.context);
            return;
        }
        const url = "/" + Spicetify.URI.fromString(info.uri).toURLPath();
        Spicetify.Platform.History.push(url);
    }

    function onPlayClick(info) {
        console.log(info);
        const options = {};
        if (info.time) {
            options.offset = info.time;
        }

        if (info?.context?.startsWith("/")) {
            const uri = URI.fromString(info.context).toURI();

            const trackUid = info.context.split("?uid=", 2)[1];
            options.trackUid = trackUid;

            Spicetify.PlaybackControl.playContext(
                { uri, url: "context://" + uri},
                options,
            );
            return;
        }

        Spicetify.PlaybackControl.playUri(info.uri, options);
    }
})()

