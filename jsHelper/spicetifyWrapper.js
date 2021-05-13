const Spicetify = {
    get CosmosAsync() {return Spicetify.Player.origin?._cosmos},
    get Queue() {return Spicetify.Player.origin2?.state.currentQueue},
    Player: {
        addEventListener: (type, callback) => {
            if (!(type in Spicetify.Player.eventListeners)) {
                Spicetify.Player.eventListeners[type] = [];
            }
            Spicetify.Player.eventListeners[type].push(callback)
        },
        dispatchEvent: (event) => {
            if (!(event.type in Spicetify.Player.eventListeners)) {
                return true;
            }
            const stack = Spicetify.Player.eventListeners[event.type];
            for (let i = 0; i < stack.length; i++) {
                if (typeof stack[i] === "function") {
                    stack[i](event);
                }
            }
            return !event.defaultPrevented;
        },
        eventListeners: {},
        seek: (p) => {
            if (p <= 1) {
                p = Math.round(p * Spicetify.Player.origin._state.duration);
            }
            Spicetify.Player.origin.seekTo(p);
        },
        getProgress: () => Spicetify.Player.origin._state.position,
        getProgressPercent: () => (Spicetify.Player.origin._state.position/Spicetify.Player.origin._state.duration),
        getDuration: () => Spicetify.Player.origin._state.duration,
        setVolume: (v) => { Spicetify.Player.origin.setVolume(v) },
        increaseVolume: () => { Spicetify.Player.origin.setVolume(Spicetify.Player.getVolume() + 0.15) },
        decreaseVolume: () => { Spicetify.Player.origin.setVolume(Spicetify.Player.getVolume() - 0.15) },
        getVolume: () => Spicetify.Player.origin._volume.getVolume(),
        next: () => { Spicetify.Player.origin.skipToNext() },
        back: () => { Spicetify.Player.origin.skipToPrevious() },
        togglePlay: () => { Spicetify.Player.isPlaying() ? Spicetify.Player.pause() : Spicetify.Player.play() },
        isPlaying: () => !Spicetify.Player.origin._state.isPaused,
        toggleShuffle: () => { Spicetify.Player.origin.setShuffle(!Spicetify.Player.origin._state.shuffle) },
        getShuffle: () => Spicetify.Player.origin._state.shuffle,
        setShuffle: (b) => { Spicetify.Player.origin.setShuffle(b) },
        toggleRepeat: () => { Spicetify.Player.origin.setRepeat((Spicetify.Player.origin._state.repeat + 1) % 3) },
        getRepeat: () => Spicetify.Player.origin._state.repeat,
        setRepeat: (r) => { Spicetify.Player.origin.setRepeat(r) },
        getMute: () => Spicetify.Player.getVolume() === 0,
        toggleMute: () => { document.querySelector(".volume-bar__icon-button ").click() },
        setMute: (b) => {
            const isMuted = Spicetify.Player.getMute();
            if ((b && !isMuted) || (!b && isMuted)) {
                Spicetify.Player.toggleMute();
            }
        },
        formatTime: (ms) => {
            let seconds = Math.floor(ms / 1e3);
            const minutes = Math.floor(seconds / 60);
            seconds -= minutes * 60;
            return `${minutes}:${seconds > 9 ? "" : "0"}${String(seconds)}`;
        },
        getHeart: () => document.querySelector('.control-button-heart button')?.ariaChecked === "true",
        pause: () => { Spicetify.Player.origin.pause() },
        play: () => { Spicetify.Player.origin.resume() },
        removeEventListener: (type, callback) => {
            if (!(type in Spicetify.Player.eventListeners)) {
                return;
            }
            const stack = Spicetify.Player.eventListeners[type];
            for (let i = 0; i < stack.length; i++) {
                if (stack[i] === callback) {
                    stack.splice(i, 1);
                    return;
                }
            }
        },
        skipBack: (amount = 15e3) => {Spicetify.Player.origin.seekBackward(amount)},
        skipForward: (amount = 15e3) => {Spicetify.Player.origin.seekForward(amount)},
        toggleHeart: () => {document.querySelector('.control-button-heart button')?.click()},
    },
    test: () => {
        const SPICETIFY_METHOD = [
            "Player",
            "addToQueue",
            "CosmosAsync",
            "Event",
            "EventDispatcher",
            "getAudioData",
            "Keyboard",
            "URI",
            "LocalStorage",
            "PlaybackControl",
            "Queue",
            "removeFromQueue",
            "showNotification",
            "Menu",
            "ContextMenu",
        ];

        const PLAYER_METHOD = [
            "addEventListener",
            "back",
            "data",
            "decreaseVolume",
            "dispatchEvent",
            "eventListeners",
            "formatTime",
            "getDuration",
            "getHeart",
            "getMute",
            "getProgress",
            "getProgressPercent",
            "getRepeat",
            "getShuffle",
            "getVolume",
            "increaseVolume",
            "isPlaying",
            "next",
            "pause",
            "play",
            "removeEventListener",
            "seek",
            "setMute",
            "setRepeat",
            "setShuffle",
            "setVolume",
            "skipBack",
            "skipForward",
            "toggleHeart",
            "toggleMute",
            "togglePlay",
            "toggleRepeat",
            "toggleShuffle",
        ]

        let count = SPICETIFY_METHOD.length;
        SPICETIFY_METHOD.forEach((method) => {
            if (Spicetify[method] === undefined || Spicetify[method] === null) {
                console.error(`Spicetify.${method} is not available. Please open an issue in Spicetify repository to inform me about it.`)
                count--;
            }
        })
        console.log(`${count}/${SPICETIFY_METHOD.length} Spicetify methods and objects are OK.`)

        count = PLAYER_METHOD.length;
        PLAYER_METHOD.forEach((method) => {
            if (Spicetify.Player[method] === undefined || Spicetify.Player[method] === null) {
                console.error(`Spicetify.Player.${method} is not available. Please open an issue in Spicetify repository to inform me about it.`)
                count--;
            }
        })
        console.log(`${count}/${PLAYER_METHOD.length} Spicetify.Player methods and objects are OK.`)
    }
};

