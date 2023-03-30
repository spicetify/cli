const Spicetify = {
    get CosmosAsync() {return Spicetify.Player.origin?._cosmos},
    get Queue() {return Spicetify.Player.origin?._queue?._state ?? Spicetify.Player.origin?._queue?._queue},
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
        getProgress: () => (Spicetify.Player.origin._state.isPaused ? 0 : Date.now() - Spicetify.Player.origin._state.timestamp) + Spicetify.Player.origin._state.positionAsOfTimestamp,
        getProgressPercent: () => (Spicetify.Player.getProgress()/Spicetify.Player.origin._state.duration),
        getDuration: () => Spicetify.Player.origin._state.duration,
        setVolume: (v) => { Spicetify.Platform.PlaybackAPI.setVolume(v) },
        increaseVolume: () => { Spicetify.Platform.PlaybackAPI.raiseVolume() },
        decreaseVolume: () => { Spicetify.Platform.PlaybackAPI.lowerVolume() },
        getVolume: () => Spicetify.Platform.PlaybackAPI._volume,
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
        toggleMute: () => { document.querySelector(".volume-bar__icon-button").click() },
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
        getHeart: () => document.querySelector('.control-button-heart')?.ariaChecked === "true",
        pause: () => { Spicetify.Player.origin.pause() },
        play: () => { Spicetify.Player.origin.resume() },
        playUri: async (uri, context = {}, options = {}) => {
            return await Spicetify.Player.origin.play({uri: uri}, context, options);
        },
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
        toggleHeart: () => {document.querySelector('.control-button-heart')?.click()},
    },
    test: () => {
        const SPICETIFY_METHOD = [
            "Player",
            "addToQueue",
            "CosmosAsync",
            "getAudioData",
            "Keyboard",
            "URI",
            "LocalStorage",
            "Queue",
            "removeFromQueue",
            "showNotification",
            "Menu",
            "ContextMenu",
            "React",
            "Mousetrap",
            "Locale",
            "ReactDOM",
            "Topbar",
            "ReactComponent",
            "PopupModal",
            "_cloneSidebarItem",
            "_sidebarItemToClone",
            "SVGIcons",
            "colorExtractor",
            "test",
            "Platform",
            "getFontStyle",
            "_fontStyle",
            "Config",
            "expFeatureOverride",
            "createInternalMap",
            "RemoteConfigResolver",
            "Playbar"
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
            "origin",
            "playUri"
        ]

        const REACT_COMPONENT = [
            "RightClickMenu",
            "ContextMenu",
            "Menu",
            "MenuItem",
            "AlbumMenu",
            "PodcastShowMenu",
            "ArtistMenu",
            "PlaylistMenu",
            "TooltipWrapper",
            "TextComponent",
            "IconComponent"
        ]

        let count = SPICETIFY_METHOD.length;
        SPICETIFY_METHOD.forEach((method) => {
            if (Spicetify[method] === undefined || Spicetify[method] === null) {
                console.error(`Spicetify.${method} is not available. Please open an issue in the Spicetify repository to inform us about it.`)
                count--;
            }
        })
        console.log(`${count}/${SPICETIFY_METHOD.length} Spicetify methods and objects are OK.`)

        count = PLAYER_METHOD.length;
        PLAYER_METHOD.forEach((method) => {
            if (Spicetify.Player[method] === undefined || Spicetify.Player[method] === null) {
                console.error(`Spicetify.Player.${method} is not available. Please open an issue in the Spicetify repository to inform us about it.`)
                count--;
            }
        })
        console.log(`${count}/${PLAYER_METHOD.length} Spicetify.Player methods and objects are OK.`)

        count = REACT_COMPONENT.length;
        REACT_COMPONENT.forEach((method) => {
            if (Spicetify.ReactComponent[method] === undefined || Spicetify.ReactComponent[method] === null) {
                console.error(`Spicetify.ReactComponent.${method} is not available. Please open an issue in the Spicetify repository to inform us about it.`)
                count--;
            }
        })
        console.log(`${count}/${REACT_COMPONENT.length} Spicetify.ReactComponent methods and objects are OK.`)

        Object.keys(Spicetify).forEach(key => {
            if(!SPICETIFY_METHOD.includes(key)) {
                console.log(`Spicetify method ${key} exists but is not in the method list. Consider adding it.`)
            }
        })

        Object.keys(Spicetify.Player).forEach(key => {
            if(!PLAYER_METHOD.includes(key)) {
                console.log(`Spicetify.Player method ${key} exists but is not in the method list. Consider adding it.`)
            }
        })

        Object.keys(Spicetify.ReactComponent).forEach(key => {
            if(!REACT_COMPONENT.includes(key)) {
                console.log(`Spicetify.ReactComponent method ${key} exists but is not in the method list. Consider adding it.`)
            }
        })
    }
};

// Wait for Spicetify.Player.origin._state before adding following APIs
(function waitOrigins() {
    if (!Spicetify?.Player?.origin?._state) {
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

    setInterval(() => {
        const event = new Event("onprogress");
        event.data = Spicetify.Player.getProgress();
        Spicetify.Player.dispatchEvent(event);
    }, 100);

    Spicetify.addToQueue = (uri) => {
        return Spicetify.Player.origin._queue.addToQueue(uri);
    };
    Spicetify.removeFromQueue = (uri) => {
        return Spicetify.Player.origin._queue.removeFromQueue(uri);
    };
})();

Spicetify.getAudioData = async (uri) => {
    uri = uri || Spicetify.Player.data.track.uri;
    const uriObj = Spicetify.URI.from?.(uri) ?? Spicetify.URI.fromString?.(uri);
    if (!uriObj || (uriObj.Type || uriObj.type) !== Spicetify.URI.Type.TRACK) {
        throw "URI is invalid.";
    }

    return await Spicetify.CosmosAsync.get(`wg://audio-attributes/v1/audio-analysis/${uriObj.getBase62Id?.() ?? uriObj.id}?format=json`);
}

if (!Spicetify.URI) Spicetify.URI = {};
(function appendValidationFunc() {
    if (!Spicetify.URI.Type) {
        setTimeout(appendValidationFunc, 10);
        return;
    }
    if (Spicetify.URI.isTrack) return;
    for (const type in Spicetify.URI.Type) {
        const funcName = type
            .toLowerCase()
            .split("_")
            .map((word) => word[0].toUpperCase() + word.slice(1))
            .join("");
        Spicetify.URI[`is${funcName}`] = (uri) => {
            const uriObj = Spicetify.URI.from?.(uri) ?? Spicetify.URI.fromString?.(uri);
            if (!uriObj) return false;
            return uriObj.type === Spicetify.URI.Type[type];
        };
    }
    Spicetify.URI.isPlaylistV1OrV2 = (uri) => {
        return Spicetify.URI.isPlaylist(uri) || Spicetify.URI.isPlaylistV2(uri);
    };
})();



Spicetify.colorExtractor = async (uri) => {
    const body = await Spicetify.CosmosAsync.get(`wg://colorextractor/v1/extract-presets?uri=${uri}&format=json`);

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

Spicetify._getStyledClassName = (args, component) => {
    const includedKeys = ["role", "variant", "semanticColor", "iconColor", "color", "weight", "buttonSize", "iconSize", "position", "paddingBottom", "data-encore-id"];
    const element = Array.from(args).find(
		e => e?.children || e?.dangerouslySetInnerHTML || typeof e?.className !== "undefined" || includedKeys.some(key => typeof e?.[key] !== "undefined")
	);

    if (!element) return;

    let className = /(?:\w+__)?(\w+)-[\w-]+/.exec(component.componentId)?.[1];

    for (const key of includedKeys) {
        if ((typeof element[key] === "string" && element[key].length) || typeof element[key] === "number") {
            className += `-${element[key]}`;
        }
    }

    const excludedKeys = ["children", "className", "style", "dir", "key", "ref", "as", ""];
    const excludedPrefix = ["aria-"];

    const booleanKeys = Object.keys(element).filter(key => typeof element[key] === "boolean" && element[key]);

    for (const key of booleanKeys) {
        if (excludedKeys.includes(key)) continue;
        if (excludedPrefix.some(prefix => key.startsWith(prefix))) continue;
        className += `-${key}`;
    }

    return className;
};

Spicetify.getFontStyle = (font) => {
    if (!font || !Spicetify._fontStyle) return;
    let rawStyle = Spicetify._fontStyle({ variant: font }).filter(style => typeof style === "string").join("");
    // Clean up empty rulesets
    rawStyle = rawStyle.replace(new RegExp("\\w+-\\w+:;", "g"), "").trim();
    // Split special rulesets
    const mediaStyle = rawStyle.split("@");
    let returnStyle = `.main-type-${font}`;

    mediaStyle.map((ruleset, index) => {
        if (index === 0) {
            return returnStyle += `{${ruleset}}`;
        } else {
            if (ruleset.endsWith(";")) ruleset = ruleset.slice(0, -1);
            ruleset = ruleset.split(")").join(`){.main-type-${font}`);
            return returnStyle += `@${ruleset}}`;
        }
    });

    if (returnStyle.endsWith(";")) returnStyle = returnStyle.slice(0, -1);
    return returnStyle.replaceAll(";;", ";");
}

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
        changeShortcut: (keys, newKeys) => {
            if (!keys || !newKeys) throw "Spicetify.Keyboard.changeShortcut: Invalid keys";

            const callback = Object.keys(Spicetify.Mousetrap.trigger()._directMap).find(key => key.startsWith(formatKeys(keys)));
            if (!callback) throw "Spicetify.Keyboard.changeShortcut: Shortcut not found";

            Spicetify.Keyboard.registerShortcut(newKeys, Spicetify.Mousetrap.trigger()._directMap[callback]);
            Spicetify.Keyboard._deregisterShortcut(keys);
        },
    };
    Spicetify.Keyboard.registerIsolatedShortcut = Spicetify.Keyboard.registerShortcut;
    Spicetify.Keyboard.registerImportantShortcut = Spicetify.Keyboard.registerShortcut;
    Spicetify.Keyboard.deregisterImportantShortcut = Spicetify.Keyboard._deregisterShortcut;
})();

