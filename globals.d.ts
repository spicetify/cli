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
            uri: string;
            isSuccessStatus(status: number): boolean;
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
    function showNotification(text: string, isError?: boolean, msTimeout?: number): void;
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
        public artist?: string;
        public album?: string;
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

        static isAd(uri: any): boolean;
        static isAlbum(uri: any): boolean;
        static isGenre(uri: any): boolean;
        static isQueue(uri: any): boolean;
        static isApplication(uri: any): boolean;
        static isArtist(uri: any): boolean;
        static isArtistToplist(uri: any): boolean;
        static isArtistConcerts(uri: any): boolean;
        static isAudioFile(uri: any): boolean;
        static isCollection(uri: any): boolean;
        static isCollectionAlbum(uri: any): boolean;
        static isCollectionArtist(uri: any): boolean;
        static isCollectionMissingAlbum(uri: any): boolean;
        static isCollectionTrackList(uri: any): boolean;
        static isConcert(uri: any): boolean;
        static isContextGroup(uri: any): boolean;
        static isDailyMix(uri: any): boolean;
        static isEmpty(uri: any): boolean;
        static isEpisode(uri: any): boolean;
        static isFacebook(uri: any): boolean;
        static isFolder(uri: any): boolean;
        static isFollowers(uri: any): boolean;
        static isFollowing(uri: any): boolean;
        static isImage(uri: any): boolean;
        static isInbox(uri: any): boolean;
        static isInterruption(uri: any): boolean;
        static isLibrary(uri: any): boolean;
        static isLive(uri: any): boolean;
        static isRoom(uri: any): boolean;
        static isExpression(uri: any): boolean;
        static isLocal(uri: any): boolean;
        static isLocalTrack(uri: any): boolean;
        static isLocalAlbum(uri: any): boolean;
        static isLocalArtist(uri: any): boolean;
        static isMerch(uri: any): boolean;
        static isMosaic(uri: any): boolean;
        static isPlaylist(uri: any): boolean;
        static isPlaylistV2(uri: any): boolean;
        static isPrerelease(uri: any): boolean;
        static isProfile(uri: any): boolean;
        static isPublishedRootlist(uri: any): boolean;
        static isRadio(uri: any): boolean;
        static isRootlist(uri: any): boolean;
        static isSearch(uri: any): boolean;
        static isShow(uri: any): boolean;
        static isSocialSession(uri: any): boolean;
        static isSpecial(uri: any): boolean;
        static isStarred(uri: any): boolean;
        static isStation(uri: any): boolean;
        static isTempPlaylist(uri: any): boolean;
        static isToplist(uri: any): boolean;
        static isTrack(uri: any): boolean;
        static isTrackset(uri: any): boolean;
        static isUserToplist(uri: any): boolean;
        static isUserTopTracks(uri: any): boolean;
        static isUnknown(uri: any): boolean;
        static isMedia(uri: any): boolean;
        static isQuestion(uri: any): boolean;
        static isPoll(uri: any): boolean;
        static isPlaylistV1OrV2(uri: any): boolean;
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
        class Button {
            constructor(label: string, icon: Icon | string, onClick: (self: Button) => void, disabled?: boolean, active?: boolean, registerOnCreate?: boolean);
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
}
