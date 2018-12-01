const Spicetify = {
    Player: {
        addEventListener: undefined,
        back: undefined,
        data: undefined,
        decreaseVolume: undefined,
        dispatchEvent: undefined,
        eventListeners: undefined,
        formatTime: undefined,
        getDuration: undefined,
        getMute: undefined,
        getProgressMs: undefined,
        getProgressPercent: undefined,
        getRepeat: undefined,
        getShuffle: undefined,
        getThumbDown: undefined,
        getThumbUp: undefined,
        getVolume: undefined,
        increaseVolume: undefined,
        isPlaying: undefined,
        next: undefined,
        pause: undefined,
        play: undefined,
        removeEventListener: undefined,
        seek: undefined,
        setMute: undefined,
        setRepeat: undefined,
        setShuffle: undefined,
        setVolume: undefined,
        skipBack: undefined,
        skipForward: undefined,
        thumbDown: undefined,
        thumbUp: undefined,
        toggleMute: undefined,
        togglePlay: undefined,
        toggleRepeat: undefined,
        toggleShuffle: undefined,
    },

    addToQueue: undefined,

    BridgeAPI: undefined,

    CosmosAPI: undefined,

    getAudioData: undefined,

    LibURI: undefined,

    LiveAPI: undefined,

    LocalStorage: undefined,

    PlaybackControl: undefined,

    Queue: undefined,

    removeFromQueue: undefined,

    test: () => {
        const SPICETIFY_METHOD = [
            "Player",
            "addToQueue",
            "BridgeAPI",
            "CosmosAPI",
            "getAudioData",
            "LibURI",
            "LiveAPI",
            "LocalStorage",
            "PlaybackControl",
            "Queue",
            "removeFromQueue",
            "showNotification",
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
            "getMute",
            "getProgressMs",
            "getProgressPercent",
            "getRepeat",
            "getShuffle",
            "getThumbDown",
            "getThumbUp",
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
            "thumbDown",
            "thumbUp",
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

Spicetify.LibURI = (function () {
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

    /**
     * Creates an application URI object from the current URI object.
     *
     * If the current URI object is already an application type, a copy is made.
     *
     * @return {URI} The current URI as an application URI.
     */
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

    /**
     * Creates a URI object from an application URI object.
     *
     * If the current URI object is not an application type, a copy is made.
     *
     * @return {URI} The current URI as a real typed URI.
     */
    URI.prototype.toRealType = function () {
        if (this.type == URI.Type.APPLICATION) {
            return _parseFromComponents([this.id].concat(this.args), Format.URI);
        } else {
            return new URI(null, this);
        }
    };

    /**
     * Returns the URI representation of this URI.
     *
     * @return {String} The URI representation of this uri.
     */
    URI.prototype.toURI = function () {
        return URI_PREFIX + _getComponents(this, Format.URI).join(':');
    };

    /**
     * Returns the String representation of this URI.
     *
     * @return {String} The URI representation of this uri.
     * @see {URI#toURI}
     */
    URI.prototype.toString = function () {
        return this.toURI();
    };

    /**
     * Get the URL path of this uri.
     *
     * @param {boolean} opt_leadingSlash True if a leading slash should be prepended.
     * @return {String} The path of this uri.
     */
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

    /**
     * Returns the Play URL string for the uri.
     *
     * @return {string} The Play URL string for the uri.
     */
    URI.prototype.toPlayURL = function () {
        return PLAY_HTTPS_PREFIX + this.toURLPath();
    };

    /**
     * Returns the URL string for the uri.
     *
     * @return {string} The URL string for the uri.
     * @see {URL#toPlayURL}
     */
    URI.prototype.toURL = function () {
        return this.toPlayURL();
    };

    /**
     * Returns the Open URL string for the uri.
     *
     * @return {string} The Open URL string for the uri.
     */
    URI.prototype.toOpenURL = function () {
        return OPEN_HTTPS_PREFIX + this.toURLPath();
    };

    /**
     * Returns the Play HTTPS URL string for the uri.
     *
     * @return {string} The Play HTTPS URL string for the uri.
     */
    URI.prototype.toSecurePlayURL = function () {
        return this.toPlayURL();
    };

    /**
     * Returns the HTTPS URL string for the uri.
     *
     * @return {string} The HTTPS URL string for the uri.
     * @see {URL#toSecurePlayURL}
     */
    URI.prototype.toSecureURL = function () {
        return this.toPlayURL();
    };

    /**
     * Returns the Open HTTPS URL string for the uri.
     *
     * @return {string} The Open HTTPS URL string for the uri.
     */
    URI.prototype.toSecureOpenURL = function () {
        return this.toOpenURL();
    };

    /**
     * Returns the id of the uri as a bytestring.
     *
     * @return {Array} The id of the uri as a bytestring.
     */
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


    /**
    * Checks whether two URI:s refer to the same thing even though they might
    * not necessarily be equal.
    *
    * These two Playlist URIs, for example, refer to the same playlist:
    *
    *   spotify:user:napstersean:playlist:3vxotOnOGDlZXyzJPLFnm2
    *   spotify:playlist:3vxotOnOGDlZXyzJPLFnm2
    *
    * @param {*} uri The uri to compare identity for.
    * @return {boolean} Whether they shared idenitity
    */
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

    /**
     * The various URI Types.
     *
     * Note that some of the types in this enum are not real URI types, but are
     * actually URI particles. They are marked so.
     *
     * @enum {string}
     */
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

    /**
     * Creates a new URI object from a parsed string argument.
     *
     * @param {string} str The string that will be parsed into a URI object.
     * @throws TypeError If the string argument is not a valid URI, a TypeError will
     *     be thrown.
     * @return {URI} The parsed URI object.
     */
    URI.fromString = function (str) {
        var splitted = _splitIntoComponents(str);
        return _parseFromComponents(splitted.components, splitted.format, splitted.query);
    };

    /**
     * Parses a given object into a URI instance.
     *
     * Unlike URI.fromString, this function could receive any kind of value. If
     * the value is already a URI instance, it is simply returned.
     * Otherwise the value will be stringified before parsing.
     *
     * This function also does not throw an error like URI.fromString, but
     * instead simply returns null if it can't parse the value.
     *
     * @param {*} value The value to parse.
     * @return {URI?} The corresponding URI instance, or null if the
     *     passed value is not a valid value.
     */
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

    /**
     * Creates a new URI from a bytestring.
     *
     * @param {URI.Type} type The type of the URI.
     * @param {ByteString} idByteString The ID of the URI as a bytestring.
     * @param {Object} opt_args Optional arguments to the URI constructor.
     * @return {URI} The URI object created.
     */
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

    /**
     * Clones a given SpotifyURI instance.
     *
     * @param {URI} uri The uri to clone.
     * @return {URI?} An instance of URI.
     */
    URI.clone = function (uri) {
        if (!(uri instanceof URI)) {
            return null;
        }
        return new URI(null, uri);
    };

    /**
     * @deprecated
     */
    URI.getCanonical = function (username) {
        return this.getCanonical(username);
    };

    /**
     * Returns the canonical representation of a username.
     *
     * @param {string} username The username to encode.
     * @return {string} The encoded canonical representation of the username.
     */
    URI.getCanonicalUsername = function (username) {
        return _encodeComponent(username, Format.URI);
    };

    /**
     * Returns the non-canonical representation of a username.
     *
     * @param {string} username The username to encode.
     * @return {string} The unencoded canonical representation of the username.
     */
    URI.getDisplayUsername = function (username) {
        return _decodeComponent(username, Format.URI);
    };

    /**
     * Returns the hex representation of a Base62 encoded id.
     *
     * @param {string} id The base62 encoded id.
     * @return {string} The hex representation of the base62 id.
     */
    URI.idToHex = function (id) {
        if (id.length == 22) {
            return Base62.toHex(id);
        }
        return id;
    };

    /**
     * Returns the base62 representation of a hex encoded id.
     *
     * @param {string} hex The hex encoded id.
     * @return {string} The base62 representation of the id.
     */
    URI.hexToId = function (hex) {
        if (hex.length == 32) {
            return Base62.fromHex(hex);
        }
        return hex;
    };

    /**
     * Creates a new empty URI.
     *
     * @return {URI} The empty URI.
     */
    URI.emptyURI = function () {
        return new URI(URI.Type.EMPTY, {});
    };

    /**
     * Creates a new 'album' type URI.
     *
     * @param {string} id The id of the album.
     * @param {number} disc The disc number of the album.
     * @return {URI} The album URI.
     */
    URI.albumURI = function (id, disc) {
        return new URI(URI.Type.ALBUM, { id: id, disc: disc });
    };

    /**
     * Creates a new 'ad' type URI.
     *
     * @param {string} id The id of the ad.
     * @return {URI} The ad URI.
     */
    URI.adURI = function (id) {
        return new URI(URI.Type.AD, { id: id });
    };

    /**
     * Creates a new 'audiofile' type URI.
     *
     * @param {string} extension The extension of the audiofile.
     * @param {string} id The id of the extension.
     * @return {URI} The audiofile URI.
     */
    URI.audioFileURI = function (extension, id) {
        return new URI(URI.Type.AUDIO_FILE, { id: id, extension: extension });
    };

    /**
     * Creates a new 'artist' type URI.
     *
     * @param {string} id The id of the artist.
     * @return {URI} The artist URI.
     */
    URI.artistURI = function (id) {
        return new URI(URI.Type.ARTIST, { id: id });
    };

    /**
     * Creates a new 'artist-toplist' type URI.
     *
     * @param {string} id The id of the artist.
     * @param {string} toplist The toplist type.
     * @return {URI} The artist-toplist URI.
     */
    URI.artistToplistURI = function (id, toplist) {
        return new URI(URI.Type.ARTIST_TOPLIST, { id: id, toplist: toplist });
    };

    /**
     * Creates a new 'dailymix' type URI.
     *
     * @param {Array.<string>} args An array of arguments for the dailymix.
     * @return {URI} The dailymix URI.
     */
    URI.dailyMixURI = function (id) {
        return new URI(URI.Type.DAILY_MIX, { id: id });
    };

    /**
     * Creates a new 'search' type URI.
     *
     * @param {string} query The unencoded search query.
     * @return {URI} The search URI
     */
    URI.searchURI = function (query) {
        return new URI(URI.Type.SEARCH, { query: query });
    };

    /**
     * Creates a new 'track' type URI.
     *
     * @param {string} id The id of the track.
     * @param {string} anchor The point in the track formatted as mm:ss
     * @return {URI} The track URI.
     */
    URI.trackURI = function (id, anchor, context, play) {
        return new URI(URI.Type.TRACK, {
            id: id,
            anchor: anchor,
            context: context ? URI.fromString(context) : context,
            play: play
        });
    };

    /**
     * Creates a new 'trackset' type URI.
     *
     * @param {Array.<URI>} tracks An array of 'track' type URIs.
     * @param {string} name The name of the trackset.
     * @param {number} index The index in the trackset.
     * @return {URI} The trackset URI.
     */
    URI.tracksetURI = function (tracks, name, index) {
        return new URI(URI.Type.TRACKSET, {
            tracks: tracks,
            name: name || '',
            index: isNaN(index) ? null : index
        });
    };

    /**
     * Creates a new 'facebook' type URI.
     *
     * @param {string} uid The user id.
     * @return {URI} The facebook URI.
     */
    URI.facebookURI = function (uid) {
        return new URI(URI.Type.FACEBOOK, { uid: uid });
    };

    /**
     * Creates a new 'followers' type URI.
     *
     * @param {string} username The non-canonical username.
     * @return {URI} The followers URI.
     */
    URI.followersURI = function (username) {
        return new URI(URI.Type.FOLLOWERS, { username: username });
    };

    /**
     * Creates a new 'following' type URI.
     *
     * @param {string} username The non-canonical username.
     * @return {URI} The following URI.
     */
    URI.followingURI = function (username) {
        return new URI(URI.Type.FOLLOWING, { username: username });
    };

    /**
     * Creates a new 'playlist' type URI.
     *
     * @param {string} username The non-canonical username of the playlist owner.
     * @param {string} id The id of the playlist.
     * @return {URI} The playlist URI.
     */
    URI.playlistURI = function (username, id) {
        return new URI(URI.Type.PLAYLIST, { username: username, id: id });
    };

    /**
     * Creates a new 'playlist-v2' type URI.
     *
     * @param {string} id The id of the playlist.
     * @return {URI} The playlist URI.
     */
    URI.playlistV2URI = function (id) {
        return new URI(URI.Type.PLAYLIST_V2, { id: id });
    };

    /**
     * Creates a new 'folder' type URI.
     *
     * @param {string} username The non-canonical username of the folder owner.
     * @param {string} id The id of the folder.
     * @return {URI} The folder URI.
     */
    URI.folderURI = function (username, id) {
        return new URI(URI.Type.FOLDER, { username: username, id: id });
    };

    /**
     * Creates a new 'collectiontracklist' type URI.
     *
     * @param {string} username The non-canonical username of the collection owner.
     * @param {string} id The id of the tracklist.
     * @return {URI} The collectiontracklist URI.
     */
    URI.collectionTrackList = function (username, id) {
        return new URI(URI.Type.COLLECTION_TRACK_LIST, { username: username, id: id });
    };

    /**
     * Creates a new 'starred' type URI.
     *
     * @param {string} username The non-canonical username of the starred list owner.
     * @return {URI} The starred URI.
     */
    URI.starredURI = function (username) {
        return new URI(URI.Type.STARRED, { username: username });
    };

    /**
     * Creates a new 'user-toplist' type URI.
     *
     * @param {string} username The non-canonical username of the toplist owner.
     * @param {string} toplist The toplist type.
     * @return {URI} The user-toplist URI.
     */
    URI.userToplistURI = function (username, toplist) {
        return new URI(URI.Type.USER_TOPLIST, { username: username, toplist: toplist });
    };

    /**
     * Creates a new 'user-top-tracks' type URI.
     *
     * @deprecated
     * @param {string} username The non-canonical username of the toplist owner.
     * @return {URI} The user-top-tracks URI.
     */
    URI.userTopTracksURI = function (username) {
        return new URI(URI.Type.USER_TOP_TRACKS, { username: username });
    };

    /**
     * Creates a new 'toplist' type URI.
     *
     * @param {string} toplist The toplist type.
     * @param {string} country The country code for the toplist.
     * @param {boolean} global True if this is a global rather than a country list.
     * @return {URI} The toplist URI.
     */
    URI.toplistURI = function (toplist, country, global) {
        return new URI(URI.Type.TOPLIST, { toplist: toplist, country: country, global: !!global });
    };

    /**
     * Creates a new 'inbox' type URI.
     *
     * @param {string} username The non-canonical username of the inbox owner.
     * @return {URI} The inbox URI.
     */
    URI.inboxURI = function (username) {
        return new URI(URI.Type.INBOX, { username: username });
    };

    /**
     * Creates a new 'rootlist' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @return {URI} The rootlist URI.
     */
    URI.rootlistURI = function (username) {
        return new URI(URI.Type.ROOTLIST, { username: username });
    };

    /**
     * Creates a new 'published-rootlist' type URI.
     *
     * @param {string} username The non-canonical username of the published-rootlist owner.
     * @return {URI} The published-rootlist URI.
     */
    URI.publishedRootlistURI = function (username) {
        return new URI(URI.Type.PUBLISHED_ROOTLIST, { username: username });
    };

    /**
     * Creates a new 'local-artist' type URI.
     *
     * @param {string} artist The artist name.
     * @return {URI} The local-artist URI.
     */
    URI.localArtistURI = function (artist) {
        return new URI(URI.Type.LOCAL_ARTIST, { artist: artist });
    };

    /**
     * Creates a new 'local-album' type URI.
     *
     * @param {string} artist The artist name.
     * @param {string} album The album name.
     * @return {URI} The local-album URI.
     */
    URI.localAlbumURI = function (artist, album) {
        return new URI(URI.Type.LOCAL_ALBUM, { artist: artist, album: album });
    };

    /**
     * Creates a new 'local' type URI.
     *
     * @param {string} artist The artist name.
     * @param {string} album The album name.
     * @param {string} track The track name.
     * @param {number} duration The track duration in ms.
     * @return {URI} The local URI.
     */
    URI.localURI = function (artist, album, track, duration) {
        return new URI(URI.Type.LOCAL, {
            artist: artist,
            album: album,
            track: track,
            duration: duration
        });
    };

    /**
     * Creates a new 'library' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @param {string} category The category of the library.
     * @return {URI} The library URI.
     */
    URI.libraryURI = function (username, category) {
        return new URI(URI.Type.LIBRARY, { username: username, category: category });
    };

    /**
     * Creates a new 'collection' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @param {string} category The category of the collection.
     * @return {URI} The collection URI.
     */
    URI.collectionURI = function (username, category) {
        return new URI(URI.Type.COLLECTION, { username: username, category: category });
    };

    /**
     * Creates a new 'temp-playlist' type URI.
     *
     * @param {string} origin The origin of the temporary playlist.
     * @param {string} data Additional data for the playlist.
     * @return {URI} The temp-playlist URI.
     */
    URI.temporaryPlaylistURI = function (origin, data) {
        return new URI(URI.Type.TEMP_PLAYLIST, { origin: origin, data: data });
    };

    /**
     * Creates a new 'context-group' type URI.
     *
     * @deprecated
     * @param {string} origin The origin of the temporary playlist.
     * @param {string} name The name of the context group.
     * @return {URI} The context-group URI.
     */
    URI.contextGroupURI = function (origin, name) {
        return new URI(URI.Type.CONTEXT_GROUP, { origin: origin, name: name });
    };

    /**
     * Creates a new 'profile' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @param {Array.<string>} args A list of arguments.
     * @return {URI} The profile URI.
     */
    URI.profileURI = function (username, args) {
        return new URI(URI.Type.PROFILE, { username: username, args: args });
    };

    /**
     * Creates a new 'image' type URI.
     *
     * @param {string} id The id of the image.
     * @return {URI} The image URI.
     */
    URI.imageURI = function (id) {
        return new URI(URI.Type.IMAGE, { id: id });
    };

    /**
     * Creates a new 'mosaic' type URI.
     *
     * @param {Array.<string>} ids The ids of the mosaic immages.
     * @return {URI} The mosaic URI.
     */
    URI.mosaicURI = function (ids) {
        return new URI(URI.Type.MOSAIC, { ids: ids });
    };

    /**
     * Creates a new 'radio' type URI.
     *
     * @param {string} args The radio seed arguments.
     * @return {URI} The radio URI.
     */
    URI.radioURI = function (args) {
        args = typeof args === 'undefined' ? '' : args;
        return new URI(URI.Type.RADIO, { args: args });
    };

    /**
     * Creates a new 'special' type URI.
     *
     * @param {Array.<string>} args An array containing the other arguments.
     * @return {URI} The special URI.
     */
    URI.specialURI = function (args) {
        args = typeof args === 'undefined' ? [] : args;
        return new URI(URI.Type.SPECIAL, { args: args });
    };

    /**
     * Creates a new 'station' type URI.
     *
     * @param {Array.<string>} args An array of arguments for the station.
     * @return {URI} The station URI.
     */
    URI.stationURI = function (args) {
        args = typeof args === 'undefined' ? [] : args;
        return new URI(URI.Type.STATION, { args: args });
    };

    /**
     * Creates a new 'application' type URI.
     *
     * @param {string} id The id of the application.
     * @param {Array.<string>} args An array containing the arguments to the app.
     * @return {URI} The application URI.
     */
    URI.applicationURI = function (id, args) {
        args = typeof args === 'undefined' ? [] : args;
        return new URI(URI.Type.APPLICATION, { id: id, args: args });
    };

    /**
     * Creates a new 'collection-album' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @param {string} id The id of the album.
     * @return {URI} The collection-album URI.
     */
    URI.collectionAlbumURI = function (username, id) {
        return new URI(URI.Type.COLLECTION_ALBUM, { username: username, id: id });
    };

    /**
     * Creates a new 'collection-album-missing' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @param {string} id The id of the album.
     * @return {URI} The collection-album-missing URI.
     */
    URI.collectionMissingAlbumURI = function (username, id) {
        return new URI(URI.Type.COLLECTION_MISSING_ALBUM, { username: username, id: id });
    };

    /**
     * Creates a new 'collection-artist' type URI.
     *
     * @param {string} username The non-canonical username of the rootlist owner.
     * @param {string} id The id of the artist.
     * @return {URI} The collection-artist URI.
     */
    URI.collectionArtistURI = function (username, id) {
        return new URI(URI.Type.COLLECTION_ARTIST, { username: username, id: id });
    };

    /**
     * Creates a new 'episode' type URI.
     *
     * @param {string} id The id of the episode.
     * @param {string} context An optional context URI
     * @param {boolean} play Toggles autoplay in the episode URI
     * @return {URI} The episode URI.
     */
    URI.episodeURI = function (id, context, play) {
        return new URI(URI.Type.EPISODE, {
            id: id,
            context: context ? URI.fromString(context) : context,
            play: play
        });
    };

    /**
     * Creates a new 'show' type URI.
     *
     * @param {string} id The id of the show.
     * @return {URI} The show URI.
     */
    URI.showURI = function (id) {
        return new URI(URI.Type.SHOW, { id: id });
    };

    /**
     * Creates a new 'concert' type URI.
     *
     * @param {string} id The id of the concert.
     * @return {URI} The concert URI.
     */
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

Spicetify.getAudioData = (callback, uri) => {
    uri = uri || Spicetify.Player.data.track.uri;
    if (typeof(callback) !== "function" ) {
        console.log("Spicetify.getAudioData: callback has to be a function");
        return;
    };
    var id = Spicetify.LibURI.from(uri).id;
    if (id) {
        window.cosmos.resolver.get(`hm://audio-attributes/v1/audio-analysis/${id}`, (error, payload) => {
            if (error) {
                console.log(error);
                callback(null);
                return;
            }
            if (payload._status === 200 && payload._body && payload._body !== "") {
                var data = JSON.parse(payload._body);
                data.uri=uri;
                callback(data);
            } else {
                callback(null)
            }
        })
    };
}

/**
 * Set cosmos, bridge, live API to Spicetify object
 */
(function findAPI() {
    if (!Spicetify.CosmosAPI) {
        Spicetify.CosmosAPI = window.cosmos;
    }
    if (!Spicetify.BridgeAPI) {
        Spicetify.BridgeAPI = window.bridge;
    }
    if (!Spicetify.LiveAPI) {
        Spicetify.LiveAPI = window.live;
    }

    if (!Spicetify.CosmosAPI
    || !Spicetify.BridgeAPI
    || !Spicetify.LiveAPI) {
        setTimeout(findAPI, 1000)
    }
})();