Spicetify.SVGIcons = {
    "collaborative": "<path d=\"M4.765 1.423c-.42.459-.713.992-.903 1.554-.144.421-.264 1.173-.22 1.894.077 1.321.638 2.408 1.399 3.316v.002l.083.098c.611.293 1.16.696 1.621 1.183a2.244 2.244 0 00-.426-2.092l-.127-.153-.002-.001c-.612-.73-.997-1.52-1.051-2.442-.032-.54.066-1.097.143-1.323a2.85 2.85 0 01.589-1.022 2.888 2.888 0 014.258 0c.261.284.456.628.59 1.022.076.226.175.783.143 1.323-.055.921-.44 1.712-1.052 2.442l-.002.001-.127.153a2.25 2.25 0 00.603 3.39l2.209 1.275a3.248 3.248 0 011.605 2.457h-5.99a5.466 5.466 0 01-.594 1.5h8.259l-.184-1.665a4.75 4.75 0 00-2.346-3.591l-2.209-1.275a.75.75 0 01-.201-1.13l.126-.152h.001c.76-.909 1.32-1.995 1.399-3.316.043-.721-.077-1.473-.22-1.894a4.46 4.46 0 00-.644-1.24v-.002h-.002a4.388 4.388 0 00-6.728-.312zM2 12.5v-2h1.5v2h2V14h-2v2H2v-2H0v-1.5h2z\"/>",
    "album": "<path d=\"M7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14.012C3.909 14.012.988 11.091.988 7.5S3.909.988 7.5.988s6.512 2.921 6.512 6.512-2.921 6.512-6.512 6.512zM7.5 5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4.012c-.834 0-1.512-.678-1.512-1.512S6.666 5.988 7.5 5.988s1.512.679 1.512 1.512S8.334 9.012 7.5 9.012z\"/>",
    "artist": "<path d=\"M9.692 9.133a.202.202 0 01-.1-.143.202.202 0 01.046-.169l.925-1.084a4.035 4.035 0 00.967-2.619v-.353a4.044 4.044 0 00-1.274-2.94A4.011 4.011 0 007.233.744C5.124.881 3.472 2.7 3.472 4.886v.232c0 .96.343 1.89.966 2.618l.925 1.085a.203.203 0 01.047.169.202.202 0 01-.1.143l-2.268 1.304a4.04 4.04 0 00-2.041 3.505V15h1v-1.058c0-1.088.588-2.098 1.537-2.637L5.808 10a1.205 1.205 0 00.316-1.828l-.926-1.085a3.028 3.028 0 01-.726-1.969v-.232c0-1.66 1.241-3.041 2.826-3.144a2.987 2.987 0 012.274.812c.618.579.958 1.364.958 2.21v.354c0 .722-.258 1.421-.728 1.969l-.925 1.085A1.205 1.205 0 009.194 10l.341.196c.284-.248.6-.459.954-.605l-.797-.458zM13 6.334v4.665a2.156 2.156 0 00-1.176-.351c-1.2 0-2.176.976-2.176 2.176S10.625 15 11.824 15 14 14.024 14 12.824V8.065l1.076.622.5-.866L13 6.334zM11.824 14a1.177 1.177 0 01-1.176-1.176A1.177 1.177 0 1111.824 14z\"/>",
    "block": "<path fill=\"none\" d=\"M16 0v16H0V0z\"/><path d=\"M4 8h7V7H4v1zm3.5-8a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14C3.916 14 1 11.084 1 7.5S3.916 1 7.5 1 14 3.916 14 7.5 11.084 14 7.5 14z\"/>",
    "brightness": "<path d=\"M8 5.25a2.75 2.75 0 100 5.5 2.75 2.75 0 000-5.5zM3.75 8a4.25 4.25 0 118.5 0 4.25 4.25 0 01-8.5 0zm3.5-6V0h1.5v2h-1.5zm0 14v-2h1.5v2h-1.5zm4.462-12.773l1.415-1.414 1.06 1.06-1.414 1.415-1.06-1.061zm-9.899 9.9l1.414-1.415 1.06 1.061-1.414 1.414-1.06-1.06zM14 7.25h2v1.5h-2v-1.5zm-14 0h2v1.5H0v-1.5zm12.773 4.462l1.414 1.415-1.06 1.06-1.415-1.414 1.061-1.06zM2.874 1.813l1.414 1.414-1.06 1.06-1.415-1.413 1.06-1.061z\"/>",
    "car": "<path d=\"M2.92 2.375A2.75 2.75 0 015.303 1h5.395c.983 0 1.89.524 2.382 1.375L14.017 4h1.233a.75.75 0 010 1.5h-.237c.989.9.988 2.117.987 2.707v7.043a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V14H3v1.25a.75.75 0 01-.75.75H.75a.75.75 0 01-.75-.75V8.207C0 7.617-.002 6.4.987 5.5H.75a.75.75 0 010-1.5h1.233l.938-1.625zm2.382.125c-.446 0-.859.238-1.082.625L3.137 5h9.726L11.78 3.125a1.25 1.25 0 00-1.083-.625H5.302zm8.57 4H2.128a2.72 2.72 0 01-.055.046c-.473.377-.556.894-.57 1.454h2.429a1 1 0 011 1v.5H1.5v3h13v-3h-3.43V9a1 1 0 011-1h2.427c-.013-.56-.096-1.077-.569-1.454a2.585 2.585 0 01-.055-.046z\"/>",
    "chart-down": "<path d=\"M3 6l5 5.794L13 6z\"/>",
    "chart-up": "<path d=\"M13 10L8 4.206 3 10z\"/>",
    "check": "<path d=\"M13.985 2.383L5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z\"/>",
    "check-alt-fill": "<path d=\"M7.5 0C3.354 0 0 3.354 0 7.5S3.354 15 7.5 15 15 11.646 15 7.5 11.646 0 7.5 0zM6.246 12.086l-3.16-3.707 1.05-1.232 2.111 2.464 4.564-5.346 1.221 1.05-5.786 6.771z\"/><path fill=\"none\" d=\"M0 0h16v16H0z\"/>",
    "chevron-left": "<path d=\"M11.521 1.38l-.65-.76L2.23 8l8.641 7.38.65-.76L3.77 8z\"/>",
    "chevron-right": "<path d=\"M5.129.62l-.65.76L12.231 8l-7.752 6.62.65.76L13.771 8z\"/>",
    "chromecast-disconnected": "<path d=\"M.667 12v2h2q0-.825-.588-1.413Q1.492 12 .667 12zm0-2.667v1.334q1.38 0 2.357.976Q4 12.619 4 14h1.333q0-.952-.369-1.817-.369-.866-.992-1.489-.623-.623-1.488-.992T.667 9.333zm0-2.666V8q1.627 0 3.008.806 1.38.805 2.186 2.186.806 1.381.806 3.008H8q0-1.198-.369-2.317-.37-1.12-1.048-2.02Q5.905 8.762 5 8.083q-.905-.678-2.024-1.047-1.119-.37-2.31-.37zM14 2H2q-.548 0-.94.393-.393.393-.393.94v2H2v-2h12v9.334H9.333V14H14q.548 0 .94-.393.393-.393.393-.94V3.333q0-.547-.393-.94Q14.548 2 14 2z\"/>",
    "clock": "<path d=\"M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z\"/><path d=\"M8 3.25a.75.75 0 01.75.75v3.25H11a.75.75 0 010 1.5H7.25V4A.75.75 0 018 3.25z\"/>",
    "computer": "<path d=\"M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0114.25 12H1.75A1.75 1.75 0 010 10.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H1.75zm1.5 12.75A.75.75 0 014 14.5h8a.75.75 0 010 1.5H4a.75.75 0 01-.75-.75z\"/>",
    "copy": "<path d=\"M8.492 6.619a.522.522 0 00.058.737c.45.385.723.921.77 1.511.046.59-.14 1.163-.524 1.613l-2.372 2.777c-.385.45-.921.724-1.512.77a2.21 2.21 0 01-1.613-.524 2.22 2.22 0 01-.246-3.125l1.482-1.735a.522.522 0 10-.795-.679L2.259 9.7a3.266 3.266 0 00.362 4.599 3.237 3.237 0 002.374.771 3.234 3.234 0 002.224-1.134l2.372-2.777c.566-.663.84-1.505.771-2.375A3.238 3.238 0 009.228 6.56a.523.523 0 00-.736.059zm4.887-4.918A3.233 3.233 0 0011.004.93 3.234 3.234 0 008.78 2.064L6.409 4.84a3.241 3.241 0 00-.772 2.374 3.238 3.238 0 001.134 2.224.519.519 0 00.738-.058.522.522 0 00-.058-.737 2.198 2.198 0 01-.771-1.511 2.208 2.208 0 01.524-1.613l2.372-2.777c.385-.45.921-.724 1.512-.77a2.206 2.206 0 011.613.524 2.22 2.22 0 01.246 3.125l-1.482 1.735a.522.522 0 10.795.679L13.741 6.3a3.266 3.266 0 00-.362-4.599z\"/>",
    "download": "<path d=\"M7.999 9.657V4h-1v5.65L5.076 7.414l-.758.651 3.183 3.701 3.193-3.7-.758-.653-1.937 2.244zM7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14C3.916 14 1 11.084 1 7.5S3.916 1 7.5 1 14 3.916 14 7.5 11.084 14 7.5 14z\"/>",
    "downloaded": "<path d=\"M7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm.001 11.767L4.318 8.065l.758-.652L6.999 9.65V3h1v6.657l1.937-2.244.757.653-3.192 3.701z\"/>",
    "edit": "<path d=\"M11.472.279L2.583 10.686l-.887 4.786 4.588-1.625L15.173 3.44 11.472.279zM5.698 12.995l-2.703.957.523-2.819v-.001l2.18 1.863zm-1.53-2.623l7.416-8.683 2.18 1.862-7.415 8.683-2.181-1.862z\"/>",
    "enhance": "<path d=\"M11.777.972c-.364 1.054-1.195 2.322-2.798 2.83-.115.036-.115.36 0 .396 1.603.508 2.434 1.775 2.798 2.83.04.114.406.114.446 0 .364-1.055 1.195-2.322 2.798-2.83.115-.036.115-.36 0-.396-1.603-.508-2.434-1.776-2.798-2.83-.04-.114-.406-.114-.446 0zM5.295 4.5a.75.75 0 01.747.682c.06.65.334 1.68.954 2.572.606.87 1.527 1.596 2.927 1.75a.75.75 0 010 1.491c-1.4.154-2.321.88-2.927 1.751a5.683 5.683 0 00-.954 2.572.75.75 0 01-1.493 0 5.683 5.683 0 00-.954-2.572c-.606-.87-1.527-1.597-2.927-1.75a.75.75 0 010-1.492c1.4-.154 2.321-.88 2.927-1.75.62-.892.894-1.922.954-2.572a.75.75 0 01.746-.682z\"/>",
    "exclamation-circle": "<path fill=\"none\" d=\"M0 0h16v16H0z\"/><path d=\"M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.946c-3.83 0-6.946-3.116-6.946-6.946S4.17 1.054 8 1.054 14.946 4.17 14.946 8 11.83 14.946 8 14.946z\"/><path d=\"M7.214 11.639c0-.216.076-.402.228-.558a.742.742 0 01.552-.234c.216 0 .402.078.558.234.156.155.234.342.234.558s-.078.4-.234.552a.773.773 0 01-.558.229.749.749 0 01-.552-.229.752.752 0 01-.228-.552zm1.188-1.716h-.804l-.312-6.072h1.416l-.3 6.072z\"/>",
    "external-link": "<path fill-rule=\"evenodd\" d=\"M15 7V1H9v1h4.29L7.11 8.18l.71.71L14 2.71V7h1zM1 15h12V9h-1v5H2V4h5V3H1v12z\" clip-rule=\"evenodd\"/>",
    "facebook": "<path d=\"M8.929 14.992H6.032v-7H4.587V5.587h1.445V4.135q0-1.548.73-2.341Q7.492 1 9.167 1h1.936v2.413H9.897q-.334 0-.532.055-.198.056-.294.195-.095.139-.119.29-.023.15-.023.428v1.206h2.182l-.254 2.405H8.93v7z\"/>",
    "follow": "<path d=\"M3.645 6.352a2.442 2.442 0 01-.586-1.587v-.194c0-1.339 1-2.454 2.277-2.536a2.409 2.409 0 011.833.655c.129.121.241.254.34.395.266-.197.55-.368.851-.51a3.345 3.345 0 00-.507-.615 3.42 3.42 0 00-2.581-.923c-1.802.117-3.213 1.669-3.213 3.534v.193c0 .82.293 1.614.825 2.236l.772.904s.07.081-.024.134L1.743 9.125A3.449 3.449 0 000 12.118V13h1v-.882c0-.877.474-1.691 1.24-2.125l1.891-1.088a1.089 1.089 0 00.286-1.649l-.772-.904zm10.614 5.774l-1.892-1.087c-.077-.044-.023-.134-.023-.134l.771-.904a3.446 3.446 0 00.825-2.236v-.294c0-.947-.396-1.862-1.088-2.511a3.419 3.419 0 00-2.581-.923c-1.801.117-3.212 1.67-3.212 3.535v.193c0 .82.293 1.614.825 2.236l.771.904s.059.087-.023.134l-1.889 1.086A3.45 3.45 0 005 15.118V16h1v-.882c0-.877.474-1.691 1.239-2.125l1.892-1.087a1.089 1.089 0 00.286-1.65l-.773-.904a2.447 2.447 0 01-.585-1.587v-.193c0-1.339 1-2.454 2.277-2.537a2.413 2.413 0 011.833.654c.498.467.771 1.1.771 1.781v.294c0 .582-.208 1.145-.586 1.587l-.771.904a1.09 1.09 0 00.285 1.651l1.894 1.088A2.448 2.448 0 0115 15.118V16h1v-.882a3.447 3.447 0 00-1.741-2.992z\"/>",
    "fullscreen": "<path d=\"M6.064 10.229l-2.418 2.418L2 11v4h4l-1.647-1.646 2.418-2.418-.707-.707zM11 2l1.647 1.647-2.418 2.418.707.707 2.418-2.418L15 6V2h-4z\"/>",
    "gamepad": "<path d=\"M4.423 2.5a1.25 1.25 0 00-1.224.995l-1.652 7.923a1.313 1.313 0 002.423.925l1.57-2.718A1.25 1.25 0 016.622 9h2.756c.447 0 .86.238 1.083.625l1.57 2.718a1.313 1.313 0 002.422-.924l-1.652-7.924a1.25 1.25 0 00-1.224-.995H4.423zm-2.692.689A2.75 2.75 0 014.423 1h7.154a2.75 2.75 0 012.692 2.189l1.653 7.923a2.813 2.813 0 01-5.19 1.981L9.233 10.5H6.766L5.27 13.093a2.813 2.813 0 01-5.19-1.98l1.65-7.925z\"/><path d=\"M7 5.5a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zm2 0a1.25 1.25 0 102.5 0 1.25 1.25 0 00-2.5 0z\"/>",
    "grid-view": "<path d=\"M9 1v6h6V1H9zm5 5h-4V2h4v4zM.999 7h6V1h-6v6zM2 2h4v4H2V2zm7 13h6V9H9v6zm1-5h4v4h-4v-4zM.999 15h6V9h-6v6zM2 10h4v4H2v-4z\"/>",
    "heart": "<path d=\"M13.764 2.727a4.057 4.057 0 00-5.488-.253.558.558 0 01-.31.112.531.531 0 01-.311-.112 4.054 4.054 0 00-5.487.253A4.05 4.05 0 00.974 5.61c0 1.089.424 2.113 1.168 2.855l4.462 5.223a1.791 1.791 0 002.726 0l4.435-5.195A4.052 4.052 0 0014.96 5.61a4.057 4.057 0 00-1.196-2.883zm-.722 5.098L8.58 13.048c-.307.36-.921.36-1.228 0L2.864 7.797a3.072 3.072 0 01-.905-2.187c0-.826.321-1.603.905-2.187a3.091 3.091 0 012.191-.913 3.05 3.05 0 011.957.709c.041.036.408.351.954.351.531 0 .906-.31.94-.34a3.075 3.075 0 014.161.192 3.1 3.1 0 01-.025 4.403z\"/>",
    "heart-active": "<path fill=\"none\" d=\"M0 0h16v16H0z\"/><path d=\"M13.797 2.727a4.057 4.057 0 00-5.488-.253.558.558 0 01-.31.112.531.531 0 01-.311-.112 4.054 4.054 0 00-5.487.253c-.77.77-1.194 1.794-1.194 2.883s.424 2.113 1.168 2.855l4.462 5.223a1.791 1.791 0 002.726 0l4.435-5.195a4.052 4.052 0 001.195-2.883 4.057 4.057 0 00-1.196-2.883z\"/>",
    "instagram": "<path d=\"M11.183 1.595Q10.175 1.548 8 1.548t-3.183.047q-.865.04-1.46.27-.516.198-.905.587-.389.39-.587.905-.23.595-.27 1.46Q1.548 5.825 1.548 8t.047 3.183q.04.865.27 1.46.198.516.587.905.39.389.905.587.595.23 1.46.27 1.008.047 3.183.047t3.183-.047q.865-.04 1.46-.27.516-.198.905-.587.389-.39.587-.905.23-.595.27-1.46.047-1.008.047-3.183t-.047-3.183q-.04-.865-.27-1.46-.198-.516-.587-.905-.39-.389-.905-.587-.595-.23-1.46-.27zM4.754.175Q5.794.127 8 .127t3.246.048q1.095.047 1.913.365.793.31 1.393.908.599.6.908 1.393.318.818.365 1.913.048 1.04.048 3.246t-.048 3.246q-.047 1.095-.365 1.913-.31.793-.908 1.393-.6.599-1.393.908-.818.318-1.913.365-1.04.048-3.246.048t-3.246-.048q-1.095-.047-1.913-.365-.793-.31-1.393-.908-.599-.6-.908-1.393-.318-.818-.365-1.913Q.127 10.206.127 8t.048-3.246Q.222 3.659.54 2.841q.31-.793.908-1.393.6-.599 1.393-.908Q3.66.222 4.754.175zm1.675 4.103Q7.175 3.96 8 3.96t1.571.318q.746.317 1.29.86.544.545.861 1.29.318.747.318 1.572 0 .825-.318 1.571-.317.746-.86 1.29-.545.544-1.29.861-.747.318-1.572.318-.825 0-1.571-.318-.746-.317-1.29-.86-.544-.545-.861-1.29Q3.96 8.824 3.96 8q0-.825.318-1.571.317-.746.86-1.29.545-.544 1.29-.861zm.254 5.996q.603.353 1.317.353t1.317-.353q.604-.353.957-.957.353-.603.353-1.317t-.353-1.317q-.353-.604-.957-.957Q8.714 5.373 8 5.373t-1.317.353q-.604.353-.957.957-.353.603-.353 1.317t.353 1.317q.353.604.957.957zm4.849-5.806q-.278-.278-.278-.67 0-.393.278-.671t.67-.278q.393 0 .671.278t.278.67q0 .393-.278.671t-.67.278q-.393 0-.671-.278z\"/>",
    "laptop": "<path d=\"M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0112.25 12h-8.5A1.75 1.75 0 012 10.25v-6.5zm1.75-.25a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25h-8.5zM.25 15.25A.75.75 0 011 14.5h14a.75.75 0 010 1.5H1a.75.75 0 01-.75-.75z\"/>",
    "library": "<path d=\"M8.375 1.098a.75.75 0 01.75 0l5.5 3.175a.75.75 0 01.375.65V15.25a.75.75 0 01-.75.75h-5.5a.75.75 0 01-.75-.75V1.747a.75.75 0 01.375-.65zM9.5 3.046V14.5h4V5.356l-4-2.31zM1 1.75a.75.75 0 011.5 0v13.5a.75.75 0 01-1.5 0V1.75zm3.5 0a.75.75 0 011.5 0v13.5a.75.75 0 01-1.5 0V1.75z\"/>",
    "list-view": "<path d=\"M1 3h1V2H1v1zm3-1v1h11V2H4zM1 9h1V8H1v1zm3 0h11V8H4v1zm0 6h11v-1H4v1zm-3 0h1v-1H1v1z\"/>",
    "location": "<path d=\"M8 1.562a4.732 4.732 0 00-3.47 7.95l.013.014L8 13.646l3.456-4.12.013-.013A4.732 4.732 0 008 1.563zM1.768 6.294a6.232 6.232 0 1110.813 4.225L8 15.98l-4.582-5.46a6.212 6.212 0 01-1.65-4.225z\"/><path d=\"M8 5.05a1.243 1.243 0 100 2.488A1.243 1.243 0 008 5.05zM5.257 6.295a2.743 2.743 0 115.486 0 2.743 2.743 0 01-5.486 0z\"/>",
    "locked": "<path d=\"M13 6h-1V4.5a4 4 0 00-8 0V6H3a1 1 0 00-1 1v7a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1zM5 4.5c0-1.654 1.346-3 3-3s3 1.346 3 3V6H5V4.5zm8 9.5H3V7h10v7z\"/>",
    "locked-active": "<path fill=\"none\" d=\"M0 0h16v16H0z\"/><path d=\"M13 6h-1V4.5c0-2.2-1.8-4-4-4s-4 1.8-4 4V6H3c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V7c0-.6-.4-1-1-1zM5 4.5c0-1.7 1.3-3 3-3s3 1.3 3 3V6H5V4.5z\"/>",
    "lyrics": "<path d=\"M8.5 1A4.505 4.505 0 004 5.5c0 .731.191 1.411.502 2.022L1.99 13.163a1.307 1.307 0 00.541 1.666l.605.349a1.307 1.307 0 001.649-.283L9.009 9.95C11.248 9.692 13 7.807 13 5.5 13 3.019 10.981 1 8.5 1zM4.023 14.245a.307.307 0 01-.388.066l-.605-.349a.309.309 0 01-.128-.393l2.26-5.078A4.476 4.476 0 007.715 9.92l-3.692 4.325zM8.5 9C6.57 9 5 7.43 5 5.5S6.57 2 8.5 2 12 3.57 12 5.5 10.429 9 8.5 9z\"/>",
    "menu": "<path d=\"M15.5 13.5H.5V12h15v1.5zm0-4.75H.5v-1.5h15v1.5zm0-4.75H.5V2.5h15V4z\"/>",
    "minimize": "<path d=\"M3.646 11.648l-2.418 2.417.707.707 2.418-2.418L5.999 14v-4h-4l1.647 1.648zm11.125-9.712l-.707-.707-2.418 2.418L10 2v4h4l-1.647-1.647 2.418-2.417z\"/>",
    "minus": "<path d=\"M2 7h12v2H0z\"></path>",
    "more": "<path d=\"M2 6.5a1.5 1.5 0 10-.001 2.999A1.5 1.5 0 002 6.5zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 10-.001 2.999A1.5 1.5 0 0014 6.5z\"/>",
    "new-spotify-connect": "<path d=\"M4 9.984v-4h1.802L9 4.143v7.69L5.802 9.984H4zm4 5.048q1.341 0 2.603-.508l.683.801q-1.58.707-3.286.707-1.627 0-3.107-.635-1.48-.635-2.552-1.707Q1.27 12.62.635 11.14 0 9.659 0 8.032q0-1.627.635-3.107.635-1.48 1.706-2.552Q3.413 1.302 4.893.667T8 .032q1.706 0 3.286.706l-.683.802Q9.341 1.032 8 1.032q-1.42 0-2.718.555-1.298.556-2.234 1.492-.937.937-1.492 2.234Q1 6.611 1 8.032q0 1.42.556 2.718.555 1.298 1.492 2.234.936.937 2.234 1.492 1.297.556 2.718.556zm4.357-12.469l.65-.761q1.398 1.119 2.195 2.746Q16 6.175 16 8.032t-.798 3.484q-.797 1.627-2.194 2.746l-.65-.762q1.23-.984 1.936-2.413Q15 9.66 15 8.032q0-1.627-.706-3.056-.707-1.428-1.937-2.413zM10.405 4.85l.643-.746q.904.699 1.428 1.722Q13 6.85 13 8.032q0 1.182-.524 2.206t-1.428 1.722l-.643-.746q.738-.563 1.166-1.393.429-.829.429-1.79 0-.96-.429-1.789-.428-.83-1.166-1.393z\"/>",
    "offline": "<path d=\"M12.715 3.341L13.89.703l-.913-.406-6.679 15 .913.406L8.414 13H11c2.75 0 5-2.25 5-5 0-2.143-1.38-3.954-3.285-4.659zM11 12H8.859l3.456-7.763C13.874 4.784 15 6.257 15 8c0 2.206-1.794 4-4 4zM8.79.297L7.586 3H5C2.25 3 0 5.25 0 8c0 2.143 1.38 3.954 3.285 4.659L2.11 15.297l.913.406 6.679-15L8.79.297zM3.684 11.763C2.126 11.216 1 9.743 1 8c0-2.206 1.794-4 4-4h2.141l-3.457 7.763z\"/><path fill=\"none\" d=\"M16 0v16H0V0z\"/>",
    "pause": "<path fill=\"none\" d=\"M0 0h16v16H0z\"/><path d=\"M3 2h3v12H3zM10 2h3v12h-3z\"/>",
    "phone": "<path d=\"M8 13a1 1 0 100-2 1 1 0 000 2z\"/><path d=\"M4.75 0A1.75 1.75 0 003 1.75v12.5c0 .966.784 1.75 1.75 1.75h6.5A1.75 1.75 0 0013 14.25V1.75A1.75 1.75 0 0011.25 0h-6.5zM4.5 1.75a.25.25 0 01.25-.25h6.5a.25.25 0 01.25.25v12.5a.25.25 0 01-.25.25h-6.5a.25.25 0 01-.25-.25V1.75z\"/>",
    "play": "<path d=\"M4.018 14L14.41 8 4.018 2z\"/>",
    "playlist": "<path d=\"M15 14.5H5V13h10v1.5zm0-5.75H5v-1.5h10v1.5zM15 3H5V1.5h10V3zM3 3H1V1.5h2V3zm0 11.5H1V13h2v1.5zm0-5.75H1v-1.5h2v1.5z\"/>",
    "playlist-folder": "<path d=\"M1.75 1A1.75 1.75 0 000 2.75v11.5C0 15.216.784 16 1.75 16h12.5A1.75 1.75 0 0016 14.25v-9.5A1.75 1.75 0 0014.25 3H7.82l-.65-1.125A1.75 1.75 0 005.655 1H1.75zM1.5 2.75a.25.25 0 01.25-.25h3.905a.25.25 0 01.216.125L6.954 4.5h7.296a.25.25 0 01.25.25v9.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25V2.75z\"/>",
    "plus2px": "<path d=\"M14 7H9V2H7v5H2v2h5v5h2V9h5z\"/><path fill=\"none\" d=\"M0 0h16v16H0z\"/>",
    "plus-alt": "<path d=\"M7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14C3.916 14 1 11.084 1 7.5S3.916 1 7.5 1 14 3.916 14 7.5 11.084 14 7.5 14zM8 3H7v4H3v1h4v4h1V8h4V7H8V3z\"/>",
    "podcasts": "<path d=\"M4.011 8.226a3.475 3.475 0 011.216-2.387c.179-.153.373-.288.578-.401l-.485-.875a4.533 4.533 0 00-.742.515 4.476 4.476 0 00-1.564 3.069 4.476 4.476 0 002.309 4.287l.483-.875a3.483 3.483 0 01-1.795-3.333zm-1.453 4.496a6.506 6.506 0 01.722-9.164c.207-.178.425-.334.647-.48l-.551-.835c-.257.169-.507.35-.746.554A7.449 7.449 0 00.024 7.912a7.458 7.458 0 003.351 6.848l.55-.835a6.553 6.553 0 01-1.367-1.203zm10.645-9.093a7.48 7.48 0 00-1.578-1.388l-.551.835c.518.342.978.746 1.368 1.203a6.452 6.452 0 011.537 4.731 6.455 6.455 0 01-2.906 4.914l.55.835c.257-.169.507-.351.747-.555a7.453 7.453 0 002.606-5.115 7.447 7.447 0 00-1.773-5.46zm-2.281 1.948a4.497 4.497 0 00-1.245-1.011l-.483.875a3.476 3.476 0 011.796 3.334 3.472 3.472 0 01-1.217 2.387 3.478 3.478 0 01-.577.401l.485.875a4.57 4.57 0 00.742-.515 4.476 4.476 0 001.564-3.069 4.482 4.482 0 00-1.065-3.277zM7.5 7A1.495 1.495 0 007 9.908V16h1V9.908A1.495 1.495 0 007.5 7z\"/><path fill=\"none\" d=\"M16 0v16H0V0z\"/><path fill=\"none\" d=\"M16 0v16H0V0z\"/>",
    "projector": "<path d=\"M11.5 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z\"/><path d=\"M1.75 3A1.75 1.75 0 000 4.75v6.5C0 12.216.784 13 1.75 13H2v1.25a.75.75 0 001.5 0V13h9v1.25a.75.75 0 001.5 0V13h.25A1.75 1.75 0 0016 11.25v-6.5A1.75 1.75 0 0014.25 3H1.75zM1.5 4.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v6.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25v-6.5z\"/>",
    "queue": "<path d=\"M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 013.5 1h9a2.5 2.5 0 010 5h-9A2.5 2.5 0 011 3.5zm2.5-1a1 1 0 000 2h9a1 1 0 100-2h-9z\"/>",
    "repeat": "<path d=\"M5.5 5H10v1.5l3.5-2-3.5-2V4H5.5C3 4 1 6 1 8.5c0 .6.1 1.2.4 1.8l.9-.5C2.1 9.4 2 9 2 8.5 2 6.6 3.6 5 5.5 5zm9.1 1.7l-.9.5c.2.4.3.8.3 1.3 0 1.9-1.6 3.5-3.5 3.5H6v-1.5l-3.5 2 3.5 2V13h4.5C13 13 15 11 15 8.5c0-.6-.1-1.2-.4-1.8z\"/>",
    "repeat-once": "<path fill=\"none\" d=\"M0 0h16v16H0z\"/><path d=\"M5 5v-.5V4c-2.2.3-4 2.2-4 4.5 0 .6.1 1.2.4 1.8l.9-.5C2.1 9.4 2 9 2 8.5 2 6.7 3.3 5.3 5 5zM10.5 12H6v-1.5l-3.5 2 3.5 2V13h4.5c1.9 0 3.5-1.2 4.2-2.8-.5.3-1 .5-1.5.6-.7.7-1.6 1.2-2.7 1.2zM11.5 0C9 0 7 2 7 4.5S9 9 11.5 9 16 7 16 4.5 14 0 11.5 0zm.9 7h-1.3V3.6H10v-1h.1c.2 0 .3 0 .4-.1.1 0 .3-.1.4-.2.1-.1.2-.2.2-.3.1-.1.1-.2.1-.3v-.1h1.1V7z\"/>",
    "search": "<path d=\"M11.618 11.532A5.589 5.589 0 0013.22 7.61a5.61 5.61 0 10-5.61 5.61 5.58 5.58 0 003.246-1.04l2.912 3.409.76-.649-2.91-3.408zm-4.008.688C5.068 12.22 3 10.152 3 7.61S5.068 3 7.61 3s4.61 2.068 4.61 4.61-2.068 4.61-4.61 4.61z\"/>",
    "search-active": "<path d=\"M11.955 11.157A5.61 5.61 0 107.61 13.22c1.03 0 1.992-.282 2.822-.767l2.956 3.46 1.521-1.299-2.954-3.457zm-4.345.063A3.614 3.614 0 014 7.61 3.614 3.614 0 017.61 4a3.614 3.614 0 013.61 3.61 3.614 3.614 0 01-3.61 3.61z\"/>",
    "shuffle": "<path d=\"M4.5 6.8l.7-.8C4.1 4.7 2.5 4 .9 4v1c1.3 0 2.6.6 3.5 1.6l.1.2zm7.5 4.7c-1.2 0-2.3-.5-3.2-1.3l-.6.8c1 1 2.4 1.5 3.8 1.5V14l3.5-2-3.5-2v1.5zm0-6V7l3.5-2L12 3v1.5c-1.6 0-3.2.7-4.2 2l-3.4 3.9c-.9 1-2.2 1.6-3.5 1.6v1c1.6 0 3.2-.7 4.2-2l3.4-3.9c.9-1 2.2-1.6 3.5-1.6z\"/>",
    "skip-back": "<path d=\"M13 2.5L5 7.119V3H3v10h2V8.881l8 4.619z\"/>",
    "skip-back15": "<path d=\"M10 4.001H6V2.5l-3.464 2L6 6.5V5h4c2.206 0 4 1.794 4 4s-1.794 4-4 4v1c2.75 0 5-2.25 5-5s-2.25-4.999-5-4.999zM2.393 8.739c-.083.126-.19.236-.32.332a1.642 1.642 0 01-.452.229 1.977 1.977 0 01-.56.092v.752h1.36V14h1.096V8.327h-.96c-.027.15-.081.287-.164.412zm5.74 2.036a1.762 1.762 0 00-.612-.368 2.295 2.295 0 00-.78-.128c-.191 0-.387.031-.584.092a1.188 1.188 0 00-.479.268l.327-1.352H8.38v-.96H5.252l-.688 2.872c.037.017.105.042.204.076l.308.108.309.107.212.076c.096-.112.223-.205.38-.28.157-.075.337-.112.54-.112.133 0 .264.021.392.063.128.043.24.105.336.188a.907.907 0 01.233.316c.059.128.088.275.088.44a.927.927 0 01-.628.916 1.19 1.19 0 01-.404.068c-.16 0-.306-.025-.435-.076a1.046 1.046 0 01-.34-.212.992.992 0 01-.229-.32 1.171 1.171 0 01-.1-.4l-1.04.248c.021.225.086.439.195.645.109.205.258.388.444.548.187.16.406.287.66.38.253.093.534.14.844.14.336 0 .636-.052.9-.156.264-.104.487-.246.672-.424.184-.179.325-.385.424-.62.099-.235.148-.485.148-.752 0-.298-.049-.565-.145-.8a1.686 1.686 0 00-.399-.591z\"/>",
    "skip-forward": "<path d=\"M11 3v4.119L3 2.5v11l8-4.619V13h2V3z\"/>",
    "skip-forward15": "<path d=\"M6 5h4v1.5l3.464-2L10 2.5V4H6C3.25 4 1 6.25 1 9s2.25 5 5 5v-1c-2.206 0-4-1.794-4-4s1.794-4 4-4zm1.935 3.739a1.306 1.306 0 01-.32.332c-.13.096-.281.172-.451.228a1.956 1.956 0 01-.562.092v.752h1.36v3.856h1.096V8.327h-.96c-.026.15-.08.287-.163.412zm6.139 2.628a1.664 1.664 0 00-.399-.592 1.747 1.747 0 00-.612-.368 2.295 2.295 0 00-.78-.128c-.191 0-.387.03-.584.092-.197.061-.357.15-.479.268l.327-1.352h2.376v-.96h-3.128l-.688 2.872c.037.016.106.041.204.076l.308.108.309.108.212.076c.096-.112.223-.206.38-.28.157-.075.337-.112.54-.112.133 0 .264.021.392.064a.97.97 0 01.336.188.907.907 0 01.233.316c.058.128.088.274.088.44a.941.941 0 01-.3.721.995.995 0 01-.328.196 1.19 1.19 0 01-.404.068c-.16 0-.306-.025-.436-.076a1.03 1.03 0 01-.569-.532 1.171 1.171 0 01-.1-.4l-1.04.248c.02.224.086.439.195.644.109.205.258.388.444.548.186.16.406.287.66.38.253.093.534.14.844.14.336 0 .636-.052.9-.156.264-.104.487-.245.672-.424.184-.179.325-.385.424-.62a1.91 1.91 0 00.148-.752c0-.3-.049-.566-.145-.801z\"/>",
    "soundbetter": "<path fill-rule=\"evenodd\" d=\"M5.272 12.542h1.655V2H5.15v3.677C4.782 4.758 4.046 4.33 3.065 4.33c-.98 0-1.716.43-2.268 1.226C.245 6.352 0 7.332 0 8.435c0 1.226.245 2.207.736 3.004.49.796 1.226 1.226 2.207 1.226 1.103 0 1.9-.552 2.329-1.717v1.594zm-.49-6.068c.306.368.429.858.429 1.47v1.35c0 .55-.184 1.041-.49 1.409-.369.368-.737.552-1.166.552-1.103 0-1.655-.92-1.655-2.636 0-.92.123-1.594.49-2.023.307-.429.736-.674 1.227-.674.49 0 .858.184 1.164.552zM8.03 12.542V2h4.108c.674 0 1.287.061 1.716.245.43.123.859.43 1.165.92.307.429.49.98.49 1.593 0 .552-.183 1.103-.49 1.532-.368.43-.797.674-1.41.797.736.123 1.288.43 1.655.92.368.49.552 1.041.552 1.654 0 .797-.245 1.471-.797 2.023-.552.551-1.348.858-2.452.858H8.031zm1.778-6.13h2.33c.49 0 .858-.122 1.103-.428.245-.307.429-.674.429-1.103 0-.49-.184-.859-.49-1.042a1.712 1.712 0 00-1.104-.368H9.808v2.942zm2.452 4.536H9.808V7.884h2.452c.49 0 .92.122 1.226.429.245.306.43.674.43 1.103 0 .49-.123.858-.43 1.103-.306.307-.736.43-1.226.43z\" clip-rule=\"evenodd\"/><path d=\"M.674 13.523H16v1.226H.674z\"/>",
    "speaker": "<path d=\"M11 12.75a2 2 0 100-4 2 2 0 000 4z\"/><path d=\"M6 2.75C6 1.784 6.783 1 7.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5A1.75 1.75 0 0114.25 16h-6.5A1.75 1.75 0 016 14.25V2.75zm1.75-.25a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25h-6.5zm-6 0a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h2.375V16H1.75A1.75 1.75 0 010 14.25V2.75C0 1.784.784 1 1.75 1h2.375v1.5H1.75z\"/><path d=\"M12 5.5a1 1 0 11-2 0 1 1 0 012 0z\"/>",
    "spotify": "<path d=\"M8 0a8 8 0 100 16A8 8 0 008 0zm3.669 11.539a.498.498 0 01-.686.166c-1.878-1.148-4.243-1.408-7.028-.772a.499.499 0 01-.222-.972c3.048-.696 5.662-.396 7.77.892a.5.5 0 01.166.686zm.979-2.178a.624.624 0 01-.858.205c-2.15-1.322-5.428-1.705-7.972-.932a.624.624 0 11-.362-1.194c2.905-.882 6.517-.455 8.987 1.063a.624.624 0 01.205.858zm.084-2.269C10.153 5.561 5.9 5.42 3.438 6.167a.748.748 0 11-.434-1.432c2.826-.857 7.523-.692 10.492 1.07a.748.748 0 01-.764 1.287z\"/>",
    "subtitles": "<path fill=\"none\" d=\"M0 0h16v16H0z\"/><path d=\"M3 7h10v1H3zM5 10h6v1H5z\"/><path d=\"M15 3v10H1V3h14m1-1H0v12h16V2z\"/>",
    "tablet": '<path d="M1 1.75C1 .784 1.784 0 2.75 0h10.5C14.216 0 15 .784 15 1.75v12.5A1.75 1.75 0 0113.25 16H2.75A1.75 1.75 0 011 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H2.75z"/><path d="M9 12a1 1 0 11-2 0 1 1 0 012 0z"/>',
    "ticket": "<path d=\"M0 2h16v5.486l-.563.145a.898.898 0 000 1.739l.563.144V15H0V9.514l.563-.144a.898.898 0 000-1.74L0 7.487V2zm1.5 1.5v2.902a2.396 2.396 0 010 4.196V13.5h13v-2.902a2.396 2.396 0 010-4.196V3.5h-13z\"/><path d=\"M8 7.25a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zM5.25 8.5a2.75 2.75 0 115.5 0 2.75 2.75 0 01-5.5 0z\"/>",
    "twitter": "<path d=\"M13.54 3.889q.984-.595 1.333-1.683-.905.54-1.929.738-.42-.452-.996-.706-.575-.254-1.218-.254-1.254 0-2.143.889-.889.889-.889 2.15 0 .318.08.691-1.857-.095-3.484-.932-1.627-.838-2.762-2.242-.413.714-.413 1.523 0 .778.361 1.445t.988 1.08q-.714-.009-1.373-.374v.04q0 1.087.69 1.92.691.834 1.739 1.048-.397.111-.794.111-.254 0-.571-.055.285.912 1.063 1.5.778.587 1.77.603-1.659 1.302-3.77 1.302-.365 0-.722-.048Q2.619 14 5.15 14q1.358 0 2.572-.361 1.215-.361 2.147-.988.933-.627 1.683-1.46.75-.834 1.234-1.798.484-.964.738-1.988t.254-2.032q0-.262-.008-.397.88-.635 1.508-1.563-.841.373-1.738.476z\"/>",
    "visualizer": "<path d=\"M.999 15h2V5h-2v10zm4 0h2V1h-2v14zM9 15h2v-4H9v4zm4-7v7h2V8h-2z\"/>",
    "voice": "<path d=\"M4 4a4 4 0 118 0v3a4 4 0 01-8 0V4zm4-2.5A2.5 2.5 0 005.5 4v3a2.5 2.5 0 005 0V4A2.5 2.5 0 008 1.5z\"/><path d=\"M2.25 6v1a5.75 5.75 0 0011.5 0V6h1.5v1a7.251 7.251 0 01-6.5 7.212V16h-1.5v-1.788A7.251 7.251 0 01.75 7V6h1.5z\"/>",
    "volume": "<path d=\"M12.945 1.379l-.652.763c1.577 1.462 2.57 3.544 2.57 5.858s-.994 4.396-2.57 5.858l.651.763a8.966 8.966 0 00.001-13.242zm-2.272 2.66l-.651.763a4.484 4.484 0 01-.001 6.397l.651.763c1.04-1 1.691-2.404 1.691-3.961s-.65-2.962-1.69-3.962zM0 5v6h2.804L8 14V2L2.804 5H0zm7-1.268v8.536L3.072 10H1V6h2.072L7 3.732z\"/>",
    "volume-off": "<path d=\"M0 5v6h2.804L8 14V2L2.804 5H0zm7-1.268v8.536L3.072 10H1V6h2.072L7 3.732zm8.623 2.121l-.707-.707-2.147 2.147-2.146-2.147-.707.707L12.062 8l-2.146 2.146.707.707 2.146-2.147 2.147 2.147.707-.707L13.477 8l2.146-2.147z\"/>",
    "volume-one-wave": "<path d=\"M10.04 5.984l.658-.77q.548.548.858 1.278.31.73.31 1.54 0 .54-.144 1.055-.143.516-.4.957-.259.44-.624.805l-.658-.77q.825-.865.825-2.047 0-1.183-.825-2.048zM0 11.032v-6h2.802l5.198-3v12l-5.198-3H0zm7 1.27v-8.54l-3.929 2.27H1v4h2.071L7 12.302z\"/>",
    "volume-two-wave": "<path d=\"M0 11.032v-6h2.802l5.198-3v12l-5.198-3H0zm7 1.27v-8.54l-3.929 2.27H1v4h2.071L7 12.302zm4.464-2.314q.401-.925.401-1.956 0-1.032-.4-1.957-.402-.924-1.124-1.623L11 3.69q.873.834 1.369 1.957.496 1.123.496 2.385 0 1.262-.496 2.385-.496 1.123-1.369 1.956l-.659-.762q.722-.698 1.123-1.623z\"/>",
    "watch": "<path d=\"M4.347 1.122l-.403 1.899A2.25 2.25 0 002 5.25v5.5a2.25 2.25 0 001.944 2.23l.403 1.898c.14.654.717 1.122 1.386 1.122h4.535c.668 0 1.246-.468 1.385-1.122l.404-1.899A2.25 2.25 0 0014 10.75v-5.5a2.25 2.25 0 00-1.943-2.23l-.404-1.898A1.417 1.417 0 0010.267 0H5.734c-.67 0-1.247.468-1.386 1.122zM5.8 1.5h4.4l.319 1.5H5.48l.32-1.5zM10.52 13l-.319 1.5H5.8L5.481 13h5.038zM4.25 4.5h7.5a.75.75 0 01.75.75v5.5a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-5.5a.75.75 0 01.75-.75z\"/>",
    "x": "<path d=\"M14.354 2.353l-.708-.707L8 7.293 2.353 1.646l-.707.707L7.293 8l-5.647 5.646.707.708L8 8.707l5.646 5.647.708-.708L8.707 8z\"/>"
};

