declare namespace Spicetify {
	type Icon =
		| "addToPlaylist"
		| "addToQueue"
		| "album"
		| "artist"
		| "block"
		| "brightness"
		| "car"
		| "chart-down"
		| "chart-up"
		| "check"
		| "check-alt-fill"
		| "chevron-left"
		| "chevron-right"
		| "chromecast-disconnected"
		| "clock"
		| "collapseLibrary"
		| "collaborative"
		| "computer"
		| "connectDevice"
		| "copy"
		| "create"
		| "credits"
		| "download"
		| "downloaded"
		| "edit"
		| "enhance"
		| "enterFullScreen"
		| "exclamation-circle"
		| "excludeTaste"
		| "expandLibrary"
		| "external-link"
		| "facebook"
		| "follow"
		| "friendActivity"
		| "fullscreen"
		| "gamepad"
		| "goToAlbum"
		| "goToArtist"
		| "grid-view"
		| "heart"
		| "heart-active"
		| "heartAdd"
		| "instagram"
		| "laptop"
		| "library"
		| "list-view"
		| "location"
		| "locked"
		| "locked-active"
		| "lyrics"
		| "menu"
		| "minimize"
		| "miniplayer"
		| "minus"
		| "more"
		| "new-spotify-connect"
		| "nowPlaying"
		| "offline"
		| "openDesktop"
		| "pause"
		| "phone"
		| "play"
		| "playlist"
		| "playlist-folder"
		| "plus-alt"
		| "plus2px"
		| "podcasts"
		| "projector"
		| "queue"
		| "radio"
		| "repeat"
		| "repeat-once"
		| "search"
		| "search-active"
		| "share"
		| "shuffle"
		| "skip-back"
		| "skip-back15"
		| "skip-forward"
		| "skip-forward15"
		| "skipBack"
		| "skipForward"
		| "smartShuffle"
		| "soundbetter"
		| "speaker"
		| "spotify"
		| "subtitles"
		| "tablet"
		| "ticket"
		| "twitter"
		| "visualizer"
		| "voice"
		| "volume"
		| "volume-off"
		| "volume-one-wave"
		| "volumeHigh"
		| "volume-two-wave"
		| "watch"
		| "whatsNew"
		| "x";
	type Variant =
		| "bass"
		| "forte"
		| "brio"
		| "altoBrio"
		| "alto"
		| "canon"
		| "celloCanon"
		| "cello"
		| "ballad"
		| "balladBold"
		| "viola"
		| "violaBold"
		| "mesto"
		| "mestoBold"
		| "metronome"
		| "finale"
		| "finaleBold"
		| "minuet"
		| "minuetBold";
	type SemanticColor =
		| "textBase"
		| "textSubdued"
		| "textBrightAccent"
		| "textNegative"
		| "textWarning"
		| "textPositive"
		| "textAnnouncement"
		| "essentialBase"
		| "essentialSubdued"
		| "essentialBrightAccent"
		| "essentialNegative"
		| "essentialWarning"
		| "essentialPositive"
		| "essentialAnnouncement"
		| "decorativeBase"
		| "decorativeSubdued"
		| "backgroundBase"
		| "backgroundHighlight"
		| "backgroundPress"
		| "backgroundElevatedBase"
		| "backgroundElevatedHighlight"
		| "backgroundElevatedPress"
		| "backgroundTintedBase"
		| "backgroundTintedHighlight"
		| "backgroundTintedPress"
		| "backgroundUnsafeForSmallTextBase"
		| "backgroundUnsafeForSmallTextHighlight"
		| "backgroundUnsafeForSmallTextPress";
	type ColorSet =
		| "base"
		| "brightAccent"
		| "negative"
		| "warning"
		| "positive"
		| "announcement"
		| "invertedDark"
		| "invertedLight"
		| "mutedAccent"
		| "overMedia";
	type ColorSetBackgroundColors = {
		base: string;
		highlight: string;
		press: string;
	};
	type ColorSetNamespaceColors = {
		announcement: string;
		base: string;
		brightAccent: string;
		negative: string;
		positive: string;
		subdued: string;
		warning: string;
	};
	type ColorSetBody = {
		background: ColorSetBackgroundColors & {
			elevated: ColorSetBackgroundColors;
			tinted: ColorSetBackgroundColors;
			unsafeForSmallText: ColorSetBackgroundColors;
		};
		decorative: {
			base: string;
			subdued: string;
		};
		essential: ColorSetNamespaceColors;
		text: ColorSetNamespaceColors;
	};
	type Metadata = Partial<Record<string, string>>;
	type ContextTrack = {
		uri: string;
		uid?: string;
		metadata?: Metadata;
	};
	type PlayerState = {
		timestamp: number;
		context: PlayerContext;
		index: PlayerIndex;
		item: PlayerTrack;
		shuffle: boolean;
		smartShuffle: boolean;
		repeat: number;
		speed: number;
		positionAsOfTimestamp: number;
		duration: number;
		hasContext: boolean;
		isPaused: boolean;
		isBuffering: boolean;
		restrictions: Restrictions;
		previousItems?: PlayerTrack[];
		nextItems?: PlayerTrack[];
		playbackQuality: PlaybackQuality;
		playbackId: string;
		sessionId: string;
		signals?: any[];
	};
	type PlayerContext = {
		uri: string;
		url: string;
		metadata: {
			"player.arch": string;
		};
	};
	type PlayerIndex = {
		pageURI?: string | null;
		pageIndex: number;
		itemIndex: number;
	};
	type PlayerTrack = {
		type: string;
		uri: string;
		uid: string;
		name: string;
		mediaType: string;
		duration: {
			milliseconds: number;
		};
		album: Album;
		artists?: ArtistsEntity[];
		isLocal: boolean;
		isExplicit: boolean;
		is19PlusOnly: boolean;
		provider: string;
		metadata: TrackMetadata;
		images?: ImagesEntity[];
	};
	type TrackMetadata = {
		artist_uri: string;
		entity_uri: string;
		iteration: string;
		title: string;
		"collection.is_banned": string;
		"artist_uri:1": string;
		"collection.in_collection": string;
		image_small_url: string;
		"collection.can_ban": string;
		is_explicit: string;
		album_disc_number: string;
		album_disc_count: string;
		track_player: string;
		album_title: string;
		"canvas.artist.avatar": string;
		"canvas.artist.name": string;
		"canvas.artist.uri": string;
		"canvas.canvasUri": string;
		"canvas.entityUri": string;
		"canvas.explicit": string;
		"canvas.fileId": string;
		"canvas.id": string;
		"canvas.type": string;
		"canvas.uploadedBy": string;
		"canvas.url": string;
		"collection.can_add": string;
		image_large_url: string;
		"actions.skipping_prev_past_track": string;
		page_instance_id: string;
		image_xlarge_url: string;
		marked_for_download: string;
		"actions.skipping_next_past_track": string;
		context_uri: string;
		"artist_name:1": string;
		has_lyrics: string;
		interaction_id: string;
		image_url: string;
		album_uri: string;
		album_artist_name: string;
		album_track_number: string;
		artist_name: string;
		duration: string;
		album_track_count: string;
		popularity: string;
		associated_video_id: string;
		video_association: string;
		video_association_image: string;
		video_association_image_height: string;
		video_association_image_height_large: string;
		video_association_image_height_xxlarge: string;
		video_association_image_large: string;
		video_association_image_width: string;
		video_association_image_width_large: string;
		video_association_image_width_xxlarge: string;
		video_association_image_xxlarge: string;
		[key: string]: string;
	};
	type Album = {
		type: string;
		uri: string;
		name: string;
		images?: ImagesEntity[];
	};
	type ImagesEntity = {
		url: string;
		label: string;
	};
	type ArtistsEntity = {
		type: string;
		uri: string;
		name: string;
	};
	type Restrictions = {
		canPause: boolean;
		canResume: boolean;
		canSeek: boolean;
		canSkipPrevious: boolean;
		canSkipNext: boolean;
		canToggleRepeatContext: boolean;
		canToggleRepeatTrack: boolean;
		canToggleShuffle: boolean;
		disallowPausingReasons?: string[];
		disallowResumingReasons?: string[];
		disallowSeekingReasons?: string[];
		disallowSkippingPreviousReasons?: string[];
		disallowSkippingNextReasons?: string[];
		disallowTogglingRepeatContextReasons?: string[];
		disallowTogglingRepeatTrackReasons?: string[];
		disallowTogglingShuffleReasons?: string[];
		disallowTransferringPlaybackReasons?: string[];
	};
	type PlaybackQuality = {
		bitrateLevel: number;
		strategy: number;
		targetBitrateLevel: number;
		targetBitrateAvailable: boolean;
		hifiStatus: number;
	};
	namespace Player {
		/**
		 *
		 * Contains vast array of internal APIs.
		 * Please explore in Devtool Console.
		 */
		const origin: any;
		/**
		 * Register a listener `type` on Spicetify.Player.
		 *
		 * On default, `Spicetify.Player` always dispatch:
		 *  - `songchange` type when player changes track.
		 *  - `onplaypause` type when player plays or pauses.
		 *  - `onprogress` type when track progress changes.
		 */
		function addEventListener(type: string, callback: (event?: Event) => void): void;
		function addEventListener(type: "songchange", callback: (event?: Event & { data: PlayerState | null }) => void): void;
		function addEventListener(type: "onplaypause", callback: (event?: Event & { data: PlayerState | null }) => void): void;
		function addEventListener(type: "onprogress", callback: (event?: Event & { data: number }) => void): void;
		/**
		 * Skip to previous track.
		 */
		function back(): void;
		/**
		 * An object contains all information about current track and player.
		 * `null` while the player has no current item, and unset until the player first reports a track.
		 */
		const data: PlayerState | null;
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
		 *
		 * @return `false` if a listener called `preventDefault()` on the event, `true` otherwise.
		 */
		function dispatchEvent(event: Event): boolean;
		const eventListeners: {
			[key: string]: Array<(event?: Event) => void>;
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
		 * Add the current track to, or remove it from, the user's Liked Songs.
		 * @param state
		 */
		function setHeart(state: boolean): void;
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
		function sub(
			url: string,
			callback: (b: Response["body"]) => void,
			onError?: (e: Error) => void,
			body?: Body,
			headers?: Headers
		): Promise<Response["body"]>;
		function postSub(
			url: string,
			body: Body | null,
			callback: (b: Response["body"]) => void,
			onError?: (e: Error) => void
		): Promise<Response["body"]>;
		function request(method: Method, url: string, body?: Body, headers?: Headers): Promise<Response>;
		function resolve(method: Method, url: string, body?: Body, headers?: Headers): Promise<Response>;
	}
	/**
	 * Fetch interesting colors from URI.
	 * @param uri Any type of URI that has artwork (playlist, track, album, artist, show, ...)
	 * @return The color presets, or `null` when Spotify returns none for the URI.
	 */
	function colorExtractor(uri: string): Promise<{
		DARK_VIBRANT: string;
		DESATURATED: string;
		LIGHT_VIBRANT: string;
		PROMINENT: string;
		VIBRANT: string;
		VIBRANT_NON_ALARMING: string;
	} | null>;
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
		type ValidKey =
			| "BACKSPACE"
			| "TAB"
			| "ENTER"
			| "SHIFT"
			| "CTRL"
			| "ALT"
			| "CAPS"
			| "ESCAPE"
			| "SPACE"
			| "PAGE_UP"
			| "PAGE_DOWN"
			| "END"
			| "HOME"
			| "ARROW_LEFT"
			| "ARROW_UP"
			| "ARROW_RIGHT"
			| "ARROW_DOWN"
			| "INSERT"
			| "DELETE"
			| "A"
			| "B"
			| "C"
			| "D"
			| "E"
			| "F"
			| "G"
			| "H"
			| "I"
			| "J"
			| "K"
			| "L"
			| "M"
			| "N"
			| "O"
			| "P"
			| "Q"
			| "R"
			| "S"
			| "T"
			| "U"
			| "V"
			| "W"
			| "X"
			| "Y"
			| "Z"
			| "WINDOW_LEFT"
			| "WINDOW_RIGHT"
			| "SELECT"
			| "NUMPAD_0"
			| "NUMPAD_1"
			| "NUMPAD_2"
			| "NUMPAD_3"
			| "NUMPAD_4"
			| "NUMPAD_5"
			| "NUMPAD_6"
			| "NUMPAD_7"
			| "NUMPAD_8"
			| "NUMPAD_9"
			| "MULTIPLY"
			| "ADD"
			| "SUBTRACT"
			| "DECIMAL_POINT"
			| "DIVIDE"
			| "F1"
			| "F2"
			| "F3"
			| "F4"
			| "F5"
			| "F6"
			| "F7"
			| "F8"
			| "F9"
			| "F10"
			| "F11"
			| "F12"
			| ";"
			| "="
			| ","
			| "-"
			| "."
			| "/"
			| "`"
			| "["
			| "\\"
			| "]"
			| '"'
			| "~"
			| "!"
			| "@"
			| "#"
			| "$"
			| "%"
			| "^"
			| "&"
			| "*"
			| "("
			| ")"
			| "_"
			| "+"
			| ":"
			| "'"
			| "<"
			| ">"
			| "?"
			| "|";
		type KeysDefine =
			| string
			| {
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
	 * React-based menu items injected into Spotify's own menus.
	 * `Spicetify.ContextMenu` and `Spicetify.Menu` are built on these classes.
	 */
	namespace ContextMenuV2 {
		/**
		 * Value Spicetify provides around each Spotify menu while it renders.
		 * Outside a menu the fields are absent.
		 */
		type Context = {
			/**
			 * Props Spotify passed to the menu. They carry the target's `uri`/`uris`, `uid`/`uids` and `contextUri`, or the
			 * `item`/`reference`/`context` objects those are read from.
			 */
			props?: any;
			/**
			 * What opened the menu, e.g. `"right-click"` or `"click"`.
			 */
			trigger?: string;
			/**
			 * Element the menu was opened from.
			 */
			target?: HTMLElement;
		};
		/**
		 * Decides whether an item is added to the menu being rendered. Called with the fields of `Context`.
		 */
		type ShouldAddCallback = (props: any, trigger?: string, target?: HTMLElement) => boolean;
		/**
		 * Entries of a sub menu.
		 * The sub menu renders them with `Array.prototype.filter`, while `addItem` and `removeItem` call `Set.prototype.add` and
		 * `Set.prototype.delete`, so only an array renders and only a Set can be changed after construction.
		 */
		type SubMenuItems = Array<Item | ItemSubMenu> | Set<Item | ItemSubMenu>;

		/**
		 * React context Spicetify provides around Spotify's menus. Created by Spotify's patched menu code, or once the webpack
		 * modules load, whichever comes first.
		 */
		let _context: React.Context<Context | null> | undefined;

		/**
		 * Extract `[uris, uids, contextUri]` from Spotify menu props.
		 * @return `undefined` if the props carry no URI.
		 */
		function parseProps(props: any): [uris: string[], uids: string[] | undefined, contextUri: string | undefined] | undefined;
		/**
		 * Add a React element to every Spotify menu for which `shouldAdd` returns true.
		 */
		function registerItem(item: React.ReactElement, shouldAdd?: ShouldAddCallback): void;
		/**
		 * Remove an element added with `registerItem`.
		 */
		function unregisterItem(item: React.ReactElement): void;
		/**
		 * Elements Spicetify injects into the menu being rendered. Called from Spotify's patched menu code.
		 */
		function renderItems(): React.ReactElement[];

		/**
		 * A single menu item. Changing a property re-renders the item if it is on screen.
		 */
		class Item {
			constructor(options: {
				children: React.ReactNode;
				/**
				 * @default false
				 */
				disabled?: boolean;
				leadingIcon?: Icon | string;
				trailingIcon?: Icon | string;
				divider?: "before" | "after" | "both";
				onClick: (context: Context, self: Item, event: React.MouseEvent<HTMLButtonElement>) => void;
				/**
				 * @default () => true
				 */
				shouldAdd?: ShouldAddCallback;
			});
			/**
			 * Read when `register` is called, so changing it afterwards has no effect until the item is registered again.
			 */
			shouldAdd: ShouldAddCallback;
			children: React.ReactNode;
			disabled: boolean;
			/**
			 * Name of an `SVGIcons` entry, or raw SVG markup.
			 */
			leadingIcon: Icon | string | undefined;
			/**
			 * Name of an `SVGIcons` entry, or raw SVG markup.
			 */
			trailingIcon: Icon | string | undefined;
			divider: "before" | "after" | "both" | undefined;
			/**
			 * Start adding the item to menus.
			 */
			register(): void;
			/**
			 * Stop adding the item to menus.
			 */
			deregister(): void;
		}

		/**
		 * A menu item that opens a nested menu.
		 */
		class ItemSubMenu {
			/**
			 * Elements for the entries of `items` whose `shouldAdd` returns true. Sets each nested `ItemSubMenu`'s `depth` to
			 * `parentDepth + 1`.
			 */
			static itemsToComponents(
				items: Array<Item | ItemSubMenu>,
				props: any,
				trigger?: string,
				target?: HTMLElement,
				parentDepth?: number
			): React.ReactElement[];
			constructor(options: {
				text: React.ReactNode;
				/**
				 * @default false
				 */
				disabled?: boolean;
				leadingIcon?: Icon | string;
				divider?: "before" | "after" | "both";
				items: SubMenuItems;
				/**
				 * @default 1
				 */
				depth?: number;
				/**
				 * @default () => true
				 */
				shouldAdd?: ShouldAddCallback;
			});
			/**
			 * Read when `register` is called, so changing it afterwards has no effect until the sub menu is registered again.
			 */
			shouldAdd: ShouldAddCallback;
			text: React.ReactNode;
			disabled: boolean;
			/**
			 * Name of an `SVGIcons` entry, or raw SVG markup.
			 */
			leadingIcon: Icon | string | undefined;
			divider: "before" | "after" | "both" | undefined;
			/**
			 * Nesting level, used by Spotify to place the nested menu.
			 */
			depth: number;
			/**
			 * Add an entry. Requires `items` to have been a Set.
			 */
			addItem(item: Item | ItemSubMenu): void;
			/**
			 * Remove an entry. Requires `items` to have been a Set.
			 */
			removeItem(item: Item | ItemSubMenu): void;
			/**
			 * Start adding the sub menu to menus.
			 */
			register(): void;
			/**
			 * Stop adding the sub menu to menus.
			 */
			deregister(): void;
		}
	}

	/**
	 * To create and prepend custom menu item in profile menu.
	 */
	namespace Menu {
		/**
		 * Create a single toggle.
		 */
		class Item extends ContextMenuV2.Item {
			/**
			 * @param children Item label
			 * @param isEnabled Whether the item shows a tick
			 * @param onClick Called with the item when it is clicked
			 * @param leadingIcon Name of an `SVGIcons` entry, or raw SVG markup
			 */
			constructor(children: React.ReactNode, isEnabled: boolean, onClick: (self: Item) => void, leadingIcon?: Icon | string);
			/**
			 * Visually, item has a tick next to it if its state is enabled. Setting it sets `trailingIcon`.
			 */
			isEnabled: boolean;
			/**
			 * Change item enabled state. Same as setting `isEnabled`.
			 */
			setState(isEnabled: boolean): void;
		}

		/**
		 * Create a sub menu to contain Item toggles.
		 * `Item`s in `items` shouldn't be registered.
		 */
		class SubMenu extends ContextMenuV2.ItemSubMenu {
			/**
			 * @param name Sub menu label
			 * @param items Entries of the sub menu, see `ContextMenuV2.SubMenuItems`
			 * @param icon Name of an `SVGIcons` entry, or raw SVG markup
			 */
			constructor(name: string, items: ContextMenuV2.SubMenuItems, icon?: Icon | string);
			/**
			 * Sub menu label. Alias of `text`.
			 */
			name: string;
			/**
			 * Name of an `SVGIcons` entry, or raw SVG markup. Alias of `leadingIcon`.
			 */
			icon: Icon | string | undefined;
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
		static collectionArtistURI(username: string, id: string): URI;

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
		static trackURI(id: string, anchor: string, context?: string, play?: boolean): URI;

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
		class Item extends ContextMenuV2.Item {
			/**
			 * List of valid icons to use.
			 */
			static readonly iconList: Icon[];
			/**
			 * @param name Item label
			 * @param onClick Called with the target's URIs when the item is clicked
			 * @param shouldAdd Decides from the target's URIs whether the item is added. Defaults to always.
			 * @param icon Leading icon: name of an `SVGIcons` entry, or raw SVG markup
			 * @param trailingIcon Trailing icon: name of an `SVGIcons` entry, or raw SVG markup
			 * @param disabled Defaults to `false`
			 */
			constructor(
				name: string,
				onClick: OnClickCallback,
				shouldAdd?: ShouldAddCallback,
				icon?: Icon | string,
				trailingIcon?: Icon | string,
				disabled?: boolean
			);
			/**
			 * Item label. Alias of `children`.
			 */
			name: string;
			/**
			 * Name of an `SVGIcons` entry, or raw SVG markup. Alias of `leadingIcon`.
			 */
			icon: Icon | string | undefined;
		}

		/**
		 * Create a sub menu to contain `Item`s.
		 * `Item`s in `items` shouldn't be registered.
		 */
		class SubMenu extends ContextMenuV2.ItemSubMenu {
			/**
			 * List of valid icons to use.
			 */
			static readonly iconList: Icon[];
			/**
			 * @param name Sub menu label
			 * @param items Entries of the sub menu, see `ContextMenuV2.SubMenuItems`
			 * @param shouldAdd Decides from the target's URIs whether the sub menu is added. Defaults to always.
			 * @param disabled Defaults to `false`
			 * @param icon Leading icon: name of an `SVGIcons` entry, or raw SVG markup
			 */
			constructor(
				name: string,
				items: ContextMenuV2.SubMenuItems,
				shouldAdd?: ShouldAddCallback,
				disabled?: boolean,
				icon?: Icon | string
			);
			/**
			 * Sub menu label. Alias of `text`.
			 */
			name: string;
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
			 * or a HTML element for interactive config/setting menu,
			 * or a React JSX element for React-based components
			 */
			content: string | Element | React.JSX.Element;
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
	/** React DOM Server instance to render components to string */
	const ReactDOMServer: any;
	/** React JSX runtime instance to transform JSX elements */
	const ReactJSX: any;

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
			trigger?: "click" | "right-click";
			/**
			 * Determins is the context menu should open or toggle when triggered
			 */
			action?: "toggle" | "open";
			/**
			 * The preferred placement of the context menu when it opens.
			 * Relative to trigger element.
			 */
			placement?:
				| "top"
				| "top-start"
				| "top-end"
				| "right"
				| "right-start"
				| "right-end"
				| "bottom"
				| "bottom-start"
				| "bottom-end"
				| "left"
				| "left-start"
				| "left-end";
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
			menu:
				| typeof Spicetify.ReactComponent.Menu
				| typeof Spicetify.ReactComponent.AlbumMenu
				| typeof Spicetify.ReactComponent.PodcastShowMenu
				| typeof Spicetify.ReactComponent.ArtistMenu
				| typeof Spicetify.ReactComponent.PlaylistMenu;
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
		};
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
			divider?: "before" | "after" | "both";
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
			label: string | React.ReactNode;
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
			placement?:
				| "top"
				| "top-start"
				| "top-end"
				| "right"
				| "right-start"
				| "right-end"
				| "bottom"
				| "bottom-start"
				| "bottom-end"
				| "left"
				| "left-start"
				| "left-end";
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
		};
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
		};
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
		};
		type SliderProps = {
			/**
			 * Label for the slider.
			 */
			labelText?: string;
			/**
			 * The current value of the slider.
			 */
			value: number;
			/**
			 * The minimum value of the slider.
			 */
			min: number;
			/**
			 * The maximum value of the slider.
			 */
			max: number;
			/**
			 * The step value of the slider.
			 */
			step: number;
			/**
			 * Whether or not the slider is disabled/can be interacted with.
			 * @default true
			 */
			isInteractive?: boolean;
			/**
			 * Whether or not the active style of the slider should be shown.
			 * This is equivalent to the slider being focused/hovered.
			 * @default false
			 */
			forceActiveStyles?: boolean;
			/**
			 * Callback function that is called when the slider starts being dragged.
			 *
			 * @param {number} value The current value of the slider in percent.
			 */
			onDragStart: (value: number) => void;
			/**
			 * Callback function that is called when the slider is being dragged.
			 *
			 * @param {number} value The current value of the slider in percent.
			 */
			onDragMove: (value: number) => void;
			/**
			 * Callback function that is called when the slider stops being dragged.
			 *
			 * @param {number} value The current value of the slider in percent.
			 */
			onDragEnd: (value: number) => void;
			/**
			 * Callback function that is called when the slider incremented a step.
			 *
			 * @deprecated Use `onDrag` props instead.
			 */
			onStepForward?: () => void;
			/**
			 * Callback function that is called when the slider decremented a step.
			 *
			 * @deprecated Use `onDrag` props instead.
			 */
			onStepBackward?: () => void;
		};
		type ButtonProps = {
			component: any;
			/**
			 * Color set for the button.
			 * @default "brightAccent"
			 */
			colorSet?: ColorSet;
			/**
			 * Size for the button.
			 * @default "md"
			 */
			buttonSize?: "sm" | "md" | "lg";
			/**
			 * Size for the button.
			 * @deprecated Use `buttonSize` prop instead, as it will take precedence.
			 * @default "medium"
			 */
			size?: "small" | "medium" | "large";
			/**
			 * Unused by Spotify. Usage unknown.
			 */
			fullWidth?: any;
			/**
			 * React component to render for an icon placed before children. Component, not element!
			 */
			iconLeading?: (props: any) => any | string;
			/**
			 * React component to render for an icon placed after children. Component, not element!
			 */
			iconTrailing?: (props: any) => any | string;
			/**
			 * React component to render for an icon used as button body. Component, not element!
			 */
			iconOnly?: (props: any) => any | string;
			/**
			 * Additional class name to apply to the button.
			 */
			className?: string;
			/**
			 * Label of the element for screen readers.
			 */
			"aria-label"?: string;
			/**
			 * ID of an element that describes the button for screen readers.
			 */
			"aria-labelledby"?: string;
			/**
			 * Unsafely set the color set for the button.
			 * Values from the colorSet will be pasted into the CSS.
			 */
			UNSAFE_colorSet?: ColorSetBody;
			onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
			onMouseEnter?: (event: React.MouseEvent<HTMLButtonElement>) => void;
			onMouseLeave?: (event: React.MouseEvent<HTMLButtonElement>) => void;
			onMouseDown?: (event: React.MouseEvent<HTMLButtonElement>) => void;
			onMouseUp?: (event: React.MouseEvent<HTMLButtonElement>) => void;
			onFocus?: (event: React.FocusEvent<HTMLButtonElement>) => void;
			onBlur?: (event: React.FocusEvent<HTMLButtonElement>) => void;
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
		const TrackMenu: any;
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
		 * Component to render Spotify slider
		 *
		 * Used in progress bar, volume slider, crossfade settings, etc.
		 *
		 * Props:
		 * @see Spicetify.ReactComponent.SliderProps
		 */
		const Slider: any;
		/**
		 * Component to render Spotify primary button
		 *
		 * Props:
		 * @see Spicetify.ReactComponent.ButtonProps
		 */
		const ButtonPrimary: any;
		/**
		 * Component to render Spotify secondary button
		 *
		 * Props:
		 * @see Spicetify.ReactComponent.ButtonProps
		 */
		const ButtonSecondary: any;
		/**
		 * Component to render Spotify tertiary button
		 *
		 * Props:
		 * @see Spicetify.ReactComponent.ButtonProps
		 */
		const ButtonTertiary: any;
		/**
		 * Component Spotify uses for a menu item that opens a nested menu.
		 * Used by `Spicetify.ContextMenuV2.ItemSubMenu`.
		 */
		const MenuSubMenuItem: any;
		/**
		 * Provider of Spotify's remote configuration
		 */
		const RemoteConfigProvider: any;
		/**
		 * Spotify snackbar building blocks
		 */
		const Snackbar: {
			wrapper: any;
			simpleLayout: any;
			ctaText: any;
			styledImage: any;
		};
		/**
		 * Component to render Spotify chip
		 */
		const Chip: any;
		/**
		 * Component to render Spotify dropdown
		 */
		const Dropdown: any;
		/**
		 * Component to render Spotify toggle switch
		 */
		const Toggle: any;
		/**
		 * Card components from Spotify library. A key is `undefined` when its component was not found in this Spotify version.
		 */
		const Cards: {
			Default: any;
			FeatureCard: any;
			Hero: any;
			CardImage: any;
			Album: any;
			Artist: any;
			Audiobook: any;
			Episode: any;
			Playlist: any;
			Profile: any;
			Show: any;
			Track: any;
		};
		/**
		 * React Router components used by Spotify
		 */
		const Router: any;
		const Routes: any;
		const Route: any;
		/**
		 * Redux store provider used by Spotify
		 */
		const StoreProvider: any;
		/**
		 * Horizontally scrolling container with chevron buttons, implemented by Spicetify
		 */
		const ScrollableContainer: any;
		/**
		 * Spotify's in-app navigation link component, taking the route in `to`
		 */
		const Navigation: any;
	}