// Wait for Spicetify.Player.origin and origin2 to be available
// before adding following APIs
(function waitOrigins() {
    if (!Spicetify.Player.origin || !Spicetify.Player.origin2) {
        setTimeout(waitOrigins, 10);
        return;
    }

    Spicetify.Player.origin._cosmos.sub(
        "sp://player/v2/main", 
        (data) => {
            if (!data || !data.track) return;
            const lastData = Spicetify.Player.data;
            Spicetify.Player.data=data;
            if (lastData?.track.uri !== data.track.uri) {
                const event = new Event("songchange");
                event.data = data;
                Spicetify.Player.dispatchEvent(event);
            }
            if (lastData?.is_paused !== data.is_paused) {
                const event = new Event("onplaypause");
                event.data = data;
                Spicetify.Player.dispatchEvent(event);
            }
        }
    );

    Spicetify.Player.origin2.state.addProgressListener((data) => {
        const event = new Event("onprogress");
        event.data = data.position;
        Spicetify.Player.dispatchEvent(event);
    });

    Spicetify.addToQueue = Spicetify.Player.origin2.player.addToQueue;
    Spicetify.removeFromQueue = Spicetify.Player.origin2.removeFromQueue;
    Spicetify.PlaybackControl = Spicetify.Player.origin2.player;
})();

Spicetify.getAudioData = async (uri) => {
    uri = uri || Spicetify.Player.data.track.uri;
    const uriObj = Spicetify.URI.from(uri);
    if (!uriObj && uriObj.Type !== Spicetify.URI.Type.TRACK) {
        throw "URI is invalid.";
    }

    return await Spicetify.CosmosAsync.get(`hm://audio-attributes/v1/audio-analysis/${uriObj.getBase62Id()}`)
}

