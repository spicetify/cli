// @ts-check
// NAME: Full App Display
// AUTHOR: khanhas
// VERSION: 1.0
// DESCRIPTION: Fancy artwork and track status display.

/// <reference path="../globals.d.ts" />

(function FullAppDisplay() {
    const topBar = document.querySelector(".main-topBar-historyButtons");

    if (!Spicetify.Player || !Spicetify.Player.data || !topBar) {
        setTimeout(FullAppDisplay, 200)
        return
    }

    const CONFIG = getConfig()

    const style = document.createElement("style")
    const styleBase = `
#full-app-display {
    display: none;
    position: fixed;
    width: 100%;
    height: 100%;
    z-index: 500;
    cursor: default;
    left: 0;
    top: 0;
}
#fad-header {
    position: fixed;
    width: 100%;
    height: 80px;
    -webkit-app-region: drag;
}
#fad-foreground {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
}
#fad-art-image {
    position: relative;
    width: 100%;
    height: 100%;
    padding-bottom: 100%;
    border-radius: 15px;
    background-size: cover;
}
#fad-art-inner {
    position: absolute;
    left: 3%;
    bottom: 0;
    width: 94%;
    height: 94%;
    z-index: -1;
    backface-visibility: hidden;
    transform: translateZ(0);
    filter: blur(6px);
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}
#fad-progress-container {
    width: 100%;
    display: flex;
    align-items: center;
}
#fad-progress {
    width: 100%;
    height: 6px;
    border-radius: 6px;
    background-color: #ffffff50;
    overflow: hidden;
}
#fad-progress-inner {
    height: 100%;
    border-radius: 6px;
    background-color: #ffffff;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.8);
}
#fad-duration {
    margin-left: 10px;
}
#fad-background {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: -2;
}
body.fad-activated #full-app-display {
    display: block
}
.fad-background-fade {
    transition: background-image 1s linear;
}
body.video-full-screen.video-full-screen--hide-ui {
    cursor: auto;
}
#full-app-display button {
    background-color: transparent;
    border: 0;
    color: currentColor;
    padding: 0 5px;
}
`

    const styleChoices = [`
#fad-foreground {
    flex-direction: row;
    text-align: left;
}
#fad-art {
    width: calc(100vw - 840px);
    min-width: 200px;
    max-width: 340px;
}
#fad-details {
    padding-left: 50px;
    line-height: initial;
    max-width: 70%;
    color: #FFFFFF;
}
#fad-title {
    font-size: 87px;
    font-weight: var(--glue-font-weight-black);
}
#fad-artist, #fad-album {
    font-size: 54px;
    font-weight: var(--glue-font-weight-medium);
}
#fad-artist svg, #fad-album svg {
    margin-right: 5px;
}
#fad-status {
    display: flex;
    min-width: 400px;
    max-width: 400px;
    align-items: center;
}
#fad-status.active {
    margin-top: 20px;
}
#fad-controls {
    display: flex;
    margin-right: 10px;
}
#fad-elapsed {
    min-width: 52px;
}`,
`
#fad-art {
    width: calc(100vh - 400px);
    max-width: 340px;
}
#fad-foreground {
    flex-direction: column;
    text-align: center;
}
#fad-details {
    padding-top: 50px;
    line-height: initial;
    max-width: 70%;
    color: #FFFFFF;
}
#fad-title {
    font-size: 54px;
    font-weight: var(--glue-font-weight-black);
}
#fad-artist, #fad-album {
    font-size: 33px;
    font-weight: var(--glue-font-weight-medium);
}
#fad-artist svg, #fad-album svg {
    width: 25px;
    height: 25px;
    margin-right: 5px;
}
#fad-status {
    display: flex;
    min-width: 400px;
    max-width: 400px;
    align-items: center;
    flex-direction: column;
}
#fad-status.active {
    margin: 20px auto 0;
}
#fad-controls {
    margin-top: 20px;
    order: 2
}
#fad-elapsed {
    min-width: 56px;
    margin-right: 10px;
    text-align: right;
}`
    ]

    const iconStyleChoices = [`
#fad-artist svg, #fad-album svg {
    display: none;
}`,
`
#fad-artist svg, #fad-album svg {
    display: inline-block;
}`
    ]

    const container = document.createElement("div")
    container.id = "full-app-display"
    container.classList.add("Video", "VideoPlayer--fullscreen", "VideoPlayer--landscape")

    let cover, back, title, artist, album, prog, elaps, durr, play;
    const nextTrackImg = new Image()

    function render() {
        Spicetify.Player.removeEventListener("songchange", updateInfo)
        Spicetify.Player.removeEventListener("onprogress", updateProgress)
        Spicetify.Player.removeEventListener("onplaypause", updateControl)

        style.innerHTML = styleBase + styleChoices[CONFIG.vertical ? 1 : 0] + iconStyleChoices[CONFIG.icons ? 1 : 0];

        container.innerHTML = `
<canvas id="fad-background"></canvas>
<div id="fad-header"></div>
<div id="fad-foreground">
    <div id="fad-art">
        <div id="fad-art-image">
            <div id="fad-art-inner"></div>
        </div>
    </div>
    <div id="fad-details">
        <div id="fad-title"></div>
        <div id="fad-artist">
            <svg height="35" width="35" viewBox="0 0 16 16" fill="currentColor">
                ${Spicetify.SVGIcons.artist}
            </svg>
            <span></span>
        </div>
        ${CONFIG.showAlbum ? `<div id="fad-album">
            <svg height="35" width="35" viewBox="0 0 16 16" fill="currentColor">
                ${Spicetify.SVGIcons.album}
            </svg>
            <span></span>
        </div>` : ""}
        <div id="fad-status" class="${CONFIG.enableControl || CONFIG.enableProgress ? "active" : ""}">
            ${CONFIG.enableControl ? `
            <div id="fad-controls">
                ${CONFIG.vertical ? `<button id="fad-back">
                    <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                        ${Spicetify.SVGIcons["skip-back"]}
                    </svg>
                </button>` : ""}
                <button id="fad-play">
                    <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                        ${Spicetify.SVGIcons.play}
                    </svg>
                </button>
                <button id="fad-next">
                    <svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">
                        ${Spicetify.SVGIcons["skip-forward"]}
                    </svg>
                </button>
            </div>` : ""}
            ${CONFIG.enableProgress ? `
            <div id="fad-progress-container">
                <span id="fad-elapsed"></span>
                <div id="fad-progress"><div id="fad-progress-inner"></div></div>
                <span id="fad-duration"></span>
            </div>` : ""}
        </div>
    </div>
</div>`

        back = container.querySelector('canvas')
        back.width = window.innerWidth
        back.height = window.innerHeight
        cover = container.querySelector("#fad-art-image")
        title = container.querySelector("#fad-title")
        artist = container.querySelector("#fad-artist span")
        album = container.querySelector("#fad-album span")

        if (CONFIG.enableProgress) {
            prog = container.querySelector("#fad-progress-inner")
            durr = container.querySelector("#fad-duration")
            elaps = container.querySelector("#fad-elapsed")
        }

        if (CONFIG.enableControl) {
            play = container.querySelector("#fad-play")
            play.onclick = Spicetify.Player.togglePlay
            container.querySelector("#fad-next").onclick = Spicetify.Player.next
            if (CONFIG.vertical) {
                container.querySelector("#fad-back").onclick = Spicetify.Player.back
            }
        }
    }

    const classes = [
        "video",
        "video-full-screen",
        "video-full-window",
        "video-full-screen--hide-ui",
        "fad-activated"
    ]

    
    function prepareTitle(rawTitle) {
        if (CONFIG.trimTitle) {
            rawTitle = rawTitle
            .replace(/\(.+?\)/g, "")
            .replace(/\[.+?\]/g, "")
            .replace(/\s\-\s.+?$/, "")
            .trim()
        }
        return rawTitle
    }
    
    function prepareArtist(meta) {
        if (CONFIG.showAllArtists) {
            return Object.keys(meta)
            .filter(key => key.startsWith('artist_name'))
            .sort()
            .map(key => meta[key])
            .join(', ')
        } else {
            return meta.artist_name
        }
    }

    function getAlbumInfo(uri) {
        return Spicetify.CosmosAsync.get(`hm://album/v1/album-app/album/${uri}/desktop`)
    }

    async function prepareAlbum(meta) {
        if (CONFIG.showAlbum) {
            const albumURI = meta.album_uri
            const albumInfo = await getAlbumInfo(albumURI.replace("spotify:album:", ""))

            const albumDate = new Date(albumInfo.year, (albumInfo.month || 1) - 1, albumInfo.day || 0)
            const recentDate = new Date()
            recentDate.setMonth(recentDate.getMonth() - 6)
            const dateStr = albumDate.toLocaleString(
                'default',
                albumDate > recentDate ? {
                    year: 'numeric',
                    month: 'short'
                } : {
                    year: 'numeric'
                }
            )

            return meta.album_title + " • " + dateStr
        }
    }

    function prepareDuration(meta) {
        if (CONFIG.enableProgress) {
            return Spicetify.Player.formatTime(meta.duration)
        }
    }

    function updateCanvas(prevImg, nextImg, animCover) {
        const { innerWidth: width, innerHeight: height } = window
        back.width = width
        back.height = height
        const dim = width > height ? width : height

        const ctx = back.getContext('2d')
        ctx.imageSmoothingEnabled = false
        ctx.filter = `blur(30px) brightness(0.6)`
        const blur = 30
        
        if (!animCover) {
            ctx.globalAlpha = 1
            ctx.drawImage(
                nextImg, 
                -blur * 2,
                -blur * 2 - (width - height) / 2,
                dim + 4 * blur,
                dim + 4 * blur
            );
            return;
        }

        let factor = 0.0
        const animate = () => {
            ctx.globalAlpha = 1
            ctx.drawImage(
                prevImg, 
                -blur * 2,
                -blur * 2 - (width - height) / 2,
                dim + 4 * blur,
                dim + 4 * blur
            );
            ctx.globalAlpha = Math.sin(Math.PI/2*factor)
            ctx.drawImage(
                nextImg, 
                -blur * 2,
                -blur * 2 - (width - height) / 2,
                dim + 4 * blur,
                dim + 4 * blur
            );

            if (factor < 1.0) {
                factor += 0.016;
                requestAnimationFrame(animate);
            }
        };

        requestAnimationFrame(animate);
    }

    async function initInfo() {
        const meta = Spicetify.Player.data.track.metadata
        
        // Set the cover url before updating the background to prevent its animation
        const bgImage = `url("${meta.image_xlarge_url}")`
        cover.style.backgroundImage = bgImage

        // prepare title
        let rawTitle = prepareTitle(meta.title)

        // prepare artist
        let artistName = prepareArtist(meta)

        // prepare album
        let albumText = await prepareAlbum(meta)

        // prepare duration
        let durationText = prepareDuration(meta)
        

        
        // Wait until next track image is downloaded then update UI text and images
        const previouseImg = nextTrackImg.cloneNode()
        nextTrackImg.src = meta.image_xlarge_url
        nextTrackImg.onload = () => {

            // Force no fade for (re)opening of the extension
            updateCanvas(previouseImg, nextTrackImg, false)
            
            title.innerText = rawTitle || ""
            artist.innerText = artistName || ""
            if (album) {
                album.innerText = albumText || ""
            }
            if (durr) {
                durr.innerText = durationText || ""
            }
        }
    }

    async function updateInfo() {
        const meta = Spicetify.Player.data.track.metadata

        // prepare title
        let rawTitle = prepareTitle(meta.title)

        // prepare artist
        let artistName = prepareArtist(meta)

        // prepare album
        let albumText = await prepareAlbum(meta)

        // prepare duration
        let durationText = prepareDuration(meta)
        

        
        // Wait until next track image is downloaded then update UI text and images
        const previouseImg = nextTrackImg.cloneNode()
        nextTrackImg.src = meta.image_xlarge_url
        nextTrackImg.onload = () => {

            const bgImage = `url("${meta.image_xlarge_url}")`
            cover.style.backgroundImage = bgImage

            updateCanvas(previouseImg, nextTrackImg, CONFIG.enableFade)

            title.innerText = rawTitle || ""
            artist.innerText = artistName || ""
            if (album) {
                album.innerText = albumText || ""
            }
            if (durr) {
                durr.innerText = durationText || ""
            }
        }
    }

    function updateProgress() {
        prog.style.width = Spicetify.Player.getProgressPercent() * 100 + "%"
        elaps.innerText = Spicetify.Player.formatTime(Spicetify.Player.getProgress())
    }

    function updateControl({ data }) {
        if (data.is_paused) {
            play.innerHTML = `<svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons.play}</svg>`
        } else {
            play.innerHTML = `<svg height="20" width="20" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons.pause}</svg>`
        }
    }

    function activate() {
        initInfo()
        Spicetify.Player.addEventListener("songchange", updateInfo)
        if (CONFIG.enableProgress) {
            updateProgress()
            Spicetify.Player.addEventListener("onprogress", updateProgress)
        }
        if (CONFIG.enableControl) {
            updateControl({ data: { is_paused: !Spicetify.Player.isPlaying() }})
            Spicetify.Player.addEventListener("onplaypause", updateControl)
        }
        if (CONFIG.enableFullscreen) {
            document.documentElement.requestFullscreen();
        } else if (document.webkitIsFullScreen) {
            document.exitFullscreen()
        }
        if (CONFIG.enableFade) {
            cover.classList.add("fad-background-fade")
        } else {
            cover.classList.remove("fad-background-fade")
        }
        document.body.classList.add(...classes)
    }

    function deactivate() {
        Spicetify.Player.removeEventListener("songchange", updateInfo)
        if (CONFIG.enableProgress) {
            Spicetify.Player.removeEventListener("onprogress", updateProgress)
        }
        if (CONFIG.enableControl) {
            Spicetify.Player.removeEventListener("onplaypause", updateControl)
        }
        if (CONFIG.enableFullscreen || document.webkitIsFullScreen) {
            document.exitFullscreen()
        }
        document.body.classList.remove(...classes)
    }

    function getConfig() {
        try {
            const parsed = JSON.parse(Spicetify.LocalStorage.get("full-app-display-config"))
            if (parsed && typeof parsed === "object") {
                return parsed
            }
            throw ""
        } catch {
            Spicetify.LocalStorage.set("full-app-display-config", "{}")
            return {}
        }
    }

    function saveConfig() {
        Spicetify.LocalStorage.set("full-app-display-config", JSON.stringify(CONFIG))
    }

    // Add activator on top bar
    const button = document.createElement("button")
    button.classList.add("main-topBar-button", "fad-button")
    button.setAttribute("title", "Full App Display")
    button.innerHTML = `<svg role="img" height="16" width="16" viewBox="0 0 32 32" fill="currentColor"><path d="M8.645 22.648l-5.804 5.804.707.707 5.804-5.804 2.647 2.646v-6h-6l2.646 2.647zM29.157 3.55l-.707-.707-5.804 5.805L20 6.001v6h6l-2.646-2.647 5.803-5.804z"></path></svg>`
    topBar.append(button)

    const videoContainer = document.querySelector(".Root__video-player")
    videoContainer.append(style, container)

    function newMenuItem(name, key) {
        const container = document.createElement("div");
        container.innerHTML = `
<div class="setting-row">
    <label class="col description">${name}</label>
    <div class="col action"><button class="switch">
        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
            ${Spicetify.SVGIcons.check}
        </svg>
    </button></div>
</div>`;

        const slider = container.querySelector("button");
        slider.classList.toggle("disabled", !CONFIG[key]);

        slider.onclick = () => {
            const state = slider.classList.contains("disabled");
            slider.classList.toggle("disabled");
            CONFIG[key] = state;
            saveConfig()
            render()
            activate()
        };

        return container;
    }

    let configContainer;
    function openConfig(event) {
        event.preventDefault();
        if (!configContainer) {
            configContainer = document.createElement("div");
            configContainer.id = "popup-config-container"
            const style = document.createElement("style");
            style.innerHTML = `
.setting-row::after {
    content: "";
    display: table;
    clear: both;
}
.setting-row .col {
    display: flex;
    padding: 10px 0;
    align-items: center;
}
.setting-row .col.description {
    float: left;
    padding-right: 15px;
}
.setting-row .col.action {
    float: right;
    text-align: right;
}
button.switch {
    align-items: center;
    border: 0px;
    border-radius: 50%;
    background-color: rgba(var(--spice-rgb-shadow), .7);
    color: var(--spice-text);
    cursor: pointer;
    display: flex;
    margin-inline-start: 12px;
    padding: 8px;
}
button.switch.disabled {
    color: rgba(var(--spice-rgb-text), .3);
}`;

            configContainer.append(
                style,
                newMenuItem("Enable progress bar", "enableProgress"),
                newMenuItem("Enable controls", "enableControl"),
                newMenuItem("Trim title", "trimTitle"),
                newMenuItem("Show album", "showAlbum"),
                newMenuItem("Show all artists", "showAllArtists"),
                newMenuItem("Show icons", "icons"),
                newMenuItem("Vertical mode", "vertical"),
                newMenuItem("Enable fullscreen", "enableFullscreen"),
                newMenuItem("Enable song change animation", "enableFade"),
            )
        }
        Spicetify.PopupModal.display({
            title: "Full App Display",
            content: configContainer,
        })
    }

    button.onclick = activate
    container.ondblclick = deactivate
    container.oncontextmenu = openConfig

    function toggleFad() {
        if (document.body.classList.contains('fad-activated')) {
            deactivate();
        } else {
            activate();
        }
    }

    Spicetify.Keyboard.registerShortcut(
        {
            key: Spicetify.Keyboard.KEYS["F11"],
            ctrl: false,
            shift: false,
            alt: false,
        },
        toggleFad
    );

    render()
})()