declare namespace Spicetify {
    type Metadata = Partial<Record<string, string>>;
    type ContextTrack = {
        uri: string;
        uid?: string;
        metadata?: Metadata;
    };
    type ProvidedTrack = ContextTrack & {
        removed?: string[];
        blocked?: string[];
        provider?: string;
    };
    interface ContextOption {
        contextURI?: string;
        index?: number;
        trackUri?: string;
        page?: number;
        trackUid?: string;
        sortedBy?: string;
        filteredBy?: string;
        shuffleContext?: boolean;
        repeatContext?: boolean;
        repeatTrack?: boolean;
        offset?: number;
        next_page_url?: string;
        restrictions?: Record<string, string[]>;
        referrer?: string;
    };
    type PlayerState = {
        timestamp: number;
        context_uri: string;
        context_url: string;
        context_restrictions: Record<string, string>;
        index?: {
            page: number;
            track: number;
        };
        track?: ProvidedTrack;
        playback_id?: string;
        playback_quality?: string;
        playback_speed?: number;
        position_as_of_timestamp: number;
        duration: number;
        is_playing: boolean;
        is_paused: boolean;
        is_buffering: boolean;
        play_origin: {
            feature_identifier: string;
            feature_version: string;
            view_uri?: string;
            external_referrer?: string;
            referrer_identifier?: string;
            device_identifier?: string;
        };
        options: {
            shuffling_context?: boolean;
            repeating_context?: boolean;
            repeating_track?: boolean;
        };
        restrictions: Record<string, string[]>;
        suppressions: {
            providers: string[];
        };
        debug: {
            log: string[];
        };
        prev_tracks: ProvidedTrack[];
        next_tracks: ProvidedTrack[];
        context_metadata: Metadata;
        page_metadata: Metadata;
        session_id: string;
        queue_revision: string;
    };
    namespace Player {
        /**
         * Register a listener `type` on Spicetify.Player.
         *
         * On default, `Spicetify.Player` always dispatch:
         *  - `songchange` type when player changes track.
         *  - `onplaypause` type when player plays or pauses.
         *  - `onprogress` type when track progress changes.
         *  - `appchange` type when user changes page.
         */
        function addEventListener(type: string, callback: (event?: Event) => void): void;
        function addEventListener(type: "songchange", callback: (event?: Event & { data: PlayerState }) => void): void;
        function addEventListener(type: "onplaypause", callback: (event?: Event & { data: PlayerState }) => void): void;
        function addEventListener(type: "onprogress", callback: (event?: Event & { data: number }) => void): void;
        function addEventListener(type: "appchange", callback: (event?: Event & { data: {
            /**
             * App href path
             */
            path: string;
            /**
             * App container
             */
             container: HTMLElement;
        } }) => void): void;
        /**
         * Skip to previous track.
         */
        function back(): void;
        /**
         * An object contains all information about current track and player.
         */
        const data: PlayerState;
        /**
         * Decrease a small amount of volume.
         */
        function decreaseVolume(): void;
        /**
         * Dispatches an event at `Spicetify.Player`.
         *
         * On default, `Spicetify.Player` always dispatch
         *  - `songchange` type when player changes track.
         *  - `onplaypause` type when player plays or pauses.
         *  - `onprogress` type when track progress changes.
         *  - `appchange` type when user changes page.
         */
        function dispatchEvent(event: Event): void;
        const eventListeners: {
            [key: string]: Array<(event?: Event) => void>
        };
        /**
         * Convert milisecond to `mm:ss` format
         * @param milisecond
         */
        function formatTime(milisecond: number): string;
        /**
         * Return song total duration in milisecond.
         */
        function getDuration(): number;
        /**
         * Return mute state
         */
        function getMute(): boolean;
        /**
         * Return elapsed duration in milisecond.
         */
        function getProgress(): number;
        /**
         * Return elapsed duration in percentage (0 to 1).
         */
        function getProgressPercent(): number;
        /**
         * Return current Repeat state (No repeat = 0/Repeat all = 1/Repeat one = 2).
         */
        function getRepeat(): number;
        /**
         * Return current shuffle state.
         */
        function getShuffle(): boolean;
        /**
         * Return track heart state.
         */
        function getHeart(): boolean;
        /**
         * Return current volume level (0 to 1).
         */
        function getVolume(): number;
        /**
         * Increase a small amount of volume.
         */
        function increaseVolume(): void;
        /**
         * Return a boolean whether player is playing.
         */
        function isPlaying(): boolean;
        /**
         * Skip to next track.
         */
        function next(): void;
        /**
         * Pause track.
         */
        function pause(): void;
        /**
         * Resume track.
         */
        function play(): void;
        /**
         * Play a track, playlist, album, etc. immediately
         * @param uri Spotify URI
         * @param context
         * @param options
         */
        async function playUri(uri: string, context: any = {}, options: Options = {});
        /**
         * Unregister added event listener `type`.
         * @param type
         * @param callback
         */
        function removeEventListener(type: string, callback: (event?: Event) => void): void;
        /**
         * Seek track to position.
         * @param position can be in percentage (0 to 1) or in milisecond.
         */
        function seek(position: number): void;
        /**
         * Turn mute on/off
         * @param state
         */
        function setMute(state: boolean): void;
        /**
         * Change Repeat mode
         * @param mode `0` No repeat. `1` Repeat all. `2` Repeat one track.
         */
        function setRepeat(mode: number): void;
        /**
         * Turn shuffle on/off.
         * @param state
         */
        function setShuffle(state: boolean): void;
        /**
         * Set volume level
         * @param level 0 to 1
         */
        function setVolume(level: number): void;
        /**
         * Seek to previous `amount` of milisecond
         * @param amount in milisecond. Default: 15000.
         */
        function skipBack(amount?: number): void;
        /**
         * Seek to next  `amount` of milisecond
         * @param amount in milisecond. Default: 15000.
         */
        function skipForward(amount?: number): void;
        /**
        * Toggle Heart (Favourite) track state.
        */
        function toggleHeart(): void;
        /**
         * Toggle Mute/No mute.
         */
        function toggleMute(): void;
        /**
         * Toggle Play/Pause.
         */
        function togglePlay(): void;
        /**
         * Toggle No repeat/Repeat all/Repeat one.
         */
        function toggleRepeat(): void;
        /**
         * Toggle Shuffle/No shuffle.
         */
        function toggleShuffle(): void;
    }
    /**
     * Adds a track/album or array of tracks/albums to prioritized queue.
     */
    function addToQueue(uri: string | string[]): Promise<void>;
    /**
     * @deprecated
     */
    const BridgeAPI: any;
    /**
     * @deprecated
     */
    const CosmosAPI: any;
    /**
     * Async wrappers of CosmosAPI
     */
    namespace CosmosAsync {
        type Method = "DELETE" | "GET" | "HEAD" | "PATCH" | "POST" | "PUT" | "SUB";
        interface Error {
            code: number;
            error: string;
            message: string;
            stack?: string;
        }