Spicetify.colorExtractor = async (uri) => {
    const body = await Spicetify.CosmosAsync.get(`hm://colorextractor/v1/extract-presets?uri=${uri}&format=json`);

    if (body.entries && body.entries.length) {
        const list = {};
        for (const color of body.entries[0].color_swatches) {
            list[color.preset] = `#${color.color.toString(16).padStart(6, "0")}`;
        }
        return list;
    } else {
        return null;
    }
}

Spicetify.LocalStorage = {
    clear: () => localStorage.clear(),
    get: (key) => localStorage.getItem(key),
    remove: (key) => localStorage.removeItem(key),
    set: (key, value) => localStorage.setItem(key, value),
};

(function waitMouseTrap() {
    if (!Spicetify.Mousetrap) {
        setTimeout(waitMouseTrap, 10);
        return;
    }
    const KEYS = {
        BACKSPACE:"backspace",
        TAB:"tab",
        ENTER:"enter",
        SHIFT:"shift",
        CTRL:"ctrl",
        ALT:"alt",
        CAPS:"capslock",
        ESCAPE:"esc",
        SPACE:"space",
        PAGE_UP:"pageup",
        PAGE_DOWN:"pagedown",
        END:"end",
        HOME:"home",
        ARROW_LEFT:"left",
        ARROW_UP:"up",
        ARROW_RIGHT:"right",
        ARROW_DOWN:"down",
        INSERT:"ins",
        DELETE:"del",
        A:"a",
        B:"b",
        C:"c",
        D:"d",
        E:"e",
        F:"f",
        G:"g",
        H:"h",
        I:"i",
        J:"j",
        K:"k",
        L:"l",
        M:"m",
        N:"n",
        O:"o",
        P:"p",
        Q:"q",
        R:"r",
        S:"s",
        T:"t",
        U:"u",
        V:"v",
        W:"w",
        X:"x",
        Y:"y",
        Z:"z",
        WINDOW_LEFT:"meta",
        WINDOW_RIGHT:"meta",
        SELECT:"meta",
        NUMPAD_0:"0",
        NUMPAD_1:"1",
        NUMPAD_2:"2",
        NUMPAD_3:"3",
        NUMPAD_4:"4",
        NUMPAD_5:"5",
        NUMPAD_6:"6",
        NUMPAD_7:"7",
        NUMPAD_8:"8",
        NUMPAD_9:"9",
        MULTIPLY:"*",
        ADD:"+",
        SUBTRACT:"-",
        DECIMAL_POINT:".",
        DIVIDE:"/",
        F1:"f1",
        F2:"f2",
        F3:"f3",
        F4:"f4",
        F5:"f5",
        F6:"f6",
        F7:"f7",
        F8:"f8",
        F9:"f9",
        F10:"f10",
        F11:"f11",
        F12:"f12",
        ";":";",
        "=":"=",
        ",":",",
        "-":"-",
        ".":".",
        "/":"/",
        "`":"`",
        "[":"[",
        "\\":"\\",
        "]":"]",
        '"':'"',
        "~":"`",
        "!":"1",
        "@":"2",
        "#":"3",
        $:"4",
        "%":"5",
        "^":"6",
        "&":"7",
        "*":"8",
        "(":"9",
        ")":"0",
        _:"-",
        "+":"=",
        ":":";",
        '"':"'",
        "<":",",
        ">":".",
        "?":"/",
        "|":"\\",
    };

    function formatKeys(keys) {
        let keystroke = ""
        if (typeof keys === "object") {
            if (!keys.key || !Object.values(KEYS).includes(keys.key)) {
                throw "Spicetify.Keyboard.registerShortcut: Invalid key " + keys.key;
            }
            if (keys.ctrl) keystroke += "mod+";
            if (keys.meta) keystroke += "meta+";
            if (keys.alt) keystroke += "alt+";
            if (keys.shift) keystroke += "shift+";
            keystroke += keys.key;
        } else if (typeof keys === "string" && Object.values(KEYS).includes(keys)) {
            keystroke = keys;
        } else {
            throw "Spicetify.Keyboard.registerShortcut: Invalid keys " + keys;
        }
        return keystroke;
    }

    Spicetify.Keyboard = {
        KEYS,
        registerShortcut: (keys, callback) => {
            Spicetify.Mousetrap.bind(formatKeys(keys), callback);
        },
        _deregisterShortcut: (keys) => {
            Spicetify.Mousetrap.unbind(formatKeys(keys));
        },
    };
    Spicetify.Keyboard.registerIsolatedShortcut = Spicetify.Keyboard.registerShortcut;
    Spicetify.Keyboard.registerImportantShortcut = Spicetify.Keyboard.registerShortcut;
    Spicetify.Keyboard.deregisterImportantShortcut = Spicetify.Keyboard._deregisterShortcut;
})();

