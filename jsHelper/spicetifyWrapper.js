const Spicetify = {
    get CosmosAPI() {return window.cosmos},
    get BridgeAPI() {return window.bridge},
    get LiveAPI() {return window.live},
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
                p = Math.round(p * Spicetify.Player.origin.duration());
            }
            Spicetify.Player.origin.seek(p);
        },
        getProgress: () => Spicetify.Player.origin.progressbar.getRealValue(),
        getProgressPercent: () => Spicetify.Player.origin.progressbar.getPercentage(),
        getDuration: () => Spicetify.Player.origin.duration(),
        setVolume: (v) => { Spicetify.Player.origin.changeVolume(v, false) },
        increaseVolume: () => { Spicetify.Player.origin.increaseVolume() },
        decreaseVolume: () => { Spicetify.Player.origin.decreaseVolume() },
        getVolume: () => Spicetify.Player.origin.volume(),
        next: () => { Spicetify.Player.origin._doSkipToNext() },
        back: () => { Spicetify.Player.origin._doSkipToPrevious() },
        togglePlay: () => { Spicetify.Player.origin._doTogglePlay() },
        isPlaying: () => Spicetify.Player.origin.playing(),
        toggleShuffle: () => { Spicetify.Player.origin.toggleShuffle() },
        getShuffle: () => Spicetify.Player.origin.shuffle(),
        setShuffle: (b) => { Spicetify.Player.origin.shuffle(b) },
        toggleRepeat: () => { Spicetify.Player.origin.toggleRepeat() },
        getRepeat: () => Spicetify.Player.origin.repeat(),
        setRepeat: (r) => { Spicetify.Player.origin.repeat(r) },
        getMute: () => Spicetify.Player.origin.mute(),
        toggleMute: () => { Spicetify.Player.origin._doToggleMute() },
        setMute: (b) => { Spicetify.Player.origin.changeVolume(Spicetify.Player.origin._unmutedVolume, b) },
        formatTime: (ms) => Spicetify.Player.origin._formatTime(ms),
        getHeart: () => Spicetify.LiveAPI(Spicetify.Player.data.track.uri).get("added"),
        pause: () => {Spicetify.Player.isPlaying() && Spicetify.Player.togglePlay()},
        play: () => {!Spicetify.Player.isPlaying() && Spicetify.Player.togglePlay()},
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
        skipBack: (amount = 15e3) => {Spicetify.Player.seek(Spicetify.Player.getProgress() - amount)},
        skipForward: (amount = 15e3) => {Spicetify.Player.seek(Spicetify.Player.getProgress() + amount)},
        toggleHeart: () => {document.querySelector('[data-interaction-target="save-remove-button"]').click()},
    },
    showNotification: (text) => {
        Spicetify.EventDispatcher.dispatchEvent(
            new Spicetify.Event(Spicetify.Event.TYPES.SHOW_NOTIFICATION_BUBBLE, {
                i18n: text,
                messageHtml: text
            })
        );
    },
    test: () => {
        const SPICETIFY_METHOD = [
            "Player",
            "addToQueue",
            "BridgeAPI",
            "CosmosAPI",
            "Event",
            "EventDispatcher",
            "getAudioData",
            "Keyboard",
            "URI",
            "LiveAPI",
            "LocalStorage",
            "PlaybackControl",
            "Queue",
            "removeFromQueue",
            "showNotification",
            "getAblumArtColors",
            "Menu",
            "ContextMenu",
            "Abba",
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
}

Spicetify.URI = (function () {
    /**
    * Copyright (c) 2017 Spotify AB
    *
    * Fast base62 encoder/decoder.
    *
    * Usage:
    *
    *   Base62.toHex('1C0pasJ0dS2Z46GKh2puYo') // -> '34ff970885ca8fa02c0d6e459377d5d0'
    *                         ^^^
    *                          |
    *               Length-22 base62-encoded ID.
    *         Lengths other than 22 or invalid base62 IDs
    *                  are not supported.
    *
    *   Base62.fromHex('34ff970885ca8fa02c0d6e459377d5d0') // -> '1C0pasJ0dS2Z46GKh2puYo'
    *                         ^^^
    *                          |
    *               Length-32 hex-encoded ID.
    *         Lengths other than 32 are not supported.
    *
    * Written by @ludde, programatically tested and documented by @felipec.
    */
    var Base62 = (function () {
        // Alphabets
        var HEX16 = '0123456789abcdef';
        var BASE62 =
            '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

        // Hexadecimal fragments
        var HEX256 = [];
        HEX256.length = 256;
        for (var i = 0; i < 256; i++) {
            HEX256[i] = HEX16[i >> 4] + HEX16[i & 0xf];
        }

        // Look-up tables
        var ID62 = [];
        ID62.length = 128;
        for (var i = 0; i < BASE62.length; ++i) {
            ID62[BASE62.charCodeAt(i)] = i;
        }
        var ID16 = [];
        for (var i = 0; i < 16; i++) {
            ID16[HEX16.charCodeAt(i)] = i;
        }
        for (var i = 0; i < 6; i++) {
            ID16['ABCDEF'.charCodeAt(i)] = 10 + i;
        }

        return {
            toHex: function (s) {
                if (s.length !== 22) {
                    // Can only parse base62 ids with length == 22.
                    // Invalid base62 ids will lead to garbage in the output.
                    return null;
                }

                // 1 / (2^32)
                var MAX_INT_INV = 2.3283064365386963e-10;
                // 2^32
                var MAX_INT = 0x100000000;
                // 62^3
                var P62_3 = 238328;

                var p0, p1, p2, p3;
                var v;
                // First 7 characters fit in 2^53
                // prettier-ignore
                p0 =
                    ID62[s.charCodeAt(0)] * 56800235584 +  // * 62^6
                    ID62[s.charCodeAt(1)] * 916132832 +    // * 62^5
                    ID62[s.charCodeAt(2)] * 14776336 +     // * 62^4
                    ID62[s.charCodeAt(3)] * 238328 +       // * 62^3
                    ID62[s.charCodeAt(4)] * 3844 +         // * 62^2
                    ID62[s.charCodeAt(5)] * 62 +           // * 62^1
                    ID62[s.charCodeAt(6)];                 // * 62^0
                p1 = (p0 * MAX_INT_INV) | 0;
                p0 -= p1 * MAX_INT;
                // 62^10 < 2^64
                v =
                    ID62[s.charCodeAt(7)] * 3844 +
                    ID62[s.charCodeAt(8)] * 62 +
                    ID62[s.charCodeAt(9)];
                (p0 = p0 * P62_3 + v), (p0 = p0 - (v = (p0 * MAX_INT_INV) | 0) * MAX_INT);
                p1 = p1 * P62_3 + v;
                // 62^13 < 2^96
                v =
                    ID62[s.charCodeAt(10)] * 3844 +
                    ID62[s.charCodeAt(11)] * 62 +
                    ID62[s.charCodeAt(12)];
                (p0 = p0 * P62_3 + v), (p0 = p0 - (v = (p0 * MAX_INT_INV) | 0) * MAX_INT);
                (p1 = p1 * P62_3 + v), (p1 = p1 - (v = (p1 * MAX_INT_INV) | 0) * MAX_INT);
                p2 = v;
                // 62^16 < 2^96
                v =
                    ID62[s.charCodeAt(13)] * 3844 +
                    ID62[s.charCodeAt(14)] * 62 +
                    ID62[s.charCodeAt(15)];
                (p0 = p0 * P62_3 + v), (p0 = p0 - (v = (p0 * MAX_INT_INV) | 0) * MAX_INT);
                (p1 = p1 * P62_3 + v), (p1 = p1 - (v = (p1 * MAX_INT_INV) | 0) * MAX_INT);
                p2 = p2 * P62_3 + v;
                // 62^19 < 2^128
                v =
                    ID62[s.charCodeAt(16)] * 3844 +
                    ID62[s.charCodeAt(17)] * 62 +
                    ID62[s.charCodeAt(18)];
                (p0 = p0 * P62_3 + v), (p0 = p0 - (v = (p0 * MAX_INT_INV) | 0) * MAX_INT);
                (p1 = p1 * P62_3 + v), (p1 = p1 - (v = (p1 * MAX_INT_INV) | 0) * MAX_INT);
                (p2 = p2 * P62_3 + v), (p2 = p2 - (v = (p2 * MAX_INT_INV) | 0) * MAX_INT);
                p3 = v;
                v =
                    ID62[s.charCodeAt(19)] * 3844 +
                    ID62[s.charCodeAt(20)] * 62 +
                    ID62[s.charCodeAt(21)];
                (p0 = p0 * P62_3 + v), (p0 = p0 - (v = (p0 * MAX_INT_INV) | 0) * MAX_INT);
                (p1 = p1 * P62_3 + v), (p1 = p1 - (v = (p1 * MAX_INT_INV) | 0) * MAX_INT);
                (p2 = p2 * P62_3 + v), (p2 = p2 - (v = (p2 * MAX_INT_INV) | 0) * MAX_INT);
                (p3 = p3 * P62_3 + v), (p3 = p3 - (v = (p3 * MAX_INT_INV) | 0) * MAX_INT);
                if (v) {
                    // carry not allowed
                    return null;
                }
                // prettier-ignore
                return HEX256[p3 >>> 24] + HEX256[(p3 >>> 16) & 0xFF] + HEX256[(p3 >>> 8) & 0xFF] + HEX256[(p3) & 0xFF] +
                    HEX256[p2 >>> 24] + HEX256[(p2 >>> 16) & 0xFF] + HEX256[(p2 >>> 8) & 0xFF] + HEX256[(p2) & 0xFF] +
                    HEX256[p1 >>> 24] + HEX256[(p1 >>> 16) & 0xFF] + HEX256[(p1 >>> 8) & 0xFF] + HEX256[(p1) & 0xFF] +
                    HEX256[p0 >>> 24] + HEX256[(p0 >>> 16) & 0xFF] + HEX256[(p0 >>> 8) & 0xFF] + HEX256[(p0) & 0xFF];
            },

            fromHex: function (s) {
                var i;
                var p0 = 0, p1 = 0, p2 = 0;
                for (i = 0; i < 10; i++) p2 = p2 * 16 + ID16[s.charCodeAt(i)];
                for (i = 0; i < 11; i++) p1 = p1 * 16 + ID16[s.charCodeAt(i + 10)];
                for (i = 0; i < 11; i++) p0 = p0 * 16 + ID16[s.charCodeAt(i + 21)];
                if (isNaN(p0 + p1 + p2)) {
                    return null;
                }
                var P16_11 = 17592186044416; // 16^11
                var INV_62 = 1.0 / 62;

                var acc;
                var ret = '';
                i = 0;
                for (; i < 7; ++i) {
                    acc = p2;
                    p2 = Math.floor(acc * INV_62);
                    acc = (acc - p2 * 62) * P16_11 + p1;
                    p1 = Math.floor(acc * INV_62);
                    acc = (acc - p1 * 62) * P16_11 + p0;
                    p0 = Math.floor(acc * INV_62);
                    ret = BASE62[acc - p0 * 62] + ret;
                }
                p1 += p2 * P16_11;
                for (; i < 15; ++i) {
                    acc = p1;
                    p1 = Math.floor(acc * INV_62);
                    acc = (acc - p1 * 62) * P16_11 + p0;
                    p0 = Math.floor(acc * INV_62);
                    ret = BASE62[acc - p0 * 62] + ret;
                }
                p0 += p1 * P16_11;
                for (; i < 21; ++i) {
                    acc = p0;
                    p0 = Math.floor(acc * INV_62);
                    ret = BASE62[acc - p0 * 62] + ret;
                }
                return BASE62[p0] + ret;
            },

            // Expose the lookup tables
            HEX256: HEX256, // number -> 'hh'
            ID16: ID16,  // hexadecimal char code -> 0..15
            ID62: ID62,  // base62 char code -> 0..61
        };
    })();

    /**
     * The URI prefix for URIs.
     *
     * @const
     * @private
     */
    var URI_PREFIX = 'spotify:';

    /**
     * The URL prefix for Play.
     *
     * @const
     * @private
     */
    var PLAY_HTTP_PREFIX = 'http://play.spotify.com/';

    /**
     * The HTTPS URL prefix for Play.
     *
     * @const
     * @private
     */
    var PLAY_HTTPS_PREFIX = 'https://play.spotify.com/';

    /**
     * The URL prefix for Open.
     *
     * @const
     * @private
     */
    var OPEN_HTTP_PREFIX = 'http://open.spotify.com/';

    /**
     * The HTTPS URL prefix for Open.
     *
     * @const
     * @private
     */
    var OPEN_HTTPS_PREFIX = 'https://open.spotify.com/';

    var ERROR_INVALID = new TypeError('Invalid Spotify URI!');
    var ERROR_NOT_IMPLEMENTED = new TypeError('Not implemented!');


    /**
     * The format for the URI to parse.
     *
     * @enum {number}
     * @private
     */
    var Format = {
        URI: 0,
        URL: 1
    };

    /**
     * Represents the result of a URI splitting operation.
     *
     * @typedef {{
     *    format: Format,
     *    components: Array.<string>
     * }}
     * @see _splitIntoComponents
     * @private
     */
    var SplittedURI;

    /**
     * Split an string URI or HTTP/HTTPS URL into components, skipping the prefix.
     *
     * @param {string} str A string URI to split.
     * @return {SplittedURI} The parsed URI.
     * @private
     */
    var _splitIntoComponents = function (str) {
        var components;
        var format;
        var query;
        var anchor;

        var querySplit = str.split('?');
        if (querySplit.length > 1) {
            str = querySplit.shift();
            query = querySplit.pop();

            var queryHashSplit = query.split('#');
            if (queryHashSplit.length > 1) {
                query = queryHashSplit.shift();
                anchor = queryHashSplit.pop();
            }

            query = decodeQueryString(query);
        }

        var hashSplit = str.split('#');
        if (hashSplit.length > 1) {
            // first token
            str = hashSplit.shift();
            // last token
            anchor = hashSplit.pop();
        }

        if (str.indexOf(URI_PREFIX) === 0) {
            components = str.slice(URI_PREFIX.length).split(':');
            format = Format.URI;
        } else {
            // For HTTP URLs, ignore any query string argument
            str = str.split('?')[0];

            if (str.indexOf(PLAY_HTTP_PREFIX) === 0) {
                components = str.slice(PLAY_HTTP_PREFIX.length).split('/');
            } else if (str.indexOf(PLAY_HTTPS_PREFIX) === 0) {
                components = str.slice(PLAY_HTTPS_PREFIX.length).split('/');
            } else if (str.indexOf(OPEN_HTTP_PREFIX) === 0) {
                components = str.slice(OPEN_HTTP_PREFIX.length).split('/');
            } else if (str.indexOf(OPEN_HTTPS_PREFIX) === 0) {
                components = str.slice(OPEN_HTTPS_PREFIX.length).split('/');
            } else {
                throw ERROR_INVALID;
            }
            format = Format.URL;
        }

        if (anchor) {
            components.push(anchor);
        }

        return {
            format: format,
            components: components,
            query: query
        };
    };

    /**
     * Encodes a component according to a format.
     *
     * @param {string} component A component string.
     * @param {Format} format A format.
     * @return {string} An encoded component string.
     * @private
     */
    var _encodeComponent = function (component, format) {
        component = encodeURIComponent(component);
        if (format === Format.URI) {
            component = component.replace(/%20/g, '+');
        }

        // encode characters that are not encoded by default by encodeURIComponent
        // but that the Spotify URI spec encodes: !'*()
        component = component.replace(/[!'()]/g, escape);
        component = component.replace(/\*/g, '%2A');

        return component;
    };

    /**
     * Decodes a component according to a format.
     *
     * @param {string} component An encoded component string.
     * @param {Format} format A format.
     * @return {string} An decoded component string.
     * @private
     */
    var _decodeComponent = function (component, format) {
        var part = format == Format.URI ? component.replace(/\+/g, '%20') : component;
        return decodeURIComponent(part);
    };

    /**
     * Returns the components of a URI as an array.
     *
     * @param {URI} uri A uri.
     * @param {Format} format The output format.
     * @return {Array.<string>} An array of uri components.
     * @private
     */
    var _getComponents = function (uri, format) {
        var base62;
        if (uri.id) {
            base62 = uri._base62Id;
        }

        var components;
        var i;
        var len;
        switch (uri.type) {
            case URI.Type.ALBUM:
                components = [URI.Type.ALBUM, base62];
                if (uri.disc) {
                    components.push(uri.disc);
                }
                return components;
            case URI.Type.AD:
                return [URI.Type.AD, uri._base62Id];
            case URI.Type.ARTIST:
                return [URI.Type.ARTIST, base62];
            case URI.Type.ARTIST_TOPLIST:
                return [URI.Type.ARTIST, base62, URI.Type.TOP, uri.toplist];
            case URI.Type.DAILY_MIX:
                return [URI.Type.DAILY_MIX, base62];
            case URI.Type.SEARCH:
                return [URI.Type.SEARCH, _encodeComponent(uri.query, format)];
            case URI.Type.TRACK:
                if (uri.context || uri.play) {
                    base62 += encodeQueryString({
                        context: uri.context,
                        play: uri.play
                    });
                }
                if (uri.anchor) {
                    base62 += '#' + uri.anchor;
                }
                return [URI.Type.TRACK, base62];
            case URI.Type.TRACKSET:
                var trackIds = [];
                for (i = 0, len = uri.tracks.length; i < len; i++) {
                    trackIds.push(uri.tracks[i]._base62Id);
                }
                trackIds = [trackIds.join(',')];
                // Index can be 0 sometimes (required for trackset)
                if (uri.index !== null) {
                    trackIds.push('#', uri.index);
                }
                return [URI.Type.TRACKSET, _encodeComponent(uri.name)].concat(trackIds);
            case URI.Type.FACEBOOK:
                return [URI.Type.USER, URI.Type.FACEBOOK, uri.uid];
            case URI.Type.AUDIO_FILE:
                return [URI.Type.AUDIO_FILE, uri.extension, uri._base62Id];
            case URI.Type.FOLDER:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.FOLDER, uri._base62Id];
            case URI.Type.FOLLOWERS:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.FOLLOWERS];
            case URI.Type.FOLLOWING:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.FOLLOWING];
            case URI.Type.PLAYLIST:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.PLAYLIST, base62];
            case URI.Type.PLAYLIST_V2:
                return [URI.Type.PLAYLIST, base62];
            case URI.Type.STARRED:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.STARRED];
            case URI.Type.TEMP_PLAYLIST:
                return [URI.Type.TEMP_PLAYLIST, uri.origin, uri.data];
            case URI.Type.CONTEXT_GROUP:
                return [URI.Type.CONTEXT_GROUP, uri.origin, uri.name];
            case URI.Type.USER_TOPLIST:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.TOP, uri.toplist];
            // Legacy Toplist
            case URI.Type.USER_TOP_TRACKS:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.TOPLIST];
            case URI.Type.TOPLIST:
                return [URI.Type.TOP, uri.toplist].concat(uri.global ? [URI.Type.GLOBAL] : ['country', uri.country]);
            case URI.Type.INBOX:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.INBOX];
            case URI.Type.ROOTLIST:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.ROOTLIST];
            case URI.Type.PUBLISHED_ROOTLIST:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.PUBLISHED_ROOTLIST];
            case URI.Type.COLLECTION_TRACK_LIST:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.COLLECTION_TRACK_LIST, base62];
            case URI.Type.PROFILE:
                if (uri.args && uri.args.length > 0)
                    return [URI.Type.USER, _encodeComponent(uri.username, format)].concat(uri.args);
                return [URI.Type.USER, _encodeComponent(uri.username, format)];
            case URI.Type.LOCAL_ARTIST:
                return [URI.Type.LOCAL, _encodeComponent(uri.artist, format)];
            case URI.Type.LOCAL_ALBUM:
                return [URI.Type.LOCAL, _encodeComponent(uri.artist, format), _encodeComponent(uri.album, format)];
            case URI.Type.LOCAL:
                return [URI.Type.LOCAL,
                _encodeComponent(uri.artist, format),
                _encodeComponent(uri.album, format),
                _encodeComponent(uri.track, format),
                uri.duration];
            case URI.Type.LIBRARY:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.LIBRARY].concat(uri.category ? [uri.category] : []);
            case URI.Type.IMAGE:
                return [URI.Type.IMAGE, uri._base62Id];
            case URI.Type.MOSAIC:
                components = uri.ids.slice(0);
                components.unshift(URI.Type.MOSAIC);
                return components;
            case URI.Type.RADIO:
                return [URI.Type.RADIO, uri.args];
            case URI.Type.SPECIAL:
                components = [URI.Type.SPECIAL];
                var args = uri.args || [];
                for (i = 0, len = args.length; i < len; ++i)
                    components.push(_encodeComponent(args[i], format));
                return components;
            case URI.Type.STATION:
                components = [URI.Type.STATION];
                var args = uri.args || [];
                for (i = 0, len = args.length; i < len; i++) {
                    components.push(_encodeComponent(args[i], format));
                }
                return components;
            case URI.Type.APPLICATION:
                components = [URI.Type.APP, uri._base62Id];
                var args = uri.args || [];
                for (i = 0, len = args.length; i < len; ++i)
                    components.push(_encodeComponent(args[i], format));
                return components;
            case URI.Type.COLLECTION_ALBUM:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.COLLECTION, URI.Type.ALBUM, base62];
            case URI.Type.COLLECTION_MISSING_ALBUM:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.COLLECTION, URI.Type.ALBUM, base62, 'missing'];
            case URI.Type.COLLECTION_ARTIST:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.COLLECTION, URI.Type.ARTIST, base62];
            case URI.Type.COLLECTION:
                return [URI.Type.USER, _encodeComponent(uri.username, format), URI.Type.COLLECTION].concat(uri.category ? [uri.category] : []);
            case URI.Type.EPISODE:
                if (uri.context || uri.play) {
                    base62 += encodeQueryString({
                        context: uri.context,
                        play: uri.play
                    });
                }
                return [URI.Type.EPISODE, base62];
            case URI.Type.SHOW:
                return [URI.Type.SHOW, base62];
            case URI.Type.CONCERT:
                return [URI.Type.CONCERT, base62];
            default:
                throw ERROR_INVALID;
        }
    };

    var encodeQueryString = function (values) {
        var str = '?';
        for (var i in values) {
            if (values.hasOwnProperty(i) && values[i] !== undefined) {
                if (str.length > 1) {
                    str += '&';
                }
                str += i + '=' + encodeURIComponent(values[i]);
            }
        }
        return str;
    };

    var decodeQueryString = function (str) {
        return str.split('&').reduce(function (object, pair) {
            pair = pair.split('=');
            object[pair[0]] = decodeURIComponent(pair[1]);
            return object;
        }, {});
    };

    /**
     * Parses the components of a URI into a real URI object.
     *
     * @param {Array.<string>} components The components of the URI as a string
     *     array.
     * @param {Format} format The format of the source string.
     * @return {URI} The URI object.
     * @private
     */
    var _parseFromComponents = function (components, format, query) {
        var _current = 0;
        query = query || {};

        var _getNextComponent = function () {
            return components[_current++];
        };

        var _getIdComponent = function () {
            var component = _getNextComponent();

            if (component.length > 22) {
                throw new Error('Invalid ID');
            }
            return component;
        };

        var _getRemainingComponents = function () {
            return components.slice(_current);
        };

        var _getRemainingString = function () {
            var separator = (format == Format.URI) ? ':' : '/';
            return components.slice(_current).join(separator);
        };

        var part = _getNextComponent();
        var id;
        var i;
        var len;

        switch (part) {
            case URI.Type.ALBUM:
                return URI.albumURI(_getIdComponent(), parseInt(_getNextComponent(), 10));
            case URI.Type.AD:
                return URI.adURI(_getNextComponent());
            case URI.Type.ARTIST:
                id = _getIdComponent();
                if (_getNextComponent() == URI.Type.TOP) {
                    return URI.artistToplistURI(id, _getNextComponent());
                } else {
                    return URI.artistURI(id);
                }
            case URI.Type.AUDIO_FILE:
                return URI.audioFileURI(_getNextComponent(), _getNextComponent());
            case URI.Type.DAILY_MIX:
                return URI.dailyMixURI(_getIdComponent());
            case URI.Type.TEMP_PLAYLIST:
                return URI.temporaryPlaylistURI(_getNextComponent(), _getRemainingString());
            case URI.Type.PLAYLIST:
                return URI.playlistV2URI(_getIdComponent());
            case URI.Type.SEARCH:
                return URI.searchURI(_decodeComponent(_getRemainingString(), format));
            case URI.Type.TRACK:
                return URI.trackURI(_getIdComponent(), _getNextComponent(), query.context, query.play);
            case URI.Type.TRACKSET:
                var name = _decodeComponent(_getNextComponent());
                var tracksArray = _getNextComponent();
                var hashSign = _getNextComponent();
                var index = parseInt(_getNextComponent(), 10);
                // Sanity check: %23 is URL code for "#"
                if (hashSign !== '%23' || isNaN(index)) {
                    index = null;
                }
                var tracksetTracks = [];
                if (tracksArray) {
                    tracksArray = _decodeComponent(tracksArray).split(',');
                    for (i = 0, len = tracksArray.length; i < len; i++) {
                        var trackId = tracksArray[i];
                        tracksetTracks.push(URI.trackURI(trackId));
                    }
                }
                return URI.tracksetURI(tracksetTracks, name, index);
            case URI.Type.CONTEXT_GROUP:
                return URI.contextGroupURI(_getNextComponent(), _getNextComponent());
            case URI.Type.TOP:
                var type = _getNextComponent();
                if (_getNextComponent() == URI.Type.GLOBAL) {
                    return URI.toplistURI(type, null, true);
                } else {
                    return URI.toplistURI(type, _getNextComponent(), false);
                }
            case URI.Type.USER:
                var username = _decodeComponent(_getNextComponent(), format);
                var text = _getNextComponent();
                if (username == URI.Type.FACEBOOK && text != null) {
                    return URI.facebookURI(parseInt(text, 10));
                } else if (text != null) {
                    switch (text) {
                        case URI.Type.PLAYLIST:
                            return URI.playlistURI(username, _getIdComponent());
                        case URI.Type.FOLDER:
                            return URI.folderURI(username, _getIdComponent());
                        case URI.Type.COLLECTION_TRACK_LIST:
                            return URI.collectionTrackList(username, _getIdComponent());
                        case URI.Type.COLLECTION:
                            var collectionItemType = _getNextComponent();
                            switch (collectionItemType) {
                                case URI.Type.ALBUM:
                                    id = _getIdComponent();
                                    if (_getNextComponent() === 'missing') {
                                        return URI.collectionMissingAlbumURI(username, id);
                                    } else {
                                        return URI.collectionAlbumURI(username, id);
                                    }
                                case URI.Type.ARTIST:
                                    return URI.collectionArtistURI(username, _getIdComponent());
                                default:
                                    return URI.collectionURI(username, collectionItemType);
                            }
                        case URI.Type.STARRED:
                            return URI.starredURI(username);
                        case URI.Type.FOLLOWERS:
                            return URI.followersURI(username);
                        case URI.Type.FOLLOWING:
                            return URI.followingURI(username);
                        case URI.Type.TOP:
                            return URI.userToplistURI(username, _getNextComponent());
                        case URI.Type.INBOX:
                            return URI.inboxURI(username);
                        case URI.Type.ROOTLIST:
                            return URI.rootlistURI(username);
                        case URI.Type.PUBLISHED_ROOTLIST:
                            return URI.publishedRootlistURI(username);
                        case URI.Type.TOPLIST:
                            // legacy toplist
                            return URI.userTopTracksURI(username);
                        case URI.Type.LIBRARY:
                            return URI.libraryURI(username, _getNextComponent());
                    }
                }
                var rem = _getRemainingComponents();
                if (text != null && rem.length > 0) {
                    return URI.profileURI(username, [text].concat(rem));
                } else if (text != null) {
                    return URI.profileURI(username, [text]);
                } else {
                    return URI.profileURI(username);
                }
            case URI.Type.LOCAL:
                var artistNameComponent = _getNextComponent();
                var artistName = artistNameComponent && _decodeComponent(artistNameComponent, format);
                var albumNameComponent = _getNextComponent();
                var albumName = albumNameComponent && _decodeComponent(albumNameComponent, format);
                var trackNameComponent = _getNextComponent();
                var trackName = trackNameComponent && _decodeComponent(trackNameComponent, format);
                var durationComponent = _getNextComponent();
                var duration = parseInt(durationComponent, 10);
                if (trackNameComponent !== undefined) {
                    return URI.localURI(artistName, albumName, trackName, duration);
                } else if (albumNameComponent !== undefined) {
                    return URI.localAlbumURI(artistName, albumName);
                } else {
                    return URI.localArtistURI(artistName);
                }
            case URI.Type.IMAGE:
                return URI.imageURI(_getIdComponent());
            case URI.Type.MOSAIC:
                return URI.mosaicURI(components.slice(_current));
            case URI.Type.RADIO:
                return URI.radioURI(_getRemainingString());
            case URI.Type.SPECIAL:
                var args = _getRemainingComponents();
                for (i = 0, len = args.length; i < len; ++i)
                    args[i] = _decodeComponent(args[i], format);
                return URI.specialURI(args);
            case URI.Type.STATION:
                return URI.stationURI(_getRemainingComponents());
            case URI.Type.EPISODE:
                return URI.episodeURI(_getIdComponent(), query.context, query.play);
            case URI.Type.SHOW:
                return URI.showURI(_getIdComponent());
            case URI.Type.CONCERT:
                return URI.concertURI(_getIdComponent());
            case '':
                break;
            default:
                if (part === URI.Type.APP) {
                    id = _getNextComponent();
                } else {
                    id = part;
                }
                var decodedId = _decodeComponent(id, format);
                if (_encodeComponent(decodedId, format) !== id) {
                    break;
                }
                var args = _getRemainingComponents();
                for (i = 0, len = args.length; i < len; ++i)
                    args[i] = _decodeComponent(args[i], format);
                return URI.applicationURI(decodedId, args);
        }

        throw ERROR_INVALID;
    };

    /**
     * A class holding information about a uri.
     *
     * @constructor
     * @param {URI.Type} type
     * @param {Object} props
     */
    function URI(type, props) {
        this.type = type;

        // Merge properties into URI object.
        for (var prop in props) {
            if (typeof props[prop] == 'function') {
                continue;
            }
            this[prop] = props[prop];
        }
    }

    // Lazy convert the id to hexadecimal only when requested
    Object.defineProperty(URI.prototype, 'id', {
        get: function () {
            if (!this._hexId) {
                this._hexId = this._base62Id ? URI.idToHex(this._base62Id) : undefined;
            }
            return this._hexId;
        },
        set: function (id) {
            this._base62Id = id ? URI.hexToId(id) : undefined;
            this._hexId = undefined;
        },
        enumerable: true,
        configurable: true
    });

    URI.prototype.toAppType = function () {
        if (this.type == URI.Type.APPLICATION) {
            return URI.applicationURI(this.id, this.args);
        } else {
            var components = _getComponents(this, Format.URL);
            var id = components.shift();
            var len = components.length;
            if (len) {
                while (len--) {
                    components[len] = _decodeComponent(components[len], Format.URL);
                }
            }
            if (this.type == URI.Type.RADIO) {
                components = components.shift().split(':');
            }
            var result = URI.applicationURI(id, components);
            return result;
        }
    };
    URI.prototype.toRealType = function () {
        if (this.type == URI.Type.APPLICATION) {
            return _parseFromComponents([this.id].concat(this.args), Format.URI);
        } else {
            return new URI(null, this);
        }
    };
    URI.prototype.toURI = function () {
        return URI_PREFIX + _getComponents(this, Format.URI).join(':');
    };
    URI.prototype.toString = function () {
        return this.toURI();
    };
    URI.prototype.toURLPath = function (opt_leadingSlash) {
        var components = _getComponents(this, Format.URL);
        if (components[0] === URI.Type.APP) {
            components.shift();
        }

        // Some URIs are allowed to have empty components. It should be investigated
        // whether we need to strip empty components at all from any URIs. For now,
        // we check specifically for tracksets and local tracks and strip empty
        // components for all other URIs.
        //
        // For tracksets, it's permissible to have a path that looks like
        // 'trackset//trackURI' because the identifier parameter for a trackset can
        // be blank. For local tracks, some metadata can be missing, like missing
        // album name would be 'spotify:local:artist::track:duration'.
        var isTrackset = components[0] === URI.Type.TRACKSET;
        var isLocalTrack = components[0] === URI.Type.LOCAL;
        var shouldStripEmptyComponents = !isTrackset && !isLocalTrack;

        if (shouldStripEmptyComponents) {
            var _temp = [];
            for (var i = 0, l = components.length; i < l; i++) {
                var component = components[i];
                if (!!component) {
                    _temp.push(component);
                }
            }
            components = _temp;
        }
        var path = components.join('/');
        return opt_leadingSlash ? '/' + path : path;
    };
    URI.prototype.toPlayURL = function () {
        return PLAY_HTTPS_PREFIX + this.toURLPath();
    };
    URI.prototype.toURL = function () {
        return this.toPlayURL();
    };
    URI.prototype.toOpenURL = function () {
        return OPEN_HTTPS_PREFIX + this.toURLPath();
    };
    URI.prototype.toSecurePlayURL = function () {
        return this.toPlayURL();
    };
    URI.prototype.toSecureURL = function () {
        return this.toPlayURL();
    };
    URI.prototype.toSecureOpenURL = function () {
        return this.toOpenURL();
    };
    URI.prototype.idToByteString = function () {
        var hexId = Base62.toHex(this._base62Id);
        if (!hexId) {
            var zero = '';
            for (var i = 0; i < 16; i++) {
                zero += String.fromCharCode(0);
            }
            return zero;
        }
        var data = '';
        for (var i = 0; i < 32; i += 2) {
            var upper = Base62.ID16[hexId.charCodeAt(i)];
            var lower = Base62.ID16[hexId.charCodeAt(i + 1)];
            var byte = (upper << 4) + lower;
            data += String.fromCharCode(byte);
        }
        return data;
    };

    URI.prototype.getPath = function () {
        var uri = this.toString().replace(/[#?].*/, '');
        return uri;
    }

    URI.prototype.getBase62Id = function () {
        return this._base62Id;
    }
    URI.prototype.isSameIdentity = function (uri) {
        var uriObject = URI.from(uri);
        if (!uriObject) return false;
        if (this.toString() === uri.toString()) return true;
        if (
            (this.type === URI.Type.PLAYLIST || this.type === URI.Type.PLAYLIST_V2) &&
            (uriObject.type === URI.Type.PLAYLIST || uriObject.type === URI.Type.PLAYLIST_V2)
        ) {
            return this.id === uriObject.id;
        } else if (this.type === URI.Type.STATION && uriObject.type === URI.Type.STATION) {
            var thisStationContextUriObject = _parseFromComponents(this.args, Format.URI);
            return !!thisStationContextUriObject &&
                thisStationContextUriObject.isSameIdentity(
                    _parseFromComponents(uriObject.args, Format.URI)
                );
        } else {
            return false;
        }
    }
    URI.Type = {
        EMPTY: 'empty',
        ALBUM: 'album',
        AD: 'ad',
        /** URI particle; not an actual URI. */
        APP: 'app',
        APPLICATION: 'application',
        ARTIST: 'artist',
        ARTIST_TOPLIST: 'artist-toplist',
        AUDIO_FILE: 'audiofile',
        COLLECTION: 'collection',
        COLLECTION_ALBUM: 'collection-album',
        COLLECTION_MISSING_ALBUM: 'collection-missing-album',
        COLLECTION_ARTIST: 'collection-artist',
        CONTEXT_GROUP: 'context-group',
        DAILY_MIX: 'dailymix',
        EPISODE: 'episode',
        /** URI particle; not an actual URI. */
        FACEBOOK: 'facebook',
        FOLDER: 'folder',
        FOLLOWERS: 'followers',
        FOLLOWING: 'following',
        /** URI particle; not an actual URI. */
        GLOBAL: 'global',
        IMAGE: 'image',
        INBOX: 'inbox',
        LOCAL_ARTIST: 'local-artist',
        LOCAL_ALBUM: 'local-album',
        LOCAL: 'local',
        LIBRARY: 'library',
        MOSAIC: 'mosaic',
        PLAYLIST: 'playlist',
        /** Only used for URI classification. Not a valid URI fragment. */
        PLAYLIST_V2: 'playlist-v2',
        PROFILE: 'profile',
        PUBLISHED_ROOTLIST: 'published-rootlist',
        RADIO: 'radio',
        ROOTLIST: 'rootlist',
        COLLECTION_TRACK_LIST: 'collectiontracklist',
        SEARCH: 'search',
        SHOW: 'show',
        CONCERT: 'concert',
        SPECIAL: 'special',
        STARRED: 'starred',
        STATION: 'station',
        TEMP_PLAYLIST: 'temp-playlist',
        /** URI particle; not an actual URI. */
        TOP: 'top',
        TOPLIST: 'toplist',
        TRACK: 'track',
        TRACKSET: 'trackset',
        /** URI particle; not an actual URI. */
        USER: 'user',
        USER_TOPLIST: 'user-toplist',
        USER_TOP_TRACKS: 'user-top-tracks',
        /** Deprecated contant. Please use USER_TOP_TRACKS. */
        USET_TOP_TRACKS: 'user-top-tracks'
    };
    URI.fromString = function (str) {
        var splitted = _splitIntoComponents(str);
        return _parseFromComponents(splitted.components, splitted.format, splitted.query);
    };
    URI.from = function (value) {
        try {
            if (value instanceof URI) {
                return value;
            }
            if (typeof value == 'object' && value.type) {
                return new URI(null, value);
            }
            return URI.fromString(value.toString());
        } catch (e) {
            return null;
        }
    };
    URI.fromByteString = function (type, idByteString, opt_args) {
        while (idByteString.length != 16) {
            idByteString = String.fromCharCode(0) + idByteString;
        }
        var hexId = '';
        for (var i = 0; i < idByteString.length; i++) {
            var byte = idByteString.charCodeAt(i);
            hexId += Base62.HEX256[byte];
        }
        var id = Base62.fromHex(hexId);
        var args = opt_args || {};
        args.id = id;
        return new URI(type, args);
    };
    URI.clone = function (uri) {
        if (!(uri instanceof URI)) {
            return null;
        }
        return new URI(null, uri);
    };
    URI.getCanonicalUsername = function (username) {
        return _encodeComponent(username, Format.URI);
    };
    URI.getDisplayUsername = function (username) {
        return _decodeComponent(username, Format.URI);
    };
    URI.idToHex = function (id) {
        if (id.length == 22) {
            return Base62.toHex(id);
        }
        return id;
    };
    URI.hexToId = function (hex) {
        if (hex.length == 32) {
            return Base62.fromHex(hex);
        }
        return hex;
    };
    URI.emptyURI = function () {
        return new URI(URI.Type.EMPTY, {});
    };
    URI.albumURI = function (id, disc) {
        return new URI(URI.Type.ALBUM, { id: id, disc: disc });
    };
    URI.adURI = function (id) {
        return new URI(URI.Type.AD, { id: id });
    };
    URI.audioFileURI = function (extension, id) {
        return new URI(URI.Type.AUDIO_FILE, { id: id, extension: extension });
    };
    URI.artistURI = function (id) {
        return new URI(URI.Type.ARTIST, { id: id });
    };
    URI.artistToplistURI = function (id, toplist) {
        return new URI(URI.Type.ARTIST_TOPLIST, { id: id, toplist: toplist });
    };
    URI.dailyMixURI = function (id) {
        return new URI(URI.Type.DAILY_MIX, { id: id });
    };
    URI.searchURI = function (query) {
        return new URI(URI.Type.SEARCH, { query: query });
    };
    URI.trackURI = function (id, anchor, context, play) {
        return new URI(URI.Type.TRACK, {
            id: id,
            anchor: anchor,
            context: context ? URI.fromString(context) : context,
            play: play
        });
    };
    URI.tracksetURI = function (tracks, name, index) {
        return new URI(URI.Type.TRACKSET, {
            tracks: tracks,
            name: name || '',
            index: isNaN(index) ? null : index
        });
    };
    URI.facebookURI = function (uid) {
        return new URI(URI.Type.FACEBOOK, { uid: uid });
    };
    URI.followersURI = function (username) {
        return new URI(URI.Type.FOLLOWERS, { username: username });
    };
    URI.followingURI = function (username) {
        return new URI(URI.Type.FOLLOWING, { username: username });
    };
    URI.playlistURI = function (username, id) {
        return new URI(URI.Type.PLAYLIST, { username: username, id: id });
    };
    URI.playlistV2URI = function (id) {
        return new URI(URI.Type.PLAYLIST_V2, { id: id });
    };
    URI.folderURI = function (username, id) {
        return new URI(URI.Type.FOLDER, { username: username, id: id });
    };
    URI.collectionTrackList = function (username, id) {
        return new URI(URI.Type.COLLECTION_TRACK_LIST, { username: username, id: id });
    };
    URI.starredURI = function (username) {
        return new URI(URI.Type.STARRED, { username: username });
    };
    URI.userToplistURI = function (username, toplist) {
        return new URI(URI.Type.USER_TOPLIST, { username: username, toplist: toplist });
    };
    URI.userTopTracksURI = function (username) {
        return new URI(URI.Type.USER_TOP_TRACKS, { username: username });
    };
    URI.toplistURI = function (toplist, country, global) {
        return new URI(URI.Type.TOPLIST, { toplist: toplist, country: country, global: !!global });
    };
    URI.inboxURI = function (username) {
        return new URI(URI.Type.INBOX, { username: username });
    };
    URI.rootlistURI = function (username) {
        return new URI(URI.Type.ROOTLIST, { username: username });
    };
    URI.publishedRootlistURI = function (username) {
        return new URI(URI.Type.PUBLISHED_ROOTLIST, { username: username });
    };
    URI.localArtistURI = function (artist) {
        return new URI(URI.Type.LOCAL_ARTIST, { artist: artist });
    };
    URI.localAlbumURI = function (artist, album) {
        return new URI(URI.Type.LOCAL_ALBUM, { artist: artist, album: album });
    };
    URI.localURI = function (artist, album, track, duration) {
        return new URI(URI.Type.LOCAL, {
            artist: artist,
            album: album,
            track: track,
            duration: duration
        });
    };
    URI.libraryURI = function (username, category) {
        return new URI(URI.Type.LIBRARY, { username: username, category: category });
    };
    URI.collectionURI = function (username, category) {
        return new URI(URI.Type.COLLECTION, { username: username, category: category });
    };
    URI.temporaryPlaylistURI = function (origin, data) {
        return new URI(URI.Type.TEMP_PLAYLIST, { origin: origin, data: data });
    };
    URI.contextGroupURI = function (origin, name) {
        return new URI(URI.Type.CONTEXT_GROUP, { origin: origin, name: name });
    };
    URI.profileURI = function (username, args) {
        return new URI(URI.Type.PROFILE, { username: username, args: args });
    };
    URI.imageURI = function (id) {
        return new URI(URI.Type.IMAGE, { id: id });
    };
    URI.mosaicURI = function (ids) {
        return new URI(URI.Type.MOSAIC, { ids: ids });
    };
    URI.radioURI = function (args) {
        args = typeof args === 'undefined' ? '' : args;
        return new URI(URI.Type.RADIO, { args: args });
    };
    URI.specialURI = function (args) {
        args = typeof args === 'undefined' ? [] : args;
        return new URI(URI.Type.SPECIAL, { args: args });
    };
    URI.stationURI = function (args) {
        args = typeof args === 'undefined' ? [] : args;
        return new URI(URI.Type.STATION, { args: args });
    };
    URI.applicationURI = function (id, args) {
        args = typeof args === 'undefined' ? [] : args;
        return new URI(URI.Type.APPLICATION, { id: id, args: args });
    };
    URI.collectionAlbumURI = function (username, id) {
        return new URI(URI.Type.COLLECTION_ALBUM, { username: username, id: id });
    };
    URI.collectionMissingAlbumURI = function (username, id) {
        return new URI(URI.Type.COLLECTION_MISSING_ALBUM, { username: username, id: id });
    };
    URI.collectionArtistURI = function (username, id) {
        return new URI(URI.Type.COLLECTION_ARTIST, { username: username, id: id });
    };
    URI.episodeURI = function (id, context, play) {
        return new URI(URI.Type.EPISODE, {
            id: id,
            context: context ? URI.fromString(context) : context,
            play: play
        });
    };
    URI.showURI = function (id) {
        return new URI(URI.Type.SHOW, { id: id });
    };
    URI.concertURI = function (id) {
        return new URI(URI.Type.CONCERT, { id: id });
    };

    URI.isAlbum = function (uri) { return (URI.from(uri) || {}).type === URI.Type.ALBUM; };
    URI.isAd = function (uri) { return (URI.from(uri) || {}).type === URI.Type.AD; };
    URI.isApplication = function (uri) { return (URI.from(uri) || {}).type === URI.Type.APPLICATION; };
    URI.isArtist = function (uri) { return (URI.from(uri) || {}).type === URI.Type.ARTIST; };
    URI.isCollection = function (uri) { return (URI.from(uri) || {}).type === URI.Type.COLLECTION; };
    URI.isCollectionAlbum = function (uri) { return (URI.from(uri) || {}).type === URI.Type.COLLECTION_ALBUM; };
    URI.isCollectionArtist = function (uri) { return (URI.from(uri) || {}).type === URI.Type.COLLECTION_ARTIST; };
    URI.isDailyMix = function (uri) { return (URI.from(uri) || {}).type === URI.Type.DAILY_MIX; };
    URI.isEpisode = function (uri) { return (URI.from(uri) || {}).type === URI.Type.EPISODE; };
    URI.isFacebook = function (uri) { return (URI.from(uri) || {}).type === URI.Type.FACEBOOK; };
    URI.isFolder = function (uri) { return (URI.from(uri) || {}).type === URI.Type.FOLDER; };
    URI.isLocalArtist = function (uri) { return (URI.from(uri) || {}).type === URI.Type.LOCAL_ARTIST; };
    URI.isLocalAlbum = function (uri) { return (URI.from(uri) || {}).type === URI.Type.LOCAL_ALBUM; };
    URI.isLocalTrack = function (uri) { return (URI.from(uri) || {}).type === URI.Type.LOCAL; };
    URI.isMosaic = function (uri) { return (URI.from(uri) || {}).type === URI.Type.MOSAIC; };
    URI.isPlaylistV1 = function (uri) { return (URI.from(uri) || {}).type === URI.Type.PLAYLIST; };
    URI.isPlaylistV2 = function (uri) { return (URI.from(uri) || {}).type === URI.Type.PLAYLIST_V2; };
    URI.isRadio = function (uri) { return (URI.from(uri) || {}).type === URI.Type.RADIO; };
    URI.isRootlist = function (uri) { return (URI.from(uri) || {}).type === URI.Type.ROOTLIST; };
    URI.isSearch = function (uri) { return (URI.from(uri) || {}).type === URI.Type.SEARCH; };
    URI.isShow = function (uri) { return (URI.from(uri) || {}).type === URI.Type.SHOW; };
    URI.isConcert = function (uri) { return (URI.from(uri) || {}).type === URI.Type.CONCERT; };
    URI.isStation = function (uri) { return (URI.from(uri) || {}).type === URI.Type.STATION; };
    URI.isTrack = function (uri) { return (URI.from(uri) || {}).type === URI.Type.TRACK; };
    URI.isProfile = function (uri) { return (URI.from(uri) || {}).type === URI.Type.PROFILE; };
    URI.isPlaylistV1OrV2 = function (uri) {
        var uriObject = URI.from(uri);
        return !!uriObject && (uriObject.type === URI.Type.PLAYLIST || uriObject.type === URI.Type.PLAYLIST_V2);
    };

    /**
     * Export public interface
     */
    return URI;
})();