	/**
	 * Add button in top bar next to navigation buttons
	 */
	namespace Topbar {
		/**
		 * The button is added as soon as it is created. There is no way to remove it other than removing `element`.
		 */
		class Button {
			/**
			 * @param label Tooltip and `aria-label`
			 * @param icon Name of an `SVGIcons` entry, or raw SVG markup
			 * @param onClick Called with the button when it is clicked
			 * @param disabled Defaults to `false`
			 * @param isRight Add the button to the right-side action buttons instead of next to the navigation buttons. Defaults to `false`.
			 */
			constructor(label: string, icon: Icon | string, onClick: (self: Button) => void, disabled?: boolean, isRight?: boolean);
			label: string;
			/**
			 * Set with an `SVGIcons` name or SVG markup; reads back the SVG markup rendered into `button`.
			 */
			icon: string;
			onClick: (self: Button) => void;
			disabled: boolean;
			/**
			 * Wrapper element added to the top bar, containing `button`.
			 */
			element: HTMLDivElement;
			/**
			 * The button itself.
			 */
			button: HTMLButtonElement;
			/**
			 * Tooltip instance, or `undefined` if `Spicetify.Tippy` was not available when the button was created.
			 */
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
			constructor(
				label: string,
				icon: Icon | string,
				onClick?: (self: Button) => void,
				disabled?: boolean,
				active?: boolean,
				registerOnCreate?: boolean
			);
			label: string;
			icon: string;
			onClick: (self: Button) => void;
			disabled: boolean;
			active: boolean;
			element: HTMLButtonElement;
			/**
			 * Element inside `element` that holds the icon markup.
			 */
			iconElement: HTMLSpanElement;
			tippy: any;
			register: () => void;
			deregister: () => void;
		}