(function appendAllFontStyle() {
    if (!Spicetify._fontStyle) {
        setTimeout(appendAllFontStyle, 1000);
        return;
    }
    const fontList = Spicetify._fontStyle.toString().match(new RegExp('"\\w+"',"g")).map(font => font.replaceAll('"', ""));
    const fontStyle = document.createElement("style");
    fontStyle.className = "spicetify-font";
    fontList.forEach(font => {
        fontStyle.innerHTML += Spicetify.getFontStyle(font);
    });
    return document.head.appendChild(fontStyle);
})()

class _HTMLContextMenuItem extends HTMLLIElement {
    constructor({
        name,
        disabled = false,
        icon = undefined,
        divider = false,
    }) {
        super();
        this.name = name;
        this.icon = icon || "";
        this.disabled = disabled;
        this.divider = divider;
        this.classList.add("main-contextMenu-menuItem");
    }
    render() {
        let icon = this.icon;
        if (icon && Spicetify.SVGIcons[icon]) {
            icon = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons[icon]}</svg>`;
        }
        this.innerHTML = `
<button class="main-contextMenu-menuItemButton ${this.disabled ? "main-contextMenu-disabled" : ""} ${this.divider ? "main-contextMenu-dividerAfter" : ""}">
    <span class="ellipsis-one-line main-type-mesto" dir="auto">${this.name}</span>
    ${icon || ""}
</button>`;
    }

    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }

    update(name, value) {
        this[name] = value;
        this.render();
    }
}

class _HTMLContextSubmenu extends HTMLDivElement {
    constructor({ items = [], placement = "bottom-start" } = {}) {
        super();
        this.items = items;
        this.placement = placement;
        this.style.zIndex = "9999";
        this.style.position = "absolute";
        this.style.inset = "0px auto auto 0px";
    }
    render() {
        this._tippy = {
            unmount: () => {},
            popperInstance: {
                forceUpdate: () => {},
            },
        };

        const list = document.createElement("ul");
        list.classList.add("main-contextMenu-menu");
        list.append(...this.items);
        this.append(list);

        const { y: parentY, width: parentWidth } = this.parentElement.getBoundingClientRect();
        const { width: thisWidth, height: thisHeight } = this.getBoundingClientRect();
        let x = 0, y = this.parentElement.offsetTop;

        switch(this.placement) {
            case "top-start":
            case "bottom-start":
                x += parentWidth - 5;
                break;
            case "top-end":
            case "bottom-end":
            default:
                x -= thisWidth - 5;
                break;
        }
        let realY = y + parentY;
        if ((realY + thisHeight) > window.innerHeight) {
            y -= ((realY + thisHeight) - window.innerHeight);
        }
        this.style.transform = `translate(${x}px, ${y}px)`;
    }

    addItem(item) {
        this.items.push(item);
    }

    connectedCallback() {
        if (!this.rendered) {
            this.render();
            this.rendered = true;
        }
    }
}
customElements.define("context-menu-item", _HTMLContextMenuItem, { extends: "li" });
customElements.define("context-submenu", _HTMLContextSubmenu, { extends: "div" });

Spicetify.Menu = (function() {
    const collection = new Set();

    const _addItems = function(instance) {
        const list = instance.querySelector("ul");
        const elemList = [];

        for (const item of collection) {
            if (item._items?.size) {
                const htmlSubmenu = new _HTMLContextSubmenu({
                    placement: instance.firstChild.dataset.placement,
                });

                for (const child of item._items) {
                    child._element.onclick = () => {
                        child.onClick();
                        htmlSubmenu.remove();
                        instance._tippy?.props?.onClickOutside();
                    };
                    htmlSubmenu.addItem(child._element);
                }

                item._element.onmouseenter = () => item._element.append(htmlSubmenu);
                item._element.onmouseleave = () => htmlSubmenu.remove();
                elemList.push(item._element);
                continue;
            }

            item._element.onclick = () => {
                item.onClick();
                instance._tippy?.props?.onClickOutside();
            };
            elemList.push(item._element);
        }
        list.prepend(...elemList);
    }

    class Item {
        constructor(name, isEnabled, onClick, icon = undefined) {
            this._name = name;
            this._isEnabled = isEnabled;
            this._icon = icon;
            this.onClick = () => {onClick(this)};
            this._element = new _HTMLContextMenuItem({
                name: name,
                icon: isEnabled ? "check" : icon ?? ""
            });
        }

        setState(isEnabled) {
            this._isEnabled = isEnabled;
            this._element.update("icon", isEnabled ? "check" : this._icon ?? "");
        }
        set isEnabled(bool) { this.setState(bool); }
        get isEnabled() { return this._isEnabled; }

        setName(name) {
            this._name = name;
            this._element.update("name", name);
        }
        set name(text) { this.setName(text); }
        get name() { return this._name; }

        setIcon(icon) {
            this._icon = icon;
            this._element.update("icon", icon);
        }
        set icon(icon) { this.setIcon(icon); }
        get icon() { return this._icon; }

        register() {
            collection.add(this);
        }
        deregister() {
            collection.delete(this);
        }
    }

    class SubMenu {
        constructor(name, items) {
            this._name = name;
            this._items = new Set(items);
            this._element = new _HTMLContextMenuItem({
                name: name,
                icon: `<svg role="img" height="16" width="16" fill="currentColor" class="main-contextMenu-subMenuIcon" viewBox="0 0 16 16"><path d="M13 10L8 4.206 3 10z"></path></svg>`
            });
        }

        setName(name) {
            this._name = name;
            this._element.update("name", name);
        }
        set name(text) { this.setName(text); }
        get name() { return this._name; }

        addItem(item) {
            this._items.add(item);
        }
        removeItem(item) {
            this._items.delete(item);
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
    const iconList = Object.keys(Spicetify.SVGIcons);

    class Item {
        constructor(name, onClick, shouldAdd = (uris) => true, icon = undefined, disabled = false) {
            this.onClick = onClick;
            this.shouldAdd = shouldAdd;
            this._name = name;
            this._icon = icon;
            this._disabled = disabled;
            this._element = new _HTMLContextMenuItem({
                name: name,
                icon: icon,
                disabled: disabled,
            });
        }
        set name(text) {
            this._name = text;
            this._element.update("name", text);
        }
        get name() { return this._name; }

        set icon(name) {
            this._icon = name;
            this._element.update("icon", name);
        }
        get icon() { return this._icon; }

        set disabled(bool) {
            this._disabled = bool;
            this._element.update("disabled", bool);
        }
        get disabled() { return this._disabled; }

        register() {
            itemList.add(this);
        }
        deregister() {
            itemList.delete(this);
        }
    }

    Item.iconList = iconList;

    class SubMenu {
        constructor(name, items, shouldAdd = (uris) => true, disabled = false) {
            this._items = new Set(items);
            this.shouldAdd = shouldAdd;
            this._name = name;
            this._disabled = disabled;
            this._element = new _HTMLContextMenuItem({
                name: name,
                icon: `<svg role="img" height="16" width="16" fill="currentColor" class="main-contextMenu-subMenuIcon" viewBox="0 0 16 16"><path d="M13 10L8 4.206 3 10z"></path></svg>`,
                disabled: disabled,
            });
        }
        set name(text) {
            this._name = text;
            this._element.update("name", text);
        }
        get name() { return this._name; }

        addItem(item) {
            this._items.add(item);
        }
        removeItem(item) {
            this._items.delete(item);
        }

        set disabled(bool) {
            this._disabled = bool;
            this._element.update("disabled", bool);
            if (this._submenuElement) {
                if (!bool) {
                    this._element.onmouseenter = () => this._element.append(this._submenuElement);
                    this._element.onmouseleave = () => this._submenuElement.remove();
                } else {
                    this._element.onmouseenter = this._element.onmouseleave = undefined;
                }
            }
        }
        get disabled() { return this._disabled; }

        register() {
            itemList.add(this);
        }
        deregister() {
            itemList.delete(this);
        }
    }

    SubMenu.iconList = iconList;

    function _addItemsRecursive(instance, currentItem, uris, uids, contextUri) {
        if (currentItem._items?.size) {
            const htmlSubmenu = new _HTMLContextSubmenu({
                placement: instance.firstChild.dataset.placement,
            });

            for (const child of currentItem._items) {
                if (!child.shouldAdd(uris, uids, contextUri)) {
                    continue;
                }

                child._element.onclick = () => {
                    if (!child._disabled) {
                        child.onClick(uris, uids, contextUri);
                        htmlSubmenu.remove();
                        instance._tippy?.props?.onClickOutside();
                    }
                };
                htmlSubmenu.addItem(child._element);

                _addItemsRecursive(instance, child, uris, uids, contextUri);
            }

            currentItem._submenuElement = htmlSubmenu;
            currentItem.disabled = currentItem._disabled;
        }
    }

    function _addItems(instance) {
        const list = instance.querySelector("ul");
        const container = instance.firstChild;
        const reactEH = Object.values(container)[1];
        let props = reactEH?.children?.props;
        if (!props) { // v1.1.56
            reactII = Object.values(container)[0];
            props = reactII.pendingProps.children.props;
        }

        let uris = [];
        let uids;
        let contextUri;
        if (props.uris) {
            uris = props.uris;
        } else if (props.uri) {
            uris = [props.uri];
        } else if (props.item?.uri) {
            uris = [props.item.uri];
        } else if (props.reference?.uri) {
            uris = [props.reference.uri];
        } else {
            return;
        }
        if (props.uids) {
            uids = props.uids;
        } else if (props.uid) {
            uids = [props.uid];
        } else if (props.item?.uid) {
            uids = [props.item.uid];
        }

        if (props.contextUri) {
            contextUri = props?.contextUri;
        } else if (props.context?.uri) {
            contextUri = props.context.uri;
        }

        const elemList = [];
        for (const item of itemList) {
            if (!item.shouldAdd(uris, uids, contextUri)) {
                continue;
            }

            if (item._items?.size) {
                _addItemsRecursive(instance, item, uris, uids, contextUri);
                elemList.push(item._element);
                continue;
            }

            item._element.onclick = () => {
                if (!item._disabled) {
                    item.onClick(uris, uids, contextUri);
                    instance._tippy?.props?.onClickOutside();
                }
            };

            elemList.push(item._element);
        }
        list.prepend(...elemList);
    }

    return { Item, SubMenu, _addItems };
})();

Spicetify._cloneSidebarItem = function (list, sidebarIsCollapsed) {
	function findChild(parent, key, value) {
		if (!parent.props) {
            return null;
        }

		if (value && parent.props[key]?.includes(value)) {
			return parent;
		} else if (!parent.props.children) {
			return null;
		} else if (Array.isArray(parent.props.children)) {
			for (const child of parent.props.children) {
				let ele = findChild(child, key, value);
				if (ele) {
					return ele;
				}
			}
		} else if (parent.props.children) {
			return findChild(parent.props.children, key, value);
		}
		return null;
	}

	function conditionalAppend(baseClassname, activeClassname, location) {
		if (Spicetify.Platform?.History?.location?.pathname.startsWith(location)) {
			baseClassname += " " + activeClassname;
		}

		return baseClassname;
	}

	const React = Spicetify.React;
	const reactObjs = [];
	for (const app of list) {
		let manifest;
		try {
			var request = new XMLHttpRequest();
			request.open("GET", `spicetify-routes-${app}.json`, false);
			request.send(null);
			manifest = JSON.parse(request.responseText);
		} catch {
			manifest = {};
		}

		let appProper = manifest.name;
		if (typeof appProper === "object") {
			appProper = appProper[Spicetify.Locale.getLocale()] || appProper["en"];
		}
		if (!appProper) {
			appProper = app[0].toUpperCase() + app.slice(1);
		}
		const icon = manifest.icon || "";
		const activeIcon = manifest["active-icon"] || icon;

		const appLink = "/" + app;
		let obj, link;

		if (typeof sidebarIsCollapsed === "boolean") {
			link = findChild(Spicetify._sidebarXItemToClone, "className", "main-yourLibraryX-navLink");
			obj = React.cloneElement(
				Spicetify._sidebarXItemToClone,
				null,
				React.cloneElement(
					Spicetify._sidebarXItemToClone.props.children,
					{
						label: sidebarIsCollapsed ? appProper : ""
					},
					React.cloneElement(
						link,
						{
							to: appLink,
							isActive: (e, { pathname: t }) => t.startsWith(appLink),
							className: conditionalAppend("link-subtle main-yourLibraryX-navLink", "main-yourLibraryX-navLinkActive", appLink)
						},
						React.createElement(Spicetify.ReactComponent.IconComponent, {
							className: "home-icon",
							iconSize: "24",
							dangerouslySetInnerHTML: {
								__html: icon
							}
						}),
						React.createElement(Spicetify.ReactComponent.IconComponent, {
							className: "home-active-icon",
							iconSize: "24",
							dangerouslySetInnerHTML: {
								__html: activeIcon
							}
						}),
						!sidebarIsCollapsed &&
							React.createElement(
								Spicetify.ReactComponent.TextComponent,
								{
									variant: "balladBold",
								},
								appProper
							)
					)
				)
			);
		} else {
			link = findChild(Spicetify._sidebarItemToClone, "className", "main-navBar-navBarLink");
			obj = React.cloneElement(
				Spicetify._sidebarItemToClone,
				null,
				React.cloneElement(
					link,
					{
						to: appLink,
						isActive: (e, { pathname: t }) => t.startsWith(appLink),
						className: conditionalAppend("link-subtle main-navBar-navBarLink", "main-navBar-navBarLinkActive", appLink)
					},
					React.createElement("div", {
						className: "icon collection-icon",
						dangerouslySetInnerHTML: {
							__html: icon
						}
					}),
					React.createElement("div", {
						className: "icon collection-active-icon",
						dangerouslySetInnerHTML: {
							__html: activeIcon
						}
					}),
					React.createElement(
						"span",
						{
							className: "ellipsis-one-line main-type-mestoBold"
						},
						appProper
					)
				)
			);
		}
		reactObjs.push(obj);
	}
	return reactObjs;
};

class _HTMLGenericModal extends HTMLElement {
    constructor() {
        super();
    }

    hide() {
        this.remove();
    }

    display({
        title,
        content,
        isLarge = false,
    }) {
        this.innerHTML = `
<div class="GenericModal__overlay" style="z-index: 100;">
    <div class="GenericModal" tabindex="-1" role="dialog" aria-label="${title}" aria-modal="true">
        <div class="${isLarge ? "main-embedWidgetGenerator-container" : "main-trackCreditsModal-container"}">
            <div class="main-trackCreditsModal-header">
                <h1 class="main-type-alto" as="h1">${title}</h1>
                <button aria-label="Close" class="main-trackCreditsModal-closeBtn"><svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><title>Close</title><path d="M31.098 29.794L16.955 15.65 31.097 1.51 29.683.093 15.54 14.237 1.4.094-.016 1.508 14.126 15.65-.016 29.795l1.414 1.414L15.54 17.065l14.144 14.143" fill="currentColor" fill-rule="evenodd"></path></svg></button>
            </div>
            <div class="main-trackCreditsModal-mainSection">
                <main class="main-trackCreditsModal-originalCredits"></main>
            </div>
        </div>
    </div>
</div>`;

        this.querySelector("button").onclick = this.hide.bind(this);
        const main = this.querySelector("main");

        let hidePopup = this.hide.bind(this);

        // Listen for click events on Overlay
        this.querySelector(".GenericModal__overlay").addEventListener('click', (event) => {
            if (!this.querySelector('.GenericModal').contains(event.target))
                hidePopup();
        });

        if (Spicetify.React.isValidElement(content)) {
            Spicetify.ReactDOM.render(content, main);
        } else if (typeof content === "string") {
            main.innerHTML = content;
        } else {
            main.append(content);
        }
        document.body.append(this);
    }
}
customElements.define("generic-modal", _HTMLGenericModal);
Spicetify.PopupModal = new _HTMLGenericModal();

Spicetify.ReactComponent = {};

Object.defineProperty(Spicetify, "TippyProps", {
    value: {
        delay: [200, 0],
        animation: true,
        render(instance) {
            const popper = document.createElement('div');
            const box = document.createElement('div');

            popper.id = "context-menu";
            popper.appendChild(box);

            box.className = "main-contextMenu-tippy"
            box.textContent = instance.props.content;

            function onUpdate(prevProps, nextProps) {
              if (prevProps.content !== nextProps.content) {
                if (nextProps.allowHTML) box.innerHTML = nextProps.content;
                else box.textContent = nextProps.content;
              }
            }

            return { popper, onUpdate }
        },
        onShow(instance) {
            instance.popper.firstChild.classList.add("main-contextMenu-tippyEnter");
        },
        onMount(instance) {
            requestAnimationFrame(() => {
                instance.popper.firstChild.classList.remove("main-contextMenu-tippyEnter");
                instance.popper.firstChild.classList.add("main-contextMenu-tippyEnterActive");
            });
        },
        onHide(instance) {
            requestAnimationFrame(() => {
                instance.popper.firstChild.classList.remove("main-contextMenu-tippyEnterActive");
                instance.unmount();
            });
        },
    },
    writable: false,
});

Spicetify.Topbar = (function() {
    let leftContainer;
    const buttonsStash = new Set();

    class Button {
        constructor(label, icon, onClick, disabled = false) {
            this.element = document.createElement("button");
            this.element.classList.add("main-topBar-button");
            this.icon = icon;
            this.onClick = onClick;
            this.disabled = disabled;
            this.tippy = Spicetify.Tippy?.(this.element, {
                content: label,
                placement: "bottom",
                ...Spicetify.TippyProps,
            });
            this.label = label;
            buttonsStash.add(this.element);
            leftContainer?.append(...buttonsStash);
        }
        get label() { return this._label; }
        set label(text) {
            this._label = text;
            if (!this.tippy) this.element.setAttribute("title", text);
            else this.tippy.setContent(text);
        }
        get icon() { return this._icon; }
        set icon(input) {
            if (input && Spicetify.SVGIcons[input]) {
                input = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons[input]}</svg>`;
            }
            this._icon = input;
            this.element.innerHTML = input;
        }
        get onClick() { return this._onClick; }
        set onClick(func) {
            this._onClick = func;
            this.element.onclick = () => this._onClick(this);
        }
        get disabled() { return this._disabled; }
        set disabled(bool) {
            this._disabled = bool;
            this.element.disabled = bool;
            if (bool) {
                this.element.classList.add("disabled");
            } else {
                this.element.classList.remove("disabled");
            }
        }
    }

    function waitForTopbarMounted() {
        leftContainer = document.querySelector(".main-topBar-historyButtons");
        if (!leftContainer) {
            setTimeout(waitForTopbarMounted, 300);
            return;
        }
        leftContainer.append(...buttonsStash);
    };

    waitForTopbarMounted();

    (function attachObserver() {
        const topBar = document.querySelector(".Root__top-bar")
        if (!topBar) {
            setTimeout(attachObserver, 300);
            return;
        }
        const observer = new MutationObserver((mutations) => {
            mutations.forEach((mutation) => {
                if (mutation.removedNodes.length > 0) {
                    leftContainer = null;
                    waitForTopbarMounted();
                }
            });
        });
        observer.observe(topBar, {childList: true});
    })();

    return { Button };
})();