        type Headers = Record<string, string>;
        type Body = Record<string, any>;

        interface Response {
            body: any;
            headers: Headers;
            status: number;
            uri: string;
            static isSuccessStatus(status: number): boolean;
        }

        function head(url: string, headers?: Headers): Promise<Headers>;
        function get(url: string, body?: Body, headers?: Headers): Promise<Response.body>;
        function post(url: string, body?: Body, headers?: Headers): Promise<Response.body>;
        function put(url: string, body?: Body, headers?: Headers): Promise<Response.body>;
        function del(url: string, body?: Body, headers?: Headers): Promise<Response.body>;
        function patch(url: string, body?: Body, headers?: Headers): Promise<Response.body>;
        function sub(url: string, callback: ((b: Response.body) => void), onError?: ((e: Error) => void), body?: Body, headers?: Headers): Promise<Response.body>;
        function postSub(url: string, body?: Body, callback: ((b: Response.body) => void), onError?: ((e: Error) => void)): Promise<Response.body>;
        function request(method: Method, url: string, body?: Body, headers?: Headers): Promise<Response>;
        function resolve(method: Method, url: string, body?: Body, headers?: Headers): Promise<Response>;
    }
    /**
     * Fetch interesting colors from URI.
     * @param uri Any type of URI that has artwork (playlist, track, album, artist, show, ...)
     */
    function colorExtractor(uri: string): Promise<{
        DESATURATED: string;
        LIGHT_VIBRANT: string;
        PROMINENT: string;
        VIBRANT: string;
        VIBRANT_NON_ALARMING: string;
    }>;
    /**
     * @deprecated
     */
    function getAblumArtColors(): any;
    /**
     * Fetch track analyzed audio data.
     * Beware, not all tracks have audio data.
     * @param uri is optional. Leave it blank to get current track
     * or specify another track uri.
     */
    function getAudioData(uri?: string): Promise<any>;
    /**
     * Set of APIs method to register, deregister hotkeys/shortcuts
     */
    namespace Keyboard {
        type ValidKey = "BACKSPACE" | "TAB" | "ENTER" | "SHIFT" | "CTRL" | "ALT" | "CAPS" | "ESCAPE" | "SPACE" | "PAGE_UP" | "PAGE_DOWN" | "END" | "HOME" | "ARROW_LEFT" | "ARROW_UP" | "ARROW_RIGHT" | "ARROW_DOWN" | "INSERT" | "DELETE" | "A" | "B" | "C" | "D" | "E" | "F" | "G" | "H" | "I" | "J" | "K" | "L" | "M" | "N" | "O" | "P" | "Q" | "R" | "S" | "T" | "U" | "V" | "W" | "X" | "Y" | "Z" | "WINDOW_LEFT" | "WINDOW_RIGHT" | "SELECT" | "NUMPAD_0" | "NUMPAD_1" | "NUMPAD_2" | "NUMPAD_3" | "NUMPAD_4" | "NUMPAD_5" | "NUMPAD_6" | "NUMPAD_7" | "NUMPAD_8" | "NUMPAD_9" | "MULTIPLY" | "ADD" | "SUBTRACT" | "DECIMAL_POINT" | "DIVIDE" | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8" | "F9" | "F10" | "F11" | "F12" | ";" | "=" | " | " | "-" | "." | "/" | "`" | "[" | "\\" | "]" | "\"" | "~" | "!" | "@" | "#" | "$" | "%" | "^" | "&" | "*" | "(" | ")" | "_" | "+" | ":" | "<" | ">" | "?" | "|";
        type KeysDefine = string | {
            key: string;
            ctrl?: boolean;
            shift?: boolean;
            alt?: boolean;
            meta?: boolean;
        };
        const KEYS: Record<ValidKey, string>;
        function registerShortcut(keys: KeysDefine, callback: (event: KeyboardEvent) => void);
        function registerIsolatedShortcut(keys: KeysDefine, callback: (event: KeyboardEvent) => void);
        function registerImportantShortcut(keys: KeysDefine, callback: (event: KeyboardEvent) => void);
        function _deregisterShortcut(keys: KeysDefine);
        function deregisterImportantShortcut(keys: KeysDefine);
    };

    /**
     * @deprecated
     */
    const LiveAPI: any;

    namespace LocalStorage {
        /**
         * Empties the list associated with the object of all key/value pairs, if there are any.
         */
        function clear(): void;
        /**
         * Get key value
         */
        function get(key: string): string | null;
        /**
         * Delete key
         */
        function remove(key: string): void;
        /**
         * Set new value for key
         */
        function set(key: string, value: string): void;
    }
    /**
     * To create and prepend custom menu item in profile menu.
     */
    namespace Menu {
        /**
         * Create a single toggle.
         */
        class Item {
            constructor(name: string, isEnabled: boolean, onClick: (self: Item) => void);
            name: string;
            isEnabled: boolean;
            /**
             * Change item name
             */
            setName(name: string): void;
            /**
             * Change item enabled state.
             * Visually, item would has a tick next to it if its state is enabled.
             */
            setState(isEnabled: boolean): void;
            /**
             * Item is only available in Profile menu when method "register" is called.
             */
            register(): void;
            /**
             * Stop item to be prepended into Profile menu.
             */
            deregister(): void;
        }

        /**
         * Create a sub menu to contain Item toggles.
         * `Item`s in `subItems` array shouldn't be registered.
         */
        class SubMenu {
            constructor(name: string, subItems: Item[]);
            name: string;
            /**
             * Change SubMenu name
             */
            setName(name: string): void;
            /**
             * Add an item to sub items list
             */
            addItem(item: Item);
            /**
             * Remove an item from sub items list
             */
            removeItem(item: Item);
            /**
             * SubMenu is only available in Profile menu when method "register" is called.
             */
            register(): void;
            /**
             * Stop SubMenu to be prepended into Profile menu.
             */
            deregister(): void;
        }
    }
    
    /**
     * Keyboard shortcut library
     * 
     * Documentation: https://craig.is/killing/mice v1.6.5
     * 
     * Spicetify.Keyboard is wrapper of this library to be compatible with legacy Spotify,
     * so new extension should use this library instead.
     */
     function Mousetrap(element?: any): void;

    /**
     * Contains vast array of internal APIs.
     * Please explore in Devtool Console.
     */
    const Platform: any;
    /**
     * Queue object contains list of queuing tracks,
     * history of played tracks and current track metadata.
     */
    const Queue: {
        nextTracks: any[];
        prevTracks: any[];
        queueRevision: string;
        track: any;
    };
    /**
     * Remove a track/album or array of tracks/albums from current queue.
     */
    function removeFromQueue(uri: string | string[]): Promise<void>;
    /**
     * Display a bubble of notification. Useful for a visual feedback.
     */
    function showNotification(text: string): void;
    /**
     * Set of APIs method to parse and validate URIs.
     */
    class URI {
        constructor(type: string, props: any);
        public type: string;
        public id: string;

        /**
         * Creates an application URI object from the current URI object.
         *
         * If the current URI object is already an application type, a copy is made.
         *
         * @return The current URI as an application URI.
         */
        toAppType(): URI;

        /**
         * Creates a URI object from an application URI object.
         *
         * If the current URI object is not an application type, a copy is made.
         *
         * @return The current URI as a real typed URI.
         */
        toRealType(): URI;

        /**
         *
         * @return The URI representation of this uri.
         */
        toURI(): string;

        /**
         *
         * @return The URI representation of this uri.
         */
        toString(): string;

        /**
         * Get the URL path of this uri.
         *
         * @param opt_leadingSlash True if a leading slash should be prepended.
         * @return The path of this uri.
         */
        toURLPath(opt_leadingSlash: boolean): string;

        /**
         *
         * @return The Play URL string for the uri.
         */
        toPlayURL(): string;

        /**
         *
         * @return The URL string for the uri.
         */
        toURL(): string;

        /**
         *
         * @return The Open URL string for the uri.
         */
        toOpenURL(): string;

        /**
         *
         * @return The Play HTTPS URL string for the uri.
         */
        toSecurePlayURL(): string;

        /**
         *
         * @return The HTTPS URL string for the uri.
         */
        toSecureURL(): string;

        /**
         *
         * @return The Open HTTPS URL string for the uri.
         */
        toSecureOpenURL(): string;

        /**
         *
         * @return The id of the uri as a bytestring.
         */
        idToByteString(): string;

        getPath(): string;

        getBase62Id(): string;

        /**
        * Checks whether two URI:s refer to the same thing even though they might
        * not necessarily be equal.
        *
        * These two Playlist URIs, for example, refer to the same playlist:
        *
        *   spotify:user:napstersean:playlist:3vxotOnOGDlZXyzJPLFnm2
        *   spotify:playlist:3vxotOnOGDlZXyzJPLFnm2
        *
        * @param uri The uri to compare identity for.
        * @return Whether they shared idenitity
        */
        isSameIdentity(uri: any): boolean;

        /**
         * The various URI Types.
         *
         * Note that some of the types in this enum are not real URI types, but are
         * actually URI particles. They are marked so.
         *
         */
        static Type: {
            EMPTY: string;
            ALBUM: string;
            AD: string;
            /** URI particle; not an actual URI. */
            APP: string;
            APPLICATION: string;
            ARTIST: string;
            ARTIST_TOPLIST: string;
            AUDIO_FILE: string;
            COLLECTION: string;
            COLLECTION_ALBUM: string;
            COLLECTION_MISSING_ALBUM: string;
            COLLECTION_ARTIST: string;
            CONTEXT_GROUP: string;
            DAILY_MIX: string;
            EPISODE: string;
            /** URI particle; not an actual URI. */
            FACEBOOK: string;
            FOLDER: string;
            FOLLOWERS: string;
            FOLLOWING: string;
            /** URI particle; not an actual URI. */
            GLOBAL: string;
            IMAGE: string;
            INBOX: string;
            INTERRUPTION: string;
            LOCAL_ARTIST: string;
            LOCAL_ALBUM: string;
            LOCAL: string;
            LIBRARY: string;
            MOSAIC: string;
            PLAYLIST: string;
            /** Only used for URI classification. Not a valid URI fragment. */
            PLAYLIST_V2: string;
            PROFILE: string;
            PUBLISHED_ROOTLIST: string;
            RADIO: string;
            ROOTLIST: string;
            COLLECTION_TRACK_LIST: string;
            SEARCH: string;
            SHOW: string;
            SOCIAL_SESSION: string,
            CONCERT: string;
            SPECIAL: string;
            STARRED: string;
            STATION: string;
            TEMP_PLAYLIST: string;
            /** URI particle; not an actual URI. */
            TOP: string;
            TOPLIST: string;
            TRACK: string;
            TRACKSET: string;
            /** URI particle; not an actual URI. */
            USER: string;
            USER_TOPLIST: string;
            USER_TOP_TRACKS: string;
        };

        /**
         * Creates a new URI object from a parsed string argument.
         *
         * @param str The string that will be parsed into a URI object.
         * @throws TypeError If the string argument is not a valid URI, a TypeError will
         *     be thrown.
         * @return The parsed URI object.
         */
        static fromString(str: string): URI;

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
         * @param value The value to parse.
         * @return The corresponding URI instance, or null if the
         *     passed value is not a valid value.
         */
        static from(value: any): URI | null;

        /**
        * Creates a new URI from a bytestring.
        *
        * @param type The type of the URI.
        * @param idByteString The ID of the URI as a bytestring.
        * @param opt_args Optional arguments to the URI constructor.
        * @return The URI object created.
        */
        static fromByteString(type: string, idByteString: string, opt_args?: any): URI;

        /**
         * Clones a given SpotifyURI instance.
         *
         * @param uri The uri to clone.
         * @return An instance of URI.
         */
        static clone(uri: URI): URI | null;

        /**
         * Returns the canonical representation of a username.
         *
         * @param username The username to encode.
         * @return The encoded canonical representation of the username.
         */
        static getCanonicalUsername(username: string): string;

        /**
         * Returns the non-canonical representation of a username.
         *
         * @param username The username to encode.
         * @return The unencoded canonical representation of the username.
         */
        static getDisplayUsername(username: string): string;

        /**
         * Returns the hex representation of a Base62 encoded id.
         *
         * @param id The base62 encoded id.
         * @return The hex representation of the base62 id.
         */
        static idToHex(id: string): string;

        /**
         * Returns the base62 representation of a hex encoded id.
         *
         * @param hex The hex encoded id.
         * @return The base62 representation of the id.
         */
        static hexToId(hex: string): string;

        /**
         * Creates a new empty URI.
         *
         * @return The empty URI.
         */
        static emptyURI(): URI;

        /**
         * Creates a new 'album' type URI.
         *
         * @param id The id of the album.
         * @param disc The disc number of the album.
         * @return The album URI.
         */
        static albumURI(id: string, disc: number): URI;

        /**
         * Creates a new 'ad' type URI.
         *
         * @param id The id of the ad.
         * @return The ad URI.
         */
        static adURI(id: string): URI;

        /**
         * Creates a new 'audiofile' type URI.
         *
         * @param extension The extension of the audiofile.
         * @param id The id of the extension.
         * @return The audiofile URI.
         */
        static audioFileURI(extension: string, id: string): URI;

        /**
         * Creates a new 'artist' type URI.
         *
         * @param id The id of the artist.
         * @return The artist URI.
         */
        static artistURI(id: string): URI;

        /**
         * Creates a new 'artist-toplist' type URI.
         *
         * @param id The id of the artist.
         * @param toplist The toplist type.
         * @return The artist-toplist URI.
         */
        static artistToplistURI(id: string, toplist: string): URI;

        /**
         * Creates a new 'dailymix' type URI.
         *
         * @param args An array of arguments for the dailymix.
         * @return The dailymix URI.
         */
        static dailyMixURI(args: string[]): URI;

        /**
         * Creates a new 'search' type URI.
         *
         * @param query The unencoded search query.
         * @return The search URI
         */
        static searchURI(query: string): URI;

        /**
         * Creates a new 'track' type URI.
         *
         * @param id The id of the track.
         * @param anchor The point in the track formatted as mm:ss
         * @param context An optional context URI
         * @param play Toggles autoplay
         * @return The track URI.
         */
        static trackURI(id: string, anchor: string, context: string, play: boolean): URI;

        /**
         * Creates a new 'trackset' type URI.
         *
         * @param tracks An array of 'track' type URIs.
         * @param name The name of the trackset.
         * @param index The index in the trackset.
         * @return The trackset URI.
         */
        static tracksetURI(tracks: URI[], name: string, index: number): URI;

        /**
         * Creates a new 'facebook' type URI.
         *
         * @param uid The user id.
         * @return The facebook URI.
         */
        static facebookURI(uid: string): URI;

        /**
         * Creates a new 'followers' type URI.
         *
         * @param username The non-canonical username.
         * @return The followers URI.
         */
        static followersURI(username: string): URI;

        /**
         * Creates a new 'following' type URI.
         *
         * @param username The non-canonical username.
         * @return The following URI.
         */
        static followingURI(username: string): URI;

        /**
         * Creates a new 'playlist' type URI.
         *
         * @param username The non-canonical username of the playlist owner.
         * @param id The id of the playlist.
         * @return The playlist URI.
         */
        static playlistURI(username: string, id: string): URI;

        /**
         * Creates a new 'playlist-v2' type URI.
         *
         * @param id The id of the playlist.
         * @return The playlist URI.
         */
        static playlistV2URI(id: string): URI;

        /**
         * Creates a new 'folder' type URI.
         *
         * @param username The non-canonical username of the folder owner.
         * @param id The id of the folder.
         * @return The folder URI.
         */
        static folderURI(username: string, id: string): URI;

        /**
         * Creates a new 'collectiontracklist' type URI.
         *
         * @param username The non-canonical username of the collection owner.
         * @param id The id of the tracklist.
         * @return The collectiontracklist URI.
         */
        static collectionTrackList(username: string, id: string): URI;

        /**
         * Creates a new 'starred' type URI.
         *
         * @param username The non-canonical username of the starred list owner.
         * @return The starred URI.
         */
        static starredURI(username: string): URI;

        /**
         * Creates a new 'user-toplist' type URI.
         *
         * @param username The non-canonical username of the toplist owner.
         * @param toplist The toplist type.
         * @return The user-toplist URI.
         */
        static userToplistURI(username: string, toplist: string): URI;

        /**
         * Creates a new 'user-top-tracks' type URI.
         *
         * @deprecated
         * @param username The non-canonical username of the toplist owner.
         * @return The user-top-tracks URI.
         */
        static userTopTracksURI(username: string): URI;

        /**
         * Creates a new 'toplist' type URI.
         *
         * @param toplist The toplist type.
         * @param country The country code for the toplist.
         * @param global True if this is a global rather than a country list.
         * @return The toplist URI.
         */
        static toplistURI(toplist: string, country: string, global: boolean): URI;

        /**
         * Creates a new 'inbox' type URI.
         *
         * @param username The non-canonical username of the inbox owner.
         * @return The inbox URI.
         */
        static inboxURI(username: string): URI;

        /**
         * Creates a new 'rootlist' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @return The rootlist URI.
         */
        static rootlistURI(username: string): URI;

        /**
         * Creates a new 'published-rootlist' type URI.
         *
         * @param username The non-canonical username of the published-rootlist owner.
         * @return The published-rootlist URI.
         */
        static publishedRootlistURI(username: string): URI;

        /**
         * Creates a new 'local-artist' type URI.
         *
         * @param artist The artist name.
         * @return The local-artist URI.
         */
        static localArtistURI(artist: string): URI;

        /**
         * Creates a new 'local-album' type URI.
         *
         * @param artist The artist name.
         * @param album The album name.
         * @return The local-album URI.
         */
        static localAlbumURI(artist: string, album: string): URI;

        /**
         * Creates a new 'local' type URI.
         *
         * @param artist The artist name.
         * @param album The album name.
         * @param track The track name.
         * @param duration The track duration in ms.
         * @return The local URI.
         */
        static localURI(artist: string, album: string, track: string, duration: number): URI;

        /**
         * Creates a new 'library' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param category The category of the library.
         * @return The library URI.
         */
        static libraryURI(username: string, category: string): URI;

        /**
         * Creates a new 'collection' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param category The category of the collection.
         * @return The collection URI.
         */
        static collectionURI(username: string, category: string): URI;

        /**
         * Creates a new 'temp-playlist' type URI.
         *
         * @param origin The origin of the temporary playlist.
         * @param data Additional data for the playlist.
         * @return The temp-playlist URI.
         */
        static temporaryPlaylistURI(origin: string, data: string): URI;

        /**
         * Creates a new 'context-group' type URI.
         *
         * @deprecated
         * @param origin The origin of the temporary playlist.
         * @param name The name of the context group.
         * @return The context-group URI.
         */
        static contextGroupURI(origin: string, name: string): URI;

        /**
         * Creates a new 'profile' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param args A list of arguments.
         * @return The profile URI.
         */
        static profileURI(username: string, args: string[]): URI;

        /**
         * Creates a new 'image' type URI.
         *
         * @param id The id of the image.
         * @return The image URI.
         */
        static imageURI(id: string): URI;


        /**
         * Creates a new 'mosaic' type URI.
         *
         * @param ids The ids of the mosaic immages.
         * @return The mosaic URI.
         */
        static mosaicURI(ids: string[]): URI;

        /**
         * Creates a new 'radio' type URI.
         *
         * @param args The radio seed arguments.
         * @return The radio URI.
         */
        static radioURI(args: string): URI;

        /**
         * Creates a new 'special' type URI.
         *
         * @param args An array containing the other arguments.
         * @return The special URI.
         */
        static specialURI(args: string[]): URI;

        /**
         * Creates a new 'station' type URI.
         *
         * @param args An array of arguments for the station.
         * @return The station URI.
         */
        static stationURI(args: string[]): URI;

        /**
         * Creates a new 'application' type URI.
         *
         * @param id The id of the application.
         * @param args An array containing the arguments to the app.
         * @return The application URI.
         */
        static applicationURI(id: string, args: string[]): URI;

        /**
         * Creates a new 'collection-album' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param id The id of the album.
         * @return The collection-album URI.
         */
        static collectionAlbumURI(username: string, id: string): URI;

        /**
         * Creates a new 'collection-album-missing' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param id The id of the album.
         * @return The collection-album-missing URI.
         */
        static collectionMissingAlbumURI(username: string, id: string): URI;

        /**
         * Creates a new 'collection-artist' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param id The id of the artist.
         * @return The collection-artist URI.
         */
        static collectionArtistURI(username: string, id: string): URI;

        /**
         * Creates a new 'episode' type URI.
         *
         * @param id The id of the episode.
         * @param context An optional context URI
         * @param play Toggles autoplay in the episode URI
         * @return The episode URI.
         */
        static episodeURI(id: string, context: string, play: boolean): URI;

        /**
         * Creates a new 'show' type URI.
         *
         * @param id The id of the show.
         * @return The show URI.
         */
        static showURI(id: string): URI;

        /**
         * Creates a new 'concert' type URI.
         *
         * @param id The id of the concert.
         * @return The concert URI.
         */
        static concertURI(id: string): URI;

        /**
         * Creates a new 'socialsession' type URI.
         *
         * @param id The token needed to join a social session.
         * @return The socialsession URI.
         */
         static socialSessionURI(id: string): URI;

         /**
         * Creates a new 'interruption' type URI.
         *
         * @param id The id of the interruption.
         * @return The ad URI.
         */
        static interruptionURI(id: string): URI;

        static isAlbum(uri: any): boolean;
        static isAd(uri: any): boolean;
        static isApplication(uri: any): boolean;
        static isArtist(uri: any): boolean;
        static isCollection(uri: any): boolean;
        static isCollectionAlbum(uri: any): boolean;
        static isCollectionArtist(uri: any): boolean;
        static isDailyMix(uri: any): boolean;
        static isEpisode(uri: any): boolean;
        static isFacebook(uri: any): boolean;
        static isFolder(uri: any): boolean;
        static isLocalArtist(uri: any): boolean;
        static isLocalAlbum(uri: any): boolean;
        static isLocalTrack(uri: any): boolean;
        static isMosaic(uri: any): boolean;
        static isPlaylistV1(uri: any): boolean;
        static isPlaylistV2(uri: any): boolean;
        static isRadio(uri: any): boolean;
        static isRootlist(uri: any): boolean;
        static isSearch(uri: any): boolean;
        static isShow(uri: any): boolean;
        static isConcert(uri: any): boolean;
        static isStation(uri: any): boolean;
        static isTrack(uri: any): boolean;
        static isProfile(uri: any): boolean;
        static isPlaylistV1OrV2(uri: any): boolean;
        static isSocialSession(uri: any): boolean;
        static isInterruption(uri: any): boolean;
    }

    /**
     * Create custom menu item and prepend to right click context menu
     */
    namespace ContextMenu {
        type Icon = "album" | "artist" | "block" | "chart-down" | "chart-up" | "check" | "check-alt-fill" | "chevron-left" | "chevron-right" | "chromecast-disconnected" | "copy" | "download" | "downloaded" | "edit" | "exclamation-circle" | "external-link" | "facebook" | "follow" | "fullscreen" | "grid-view" | "heart" | "heart-active" | "instagram" | "list-view" | "locked" | "locked-active" | "lyrics" | "minimize" | "more" | "new-spotify-connect" | "offline" | "pause" | "play" | "playlist" | "playlist-folder" | "plus2px" | "plus-alt" | "podcasts" | "repeat" | "repeat-once" | "search" | "search-active" | "shuffle" | "skip-back" | "skip-back15" | "skip-forward" | "skip-forward15" | "soundbetter" | "subtitles" | "twitter" | "volume" | "volume-off" | "volume-one-wave" | "volume-two-wave" | "x";
        type OnClickCallback = (uris: string[], uids?: string[], contextUri?: string) => void;
        type ShouldAddCallback = (uris: string[], uids?: string[], contextUri?: string) => boolean;

        // Single context menu item
        class Item {
            /**
             * List of valid icons to use.
             */
            static readonly iconList: Icon[];
            constructor(name: string, onClick: OnClickCallback, shouldAdd?: ShouldAddCallback, icon?: Icon, disabled?: boolean);
            name: string;
            icon: Icon | string;
            disabled: boolean;
            /**
             * A function returning boolean determines whether item should be prepended.
             */
            shouldAdd: ShouldAddCallback;
            /**
             * A function to call when item is clicked
             */
            onClick: OnClickCallback;
            /**
             * Item is only available in Context Menu when method "register" is called.
             */
            register: () => void;
            /**
             * Stop Item to be prepended into Context Menu.
             */
            deregister: () => void;
        }

        /**
         * Create a sub menu to contain `Item`s.
         * `Item`s in `subItems` array shouldn't be registered.
         */
        class SubMenu {
            constructor(name: string, subItems: Iterable<Item>, shouldAdd?: ShouldAddCallback, disabled?: boolean);
            name: string;
            disabled: boolean;
            /**
             * A function returning boolean determines whether item should be prepended.
             */
            shouldAdd: ShouldAddCallback;
            addItem: (item: Item) => void;
            removeItem: (item: Item) => void;
            /**
             * SubMenu is only available in Context Menu when method "register" is called.
             */
            register: () => void;
            /**
             * Stop SubMenu to be prepended into Context Menu.
             */
            deregister: () => void;
        }
    }

    /**
     * Popup Modal
     */
    namespace PopupModal {
        interface Content {
            title: string;
            /**
             * You can specify a string for simple text display
             * or a HTML element for interactive config/setting menu
             */
            content: string | Element;
            /**
             * Bigger window
             */
            isLarge?: boolean;
        }

        function display(e: Content): void;
        function hide(): void;
    }

    /** React instance to create components */
    const React: any;
    /** React DOM instance to render and mount components */
    const ReactDOM: any;

    /** Stock React components exposed from Spotify library */
    namespace ReactComponent {
        type ContextMenuProps = {
            /**
             * Decide whether to use the global singleton context menu (rendered in <body>)
             * or a new inline context menu (rendered in a sibling
             * element to `children`)
             */
            renderInline?: boolean;
            /**
             * Determins what will trigger the context menu. For example, a click, or a right-click
             */
            trigger?: 'click' | 'right-click';
            /**
             * Determins is the context menu should open or toggle when triggered
             */
            action?: 'toggle' | 'open';
            /**
             * The preferred placement of the context menu when it opens.
             * Relative to trigger element.
             */
            placement?: 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end';
            /**
             * The x and y offset distances at which the context menu should open.
             * Relative to trigger element and `position`.
             */
            offset?: [number, number];
            /**
             * Will stop the client from scrolling while the context menu is open
             */
            preventScrollingWhileOpen?: boolean;
            /**
             * The menu UI to render inside of the context menu.
             */
            menu: Spicetify.ReactComponent.Menu |
                Spicetify.ReactComponent.AlbumMenu |
                Spicetify.ReactComponent.PodcastShowMenu |
                Spicetify.ReactComponent.ArtistMenu |
                Spicetify.ReactComponent.PlaylistMenu;
            /**
             * A child of the context menu. Should be `<button>`, `<a>`,
             * a custom react component that forwards a ref to a `<button>` or `<a>`,
             * or a function. If a function is passed it will be called with
             * (`isOpen`, `handleContextMenu`, `ref`) as arguments.
             */
            children: ContextMenuChildren;
        };
        type MenuProps = {
            /**
             * Function that is called when the menu is closed
             */
            onClose?: () => void;
            /**
             * Function that provides the element that focus should jump to when the menu
             * is opened
             */
            getInitialFocusElement?: (el: HTMLElement | null) => HTMLElement | undefined | null;
        }
        type MenuItemProps = {
            /**
             * Function that runs when `MenuItem` is clicked
             */
            onClick?: React.MouseEventHandler<HTMLButtonElement>;
            /**
             * Indicates if `MenuItem` is disabled. Disabled items will not cause
             * the `Menu` to close when clicked.
             */
            disabled?: boolean;
            /**
             * Indicate that a divider line should be added `before` or `after` this `MenuItem`
             */
            divider?: 'before' | 'after' | 'both';
            /**
             * React component icon that will be rendered at the end of the `MenuItem`
             */
            icon?: React.ReactNode;
        };
        /**
         * Generic context menu provider
         * 
         * Props:
         * @see Spicetify.ReactComponent.ContextMenuProps
         */
        const ContextMenu: any;
        /**
         * Wrapper of ReactComponent.ContextMenu with props: action = 'toggle' and trigger = 'right-click'
         * 
         * Props:
         * @see Spicetify.ReactComponent.ContextMenuProps
         */
        const RightClickMenu: any;
        /**
         * Outer layer contain ReactComponent.MenuItem(s)
         * 
         * Props:
         * @see Spicetify.ReactComponent.MenuProps
         */
        const Menu: any;
        /**
         * Component to construct menu item
         * Used as ReactComponent.Menu children
         * 
         * Props:
         * @see Spicetify.ReactComponent.MenuItemProps
         */
        const MenuItem: any;
        /**
         * Tailored ReactComponent.Menu for specific type of object
         * 
         * Props: {
         *      uri: string;
         *      onRemoveCallback?: (uri: string) => void;
         * }
         */
        const AlbumMenu: any;
        const PodcastShowMenu: any;
        const ArtistMenu: any;
        const PlaylistMenu: any;
    };

    /**
     * Add button in top bar next to navigation buttons
     */
    namespace Topbar {
        class Button {
            constructor(label: string, icon: string, onClick: (self: Button) => void, disabled = false);
            label: string;
            icon: string;
            onClick: (self: Button) => void;
            disabled: boolean;
            element: HTMLButtonElement;
        }
    }

    /**
     * SVG icons 
     */
    namespace SVGIcons {
        const check: string;
    }
}