Spicetify.getAudioData = (uri) => {
    return new Promise((resolve, reject) => {
        uri = uri || Spicetify.Player.data.track.uri;
        const uriObj = Spicetify.URI.from(uri);
        if (!uriObj && uriObj.Type !== Spicetify.URI.Type.TRACK) {
            reject("URI is invalid.");
            return;
        }

        Spicetify.CosmosAPI.resolver.get(
            `hm://audio-attributes/v1/audio-analysis/${uriObj.getBase62Id()}`,
            (error, payload) => {
                if (error) {
                    reject(error);
                    return;
                }

                resolve(payload.getJSONBody());
            })
    });
}

Spicetify.getAblumArtColors = (uri) => {
    return new Promise((resolve, reject) => {
        uri = uri || Spicetify.Player.data.track.uri;
        if (Spicetify.URI.isTrack(uri)) {
            reject("URI is invalid.");
            return;
        }

        Spicetify.CosmosAPI.resolver.get(
            `hm://colorextractor/v1/extract-presets?uri=${uri}&format=json`,
            (error, payload) => {
                if (error) {
                    reject(error);
                    return;
                }

                const body = payload.getJSONBody();
                if (body.entries && body.entries.length) {
                    const list = {};
                    for (const color of body.entries[0].color_swatches) {
                        list[color.preset] = `#${color.color.toString(16).padStart(3, "0")}`;
                    }
                    resolve(list);
                } else {
                    resolve(null);
                }
            }
        );
    });
}