Spicetify.Playbar = (function() {
    let rightContainer;
    let sibling;
    const buttonsStash = new Set();

    class Button {
        constructor(label, icon, onClick, disabled = false, active = false) {
            this.element = document.createElement("button");
            this.element.classList.add("main-genericButton-button");
            this.element.style.display = "block";
            this.icon = icon;
            this.onClick = onClick;
            this.disabled = disabled;
            this.active = active;
            Array.from(sibling?.classList ?? []).forEach((className) => {
                if (!className.startsWith("main-genericButton")) {
                    this.element.classList.add(className);
                }
            });
            this.tippy = Spicetify.Tippy?.(this.element, {
                content: label,
                ...Spicetify.TippyProps,
            });
            this.label = label;
            buttonsStash.add(this.element);
            rightContainer?.prepend(...buttonsStash);
        }
        get label() { return this._label; }
        set label(text) {
            this._label = text;
            if (!this.tippy) this.element.setAttribute("title", text);
            else this.tippy.setContent(text);
        }
        get icon() { return this._icon; }
        set icon(input) {
            if (input && Spicetify.SVGIcons[input]) {
                input = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor">${Spicetify.SVGIcons[input]}</svg>`;
            }
            this._icon = input;
            this.element.innerHTML = input;
        }
        get onClick() { return this._onClick; }
        set onClick(func) {
            this._onClick = func;
            this.element.onclick = () => this._onClick(this);
        }
        get disabled() { return this._disabled; }
        set disabled(bool) {
            this._disabled = bool;
            this.element.disabled = bool;
            this.element.classList.toggle("disabled", bool);
        }
        set active(bool) {
            this._active = bool;
            this.element.classList.toggle("main-genericButton-buttonActive", bool);
        }
        get active() { return this._active; }
    }

    (function waitForPlaybarMounted() {
        sibling = document.querySelector(".main-nowPlayingBar-right .main-genericButton-button");
        rightContainer = document.querySelector(".main-nowPlayingBar-right > div");
        if (!rightContainer) {
            setTimeout(waitForPlaybarMounted, 300);
            return;
        }
        Array.from(sibling?.classList ?? []).forEach((className) => {
            if (!className.startsWith("main-genericButton")) {
                buttonsStash.forEach((button) => {
                    button.classList.add(className);
                });
            }
        });
        rightContainer.prepend(...buttonsStash);
    })();

    return { Button };
})();

(function waitForHistoryAPI() {
    const main = document.querySelector(".main-view-container__scroll-node-child");
    if (!main || !Spicetify.Platform?.History) {
        setTimeout(waitForHistoryAPI, 300);
        return;
    }

    let currentPath;
    const observer = new MutationObserver(() => {
        const child = main.lastElementChild;
        const isPlaceholder = child?.tagName === "DIV" && !child?.children.length;
        if (!isPlaceholder) {
            const event = new Event("appchange");
            event.data = {
                path: currentPath,
                container: child,
            };
            Spicetify.Player.dispatchEvent(event);
            observer.disconnect();
        }
    });

    Spicetify.Platform.History.listen(({pathname}) => {
        if (!Spicetify.Player.eventListeners["appchange"]?.length) {
            return;
        }
        currentPath = pathname;
        observer.observe(main, { childList: true });
    });
}());

// Put `Spicetify` object to `window` object so apps iframe could access to it via `window.top.Spicetify`
window.Spicetify = Spicetify;
