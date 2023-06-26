declare namespace Spicetify {
    type Icon = "album" | "artist" | "block" | "brightness" | "car" | "chart-down" | "chart-up" | "check" | "check-alt-fill" | "chevron-left" | "chevron-right" | "chromecast-disconnected" | "clock" | "collaborative" | "computer" | "copy" | "download" | "downloaded" | "edit" | "enhance" | "exclamation-circle" | "external-link" | "facebook" | "follow" | "fullscreen" | "gamepad" | "grid-view" | "heart" | "heart-active" | "instagram" | "laptop" | "library" | "list-view" | "location" | "locked" | "locked-active" | "lyrics" | "menu" | "minimize" | "minus" | "more" | "new-spotify-connect" | "offline" | "pause" | "phone" | "play" | "playlist" | "playlist-folder" | "plus-alt" | "plus2px" | "podcasts" | "projector" | "queue" | "repeat" | "repeat-once" | "search" | "search-active" | "shuffle" | "skip-back" | "skip-back15" | "skip-forward" | "skip-forward15" | "soundbetter" | "speaker" | "spotify" | "subtitles" | "tablet" | "ticket" | "twitter" | "visualizer" | "voice" | "volume" | "volume-off" | "volume-one-wave" | "volume-two-wave" | "watch" | "x";
    type Variant = "bass" | "forte" | "brio" | "altoBrio" | "alto" | "canon" | "celloCanon" | "cello" | "ballad" | "balladBold" | "viola" | "violaBold" | "mesto" | "mestoBold" | "metronome" | "finale" | "finaleBold" | "minuet" | "minuetBold";
    type SemanticColor = "textBase" | "textSubdued" | "textBrightAccent" | "textNegative" | "textWarning" | "textPositive" | "textAnnouncement" | "essentialBase" | "essentialSubdued" | "essentialBrightAccent" | "essentialNegative" | "essentialWarning" | "essentialPositive" | "essentialAnnouncement" | "decorativeBase" | "decorativeSubdued" | "backgroundBase" | "backgroundHighlight" | "backgroundPress" | "backgroundElevatedBase" | "backgroundElevatedHighlight" | "backgroundElevatedPress" | "backgroundTintedBase" | "backgroundTintedHighlight" | "backgroundTintedPress" | "backgroundUnsafeForSmallTextBase" | "backgroundUnsafeForSmallTextHighlight" | "backgroundUnsafeForSmallTextPress";
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
    type ContextOption = {
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
        function playUri(uri: string, context?: any, options?: any): Promise<void>;
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
     * Adds a track or array of tracks to prioritized queue.
     */
    function addToQueue(uri: ContextTrack[]): Promise<void>;
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
            uri?: string;
        }

        function head(url: string, headers?: Headers): Promise<Headers>;
        function get(url: string, body?: Body, headers?: Headers): Promise<Response["body"]>;
        function post(url: string, body?: Body, headers?: Headers): Promise<Response["body"]>;
        function put(url: string, body?: Body, headers?: Headers): Promise<Response["body"]>;
        function del(url: string, body?: Body, headers?: Headers): Promise<Response["body"]>;
        function patch(url: string, body?: Body, headers?: Headers): Promise<Response["body"]>;
        function sub(url: string, callback: ((b: Response["body"]) => void), onError?: ((e: Error) => void), body?: Body, headers?: Headers): Promise<Response["body"]>;
        function postSub(url: string, body: Body | null, callback: ((b: Response["body"]) => void), onError?: ((e: Error) => void)): Promise<Response["body"]>;
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
        function registerShortcut(keys: KeysDefine, callback: (event: KeyboardEvent) => void): void;
        function registerIsolatedShortcut(keys: KeysDefine, callback: (event: KeyboardEvent) => void): void;
        function registerImportantShortcut(keys: KeysDefine, callback: (event: KeyboardEvent) => void): void;
        function _deregisterShortcut(keys: KeysDefine): void;
        function deregisterImportantShortcut(keys: KeysDefine): void;
        function changeShortcut(keys: KeysDefine, newKeys: KeysDefine): void;
    }

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
            constructor(name: string, isEnabled: boolean, onClick: (self: Item) => void, icon?: Icon | string);
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
             * Change icon
             */
            setIcon(icon: Icon | string): void;
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
     * Remove a track or array of tracks from current queue.
     */
    function removeFromQueue(uri: ContextTrack[]): Promise<void>;
    /**
     * Display a bubble of notification. Useful for a visual feedback.
     * @param message Message to display. Can use inline HTML for styling.
     * @param isError If true, bubble will be red. Defaults to false.
     * @param msTimeout Time in milliseconds to display the bubble. Defaults to Spotify's value.
     */
    function showNotification(message: React.ReactNode, isError?: boolean, msTimeout?: number): void;
    /**
     * Set of APIs method to parse and validate URIs.
     */
    class URI {
        constructor(type: string, props: any);
        public type: string;
        public hasBase62Id: boolean;

        public id?: string;
        public disc?: any;
        public args?: any;
        public category?: string;
        public username?: string;
        public track?: string;
        public artist?: string;
        public album?: string;
        public duration?: number;
        public query?: string;
        public country?: string;
        public global?: boolean;
        public context?: string | typeof URI | null;
        public anchor?: string;
        public play?: any;
        public toplist?: any;

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
         * @param origin The origin to use for the URL.
         * @return The URL string for the uri.
         */
        toURL(origin?: string): string;

        /**
         * Clones a given SpotifyURI instance.
         *
         * @return An instance of URI.
         */
        clone(): URI | null;

        /**
         * Gets the path of the URI object by removing all hash and query parameters.
         *
         * @return The path of the URI object.
         */
        getPath(): string;

        /**
         * The various URI Types.
         *
         * Note that some of the types in this enum are not real URI types, but are
         * actually URI particles. They are marked so.
         *
         */
        static Type: {
            AD: string;
            ALBUM: string;
            GENRE: string;
            QUEUE: string;
            APPLICATION: string;
            ARTIST: string;
            ARTIST_TOPLIST: string;
            ARTIST_CONCERTS: string;
            AUDIO_FILE: string;
            COLLECTION: string;
            COLLECTION_ALBUM: string;
            COLLECTION_ARTIST: string;
            COLLECTION_MISSING_ALBUM: string;
            COLLECTION_TRACK_LIST: string;
            CONCERT: string;
            CONTEXT_GROUP: string;
            DAILY_MIX: string;
            EMPTY: string;
            EPISODE: string;
            /** URI particle; not an actual URI. */
            FACEBOOK: string;
            FOLDER: string;
            FOLLOWERS: string;
            FOLLOWING: string;
            IMAGE: string;
            INBOX: string;
            INTERRUPTION: string;
            LIBRARY: string;
            LIVE: string;
            ROOM: string;
            EXPRESSION: string;
            LOCAL: string;
            LOCAL_TRACK: string;
            LOCAL_ALBUM: string;
            LOCAL_ARTIST: string;
            MERCH: string;
            MOSAIC: string;
            PLAYLIST: string;
            PLAYLIST_V2: string;
            PRERELEASE: string;
            PROFILE: string;
            PUBLISHED_ROOTLIST: string;
            RADIO: string;
            ROOTLIST: string;
            SEARCH: string;
            SHOW: string;
            SOCIAL_SESSION: string;
            SPECIAL: string;
            STARRED: string;
            STATION: string;
            TEMP_PLAYLIST: string;
            TOPLIST: string;
            TRACK: string;
            TRACKSET: string;
            USER_TOPLIST: string;
            USER_TOP_TRACKS: string;
            UNKNOWN: string;
            MEDIA: string;
            QUESTION: string;
            POLL: string;
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
        * Checks whether two URI:s refer to the same thing even though they might
        * not necessarily be equal.
        *
        * These two Playlist URIs, for example, refer to the same playlist:
        *
        *   spotify:user:napstersean:playlist:3vxotOnOGDlZXyzJPLFnm2
        *   spotify:playlist:3vxotOnOGDlZXyzJPLFnm2
        *
        * @param baseUri The first URI to compare.
        * @param refUri The second URI to compare.
        * @return Whether they shared idenitity
        */
        static isSameIdentity(baseUri: URI | string, refUri: URI | string): boolean;

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
         * Creates a new 'album' type URI.
         *
         * @param id The id of the album.
         * @param disc The disc number of the album.
         * @return The album URI.
         */
        static albumURI(id: string, disc: number): URI;

        /**
         * Creates a new 'application' type URI.
         *
         * @param id The id of the application.
         * @param args An array containing the arguments to the app.
         * @return The application URI.
         */
        static applicationURI(id: string, args: string[]): URI;

        /**
         * Creates a new 'artist' type URI.
         *
         * @param id The id of the artist.
         * @return The artist URI.
         */
        static artistURI(id: string): URI;

        /**
         * Creates a new 'collection' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param category The category of the collection.
         * @return The collection URI.
         */
        static collectionURI(username: string, category: string): URI;

        /**
         * Creates a new 'collection-album' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param id The id of the album.
         * @return The collection album URI.
         */
        static collectionAlbumURI(username: string, id: string): URI;

        /**
         * Creates a new 'collection-artist' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param id The id of the artist.
         * @return The collection artist URI.
         */
        static collectionAlbumURI(username: string, id: string): URI;

        /**
         * Creates a new 'concert' type URI.
         * 
         * @param id The id of the concert.
         * @return The concert URI.
         */
        static concertURI(id: string): URI;

        /**
         * Creates a new 'episode' type URI.
         * 
         * @param id The id of the episode.
         * @return The episode URI.
         */
        static episodeURI(id: string): URI;

        /**
         * Creates a new 'folder' type URI.
         * 
         * @param id The id of the folder.
         * @return The folder URI.
         */
        static folderURI(id: string): URI;

        /**
         * Creates a new 'local-album' type URI.
         * 
         * @param artist The artist of the album.
         * @param album The name of the album.
         * @return The local album URI.
         */
        static localAlbumURI(artist: string, album: string): URI;

        /**
         * Creates a new 'local-artist' type URI.
         * 
         * @param artist The name of the artist.
         * @return The local artist URI.
         */
        static localArtistURI(artist: string): URI;

        /**
         * Creates a new 'playlist-v2' type URI.
         *
         * @param id The id of the playlist.
         * @return The playlist URI.
         */
        static playlistV2URI(id: string): URI;

        /**
         * Creates a new 'prerelease' type URI.
         * 
         * @param id The id of the prerelease.
         * @return The prerelease URI.
         */
        static prereleaseURI(id: string): URI;

        /**
         * Creates a new 'profile' type URI.
         *
         * @param username The non-canonical username of the rootlist owner.
         * @param args A list of arguments.
         * @return The profile URI.
         */
        static profileURI(username: string, args: string[]): URI;

        /**
         * Creates a new 'search' type URI.
         *
         * @param query The unencoded search query.
         * @return The search URI
         */
        static searchURI(query: string): URI;

        /**
         * Creates a new 'show' type URI.
         *
         * @param id The id of the show.
         * @return The show URI.
         */
        static showURI(id: string): URI;

        /**
         * Creates a new 'station' type URI.
         *
         * @param args An array of arguments for the station.
         * @return The station URI.
         */
        static stationURI(args: string[]): URI;

        /**
         * Creates a new 'track' type URI.
         *
         * @param id The id of the track.
         * @param anchor The point in the track formatted as mm:ss
         * @param context An optional context URI
         * @param play Toggles autoplay
         * @return The track URI.
         */
        static trackURI(id: string, anchor: string, context?: string, play: boolean): URI;

        /**
         * Creates a new 'user-toplist' type URI.
         *
         * @param username The non-canonical username of the toplist owner.
         * @param toplist The toplist type.
         * @return The user-toplist URI.
         */
        static userToplistURI(username: string, toplist: string): URI;

        static isAd(uri: URI | string): boolean;
        static isAlbum(uri: URI | string): boolean;
        static isGenre(uri: URI | string): boolean;
        static isQueue(uri: URI | string): boolean;
        static isApplication(uri: URI | string): boolean;
        static isArtist(uri: URI | string): boolean;
        static isArtistToplist(uri: URI | string): boolean;
        static isArtistConcerts(uri: URI | string): boolean;
        static isAudioFile(uri: URI | string): boolean;
        static isCollection(uri: URI | string): boolean;
        static isCollectionAlbum(uri: URI | string): boolean;
        static isCollectionArtist(uri: URI | string): boolean;
        static isCollectionMissingAlbum(uri: URI | string): boolean;
        static isCollectionTrackList(uri: URI | string): boolean;
        static isConcert(uri: URI | string): boolean;
        static isContextGroup(uri: URI | string): boolean;
        static isDailyMix(uri: URI | string): boolean;
        static isEmpty(uri: URI | string): boolean;
        static isEpisode(uri: URI | string): boolean;
        static isFacebook(uri: URI | string): boolean;
        static isFolder(uri: URI | string): boolean;
        static isFollowers(uri: URI | string): boolean;
        static isFollowing(uri: URI | string): boolean;
        static isImage(uri: URI | string): boolean;
        static isInbox(uri: URI | string): boolean;
        static isInterruption(uri: URI | string): boolean;
        static isLibrary(uri: URI | string): boolean;
        static isLive(uri: URI | string): boolean;
        static isRoom(uri: URI | string): boolean;
        static isExpression(uri: URI | string): boolean;
        static isLocal(uri: URI | string): boolean;
        static isLocalTrack(uri: URI | string): boolean;
        static isLocalAlbum(uri: URI | string): boolean;
        static isLocalArtist(uri: URI | string): boolean;
        static isMerch(uri: URI | string): boolean;
        static isMosaic(uri: URI | string): boolean;
        static isPlaylist(uri: URI | string): boolean;
        static isPlaylistV2(uri: URI | string): boolean;
        static isPrerelease(uri: URI | string): boolean;
        static isProfile(uri: URI | string): boolean;
        static isPublishedRootlist(uri: URI | string): boolean;
        static isRadio(uri: URI | string): boolean;
        static isRootlist(uri: URI | string): boolean;
        static isSearch(uri: URI | string): boolean;
        static isShow(uri: URI | string): boolean;
        static isSocialSession(uri: URI | string): boolean;
        static isSpecial(uri: URI | string): boolean;
        static isStarred(uri: URI | string): boolean;
        static isStation(uri: URI | string): boolean;
        static isTempPlaylist(uri: URI | string): boolean;
        static isToplist(uri: URI | string): boolean;
        static isTrack(uri: URI | string): boolean;
        static isTrackset(uri: URI | string): boolean;
        static isUserToplist(uri: URI | string): boolean;
        static isUserTopTracks(uri: URI | string): boolean;
        static isUnknown(uri: URI | string): boolean;
        static isMedia(uri: URI | string): boolean;
        static isQuestion(uri: URI | string): boolean;
        static isPoll(uri: URI | string): boolean;
        static isPlaylistV1OrV2(uri: URI | string): boolean;
    }

    /**
     * Create custom menu item and prepend to right click context menu
     */
    namespace ContextMenu {
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
            menu: typeof Spicetify.ReactComponent.Menu |
                typeof Spicetify.ReactComponent.AlbumMenu |
                typeof Spicetify.ReactComponent.PodcastShowMenu |
                typeof Spicetify.ReactComponent.ArtistMenu |
                typeof Spicetify.ReactComponent.PlaylistMenu;
            /**
             * A child of the context menu. Should be `<button>`, `<a>`,
             * a custom react component that forwards a ref to a `<button>` or `<a>`,
             * or a function. If a function is passed it will be called with
             * (`isOpen`, `handleContextMenu`, `ref`) as arguments.
             */
            children: Element | ((isOpen?: boolean, handleContextMenu?: (e: MouseEvent) => void, ref?: (e: Element) => void) => Element);
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
             * @deprecated Since Spotify `1.2.8`. Use `leadingIcon` or `trailingIcon` instead
             */
            icon?: React.ReactNode;
            /**
             * React component icon that will be rendered at the start of the `MenuItem`
             * @since Spotify `1.2.8`
             */
            leadingIcon?: React.ReactNode;
            /**
             * React component icon that will be rendered at the end of the `MenuItem`
             * @since Spotify `1.2.8`
             */
            trailingIcon?: React.ReactNode;
        };
        type TooltipProps = {
            /**
             * Label to display in the tooltip
             */
            label: string;
            /**
             * The child element that the tooltip will be attached to
             * and will display when hovered over
             */
            children: React.ReactNode;
            /**
             * Decide whether to use the global singleton tooltip (rendered in `<body>`)
             * or a new inline tooltip (rendered in a sibling
             * element to `children`)
             */
            renderInline?: boolean;
            /**
             * Delay in milliseconds before the tooltip is displayed
             * after the user hovers over the child element
             */
            showDelay?: number;
            /**
             * Determine whether the tooltip should be displayed
             */
            disabled?: boolean;
            /**
             * The preferred placement of the context menu when it opens.
             * Relative to trigger element.
             * @default 'top'
             */
            placement?: 'top' | 'top-start' | 'top-end' | 'right' | 'right-start' | 'right-end' | 'bottom' | 'bottom-start' | 'bottom-end' | 'left' | 'left-start' | 'left-end';
            /**
             * Class name to apply to the tooltip
             */
            labelClassName?: string;
        };
        type IconComponentProps = {
            /**
             * Icon size
             * @default 24
             */
            iconSize?: number;
            /**
             * Icon color
             * Might not be used by component
             * @default 'currentColor'
             */
            color?: string;
            /**
             * Semantic color name
             * Matches color variables used in xpui
             * @default Inherit from parent
             */
            semanticColor?: SemanticColor;
            /**
             * Icon title
             * @default ''
             */
            title?: string;
            /**
             * Title ID (internal)
             */
            titleId?: string;
            /**
             * Icon description
             */
            desc?: string;
            /**
             * Description ID (internal)
             */
            descId?: string;
            /**
             * Auto mirror icon
             * @default false
             */
            autoMirror?: boolean;
        }
        type TextComponentProps = {
            /**
             * Text color
             * Might not be used by component
             * @default 'currentColor'
             */
            color?: string;
            /**
             * Semantic color name
             * Matches color variables used in xpui
             * @default Inherit from parent
             */
            semanticColor?: SemanticColor;
            /**
             * Text style variant
             * @default 'viola'
             */
            variant?: Variant;
            /**
             * Bottom padding size
             */
            paddingBottom?: string;
            /**
             * Font weight
             */
            weight?: "book" | "bold" | "black";
        }
        type ConfirmDialogProps = {
            /**
             * Boolean to determine if the dialog should be opened
             * @default true
             */
            isOpen?: boolean;
            /**
             * Whether to allow inline HTML in component text
             * @default false
             */
            allowHTML?: boolean;
            /**
             * Dialog title. Can be inline HTML if `allowHTML` is true
             */
            titleText: string;
            /**
             * Dialog description. Can be inline HTML if `allowHTML` is true
             */
            descriptionText?: string;
            /**
             * Confirm button text
             */
            confirmText?: string;
            /**
             * Cancel button text
             */
            cancelText?: string;
            /**
             * Confirm button aria-label
             */
            confirmLabel?: string;
            /**
             * Function to run when confirm button is clicked
             * The dialog does not close automatically, a handler must be included.
             * @param {React.MouseEvent<HTMLButtonElement>} event
             */
            onConfirm?: (event: React.MouseEvent<HTMLButtonElement>) => void;
            /**
             * Function to run when cancel button is clicked.
             * The dialog does not close automatically, a handler must be included.
             * @param {React.MouseEvent<HTMLButtonElement>} event
             */
            onClose?: (event: React.MouseEvent<HTMLButtonElement>) => void;
            /**
             * Function to run when dialog is clicked outside of.
             * By default, this will run `onClose`.
             * A handler must be included to close the dialog.
             * @param {React.MouseEvent<HTMLButtonElement>} event
             */
            onOutside?: (event: React.MouseEvent<HTMLButtonElement>) => void;
        }
        type PanelSkeletonProps = {
            /**
             * Aria label for the panel. Does not set the panel header content.
             */
            label?: string;
            /**
             * Item URI of the panel. Used as reference for Spotify's internal Event Factory.
             */
            itemUri?: string;
            /**
             * Additional class name to apply to the panel.
             * @deprecated Spotify `1.2.12`
             */
            className?: string;
            /**
             * Additional styles to apply to the panel.
             */
            style?: React.CSSProperties;
            /**
             * Children to render inside the panel.
             */
            children?: React.ReactNode;
        }
        type PanelContentProps = {
            /**
             * Additional class name to apply to the panel.
             */
            className?: string;
            /**
             * Children to render inside the panel.
             */
            children?: React.ReactNode;
        }
        type PanelHeaderProps = {
            /**
             * Href for the header link.
             * Can be either a URI for a path within the app, or a URL for an external link.
             */
            link?: string;
            /**
             * Title of the header.
             */
            title?: string;
            /**
             * Panel ID. Used to toggle panel open/closed state.
             */
            panel: number;
            /**
             * Whether or not the panel contains advertisements.
             * @default false
             */
            isAdvert?: boolean;
            /**
             * Actions to render in the header.
             */
            actions?: React.ReactNode | React.ReactNode[];
            /**
             * Function to call when clicking on the close button.
             * Called before the panel is closed.
             */
            onClose?: () => void;
            /**
             * Prevent the panel from closing when clicking on the header close button.
             * @default false
             */
            preventDefaultClose?: boolean;
            /**
             * Function to call when clicking on the header back button.
             * If not provided, the back button will not be rendered.
             */
            onBack?: (event: React.MouseEvent<HTMLButtonElement>) => void;
            /**
             * Font variant for the header title.
             * @default "balladBold"
             */
            titleVariant?: Variant;
            /**
             * Semantic color name for the header title.
             * @default "textBase"
             */
            titleSemanticColor?: SemanticColor;
        }
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
        /**
         * Component to display tooltip when hovering over element
         * Useful for accessibility
         *
         * Props:
         * @see Spicetify.ReactComponent.TooltipProps
         */
        const TooltipWrapper: any;
        /**
         * Component to render Spotify-style icon
         * @since Spotify `1.1.95`
         *
         * Props:
         * @see Spicetify.ReactComponent.IconComponentProps
         */
        const IconComponent: any;
        /**
         * Component to render Spotify-style text
         * @since Spotify `1.1.95`
         *
         * Props:
         * @see Spicetify.ReactComponent.TextComponentProps
         */
        const TextComponent: any;
        /**
         * Component to render Spotify-style confirm dialog
         *
         * Props:
         * @see Spicetify.ReactComponent.ConfirmDialogProps
         */
        const ConfirmDialog: any;
        /**
         * Component to render Spotify-style panel skeleton
         *
         * Props:
         * @see Spicetify.ReactComponent.PanelSkeletonProps
         */
        const PanelSkeleton: any;
        /**
         * Component to render Spotify-style panel content
         *
         * Props:
         * @see Spicetify.ReactComponent.PanelContentProps
         */
        const PanelContent: any;
        /**
         * Component to render Spotify-style panel header
         *
         * Props:
         * @see Spicetify.ReactComponent.PanelHeaderProps
         */
        const PanelHeader: any;
    }

    /**
     * Add button in top bar next to navigation buttons
     */
    namespace Topbar {
        class Button {
            constructor(label: string, icon: Icon | string, onClick: (self: Button) => void, disabled?: boolean);
            label: string;
            icon: string;
            onClick: (self: Button) => void;
            disabled: boolean;
            element: HTMLButtonElement;
            tippy: any;
        }
    }

    /**
     * Add button in player controls
     */
    namespace Playbar {
        /**
         * Create a button on the right side of the playbar
         */
        class Button {
            constructor(label: string, icon: Icon | string, onClick?: (self: Button) => void, disabled?: boolean, active?: boolean, registerOnCreate?: boolean);
            label: string;
            icon: string;
            onClick: (self: Button) => void;
            disabled: boolean;
            active: boolean;
            element: HTMLButtonElement;
            tippy: any;
            register: () => void;
            deregister: () => void;
        }

        /**
         * Create a widget next to track info
         */
        class Widget {
            constructor(label: string, icon: Icon | string, onClick?: (self: Widget) => void, disabled?: boolean, active?: boolean, registerOnCreate?: boolean);
            label: string;
            icon: string;
            onClick: (self: Widget) => void;
            disabled: boolean;
            active: boolean;
            element: HTMLButtonElement;
            tippy: any;
            register: () => void;
            deregister: () => void;
        }
    }

    /**
     * SVG icons
     */
    const SVGIcons: Record<Icon, string>;

    /**
     * Return font styling used by Spotify.
     * @param font Name of the font.
     * Can match any of the fonts listed in `Spicetify._fontStyle` or returns a generic style otherwise.
     */
    function getFontStyle(font: Variant): string;

    /**
     * A filtered copy of user's `config-xpui` file.
     */
    namespace Config {
        const version: string;
        const current_theme: string;
        const color_scheme: string;
        const extensions: string[];
        const custom_apps: string[];
    }

    /**
     * Tippy.js instance used by Spotify
     */
    const Tippy: any;
    /**
     * Spicetify's predefined props for Tippy.js
     * Used to mimic Spotify's tooltip behavior
     */
    const TippyProps: any;

    /**
     * Interface for interacting with Spotify client's app title
     */
    namespace AppTitle {
        /**
         * Set default app title. This has no effect if the player is running.
         * Will override any previous forced title.
         * @param title Title to set
         * @return Promise that resolves to a function to cancel forced title. This doesn't reset the title.
         */
        function set(title: string): Promise<{ clear: () => void }>;
        /**
         * Reset app title to default
         */
        function reset(): Promise<void>;
        /**
         * Get current default app title
         * @return Current default app title
         */
        function get(): Promise<string>;
        /**
         * Subscribe to title changes.
         * This event is not fired when the player changes app title.
         * @param callback Callback to call when title changes
         * @return Object with method to unsubscribe
         */
        function sub(callback: (title: string) => void): { clear: () => void };
    }

    /**
     * Spicetify's QraphQL wrapper for Spotify's GraphQL API endpoints
     */
    namespace GraphQL {
        /**
         * Possible types of entities.
         *
         * This list is dynamic and may change in the future.
         */
        type Query = "decorateItemsForEnhance" | "imageURLAndSize" | "imageSources" | "audioItems" | "creator" | "extractedColors" | "extractedColorsAndImageSources" | "fetchExtractedColorAndImageForAlbumEntity" | "fetchExtractedColorAndImageForArtistEntity" | "fetchExtractedColorAndImageForEpisodeEntity" | "fetchExtractedColorAndImageForPlaylistEntity" | "fetchExtractedColorAndImageForPodcastEntity" | "fetchExtractedColorAndImageForTrackEntity" | "fetchExtractedColorForAlbumEntity" | "fetchExtractedColorForArtistEntity" | "fetchExtractedColorForEpisodeEntity" | "fetchExtractedColorForPlaylistEntity" | "fetchExtractedColorForPodcastEntity" | "fetchExtractedColorForTrackEntity" | "getAlbumNameAndTracks" | "getEpisodeName" | "getTrackName" | "queryAlbumTrackUris" | "queryTrackArtists" | "decorateContextEpisodesOrChapters" | "decorateContextTracks" | "fetchTracksForRadioStation" | "decoratePlaylists" | "playlistUser" | "FetchPlaylistMetadata" | "playlistContentsItemTrackArtist" | "playlistContentsItemTrackAlbum" | "playlistContentsItemTrack" | "playlistContentsItemLocalTrack" | "playlistContentsItemEpisodeShow" | "playlistContentsItemEpisode" | "playlistContentsItemResponse" | "playlistContentsItem" | "FetchPlaylistContents" | "episodeTrailerUri" | "podcastEpisode" | "podcastMetadataV2" | "minimalAudiobook" | "audiobookChapter" | "audiobookMetadataV2" | "fetchExtractedColors" | "queryFullscreenMode" | "queryNpvEpisode" | "queryNpvArtist" | "albumTrack" | "getAlbum" | "queryAlbumTracks" | "queryArtistOverview" | "queryArtistAppearsOn" | "discographyAlbum" | "albumMetadataReleases" | "albumMetadata" | "queryArtistDiscographyAlbums" | "queryArtistDiscographySingles" | "queryArtistDiscographyCompilations" | "queryArtistDiscographyAll" | "queryArtistDiscographyOverview" | "artistPlaylist" | "queryArtistPlaylists" | "queryArtistDiscoveredOn" | "queryArtistFeaturing" | "queryArtistRelated" | "queryArtistMinimal" | "searchModalResults" | "queryWhatsNewFeed" | "whatsNewFeedNewItems" | "SetItemsStateInWhatsNewFeed" | "browseImageURLAndSize" | "browseImageSources" | "browseAlbum" | "browseArtist" | "browseEpisode" | "browseChapter" | "browsePlaylist" | "browsePodcast" | "browseAudiobook" | "browseTrack" | "browseUser" | "browseMerch" | "browseArtistConcerts" | "browseContent" | "browseSectionContainer" | "browseClientFeature" | "browseItem" | "browseAll" | "browsePage";
        /**
         * Collection of GraphQL definitions.
         */
        const Definitions: Record<Query | string, any>;
        /**
         * GraphQL query definitions. Subset of `Definitions` that are used as query requests.
         */
        const QueryDefinitions: Record<Query | string, any>;
        /**
         * GraphQL mutation definitions. Subset of `Definitions` that are used as mutation requests.
         */
        const MutationDefinitions: Record<Query | string, any>;
        /**
         * GraphQL response definitions. Subset of `Definitions` that are used as response types.
         */
        const ResponseDefinitions: Record<Query | string, any>;
        /**
         * Sends a GraphQL query to Spotify.
         * @description A preinitialized version of `Spicetify.GraphQL.Handler` using current context.
         * @param query Query to send
         * @param variables Variables to use
         * @param context Context to use
         * @return Promise that resolves to the response
         */
        function Request(query: typeof Definitions[Query | string], variables?: Record<string, any>, context?: Record<string, any>): Promise<any>;
        /**
         * Context for GraphQL queries.
         * @description Used to set context for the handler and initialze it.
         */
        const Context: Record<string, any>;
        /**
         * Handler for GraphQL queries.
         * @param context Context to use
         * @return Function to handle GraphQL queries
         */
        function Handler(context: Record<string, any>): (query: typeof Definitions[Query | string], variables?: Record<string, any>, context?: Record<string, any>) => Promise<any>;
    }

    namespace ReactHook {
        /**
         * React Hook to create interactive drag-and-drop element
         * @description Used to create a draggable element that can be dropped into Spotify's components (e.g. Playlist, Folder, Sidebar, Queue)
         * @param uris List of URIs to be dragged
         * @param label Label to be displayed when dragging
         * @param contextUri Context URI of the element from which the drag originated (e.g. Playlist URI)
         * @param sectionIndex Index of the section in which the drag originated
         * @param dropOriginUri URI of the desired drop target. Leave empty to allow drop anywhere
         * @return Function to handle drag event. Should be passed to `onDragStart` prop of the element. All parameters passed onto the hook will be passed onto the handler unless declared otherwise.
         *
         */
        function DragHandler(
            uris?: string[],
            label?: string,
            contextUri?: string,
            sectionIndex?: number,
            dropOriginUri?: string
        ): (event: React.DragEvent, uris?: string[], label?: string, contextUri?: string, sectionIndex?: number) => void;

        /**
         * React Hook to use panel state
         * @param id ID of the panel to use
         * @return Object with methods of the panel
         */
        function usePanelState(id: number): { toggle: () => void, isActive: boolean };

        /**
         * React Hook to use extracted color from GraphQL
         * 
         * @note This is a wrapper of ReactQuery's `useQuery` hook. 
         * The component using this hook must be wrapped in a `QueryClientProvider` component.
         * 
         * @see https://tanstack.com/query/v3/docs/react/reference/QueryClientProvider
         * 
         * @param uri URI of the Spotify image to extract color from.
         * @param fallbackColor Fallback color to use if the image is not available. Defaults to `#535353`.
         * @param variant Variant of the color to use. Defaults to `colorRaw`.
         * 
         * @return Extracted color hex code.
         */
        function useExtractedColor(uri: string, fallbackColor?: string, variant?: "colorRaw" | "colorLight" | "colorDark"): string;
    }

    /**
     * An API wrapper to interact with Spotify's Panel/right sidebar.
     */
    namespace Panel {
        /**
         * Properties that are used by the `registerPanel` function.
         */
        type PanelProps = {
            /**
             * Label of the Panel.
             */
            label?: string;
            /**
             * Children to render inside the Panel.
             * Must be a React Component.
             * Will be passed a `panel` prop with the Panel ID.
             */
            children: React.ReactNode;
            /**
             * Determine if the children passed is a custom Panel.
             * If true, the children will be rendered as is.
             * Note: All passed props except `children` will be ignored if enabled.
             *
             * @default false
             */
            isCustom?: boolean;
            /**
             * Inline styles to apply to the Panel skeleton.
             */
            style?: React.CSSProperties;
            /**
             * Additional class name to apply to the Panel content wrapper.
             */
            wrapperClassname?: string;
            /**
             * Additional class name to apply to the Panel header.
             */
            headerClassname?: string;
            /**
             * Font variant for the Panel header title.
             * @default "balladBold"
             */
            headerVariant?: Variant;
            /**
             * Semantic color name for the Panel header title.
             * @default "textBase"
             */
            headerSemanticColor?: SemanticColor;
            /**
             * Href for the header link.
             * Can be either a URI for a path within the app, or a URL for an external link.
             */
            headerLink?: string;
            /**
             * Additional actions to render in the header.
             * Will be rendered next to the close button.
             */
            headerActions?: React.ReactNode | React.ReactNode[];
            /**
             * Function to call when clicking on the header close button.
             * Called before the panel is closed.
             */
            headerOnClose?: () => void;
            /**
             * Prevent the panel from closing when clicking on the header close button.
             * @default false
             */
            headerPreventDefaultClose?: boolean;
            /**
             * Function to call when clicking on the header back button.
             * If not provided, the back button will not be rendered.
             * @param event Event object
             */
            headerOnBack?: (event: React.MouseEvent<HTMLButtonElement>) => void;
        };

        /**
         * An object of reserved panel IDs used by Spotify.
         */
        const reservedPanelIds: Record<string | number, string | number>;
        /**
         * Collection of React Components used by Spotify in the Panel.
         */
        const Components: {
            /**
             * React Component for the Panel's skeleton.
             *
             * Props:
             * @see Spicetify.ReactComponent.PanelSkeletonProps
             */
            PanelSkeleton: any;
            /**
             * React Component for the Panel's content.
             *
             * Props:
             * @see Spicetify.ReactComponent.PanelContentProps
             */
            PanelContent: any;
            /**
             * React Component for the Panel's header.
             *
             * Props:
             * @see Spicetify.ReactComponent.PanelHeaderProps
             */
            PanelHeader: any;
        }
        /**
         * Check whether or not a Panel with the provided ID is registered.
         * @param id Panel ID to check
         * @return Whether or not a Panel with the provided ID is registered
         */
        function hasPanel(id: number): boolean;
        /**
         * Get the Panel with the provided ID.
         * @param id Panel ID to get
         * @return Panel with the provided ID
         */
        function getPanel(id: number): React.ReactNode | undefined;
        /**
         * Set the Panel with the provided ID.
         * If the ID is not registered, it will be set to `0`.
         * @param id Panel ID to set
         */
        function setPanel(id: number): Promise<void>;
        /**
         * Subscribe to Panel changes.
         * @param callback Callback to call when Panel changes
         */
        function subPanelState(callback: (id: number) => void): void;
        /**
         * Register a new Panel.
         * An ID will be automatically assigned to the Panel.
         *
         * To make it easier and convenient for developers to use the Panel API, this method by default wraps the children passed into a Panel skeleton and content wrapper.
         *
         * If you wish to customize the Panel, you can pass `isCustom` as `true` to disable the default wrapper.
         *
         * @param props Properties of the Panel
         * @return Methods and properties of the Panel
         */
        function registerPanel(props: PanelProps): {
            /**
             * Assigned ID of the Panel.
             */
            id: number;
            /**
             * Function to toggle the Panel open/closed state.
             */
            toggle: () => Promise<void>;
            /**
             * Method to subscribe to the related Panel state.
             * Only fires when the related Panel open/closed state changes.
             */
            onStateChange: (callback: (isActive: boolean) => void) => void;
            /**
             * Boolean to determine if the Panel is open.
             */
            isActive: boolean;
        };
        /**
         * Function to render a Panel of the current ID.
         * If the ID is not registered or is reserved by Spotify, the function will return `null`.
         *
         * Used as a hook for Spotify internal component.
         * @return Panel of the current ID
         */
        function render(): React.ReactNode | null;
        /**
         * ID of the current Panel.
         * @return ID of the current Panel
         */
        const currentPanel: number;
    }

    /**
     * react-flip-toolkit
     * @description A lightweight magic-move library for configurable layout transitions.
     * @link https://github.com/aholachek/react-flip-toolkit
     */
    namespace ReactFlipToolkit {
        const Flipper: any;
        const Flipped: any;
        const spring: any;
    }

    /**
     * classnames
     * @description A simple JavaScript utility for conditionally joining classNames together.
     * @link https://github.com/JedWatson/classnames
     */
    function classnames(...args: any[]): string;

    /**
     * React Query v3
     * @description A hook for fetching, caching and updating asynchronous data in React.
     * @link https://github.com/TanStack/query/tree/v3
     */
    const ReactQuery: any;
}
