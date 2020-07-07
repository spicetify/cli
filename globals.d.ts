declare namespace Spicetify {
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
        function addEventListener(type: "songchange", callback: (event?: Event) => void): void;
        function addEventListener(type: "onplaypause", callback: (event?: Event) => void): void;
        function addEventListener(type: "onprogress", callback: (event?: Event | { data: number }) => void): void;
        function addEventListener(type: "appchange", callback: (event?: Event & {
            data: {
                /**
                 * App ID
                 */
                id: string;
                /**
                 * App URI
                 */
                uri: string;
            } & ({
                /**
                 * Whether app is embedded element or an Iframe
                 */
                isEmbeddedApp: true;

                /**
                 * App container HTML element or Iframe element
                 */
                container: HTMLElement;
            } | {
                /**
                 * Whether app is embedded element or an Iframe
                 */
                isEmbeddedApp: false;
                /**
                 * App container
                 */
                container: HTMLIFrameElement;
            })
        }) => void): void;
        /**
         * Skip to previous track.
         */
        function back(): void;
        /**
         * An object contains all information about current track and player.
         */
        const data: any;
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
    const BridgeAPI: any;
    const CosmosAPI: any;
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
     * Fetch interesting colors from track album art.
     * @param uri is optional. Leave it blank to get currrent track
     * or specify another track uri.
     */
    function getAblumArtColors(uri?: string): Promise<{
        DESATURATED: string;
        LIGHT_VIBRANT: string;
        PROMINENT: string;
        VIBRANT: string;
        VIBRANT_NON_ALARMING: string;
    }>;
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
    const Keyboard: any;

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
            /**
             * Change SubMenu name
             */
            setName(name: string): void;
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
     * Use to force playing a track/episode/album/show/playlist/artist URI.
     */
    namespace PlaybackControl {
        /**
         * Set either `index` or `trackUri`
         */
        interface ResolverOption {
            index?: number;
            trackUri?: string;
            seekTo?: number;
        }
        /**
         * Request to play a context through the cosmos track resolver.
         * @param contextUri Context URI.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playFromResolver(contextUri: string, playOptions: ResolverOption, callback?: Function): void;

        interface ContextObject {
            pages?: any;
            metadata?: {
                'zelda.context_uri': string;
            };
            entity_uri?: string;
            uri?: string;
            url?: string;
        }

        interface ContextOption {
            index?: number | null;
            range?: any;
            uid?: string;
            uri?: string;
            page?: number;
        }
        /**
         * Play a context directly, only supported on context player
         *
         * @param context Context object that CP can deal with.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playContext(context: ContextObject, playOptions: ContextOption, callback?: Function): void;
        /**
         * Update the player with a new context without changing what is currently
         * playing.
         *
         * @param context Context object that CP can deal with.
         * @param callback Optional callback function.
         */
        function updateContext(context: ContextObject, callback?: Function): void;

        interface PlaylistResolverOptions {
            context: string;
            uids?: string[];
            uid?: string;
            uris?: string[];
            trackUri?: string;
            // fills in source_start & source_end
            // example values: browse, playlist-owned-by-self-non-collaborative
            source?: string;
            // fills in referer
            // example values: spotify:app:browse
            referrerId?: string;
            // fills in referrer version
            referrerVersion?: string;
        }
        /**
         * Request to play a context through the playlist resolver.
         *
         * @param contextUri Context URI.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playFromPlaylistResolver(contextUri: string, playOptions: PlaylistResolverOptions, callback?: Function): void;

        interface CollectionResolverOption {
            context: string;
            index: number | null;
            // fills in source_start & source_end
            // example values: browse, playlist-owned-by-self-non-collaborative
            source?: string;
            // fills in referer
            // example values: spotify:app:browse
            referrerId?: string;
            // fills in referrer version
            referrerVersion?: string;
        }
        /**
         * Request to play a context through the collection resolver.
         *
         * @param contextUri Context URI.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playFromCollectionResolver(contextUri: string, playOptions: CollectionResolverOption, callback?: Function): void;

        /**
         * Request to play a single track.
         *
         * @param uri The track URI.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playTrack(uri: string, playOptions: Object, callback?: Function): void;

        interface RowsOption {
            index: number | null;
            range?: any;
            uid?: string;
            uri?: string;
            page?: number;
        }
        /**
         * Request to play tracks found in the list of rows.
         *
         * @param rows A live list of rows with tracks.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playRows(rows: any, playOptions: RowsOption, callback?: Function): void;
        /**
         * Request to play artist context.
         *
         * @param uri Context URI.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function playFromArtist(uri: string, playOptions: ResolverOption, callback?: Function): void;
        /**
         * Request to update the player with tracks from the provided rows list.
         * This will update the player silently without interrupting playback.
         *
         * @param rows A live list of rows with tracks.
         * @param playOptions An object with play options.
         * @param callback Optional callback function.
         */
        function updateWithRows(rows: any, playOptions: Object, callback?: Function): void;

        function pause(callback?: Function): void;
        function resume(callback?: Function): void;
        function skipPrev(callback?: Function): void;
        function skipNext(callback?: Function): void;
    }
    /**
     * Queue object contains list of queuing tracks,
     * history of played tracks and current track metadata.
     */
    const Queue: {
        next_tracks: any[];
        prev_tracks: any[];
        revision: string;
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
    }

    /**
     * Create custom menu item and prepend to right click context menu
     */
    namespace ContextMenu {
        type Icon = "add-to-playlist" | "add-to-queue" | "addfollow" | "addfollowers" | "addsuggestedsong" | "airplay" | "album" | "album-contained" | "arrow-down" | "arrow-left" | "arrow-right" | "arrow-up" | "artist" | "artist-active" | "attach" | "available-offline" | "ban" | "ban-active" | "block" | "bluetooth" | "browse" | "browse-active" | "camera" | "carplay" | "chart-down" | "chart-new" | "chart-up" | "check" | "check-alt" | "chevron-down" | "chevron-left" | "chevron-right" | "chevron-up" | "chromecast-connected" | "chromecast-connecting-one" | "chromecast-connecting-three" | "chromecast-connecting-two" | "chromecast-disconnected" | "collaborative-playlist" | "collection" | "collection-active" | "connect-to-devices" | "copy" | "destination-pin" | "device-arm" | "device-car" | "device-computer" | "device-mobile" | "device-multispeaker" | "device-other" | "device-speaker" | "device-tablet" | "device-tv" | "devices" | "devices-alt" | "discover" | "download" | "downloaded" | "drag-and-drop" | "edit" | "email" | "events" | "facebook" | "facebook-messenger" | "filter" | "flag" | "follow" | "fullscreen" | "games-console" | "gears" | "googleplus" | "grid-view" | "headphones" | "heart" | "heart-active" | "helpcircle" | "highlight" | "home" | "home-active" | "inbox" | "info" | "instagram" | "library" | "lightning" | "line" | "list-view" | "localfile" | "locked" | "locked-active" | "lyrics" | "make—available-offline" | "menu" | "messages" | "mic" | "minimise" | "mix" | "more" | "more-android" | "new-spotify-connect" | "new-volume" | "newradio" | "nikeplus" | "notifications" | "now-playing" | "now-playing-active" | "offline" | "offline-sync" | "pause" | "payment" | "paymenthistory" | "play" | "playback-speed-0point5x" | "playback-speed-0point8x" | "playback-speed-1point2x" | "playback-speed-1point5x" | "playback-speed-1x" | "playback-speed-2x" | "playback-speed-3x" | "playlist" | "playlist-folder" | "plus" | "plus-2px" | "plus-alt" | "podcasts" | "podcasts-active" | "public" | "queue" | "radio" | "radio-active" | "radioqueue" | "redeem" | "refresh" | "released" | "repeat" | "repeatonce" | "report-abuse" | "running" | "search" | "search-active" | "sendto" | "share" | "share-android" | "sharetofollowers" | "shows" | "shuffle" | "skip-back" | "skip-forward" | "skipback15" | "skipforward15" | "sleeptimer" | "sms" | "sort" | "sortdown" | "sortup" | "spotify-connect" | "spotify-connect-alt" | "spotifylogo" | "spotifypremium" | "star" | "star-alt" | "subtitles" | "tag" | "thumbs-down" | "thumbs-up" | "time" | "topcountry" | "track" | "trending" | "trending-active" | "tumblr" | "twitter" | "user" | "user-active" | "user-alt" | "user-circle" | "video" | "volume" | "volume-off" | "volume-onewave" | "volume-twowave" | "warning" | "watch" | "whatsapp" | "x" | "settings";

        // Single context menu item
        class Item {
            /**
             * List of valid icons to use.
             */
            static readonly iconList: Icon[];
            constructor(name: string, onClick: (uris: string[]) => void, shouldAdd: (uris: string[]) => boolean = (uris: string[]) => true, icon?: Icon);
            set name(text: string);
            set icon(name: Icon);
            /**
             * A function returning boolean determines whether item should be prepended.
             */
            set shouldAdd(func: (uris: string[]) => boolean);
            /**
             * A function to call when item is clicked
             */
            set onClick(func: (uris: string[]) => void);
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
            /**
             * List of valid icons to use.
             */
            static readonly iconList: Icon[];
            constructor(name: string, subItems: Iterable<Item>, shouldAdd = (uris) => true, icon?: Icon);
            set name(text: string);
            set icon(name: Icon);
            /**
             * Replace current `Item`s list
             */
            set items(items: Iterable<Item>);
            addItem: (item: Item) => void;
            removeItem: (item: Item) => void;
            /**
             * A function returning boolean determines whether item should be prepended.
             */
            set shouldAdd(func: (uris: string[]) => boolean);
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
     * Fetch and Override A/B test flags
     */
    namespace Abba {
        type Flag = {
            featureName: string;
            cell?: string;
        };

        /**
         * Get flag(s) value.
         */
        function getFlag(name: string | string[], callback: (flags: Flag[]) => void): void;
        /**
         * Get list of flags that is currently used by Spotify.
         */
        function getInUseFlags(callback: (flagNames: string[]) => void): void;
        /**
         * Get list all available flags.
         */
        function getAllFlags(callback: (flags: Flag[]) => void): void;
        /**
         * Get list of flags to be overrided and its their values.
         */
        function getOverrideFlags(): {[string]: string};
        /**
         * Add a flag that is going to be overrided.
         */
        function addOverrideFlag(name: string, value: string): void;
        /**
         * Remove a overrided flag.
         */
        function removeOverrideFlag(name: string): void;
    }
}