		/**
		 * Create a widget next to track info
		 */
		class Widget {
			constructor(
				label: string,
				icon: Icon | string,
				onClick?: (self: Widget) => void,
				disabled?: boolean,
				active?: boolean,
				registerOnCreate?: boolean
			);
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
	 * Interface for interacting with Spotify client's app title.
	 * Available once `Spicetify.Platform.UserAPI` has loaded.
	 */
	namespace AppTitle {
		/**
		 * Subscription returned by Spotify's product state service.
		 */
		type Subscription = {
			/**
			 * Stop the subscription.
			 */
			cancel: () => void;
		};
		/**
		 * Set default app title. This has no effect if the player is running.
		 * Will override any previous forced title.
		 * @param title Title to set
		 * @return Promise that resolves to the subscription that keeps re-applying the title.
		 * Cancelling it stops forcing the title; it doesn't reset the title.
		 */
		function set(title: string): Promise<Subscription>;
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
		 * @return Subscription to cancel to unsubscribe
		 */
		function sub(callback: (title: string) => void): Subscription;
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
		type Query =
			| "decorateItemsForEnhance"
			| "imageURLAndSize"
			| "imageSources"
			| "audioItems"
			| "creator"
			| "extractedColors"
			| "extractedColorsAndImageSources"
			| "fetchExtractedColorAndImageForAlbumEntity"
			| "fetchExtractedColorAndImageForArtistEntity"
			| "fetchExtractedColorAndImageForEpisodeEntity"
			| "fetchExtractedColorAndImageForPlaylistEntity"
			| "fetchExtractedColorAndImageForPodcastEntity"
			| "fetchExtractedColorAndImageForTrackEntity"
			| "fetchExtractedColorForAlbumEntity"
			| "fetchExtractedColorForArtistEntity"
			| "fetchExtractedColorForEpisodeEntity"
			| "fetchExtractedColorForPlaylistEntity"
			| "fetchExtractedColorForPodcastEntity"
			| "fetchExtractedColorForTrackEntity"
			| "getAlbumNameAndTracks"
			| "getEpisodeName"
			| "getTrackName"
			| "queryAlbumTrackUris"
			| "queryTrackArtists"
			| "decorateContextEpisodesOrChapters"
			| "decorateContextTracks"
			| "fetchTracksForRadioStation"
			| "decoratePlaylists"
			| "playlistUser"
			| "FetchPlaylistMetadata"
			| "playlistContentsItemTrackArtist"
			| "playlistContentsItemTrackAlbum"
			| "playlistContentsItemTrack"
			| "playlistContentsItemLocalTrack"
			| "playlistContentsItemEpisodeShow"
			| "playlistContentsItemEpisode"
			| "playlistContentsItemResponse"
			| "playlistContentsItem"
			| "FetchPlaylistContents"
			| "episodeTrailerUri"
			| "podcastEpisode"
			| "podcastMetadataV2"
			| "minimalAudiobook"
			| "audiobookChapter"
			| "audiobookMetadataV2"
			| "fetchExtractedColors"
			| "queryFullscreenMode"
			| "queryNpvEpisode"
			| "queryNpvArtist"
			| "albumTrack"
			| "getAlbum"
			| "queryAlbumTracks"
			| "queryArtistOverview"
			| "queryArtistAppearsOn"
			| "discographyAlbum"
			| "albumMetadataReleases"
			| "albumMetadata"
			| "queryArtistDiscographyAlbums"
			| "queryArtistDiscographySingles"
			| "queryArtistDiscographyCompilations"
			| "queryArtistDiscographyAll"
			| "queryArtistDiscographyOverview"
			| "artistPlaylist"
			| "queryArtistPlaylists"
			| "queryArtistDiscoveredOn"
			| "queryArtistFeaturing"
			| "queryArtistRelated"
			| "queryArtistMinimal"
			| "searchModalResults"
			| "queryWhatsNewFeed"
			| "whatsNewFeedNewItems"
			| "SetItemsStateInWhatsNewFeed"
			| "browseImageURLAndSize"
			| "browseImageSources"
			| "browseAlbum"
			| "browseArtist"
			| "browseEpisode"
			| "browseChapter"
			| "browsePlaylist"
			| "browsePodcast"
			| "browseAudiobook"
			| "browseTrack"
			| "browseUser"
			| "browseMerch"
			| "browseArtistConcerts"
			| "browseContent"
			| "browseSectionContainer"
			| "browseClientFeature"
			| "browseItem"
			| "browseAll"
			| "browsePage";
		/**
		 * Collection of GraphQL definitions.
		 */
		const Definitions: Record<Query | string, any>;
		/**
		 * Sends a GraphQL query to Spotify.
		 * @description A preinitialized version of `Spicetify.GraphQL.Handler` using current context.
		 * @param query Query to send
		 * @param variables Variables to use
		 * @param context Context to use
		 * @return Promise that resolves to the response
		 */
		function Request(query: (typeof Definitions)[Query | string], variables?: Record<string, any>, context?: Record<string, any>): Promise<any>;
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
		function Handler(
			context: Record<string, any>
		): (query: (typeof Definitions)[Query | string], variables?: Record<string, any>, context?: Record<string, any>) => Promise<any>;
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

