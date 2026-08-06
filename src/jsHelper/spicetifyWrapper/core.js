window.Spicetify = {
  Player: {
    addEventListener: (type, callback) => {
      if (!(type in Spicetify.Player.eventListeners)) {
        Spicetify.Player.eventListeners[type] = [];
      }
      Spicetify.Player.eventListeners[type].push(callback);
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
      const duration = !Number.isInteger(p) && p >= 0 && p <= 1 ? Math.round(p * Spicetify.Player.origin._state.duration) : p;
      Spicetify.Player.origin.seekTo(duration);
    },
    getProgress: () => {
      const state = Spicetify.Player.origin._state;
      return (state.isPaused ? 0 : Date.now() - state.timestamp) + state.positionAsOfTimestamp;
    },
    getProgressPercent: () => {
      const state = Spicetify.Player.origin._state;
      return Spicetify.Player.getProgress() / state.duration;
    },
    getDuration: () => Spicetify.Player.origin._state.duration,
    setVolume: (v) => {
      Spicetify.Platform.PlaybackAPI.setVolume(v);
    },
    increaseVolume: () => {
      Spicetify.Platform.PlaybackAPI.raiseVolume();
    },
    decreaseVolume: () => {
      Spicetify.Platform.PlaybackAPI.lowerVolume();
    },
    getVolume: () => Spicetify.Platform.PlaybackAPI._volume,
    next: () => {
      Spicetify.Player.origin.skipToNext();
    },
    back: () => {
      Spicetify.Player.origin.skipToPrevious();
    },
    togglePlay: () => {
      if (Spicetify.Player.isPlaying()) Spicetify.Player.pause();
      else Spicetify.Player.play();
    },
    isPlaying: () => !Spicetify.Player.origin._state.isPaused,
    toggleShuffle: () => {
      Spicetify.Player.origin.setShuffle(!Spicetify.Player.origin._state.shuffle);
    },
    getShuffle: () => Spicetify.Player.origin._state.shuffle,
    setShuffle: (b) => {
      Spicetify.Player.origin.setShuffle(b);
    },
    toggleRepeat: () => {
      Spicetify.Player.origin.setRepeat((Spicetify.Player.origin._state.repeat + 1) % 3);
    },
    getRepeat: () => Spicetify.Player.origin._state.repeat,
    setRepeat: (r) => {
      Spicetify.Player.origin.setRepeat(r);
    },
    getMute: () => Spicetify.Player.getVolume() === 0,
    toggleMute: () => {
      Spicetify.Player.setMute(!Spicetify.Player.getMute());
    },
    setMute: (b) => {
      if (b !== Spicetify.Player.getMute()) {
        document.querySelector(".volume-bar__icon-button")?.click();
      }
    },
    formatTime: (ms) => {
      let seconds = Math.floor(ms / 1e3);
      const minutes = Math.floor(seconds / 60);
      seconds -= minutes * 60;
      return `${minutes}:${seconds > 9 ? "" : "0"}${String(seconds)}`;
    },
    getHeart: () => Spicetify.Player.origin._state.item?.metadata["collection.in_collection"] === "true",
    pause: () => {
      Spicetify.Player.origin.pause();
    },
    play: () => {
      Spicetify.Player.origin.resume();
    },
    playUri: async (uri, context = {}, options = {}) => {
      return await Spicetify.Player.origin.play({ uri: uri }, context, options);
    },
    removeEventListener: (type, callback) => {
      if (!(type in Spicetify.Player.eventListeners)) return;
      const stack = Spicetify.Player.eventListeners[type];
      for (let i = 0; i < stack.length; i++) {
        if (stack[i] === callback) {
          stack.splice(i, 1);
          return;
        }
      }
    },
    skipBack: (amount = 15e3) => {
      Spicetify.Player.origin.seekBackward(amount);
    },
    skipForward: (amount = 15e3) => {
      Spicetify.Player.origin.seekForward(amount);
    },
    setHeart: (b) => {
      const uris = [Spicetify.Player.origin._state.item.uri];
      if (b) {
        Spicetify.Platform.LibraryAPI.add({ uris });
      } else {
        Spicetify.Platform.LibraryAPI.remove({ uris });
      }
    },
    toggleHeart: () => {
      Spicetify.Player.setHeart(!Spicetify.Player.getHeart());
    },
  },
  test: () => {
    function checkObject(object) {
      const { objectToCheck, methods, name } = object;
      let count = methods.size;

      for (const method of methods) {
        if (objectToCheck[method] === undefined || objectToCheck[method] === null) {
          console.error(`${name}.${method} is not available. Please open an issue in the Spicetify repository to inform us about it.`);
          count--;
        }
      }
      console.log(`${count}/${methods.size} ${name} methods and objects are OK.`);

      for (const key of Object.keys(objectToCheck)) {
        if (!methods.has(key)) {
          console.warn(`${name} method ${key} exists but is not in the method list. Consider adding it.`);
        }
      }
    }

    const objectsToCheck = new Set([
      {
        objectToCheck: Spicetify,
        name: "Spicetify",
        methods: new Set([
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
          "SVGIcons",
          "colorExtractor",
          "test",
          "Platform",
          "_platform",
          "Config",
          "expFeatureOverride",
          "createInternalMap",
          "RemoteConfigResolver",
          "Playbar",
          "Tippy",
          "_getStyledClassName",
          "GraphQL",
          "ReactHook",
          "AppTitle",
          "_reservedPanelIds",
          "ReactFlipToolkit",
          "classnames",
          "ReactQuery",
          "Color",
          "extractColorPreset",
          "ReactDOMServer",
          "Snackbar",
          "ContextMenuV2",
          "ReactJSX",
          "_renderNavLinks",
          "Events",
          "CORSProxy",
          "Daemon",
        ]),
      },
      {
        objectToCheck: Spicetify.Player,
        name: "Spicetify.Player",
        methods: new Set([
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
          "playUri",
          "setHeart",
        ]),
      },
      {
        objectToCheck: Spicetify.ReactComponent,
        name: "Spicetify.ReactComponent",
        methods: new Set([
          "RightClickMenu",
          "ContextMenu",
          "Menu",
          "MenuItem",
          "AlbumMenu",
          "PodcastShowMenu",
          "ArtistMenu",
          "PlaylistMenu",
          "TrackMenu",
          "TooltipWrapper",
          "TextComponent",
          "IconComponent",
          "ConfirmDialog",
          "Slider",
          "RemoteConfigProvider",
          "ButtonPrimary",
          "ButtonSecondary",
          "ButtonTertiary",
          "Snackbar",
          "Chip",
          "Toggle",
          "Cards",
          "Router",
          "Routes",
          "Route",
          "StoreProvider",
          "PlatformProvider",
          "Dropdown",
          "MenuSubMenuItem",
          "Navigation",
          "ScrollableContainer",
        ]),
      },
      {
        objectToCheck: Spicetify.ReactComponent.Cards,
        name: "Spicetify.ReactComponent.Cards",
        methods: new Set([
          "Default",
          "Hero",
          "CardImage",
          "Album",
          "Artist",
          "Audiobook",
          "Episode",
          "Playlist",
          "Profile",
          "Show",
          "Track",
          "FeatureCard",
        ]),
      },
      {
        objectToCheck: Spicetify.ReactHook,
        name: "Spicetify.ReactHook",
        methods: new Set(["DragHandler", "useExtractedColor"]),
      },
    ]);

    for (const object of objectsToCheck) {
      checkObject(object);
    }
  },
  GraphQL: {
    Definitions: {},
  },
  ReactComponent: {},
  ReactHook: {},
  ReactFlipToolkit: {},
  Snackbar: {},
  Platform: {},
  CORSProxy: {},
  Daemon: {},
};