Spicetify.Menu = (function() {
    const collection = new Set();

    const _hook = function(menuReact, itemReact, subMenuReact ) {
        function createSingleItem(item) {
            return menuReact.createElement(itemReact, {
                label: item.name,
                isChecked: item.isEnabled,
                name: "spicetify-hook",
                onClick: item.onClick,
            });
        }

        const result = [];

        for (const item of collection) {
            let reactComp;
            if (item.subItems) {
                reactComp = menuReact.createElement(itemReact, { label: item.name },
                    menuReact.createElement(subMenuReact, { isSubmenu: true },
                        item.subItems.map(createSingleItem)
                    )
                );
            } else {
                reactComp = createSingleItem(item);
            }
            result.push(reactComp);
        }

        return result;
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

    return { Item, SubMenu, _hook }
})();

Spicetify.ContextMenu = (function () {
    let itemList = new Set();
    const iconList = ["add-to-playlist", "add-to-queue", "addfollow", "addfollowers", "addsuggestedsong", "airplay", "album", "album-contained", "arrow-down", "arrow-left", "arrow-right", "arrow-up", "artist", "artist-active", "attach", "available-offline", "ban", "ban-active", "block", "bluetooth", "browse", "browse-active", "camera", "carplay", "chart-down", "chart-new", "chart-up", "check", "check-alt", "chevron-down", "chevron-left", "chevron-right", "chevron-up", "chromecast-connected", "chromecast-connecting-one", "chromecast-connecting-three", "chromecast-connecting-two", "chromecast-disconnected", "collaborative-playlist", "collection", "collection-active", "connect-to-devices", "copy", "destination-pin", "device-arm", "device-car", "device-computer", "device-mobile", "device-multispeaker", "device-other", "device-speaker", "device-tablet", "device-tv", "devices", "devices-alt", "discover", "download", "downloaded", "drag-and-drop", "edit", "email", "events", "facebook", "facebook-messenger", "filter", "flag", "follow", "fullscreen", "games-console", "gears", "googleplus", "grid-view", "headphones", "heart", "heart-active", "helpcircle", "highlight", "home", "home-active", "inbox", "info", "instagram", "library", "lightning", "line", "list-view", "localfile", "locked", "locked-active", "lyrics", "make—available-offline", "menu", "messages", "mic", "minimise", "mix", "more", "more-android", "new-spotify-connect", "new-volume", "newradio", "nikeplus", "notifications", "now-playing", "now-playing-active", "offline", "offline-sync", "pause", "payment", "paymenthistory", "play", "playback-speed-0point5x", "playback-speed-0point8x", "playback-speed-1point2x", "playback-speed-1point5x", "playback-speed-1x", "playback-speed-2x", "playback-speed-3x", "playlist", "playlist-folder", "plus", "plus-2px", "plus-alt", "podcasts", "podcasts-active", "public", "queue", "radio", "radio-active", "radioqueue", "redeem", "refresh", "released", "repeat", "repeatonce", "report-abuse", "running", "search", "search-active", "sendto", "share", "share-android", "sharetofollowers", "shows", "shuffle", "skip-back", "skip-forward", "skipback15", "skipforward15", "sleeptimer", "sms", "sort", "sortdown", "sortup", "spotify-connect", "spotify-connect-alt", "spotifylogo", "spotifypremium", "star", "star-alt", "subtitles", "tag", "thumbs-down", "thumbs-up", "time", "topcountry", "track", "trending", "trending-active", "tumblr", "twitter", "user", "user-active", "user-alt", "user-circle", "video", "volume", "volume-off", "volume-onewave", "volume-twowave", "warning", "watch", "whatsapp", "x", "settings"];

    class Item {
        constructor(name, onClick, shouldAdd = (uris) => true, icon = undefined) {
            this.name = name;
            this.onClick = onClick;
            this.shouldAdd = shouldAdd;
            if (icon) this.icon = icon;
        }
        set name(text) {
            if (typeof text !== "string") {
                throw "Spicetify.ContextMenu.Item: name is not a string";
            }
            this._name = text;
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
            if (!Item.iconList.includes(name)) {
                throw "Spicetify.ContextMenu.Item: icon is not a valid icon name.";
            }
            this._icon = {
                type: "spoticon",
                value: name,
            };
        }
        register() {
            itemList.add(this);
        }
        deregister() {
            itemList.remove(this);
        }
    }

    Item.iconList = iconList;

    class SubMenu {
        constructor(name, items, shouldAdd = (uris) => true, icon = undefined) {
            this.name = name;
            this.items = items;
            this.shouldAdd = shouldAdd;
            if (icon) this.icon = icon;
        }
        set name(text) {
            if (typeof text !== "string") {
                throw "Spicetify.ContextMenu.Item.setName: name is not a string";
            }
            this._name = text;
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
                throw "Spicetify.ContextMenu.Item: shouldAdd is not a function";
            }
        }
        set icon(name) {
            if (!SubMenu.iconList.includes(name)) {
                throw "Spicetify.ContextMenu.Item: icon is not a valid icon name.";
            }
            this._icon = {
                type: "spoticon",
                value: name,
            };
        }
        register() {
            itemList.add(this);
        }
        deregister() {
            itemList.remove(this);
        }
    }

    SubMenu.iconList = iconList;

    function _addItems(contextMenuInstance, uris) {
        for (const item of itemList) {
            if (!item._shouldAdd(uris)) {
                continue;
            }

            if (item._items) {
                const subItemsList = []
                for (const subItem of item._items) {
                    subItemsList.push({
                        fn: () => {
                            subItem._onClick(uris);
                            contextMenuInstance.hide();
                        },
                        icon: subItem._icon,
                        id: "",
                        text: subItem._name,
                    });
                }

                contextMenuInstance.addItem({
                    icon: item._icon,
                    id: "",
                    items: subItemsList,
                    text: item._name,
                });
                continue;
            }

            contextMenuInstance.addItem({
                fn: () => {
                    item._onClick(uris);
                    contextMenuInstance.hide();
                },
                icon: item._icon,
                id: "",
                text: item._name,
            })
        }
    }

    return { Item, SubMenu, _addItems };
})();