	/**
	 * Analyse and extract color presets from an image. Works for any valid image URL/URI.
	 * @param image Spotify URI to an image, or an image URL.
	 */
	function extractColorPreset(image: string | string[]): Promise<
		{
			colorRaw: Color;
			colorLight: Color;
			colorDark: Color;
			isFallback: boolean;
		}[]
	>;

	interface hsl {
		h: number;
		s: number;
		l: number;
	}
	interface hsv {
		h: number;
		s: number;
		v: number;
	}
	interface rgb {
		r: number;
		g: number;
		b: number;
	}
	type CSSColors = "HEX" | "HEXA" | "HSL" | "HSLA" | "RGB" | "RGBA";
	/**
	 * Spotify's internal color class
	 */
	class Color {
		constructor(rgb: rgb, hsl: hsl, hsv: hsv, alpha?: number);

		static BLACK: Color;
		static WHITE: Color;
		static CSSFormat: Record<CSSColors, number> & Record<number, CSSColors>;

		a: number;
		hsl: hsl;
		hsv: hsv;
		rgb: rgb;

		/**
		 * Convert CSS representation to Color
		 * @param cssColor CSS representation of the color. Must not contain spaces.
		 * @param alpha Alpha value of the color. Defaults to 1.
		 * @return Color object
		 * @throws {Error} If the CSS color is invalid or unsupported
		 */
		static fromCSS(cssColor: string, alpha?: number): Color;
		static fromHSL(hsl: hsl, alpha?: number): Color;
		static fromHSV(hsv: hsv, alpha?: number): Color;
		static fromRGB(rgb: rgb, alpha?: number): Color;
		static fromHex(hex: string, alpha?: number): Color;

