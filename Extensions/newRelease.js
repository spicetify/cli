// @ts-check
// NAME: New Release
// AUTHOR: khanhas
// VERSION: 1.0
// DESCRIPTION: Gather new releases in nice UI and easy to access

/// <reference path="../globals.d.ts" />

(function NewRelease() {
    const { Player, CosmosAPI, LocalStorage, PlaybackControl, ContextMenu } = Spicetify
    if (!(Player && CosmosAPI && LocalStorage && PlaybackControl && ContextMenu)) {
        setTimeout(NewRelease, 300)
        return
    }

    // How far back the album/track was released to be considered "new"
    const DAYS_LIMIT = 30
    // UI Text
    const BUTTON_NAME_TEXT = "New Releases"
    const NO_FOLLOWED_ARTIST_TEXT = "You have not followed any artist."
    const NO_NEW_RELEASE_TEXT = `There is no new release in past ${DAYS_LIMIT} days`
    const IGNORE_TEXT = "Ignore"
    const UNIGNORE_TEXT = "Unignore"

    // Local Storage keys
    const LISTENED_URI_STORAGE_KEY = "spicetify_new_release:listened"
    const LISTENED_ALL_URI_STORAGE_KEY = "spicetify_new_release:listened_ALL"
    const FOLLOWEDONLY_SETTING_KEY = "spicetify_new_release:followed_only"
    const UNLISTENEDONLY_SETTING_KEY = "spicetify_new_release:unlistened_only"

    class ReleaseCollection {
        constructor() {
            this.list = {}
            this.container = createMenu()
            this.items = this.container.firstElementChild
        }

        apply(collection, unlistenedOnly) {
            this.list = {}
            this.items.textContent = '' // Remove all childs
            const stored = this.getStorage()
            for (const item of collection) {
                if (!item) continue

                const listened = stored.has(item.uri)
                this.list[item.uri] = listened

                if (listened && unlistenedOnly) continue

                const div = document.createElement("div")
                div.track = item
                this.items.append(div)
            }
            this.update()
        }

        update(unlistenedOnly) {
            let array = Array.from(this.items.childNodes)
                .sort((a, b) => (
                    (this.list[a.track.uri] - this.list[b.track.uri]) ||
                    (b.track.time - a.track.time)
                ))

            array.forEach(child => {
                if (this.list[child.track.uri] && unlistenedOnly) {
                    this.items.removeChild(child)
                    return
                }
                this.items.append(createCard(child))
            })
        }

        // Is URI in collection and ready to change status
        isValid(uri) {
            return this.list.hasOwnProperty(uri)
        }

        isListened(uri) {
            return !!this.list[uri]
        }

        // Change URI status to listened (true)
        listen(uri) {
            if (this.isValid(uri)) {
                this.list[uri] = true
            }
        }

        unListen(uri) {
            if (this.isValid(uri)) {
                this.list[uri] = false
            }
        }

        getLen() {
            return this.items.childElementCount
        }

        getUnlistenedLen() {
            return Object.values(this.list).filter(value => !value).length
        }

        /** @return {Set<string>} */
        getStorage() {
            let storage = new Set()

            try {
                JSON.parse(LocalStorage.get(LISTENED_URI_STORAGE_KEY))
                    .forEach(uri => storage.add(uri))
            } catch {
                LocalStorage.set(LISTENED_URI_STORAGE_KEY, "[]")
            }

            try {
                JSON.parse(LocalStorage.get(LISTENED_ALL_URI_STORAGE_KEY))
                    .forEach(uri => storage.add(uri))
            } catch {
                LocalStorage.set(LISTENED_ALL_URI_STORAGE_KEY, "[]")
            }

            return storage
        }

        setStorage(isFollowedOnly) {
            const simplified = Object.keys(this.list)
                    .filter(key => this.list[key])
            LocalStorage.set(
                isFollowedOnly ?
                    LISTENED_URI_STORAGE_KEY :
                    LISTENED_ALL_URI_STORAGE_KEY,
                JSON.stringify(simplified)
            )
        }

        setMessage(msg) {
            this.items.innerHTML = `<div style="margin-top: 10px">${msg}</div>`
        }
    }

    class TopBarButton {
        constructor() {
            this.container = createTopBarButton()
            this.span = createCounterSpan()
            this.container.append(this.span)

             // In case keys do not exist
            if (!LocalStorage.get(FOLLOWEDONLY_SETTING_KEY)) {
                this.setFollowedOnly(true)
            }
            if (!LocalStorage.get(UNLISTENEDONLY_SETTING_KEY)) {
                this.setUnlistenedOnly(false)
            }
        }

        update(count) {
            if (count > 0) {
                this.span.style.margin = "0 0 0 3px"
                this.span.innerText = count + ""
            } else {
                this.span.style.margin = ""
                this.span.innerText = ""
            }
        }

        loadingState() {
            this.container.classList.remove("spoticon-notifications-16")
            this.container.classList.add("spoticon-refresh-16")
        }

        idleState() {
            this.container.classList.remove("spoticon-refresh-16")
            this.container.classList.add("spoticon-notifications-16")
        }

        isFollowedOnly() {
            return LocalStorage.get(FOLLOWEDONLY_SETTING_KEY) === "1"
        }

        setFollowedOnly(state) {
            LocalStorage.set(FOLLOWEDONLY_SETTING_KEY, state ? "1" : "0")
        }

        isUnlistenedOnly() {
            return LocalStorage.get(UNLISTENEDONLY_SETTING_KEY) === "1"
        }

        setUnlistenedOnly(state) {
            LocalStorage.set(UNLISTENEDONLY_SETTING_KEY, state ? "1" : "0")
        }
    }

    const LIST = new ReleaseCollection()
    const BUTTON = new TopBarButton()
    let today
    let limitInMs

    document.querySelector("#view-browser-navigation-top-bar")
        .append(BUTTON.container)

    async function main() {
        today = new Date().getTime()
        limitInMs = DAYS_LIMIT * 24 * 3600 * 1000

        BUTTON.update(0)
        BUTTON.loadingState()

        let artistList = await getArtistList()

        if (BUTTON.isFollowedOnly()) {
            artistList = artistList.filter(artist => artist.isFollowed)
            if (artistList.length === 0) {
                LIST.setMessage(NO_FOLLOWED_ARTIST_TEXT)
                return
            }
        }

        const requests = artistList
            .map(async (artist) => {
                const track = await getArtistNewRelease(artist.link.replace("spotify:artist:", ""))
                if (!track) return null
                const time = new Date(track.year, track.month - 1, track.day)
                if ((today - time.getTime()) < limitInMs) {
                    return ({
                        uri: track.uri,
                        name: track.name,
                        artist: artist.name,
                        cover: track.cover.uri,
                        time,
                    })
                }
            })

        const items = await Promise.all(requests)
        LIST.apply(items, BUTTON.isUnlistenedOnly())
        BUTTON.idleState()
        update()
    }

    function update() {
        LIST.setStorage(BUTTON.isFollowedOnly())
        LIST.update(BUTTON.isUnlistenedOnly())
        BUTTON.update(LIST.getUnlistenedLen())
        if (LIST.getLen() === 0) {
            LIST.setMessage(NO_NEW_RELEASE_TEXT)
        }
    }

    main()

    // Check whether currently playing track is in the new release. Set it "listened" if user is listening to it.
    Player.addEventListener("songchange", () => {
        if (LIST.getLen() === 0) return
        let uri = Player.data.context_uri
        if (!LIST.isValid(uri)) {
            uri = Player.data.track.metadata.album_uri
        }
        if (LIST.isListened(uri)) return;

        LIST.listen(uri)
        update()
    })

    // Add context menu items for Notification button
    const checkURI = ([uri]) => uri === "spotify:special:new-release"
    new ContextMenu.Item(
        "Followed artists only",
        function(){
            const state = !BUTTON.isFollowedOnly()
            BUTTON.setFollowedOnly(state)
            this.icon = state ? "check" : null
            main()
        },
        checkURI,
        BUTTON.isFollowedOnly() ? "check" : null,
    ).register()

    new ContextMenu.Item(
        "Unlistened releases only",
        function(){
            const state = !BUTTON.isUnlistenedOnly()
            BUTTON.setUnlistenedOnly(state)
            this.icon = state ? "check" : null
            main()
        },
        checkURI,
        BUTTON.isUnlistenedOnly() ? "check" : null,
    ).register()

    new ContextMenu.Item("Refresh", main, checkURI).register()

    function getArtistList() {
        return new Promise((resolve, reject) => {
            CosmosAPI.resolver.get("sp://core-collection/unstable/@/list/artists/all",
                (err, raw) => {
                    if (err) {
                        reject(err)
                        return
                    }
                    resolve(raw.getJSONBody().items)
                }
            )
        })
    }

    function getArtistNewRelease(uri) {
        return new Promise((resolve) => {
            CosmosAPI.resolver.get(
                `hm://artist/v3/${uri}/desktop/entity?format=json`,
                (err, raw) => {
                    if (err) {
                        resolve()
                        return
                    }
                    resolve(raw.getJSONBody().latest_release)
                }
            )
        })
    }

    function createTopBarButton() {
        const button = document.createElement("button")
        button.classList.add("button", "spoticon-notifications-16", "new-release-button")
        button.setAttribute("data-tooltip", BUTTON_NAME_TEXT)
        button.setAttribute("data-contextmenu", "")
        button.setAttribute("data-uri", "spotify:special:new-release")
        button.style.backgroundColor = "var(--modspotify_main_fg)"
        button.style.color = "var(--modspotify_secondary_fg)"
        button.style.padding = "5px 10px"
        button.style.borderRadius = "10px"
        button.onclick = () => {
            const bound = button.getBoundingClientRect()
            LIST.container.firstElementChild.style.left = bound.left + "px"
            LIST.container.firstElementChild.style.top = bound.bottom + 10 + "px"
            document.body.append(LIST.container)
        }
        return button
    }

    function createCounterSpan() {
        const span = document.createElement("span")
        span.id = "new-release-counter"
        return span
    }

    function createMenu() {
        const container = document.createElement("div")
        container.id = "new-release-spicetify"
        container.className = "context-menu-container"
        container.style.zIndex = "2147483646"

        container.onclick = () => container.remove()

        const menu = document.createElement("div")
        menu.className = "context-menu"
        menu.style.display = "inline-block"
        menu.style.width = "33%"
        menu.style.maxHeight = "70%"
        menu.style.overflow = "hidden auto"
        menu.style.padding = "0 10px 10px"

        container.append(menu)

        return container
    }

    function onPlayButtonClick(event) {
        PlaybackControl.playFromResolver(event.target.getAttribute("uri"), {}, () => { })
        event.stopPropagation()
        event.preventDefault()
    }

    function onControlClick(event) {
        const {isListened, track} = event.target.parentElement.parent
        isListened ? LIST.unListen(track.uri) : LIST.listen(track.uri)
        update()
        event.stopPropagation()
        event.preventDefault()
    }

    function onMouseEnter({target}) {
        target.controls.classList.remove("hidden")
    }

    function onMouseLeave({target}) {
        target.controls.classList.add("hidden")
    }

    function createCard(item) {
        item = item || document.createElement("div")
        item.isListened = LIST.isListened(item.track.uri)

        item.innerHTML = `
<div class="card card-horizontal card-horizontal-size-medium card-type-album" data-uri="${item.track.uri}" data-contextmenu="">
<div class="card-attention-highlight-box"></div>
<div class="card-horizontal-interior-wrapper">
    <div class="card-image-wrapper">
        <div class="card-image-hit-area">
            <a href="${item.track.uri}" class="card-image-link ">
                <div class="card-hit-area-counter-scale-left"></div>
                <div class="card-image-content-wrapper">
                    <div class="card-image" style="
                        background-image: url('${item.track.cover}');
                        ${item.isListened ? "filter: grayscale(1)" : ""};
                    "></div>
                </div>
            </a>
            <div class="card-overlay"></div>
            <button type="button" class="button button-play button-icon-with-stroke card-button-play" uri="${item.track.uri}"></button>
        </div>
    </div>
    <div class="card-info-wrapper">
        <div class="new-release-controls hidden" style="position: absolute; right: 0; bottom: 0; padding: 0 5px 5px 0; z-index: 3">
            ${item.isListened ?
                `<button class="button button-green spoticon-notifications-16" data-tooltip="${UNIGNORE_TEXT}"></button>` :
                `<button class="button button-green">${IGNORE_TEXT}</button>`
            }
        </div>
        <a href="${item.track.uri}">
            <div class="card-hit-area-counter-scale-right"></div>
            <div class="card-info-content-wrapper">
                <div class="card-info-title"><span class="card-info-title-text">${item.track.name}</span></div>
                <div class="card-info-subtitle-description"><span>${item.track.artist}</span></div>
                <div class="card-info-subtitle-metadata">${item.track.time.toLocaleDateString()}</div>
            </div>
        </a>
    </div>
</div>
</div>`

        item.querySelector("button.button-play").onclick = onPlayButtonClick
        item.controls = item.querySelector(".new-release-controls")
        item.controls.parent = item
        item.controls.onclick = onControlClick
        item.onmouseenter = onMouseEnter
        item.onmouseleave = onMouseLeave
        return item
    }
})()