class _HTMLContextMenuItem extends HTMLElement {
    constructor({
        name, 
        disabled = false,
        icon = undefined,
    }) {
        super();
        this.name = name;
        this.disabled = disabled;
        this.icon = icon;
    }
    render() {
        //main-contextMenu-disabled
        this.innerHTML = `
<li role="presentation" class="main-contextMenu-menuItem">
    <a class="main-contextMenu-menuItemButton ${this.disabled ? "main-contextMenu-disabled" : ""}" aria-disabled="false" role="menuitem" as="a" tabindex="-1">
        <span class="ellipsis-one-line main-type-mesto" as="span" dir="auto">${this.name}</span>
        ${this.icon || ""}
    </a>
</li>`;
    }

    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }

    static get observedAttributes() {
        return [];
    }

    attributeChangedCallback(name, oldValue, newValue) {
        this.render();
    }
}
customElements.define("context-menu-item", _HTMLContextMenuItem);

Spicetify.Menu = (function() {
    const collection = new Set();

    const _addItems = function(instance) {
        const list = instance.querySelector("ul");

        for (const item of collection) {
            if (!item.isEnabled) {
                continue;
            }
            const htmlItem = new _HTMLContextMenuItem(item.name);
            htmlItem.onclick = () => {
                item.onClick();
                instance._tippy.props.onClickOutside();
            };
            list.prepend(htmlItem);
        }
    }

    class Item {
        constructor(name, isEnabled, onClick) {
            this.name = name;
            this.isEnabled = isEnabled;
            this.onClick = () => {onClick(this)};
        }
        setState(isEnabled) {
            this.isEnabled = isEnabled;
        }
        setName(name) {
            this.name = name
        }
        register() {
            collection.add(this);
        }
        deregister() {
            collection.delete(this);
        }
    }

    class SubMenu {
        constructor(name, subItems) {
            this.name = name;
            this.subItems = subItems;
        }
        setName(name) {
            this.name = name;
        }
        register() {
            collection.add(this);
        }
        deregister() {
            collection.delete(this);
        }
    }

    return { Item, SubMenu, _addItems }
})();