		/**
		 * Change the contrast of the color against another so that
		 * the contrast between them is at least `strength`.
		 */
		contrastAdjust(against: Color, strength?: number): Color;

		/**
		 * Stringify JSON result
		 */
		stringify(): string;

		/**
		 * Convert to CSS representation
		 * @param colorFormat CSS color format to convert to
		 * @return CSS representation of the color
		 */
		toCSS(colorFormat: number): string;

		/**
		 * Return RGBA representation of the color
		 */
		toString(): string;
	}

	/**
	 * Spotify internal library for localization
	 */
	namespace Locale {
		/**
		 * Relative time format
		 */
		const _relativeTimeFormat: Intl.RelativeTimeFormat | null;
		/**
		 * Registered date time formats in the current session
		 */
		const _dateTimeFormats: Record<string, Intl.DateTimeFormat>;
		/**
		 * Current locale of the client
		 */
		const _locale: string;
		const _urlLocale: string;
		/**
		 * Collection of supported locales
		 */
		const _supportedLocales: Record<string, string>;
		/**
		 * Dictionary of localized strings
		 */
		const _dictionary: Record<string, string | { one: string; other: string }>;

		/**
		 * Format date into locale string
		 *
		 * @param date Date to format
		 * @param options Options to use
		 * @return Localized string
		 * @throws {RangeError} If the date is invalid
		 */
		function formatDate(date: number | Date | undefined, options?: Intl.DateTimeFormatOptions): string;
		/**
		 * Format time into relative locale string
		 *
		 * @param date Date to format
		 * @param options Options to use
		 * @return Localized string
		 * @throws {RangeError} If the date is invalid
		 */
		function formatRelativeTime(date: number | Date | undefined, options?: Intl.DateTimeFormatOptions): string;
		/**
		 * Format number into locale string
		 *
		 * @param number Number to format
		 * @param options Options to use
		 * @return Localized string
		 */
		function formatNumber(number: number, options?: Intl.NumberFormatOptions): string;
		/**
		 * Format number into compact locale string
		 *
		 * @param number Number to format
		 * @return Localized string
		 */
		function formatNumberCompact(number: number): string;
		/**
		 * Get localized string
		 *
		 * @param key Key of the string
		 * @param children React children to pass the string into
		 * @return Localized string or React Fragment of the children
		 */
		function get(key: string, ...children: React.ReactNode[]): string | React.ReactNode;
		/**
		 * Get date time format of the passed options.
		 *
		 * Function calls here will register to the `_dateTimeFormats` dictionary.
		 *
		 * @param options Options to use
		 * @return Date time format
		 */
		function getDateTimeFormat(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormat;
		/**
		 * Get the current locale dictionary
		 *
		 * @return Current locale dictionary
		 */
		function getDictionary(): Record<string, string | { one: string; other: string }>;
		/**
		 * Get the current locale
		 *
		 * @return Current locale
		 */
		function getLocale(): string;
		/**
		 * Get the current locale code for Smartling
		 *
		 * @return Current locale code for Smartling
		 */
		function getSmartlingLocale(): string;
		/**
		 * Get the current locale code for URL
		 *
		 * @return Current locale code for URL
		 */
		function getUrlLocale(): string;
		/**
		 * Get the current relative time format
		 *
		 * @return Current relative time format
		 */
		function getRelativeTimeFormat(): Intl.RelativeTimeFormat;
		/**
		 * Get the separator for the current locale
		 *
		 * @return Separator for the current locale
		 */
		function getSeparator(): string;
		/**
		 * Set the current locale
		 *
		 * This will clear all previously set relative time formats and key-value pairs.
		 *
		 * @param locale Locale to set
		 */
		function setLocale(locale: string): void;
		/**
		 * Set the current locale code for URL
		 *
		 * @param locale Locale code for URL to set
		 */
		function setUrlLocale(locale: string): void;
		/**
		 * Set the dictionary for the current locale
		 *
		 * @param dictionary Dictionary to set
		 */
		function setDictionary(dictionary: Record<string, string | { one: string; other: string }>): void;
		/**
		 * Transform text into locale lowercase
		 *
		 * @param text Text to transform
		 * @return Locale lowercase text
		 */
		function toLocaleLowerCase(text: string): string;
		/**
		 * Transform text into locale uppercase
		 *
		 * @param text Text to transform
		 * @return Locale uppercase text
		 */
		function toLocaleUpperCase(text: string): string;
	}