Spicetify.Abba = (function() {
    const STORAGE_KEY = "Spicetify.OverrideAbbaFlags";    
    const STORAGE = window.top.localStorage;

    const storedOverrideFlags = STORAGE.getItem(STORAGE_KEY);
    window.__spotify.product_state.abbaOverrides = storedOverrideFlags;

    let _overrideFlags;
    if (storedOverrideFlags) {
        try {
            _overrideFlags = JSON.parse(storedOverrideFlags);
        } catch {
            _overrideFlags = {};
        }
    } else {
        _overrideFlags = {};
    }

    function getFlag(name, callback) {
        if (typeof callback !== "function") {
            console.error("callback is not a function");
            return;
        }
        if (typeof name === "string") {
            name = [name];
        }
        Spicetify.CosmosAPI.resolver.post({
            url: "sp://abba/v1/flags",
            body: { flags: name }
        }, (error, res) => {
            if (error) {
                console.error(error);
                return;
            }
            callback(res.getJSONBody().flags);
        });
    }

    function getInUseFlags(callback) {
        if (typeof callback !== "function") {
            console.error("callback is not a function");
            return;
        }
        Spicetify.CosmosAPI.resolver.get("sp://abba/v1/requested_flag_names", (error, res) => {
            if (error) {
                console.error(error);
                return;
            }
            callback(res.getJSONBody());
        });
    }

    function getAllFlags(callback) {
        if (typeof callback !== "function") {
            console.error("callback is not a function");
            return;
        }
        Spicetify.CosmosAPI.resolver.get("sp://abba/v1/all_flags", (error, res) => {
            if (error) {
                console.error(error);
                return;
            }
            callback(res.getJSONBody());
        });
    }

    function getOverrideFlags() {
        return _overrideFlags;
    }

    function _syncStorage() {
        const stringified = JSON.stringify(_overrideFlags);
        STORAGE.setItem(STORAGE_KEY, stringified);
        window.__spotify.product_state.abbaOverrides = stringified;
    }

    function addOverrideFlag(name, value) {
        _overrideFlags[name] = value;
        _syncStorage();
        console.info("Please reload Spotify for overried flags to be effective")
    }

    function removeOverrideFlag(name) {
        if (_overrideFlags.hasOwnProperty(name)) {
            delete _overrideFlags[name];
            _syncStorage();
            console.info(`Flag ${name} succesfully removed from Override Flags. Please reload Spotify.`);
        }
    }

    return {
        getFlag,
        getInUseFlags,
        getAllFlags,
        getOverrideFlags,
        addOverrideFlag,
        removeOverrideFlag,
    };
})();

// Put `Spicetify` object to `window` object so apps iframe could access to it via `window.top.Spicetify`
window.Spicetify = Spicetify;