Spicetify.ContextMenu = (function () {
    let itemList = new Set();
    const iconList = ["add-to-playlist", "add-to-queue", "addfollow", "addfollowers", "addsuggestedsong", "airplay", "album", "album-contained", "arrow-down", "arrow-left", "arrow-right", "arrow-up", "artist", "artist-active", "attach", "available-offline", "ban", "ban-active", "block", "bluetooth", "browse", "browse-active", "camera", "carplay", "chart-down", "chart-new", "chart-up", "check", "check-alt", "chevron-down", "chevron-left", "chevron-right", "chevron-up", "chromecast-connected", "chromecast-connecting-one", "chromecast-connecting-three", "chromecast-connecting-two", "chromecast-disconnected", "collaborative-playlist", "collection", "collection-active", "connect-to-devices", "copy", "destination-pin", "device-arm", "device-car", "device-computer", "device-mobile", "device-multispeaker", "device-other", "device-speaker", "device-tablet", "device-tv", "devices", "devices-alt", "discover", "download", "downloaded", "drag-and-drop", "edit", "email", "events", "facebook", "facebook-messenger", "filter", "flag", "follow", "fullscreen", "games-console", "gears", "googleplus", "grid-view", "headphones", "heart", "heart-active", "helpcircle", "highlight", "home", "home-active", "inbox", "info", "instagram", "library", "lightning", "line", "list-view", "localfile", "locked", "locked-active", "lyrics", "make—available-offline", "menu", "messages", "mic", "minimise", "mix", "more", "more-android", "new-spotify-connect", "new-volume", "newradio", "nikeplus", "notifications", "now-playing", "now-playing-active", "offline", "offline-sync", "pause", "payment", "paymenthistory", "play", "playback-speed-0point5x", "playback-speed-0point8x", "playback-speed-1point2x", "playback-speed-1point5x", "playback-speed-1x", "playback-speed-2x", "playback-speed-3x", "playlist", "playlist-folder", "plus", "plus-2px", "plus-alt", "podcasts", "podcasts-active", "public", "queue", "radio", "radio-active", "radioqueue", "redeem", "refresh", "released", "repeat", "repeatonce", "report-abuse", "running", "search", "search-active", "sendto", "share", "share-android", "sharetofollowers", "shows", "shuffle", "skip-back", "skip-forward", "skipback15", "skipforward15", "sleeptimer", "sms", "sort", "sortdown", "sortup", "spotify-connect", "spotify-connect-alt", "spotifylogo", "spotifypremium", "star", "star-alt", "subtitles", "tag", "thumbs-down", "thumbs-up", "time", "topcountry", "track", "trending", "trending-active", "tumblr", "twitter", "user", "user-active", "user-alt", "user-circle", "video", "volume", "volume-off", "volume-onewave", "volume-twowave", "warning", "watch", "whatsapp", "x", "settings"];

    class Item {
        constructor(name, onClick, shouldAdd = (uris) => true, icon = undefined, disabled = false) {
            this.name = name;
            this.onClick = onClick;
            this.shouldAdd = shouldAdd;
            if (icon) this.icon = icon;
            this.disabled = disabled;
        }
        set name(text) {
            if (typeof text !== "string") {
                throw "Spicetify.ContextMenu.Item: name is not a string";
            }
            this._name = text;
            if (this._parent && this._id !== undefined) {
                this._parent.updateItem(this._id, { text: this._name });
            }
        }
        set shouldAdd(func) {
            if (typeof func == "function") {
                this._shouldAdd = func.bind(this);
            } else {
                throw "Spicetify.ContextMenu.Item: shouldAdd is not a function";
            }
        }
        set onClick(func) {
            if (typeof func == "function") {
                this._onClick = func.bind(this);
            } else {
                throw "Spicetify.ContextMenu.Item: onClick is not a function";
            }
        }
        set icon(name) {
            if (!name) {
                this._icon = null;
            } else {
                if (!Item.iconList.includes(name)) {
                    throw `Spicetify.ContextMenu.Item: "${name}" is not a valid icon name.`;
                }
                this._icon = {
                    type: "spoticon",
                    value: name,
                };
            }

            if (this._parent && this._id !== undefined) {
                this._parent.updateItem(this._id, { icon: this._icon });
            }
        }
        set disabled(bool) {
            if (typeof bool != "boolean") {
                throw "Spicetify.ContextMenu.Item: disabled is not a boolean";
            }
            this._disabled = bool;
            if (this._parent && this._id !== undefined) {
                this._parent.updateItem(this._id, { disabled: this._disabled });
            }
        }
        register() {
            itemList.add(this);
        }
        deregister() {
            itemList.delete(this);
            this._parent = this._id = undefined;
        }
    }

    Item.iconList = iconList;

    class SubMenu {
        constructor(name, items, shouldAdd = (uris) => true, icon = undefined, disabled = false) {
            this.name = name;
            this.items = items;
            this.shouldAdd = shouldAdd;
            if (icon) this.icon = icon;
            this.disabled = disabled;
        }
        set name(text) {
            if (typeof text !== "string") {
                throw "Spicetify.ContextMenu.SubMenu: name is not a string";
            }
            this._name = text;
            if (this._parent && this._id !== undefined) {
                this._parent.updateItem(this._id, { text: this._name });
            }
        }
        set items(items) {
            this._items = new Set(items);
        }
        addItem(item) {
            this._items.add(item);
        }
        removeItem(item) {
            this._items.remove(item);
        }
        set shouldAdd(func) {
            if (typeof func == "function") {
                this._shouldAdd = func.bind(this);
            } else {
                throw "Spicetify.ContextMenu.SubMenu: shouldAdd is not a function";
            }
        }
        set icon(name) {
            if (!name) {
                this._icon = null;
            } else {
                if (!Item.iconList.includes(name)) {
                    throw `Spicetify.ContextMenu.SubMenu: "${name}" is not a valid icon name.`;
                }
                this._icon = {
                    type: "spoticon",
                    value: name,
                };
            }

            if (this._parent && this._id !== undefined) {
                this._parent.updateItem(this._id, { icon: this._icon });
            }
        }
        set disabled(bool) {
            if (typeof bool !== "boolean") {
                throw "Spicetify.ContextMenu.SubMenu: disabled is not a boolean";
            }
            this._disabled = bool;
            if (this._parent && this._id !== undefined) {
                this._parent.updateItem(this._id, { disabled: this._disabled });
            }
        }
        register() {
            itemList.add(this);
        }
        deregister() {
            itemList.remove(this);
            this._parent = this._id = undefined;
        }
    }

    SubMenu.iconList = iconList;

    function _addItems(instance) {
        const list = instance.querySelector("ul");
        const container = instance.firstChild;
        const reactEH = Object.values(container)[1]; // __reactEventHandlers
        const props = reactEH.children.props;

        let uris = [];
        if (props.uris) {
            uris = props.uris;
        } else if (props.uri) {
            uris = [props.uri];
        } else {
            return;
        }

        for (const item of itemList) {
            if (!item._shouldAdd(uris)) {
                continue;
            }

            // if (item._items) {
            //     const subItemsList = [];
            //     const subItemsToAdd = [];
            //     for (const subItem of item._items) {
            //         if (!subItem._shouldAdd(uris)) {
            //             continue;
            //         }
            //         subItemsList.push(subItem);
            //         subItemsToAdd.push({
            //             fn: () => {
            //                 subItem._onClick(uris);
            //                 contextMenuInstance.hide();
            //             },
            //             icon: subItem._icon,
            //             id: "",
            //             text: subItem._name,
            //             disabled: subItem._disabled,
            //         });
            //     }

            //     contextMenuInstance.addItem({
            //         icon: item._icon,
            //         items: subItemsToAdd,
            //         text: item._name,
            //         disabled: item._disabled,
            //     });
            //     item._parent = contextMenuInstance;
            //     item._id = item._parent._rawItems[item._parent._rawItems.length - 1].id;

            //     const subMenuInstance = item._parent._items[item._id].submenu;
            //     for (let i = 0; i < subItemsList.length; i++) {
            //         subItemsList[i]._parent = subMenuInstance;
            //         subItemsList[i]._id = subMenuInstance._items[i].id;
            //     }
            //     continue;
            // }
            const htmlItem = new _HTMLContextMenuItem(item._name);
            htmlItem.onclick = () => {
                item._onClick(uris);
                instance._tippy.props.onClickOutside();
            }
            list.prepend(htmlItem);

            // contextMenuInstance.addItem({
            //     fn: () => {
            //         item._onClick(uris);
            //         contextMenuInstance.hide();
            //     },
            //     icon: item._icon,
            //     text: item._name,
            //     disabled: item._disabled,
            // })
            // item._parent = contextMenuInstance;
            // item._id = item._parent._rawItems[item._parent._rawItems.length - 1].id;
        }
    }

    return { Item, SubMenu, _addItems };
})();

// Put `Spicetify` object to `window` object so apps iframe could access to it via `window.top.Spicetify`
window.Spicetify = Spicetify;