	/**
	 * One-shot lifecycle events of the Spicetify wrapper
	 */
	namespace Events {
		interface Event {
			/**
			 * Call `callback` when the event fires. If it has already fired, `callback` runs immediately.
			 */
			on(callback: () => void): void;
		}
		/**
		 * Fires once Spotify's webpack modules have loaded, before Spicetify exposes them.
		 */
		const platformLoaded: Event;
		/**
		 * Fires once Spicetify has exposed the webpack-extracted APIs (`React`, `ReactComponent`, `URI`, `Locale`, ...).
		 */
		const webpackLoaded: Event;
	}

	/**
	 * The modular loader's runtime API.
	 *
	 * Only exists after the loader has booted: it is set once every staged module has run its `load`, and never set when the
	 * apply staged no modules.
	 */
	namespace Modules {
		type Kind = "extension" | "theme" | "snippet" | "app" | "lib";
		interface Metadata {
			name: string;
			/**
			 * What the module is. Exactly one theme may be loaded at a time.
			 */
			kind?: Kind;
			/**
			 * Classification used before `kind`, still staged by older CLIs.
			 */
			tags?: string[];
			version: string;
			authors: string[];
			description: string;
			/**
			 * Entry files, relative to the module's folder.
			 */
			entries: { js?: string; css?: string };
			hasMixins: boolean;
			/**
			 * Module identifier to semver range.
			 */
			dependencies: Record<string, string>;
			/**
			 * Older versions this module still satisfies dependency ranges for.
			 */
			compat?: string[];
		}
		interface ManifestModule extends Metadata {
			identifier: string;
		}
		/**
		 * The manifest written by `spicetify apply`, with local installs merged in.
		 */
		interface Manifest {
			spotifyVersion: string;
			classmapKey: string;
			cliVersion?: string;
			updatesBlocked?: boolean;
			managedSpotify?: "stable" | "testing";
			classmapSpotify?: string;
			classmapVerified?: boolean;
			supportedSpotify?: string;
			classmapFallback?: boolean;
			classmap?: Record<string, unknown>;
			modules: ManifestModule[];
		}
		interface BootReport {
			/**
			 * Identifiers loaded this session, in load order.
			 */
			loaded: string[];
			/**
			 * Identifier to the reason it failed to load.
			 */
			failed: Record<string, string>;
		}
		interface ModuleState {
			identifier: string;
			version: string;
			loaded: boolean;
			mixedIn: boolean;
			/**
			 * Whether the module runs from a local (localStorage) install.
			 */
			local: boolean;
			/**
			 * Reason the module failed to load, if it did.
			 */
			failed?: string;
		}
		/**
		 * A module installed into localStorage by `installLocal`.
		 */
		interface LocalRecord {
			metadata: ManifestModule;
			sidecar: { installed_version: string; classmap_base: string; allow_stale: boolean };
			/**
			 * File path within the module to its content, remapped against the bundled classmap.
			 */
			files: Record<string, string>;
			installedAt: number;
			/**
			 * Classmap key the files were remapped against. Absent on records from older loaders.
			 */
			remapKey?: string;
		}
		/**
		 * The loader's registry of known modules. Only its read-only members are declared here.
		 */
		interface Registry {
			get(identifier: string): ManifestModule | undefined;
			isLoaded(identifier: string): boolean;
			/**
			 * Whether the user disabled the module. A disabled module is skipped at boot.
			 */
			isDisabled(identifier: string): boolean;
			hasLocal(identifier: string): boolean;
			list(report?: BootReport): ModuleState[];
		}

