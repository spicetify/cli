import { waitFor } from "./shared/async.js";

(function waitOrigins() {
  if (!Spicetify?.Player?.origin?._state) {
    setTimeout(waitOrigins, 10);
    return;
  }

  /** @type {{ cache: Spicetify.PlayerState | null; current: Spicetify.PlayerState | null }} */
  const playerState = {
    cache: null,
    current: null,
  };
  const player = /** @type {Writable<typeof Spicetify.Player>} */ (Spicetify.Player);

  const interval = setInterval(() => {
    if (!Spicetify.Player.origin._state?.item) return;
    player.data = Spicetify.Player.origin._state;
    playerState.cache = Spicetify.Player.data;
    clearInterval(interval);
  }, 10);

  Spicetify.Player.origin._events.addListener("update", ({ data: playerEventData }) => {
    playerState.current = playerEventData.item ? playerEventData : null;
    player.data = playerState.current;

    if (playerState.cache?.item?.uri !== playerState.current?.item?.uri) {
      const event = /** @type {Event & { data?: unknown }} */ (new Event("songchange"));
      event.data = Spicetify.Player.data;
      Spicetify.Player.dispatchEvent(event);
    }

    if (playerState.cache?.isPaused !== playerState.current?.isPaused) {
      const event = /** @type {Event & { data?: unknown }} */ (new Event("onplaypause"));
      event.data = Spicetify.Player.data;
      Spicetify.Player.dispatchEvent(event);
    }

    playerState.cache = playerState.current;
  });

  (function waitProductStateAPI() {
    if (!Spicetify.Platform?.UserAPI) {
      setTimeout(waitProductStateAPI, 100);
      return;
    }

    const productState = Spicetify.Platform.UserAPI._product_state || Spicetify.Platform.UserAPI._product_state_service;
    if (productState) return;

    const productStateApi = Spicetify.Platform?.ProductStateAPI?.productStateApi;
    if (!productStateApi) {
      setTimeout(waitProductStateAPI, 100);
      return;
    }

    Spicetify.Platform.UserAPI._product_state_service = productStateApi;
  })();

  void (async function setButtonsHeight() {
    const CosmosAsync = await waitFor(() => Spicetify.CosmosAsync, 100);
    const expFeatures = JSON.parse(localStorage.getItem("spicetify-exp-features") || "{}");
    const isGlobalNavbar = expFeatures?.enableGlobalNavBar?.value;

    if (typeof isGlobalNavbar !== "undefined" && isGlobalNavbar === "control") {
      await CosmosAsync.post("sp://messages/v1/container/control", {
        type: "update_titlebar",
        // Clients without PlatformData.os_name report the OS as operatingSystem.
        height: Spicetify.Platform.operatingSystem === "macOS" || Spicetify.Platform.PlatformData?.os_name === "osx" ? "42" : "40",
      });
    }
  })();

  setInterval(() => {
    if (playerState.cache?.isPaused === false) {
      const event = /** @type {Event & { data?: unknown }} */ (new Event("onprogress"));
      event.data = Spicetify.Player.getProgress();
      Spicetify.Player.dispatchEvent(event);
    }
  }, 100);

  Spicetify.addToQueue = (uri) => {
    return Spicetify.Player.origin._queue?.addToQueue(uri);
  };
  Spicetify.removeFromQueue = (uri) => {
    return Spicetify.Player.origin._queue?.removeFromQueue(uri);
  };
})();