		const report: BootReport;
		const manifest: Manifest;
		const registry: Registry;
		/**
		 * URL a staged module file is served from.
		 * @return `/modules/<identifier>/<entry>`
		 */
		function entryUrl(identifier: string, entry: string): string;
		/**
		 * State of every known module.
		 */
		function list(): ModuleState[];
		/**
		 * Color schemes of a loaded theme module, from its `color.ini` sections.
		 * @return `null` if the module has no applied scheme
		 */
		function schemes(identifier: string): { active: string; names: string[] } | null;
		/**
		 * Switch a theme module's color scheme live and remember the choice.
		 * @return `false` if the module has no applied scheme or no scheme with that name
		 */
		function setScheme(identifier: string, name: string): boolean;
		/**
		 * Load a module and clear the user's persisted disable once it loads. Its dependencies must be installed at matching
		 * versions and not disabled; they are not loaded for it. Loading a theme unloads the other theme.
		 * @return `false` if the module is already loaded, or could not load; the reason for the latter is in `report.failed`
		 */
		function enable(identifier: string): Promise<boolean>;
		/**
		 * Unload a module and its loaded dependents, and persist the disable so later boots skip it.
		 * @return `false` if the module was not loaded
		 */
		function disable(identifier: string): Promise<boolean>;
		/**
		 * Unload a module and its loaded dependents for this session only.
		 * @return `false` if the module was not loaded
		 */
		function unload(identifier: string): Promise<boolean>;
		/**
		 * Unload, then load a module again.
		 * @return The result of loading it, as for `enable`
		 */
		function reload(identifier: string): Promise<boolean>;
		/**
		 * Install a module into localStorage, remapped against the bundled classmap, and load it unless the user disabled it.
		 * @throws If the manifest has no bundled classmap
		 * @return `{ requiresRestart: true }` when a multi-file module is already loaded and the new files take over on the
		 * next boot, `{ disabled: true }` when the module stays disabled, otherwise the result of loading it.
		 */
		function installLocal(
			identifier: string,
			record: { metadata: ManifestModule; files: Record<string, string>; sidecar: object }
		): Promise<boolean | { requiresRestart: true } | { disabled: true }>;
		/**
		 * Remove a module installed with `installLocal`. If a staged copy exists, it is restored and loaded again if the
		 * local copy was loaded.
		 * @throws If the removal is refused
		 * @return `{ revertedTo }` with the staged version that remains installed, `{ requiresRestart: true }` when the running
		 * code only goes away on the next boot, or `undefined` when the module is gone or there was nothing to remove.
		 */
		function removeLocal(identifier: string): Promise<{ revertedTo: string } | { requiresRestart: true } | undefined>;
		/**
		 * Every module record installed into localStorage.
		 */
		function listLocal(): LocalRecord[];
	}

	/**
	 * Calls into the local Spicetify daemon (`127.0.0.1:7967`).
	 *
	 * All members are always present. Except for `available`, `daemonInfo` and `updateAndApplySupported`, they need the
	 * token a v3 `spicetify apply` injects into the client and reject without it. They reject when the daemon is not running.
	 */
	namespace Daemon {
		type UpdateJobFailureCode =
			| "unsupported-platform"
			| "unsupported-target"
			| "update-unavailable"
			| "renderer-timeout"
			| "client-not-loaded"
			| "spotify-update-failed"
			| "apply-failed"
			| "securing-failed";
		/**
		 * State of the daemon's Update & Apply job.
		 */
		type UpdateJobStatus =
			| { kind: "idle" }
			| { kind: "accepted"; jobId: string; fromVersion: string }
			| { kind: "waiting-for-update"; jobId: string; fromVersion: string }
			| { kind: "downloading"; jobId: string; targetVersion: string }
			| { kind: "installing-spotify"; jobId: string; targetVersion: string }
			| { kind: "applying-spicetify"; jobId: string; targetVersion: string }
			| { kind: "securing"; jobId: string; targetVersion: string | null; message: string | null; manualRecovery: boolean }
			| { kind: "complete"; jobId: string; fromVersion: string; toVersion: string }
			| { kind: "failed-safe"; jobId: string; code: UpdateJobFailureCode; message: string };
		/**
		 * Answer to starting a daemon job. `joined` means a job was already running and `jobId` is that job.
		 */
		type JobAdmission = { jobId: string; disposition: "accepted" | "joined" };
		type ManagedSpotifyStatus = {
			installation:
				| { kind: "external" }
				| { kind: "unavailable"; message: string }
				| { kind: "managed"; version: string; channel: "stable" | "testing"; nativeBlocked: boolean | null };
			job:
				| { kind: "idle" }
				| { kind: "running"; jobId: string; phase: "checking" | "downloading" | "preparing" | "activating" }
				| { kind: "complete"; jobId: string }
				| { kind: "failed"; jobId: string; message: string };
		};
		type ManagedSpotifyUpdate =
			| { kind: "current"; version: string }
			| { kind: "ready"; version: string }
			| { kind: "unavailable"; version: string; message: string };

		/**
		 * Whether the daemon answers its health check.
		 */
		function available(): Promise<boolean>;
		/**
		 * Send a `spicetify:` command URI over the daemon's RPC socket.
		 * @param options.expectReply Defaults to `true`. With `false`, resolves `null` as soon as the command is sent, for
		 * commands that restart the client before they can answer.
		 * @param options.timeoutMs Defaults to 15000
		 * @return The daemon's reply text
		 */
		function send(uri: string, options?: { expectReply?: boolean; timeoutMs?: number }): Promise<string | null>;
		/**
		 * Run `spicetify apply`. This restarts the client, so the promise resolves once the daemon has the command.
		 */
		function apply(): Promise<null>;
		/**
		 * Block Spotify's own updates. This restarts the client, so the promise resolves once the daemon has the command.
		 */
		function blockUpdates(): Promise<null>;
		/**
		 * Unblock Spotify's own updates. This restarts the client, so the promise resolves once the daemon has the command.
		 */
		function unblockUpdates(): Promise<null>;
		/**
		 * The daemon's version and automatic-update setting. A field is `null` when the daemon predates it.
		 * @return `null` if the daemon is not reachable
		 */
		function daemonInfo(): Promise<{
			version: string | null;
			/**
			 * The automatic-update setting.
			 */
			autoUpdate: boolean | null;
			/**
			 * Whether the setting takes effect: only an install in the official installer's folder updates itself.
			 */
			autoUpdateActive: boolean | null;
		} | null>;
		/**
		 * Turn the daemon's automatic updates on or off. Resolves once `config.toml` records the choice.
		 */
		function setAutoUpdate(on: boolean): Promise<string>;
		/**
		 * Uninstall a module the CLI staged on disk, then run `spicetify apply`, which restarts the client.
		 */
		function uninstallStaged(identifier: string, version: string): Promise<null>;
		/**
		 * Take ownership of the native window controls hit-test filter for as long as the socket stays open.
		 * Needs a daemon that supports it; the filter only exists on Windows.
		 * @param onDisconnect Called if the connection drops after it was acquired
		 * @param options.timeoutMs Defaults to 15000
		 * @return Resolves once the daemon is ready. `release()` resolves after the daemon removes the filter.
		 */
		function acquireWindowControls(
			onDisconnect: (error: Error) => void,
			options?: { timeoutMs?: number }
		): Promise<{ release(): Promise<void> }>;
		/**
		 * Whether one-step Update & Apply can run: the daemon supports it on this platform (macOS) and Spotify's updater API
		 * is present in this client.
		 * @return `null` if the daemon is not reachable or predates the check
		 */
		function updateAndApplySupported(): Promise<boolean | null>;
		/**
		 * Update Spotify through its own updater, then re-apply Spicetify.
		 * @throws If Spotify's updater API is missing, or the daemon refuses the job
		 */
		const updateAndApply: {
			(): Promise<JobAdmission>;
			/**
			 * Follow the job's status, polled every second. `listener` is called immediately with the last known status.
			 * @return Function to stop listening
			 */
			observe(listener: (status: UpdateJobStatus) => void): () => void;
		};
		/**
		 * Spotify installs the CLI manages itself. Only implemented on Linux; elsewhere `check` and `update` reject and
		 * `status` reports an external installation.
		 */
		namespace managedSpotify {
			/**
			 * @return `null` if the daemon predates managed installs
			 */
			function status(): Promise<ManagedSpotifyStatus | null>;
			/**
			 * Check the managed install's channel for a newer Spotify package.
			 */
			function check(): Promise<ManagedSpotifyUpdate>;
			/**
			 * Start updating the managed Spotify install. Follow progress with `status()`.
			 */
			function update(): Promise<JobAdmission>;
		}
	}

	/**
	 * Proxy for requests the client cannot make directly because of CORS.
	 *
	 * By default requests go through the local daemon and fall back to the hosted proxy when the daemon does not answer. A
	 * custom template replaces both.
	 */
	namespace CORSProxy {
		type Configuration = {
			mode: "automatic" | "custom";
			/**
			 * The custom template, or `null` in automatic mode.
			 */
			template: string | null;
			/**
			 * Templates tried in order in automatic mode.
			 */
			automaticTemplates: string[];
		};
		/**
		 * URL of `target` through the first proxy template.
		 */
		function url(target: string): string;
		/**
		 * Fetch `target` through the proxy. A template is only skipped when its request fails without a response; an HTTP
		 * error response is returned as is.
		 */
		function fetch(target: string, options?: RequestInit): Promise<Response>;
		/**
		 * Templates in the order they are tried. Each contains `{url}`, replaced by the target URL.
		 */
		function templates(): string[];
		function configuration(): Configuration;
		/**
		 * Switch to automatic mode, or to a custom template that is saved to localStorage.
		 * @throws {TypeError} If a custom template is not a valid absolute http(s) URL template containing `{url}`
		 */
		function configure(options: { mode: "automatic" } | { mode: "custom"; template: string }): Configuration;
		/**
		 * Whether `template` is a string containing `{url}` that forms an http(s) URL.
		 */
		function isValidTemplate(template: unknown): boolean;
	}
}
