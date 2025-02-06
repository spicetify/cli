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
			const duration = p <= 1 ? Math.round(p * Spicetify.Player.origin._state.duration) : p;
			Spicetify.Player.origin.seekTo(duration);
		},
		getProgress: () =>
			(Spicetify.Player.origin._state.isPaused ? 0 : Date.now() - Spicetify.Player.origin._state.timestamp) +
			Spicetify.Player.origin._state.positionAsOfTimestamp,
		getProgressPercent: () => Spicetify.Player.getProgress() / Spicetify.Player.origin._state.duration,
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
			Spicetify.Player.isPlaying() ? Spicetify.Player.pause() : Spicetify.Player.play();
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
		getHeart: () => Spicetify.Player.origin._state.item.metadata["collection.in_collection"] === "true",
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
};

// Based on https://blog.aziz.tn/2025/01/spotify-fix-lagging-issue-on-scrolling.html
function applyScrollingFix() {
	const scrollableElements = Array.from(document.querySelectorAll("*")).filter((el) => {
		if (
			el.id === "context-menu" ||
			el.closest("#context-menu") ||
			el.getAttribute("role") === "dialog" ||
			el.classList.contains("popup") ||
			el.getAttribute("aria-haspopup") === "true"
		)
			return false;

		const style = window.getComputedStyle(el);
		return style.overflow === "auto" || style.overflow === "scroll" || style.overflowY === "auto" || style.overflowY === "scroll";
	});

	for (const el of scrollableElements) {
		if (!el.hasAttribute("data-scroll-optimized")) {
			el.style.willChange = "transform";
			el.style.transform = "translate3d(0, 0, 0)";
			el.setAttribute("data-scroll-optimized", "true");
		}
	}
}

const observer = new MutationObserver(applyScrollingFix);

observer.observe(document.body, {
	childList: true,
	subtree: true,
	attributes: false,
});

const originalPushState = history.pushState;
history.pushState = function (...args) {
	originalPushState.apply(this, args);
	setTimeout(applyScrollingFix, 100);
};

window.addEventListener("popstate", () => {
	setTimeout(applyScrollingFix, 100);
});

applyScrollingFix();

(function waitForPlatform() {
	if (!Spicetify._platform) {
		setTimeout(waitForPlatform, 50);
		return;
	}
	const { _platform } = Spicetify;
	for (const key of Object.keys(_platform)) {
		if (key.startsWith("get") && typeof _platform[key] === "function") {
			Spicetify.Platform[key.slice(3)] = _platform[key]();
		} else {
			Spicetify.Platform[key] = _platform[key];
		}
	}
})();

(function addMissingPlatformAPIs() {
	if (!Spicetify.Platform?.version && !Spicetify.Platform?.Registry) {
		setTimeout(addMissingPlatformAPIs, 50);
		return;
	}
	const version = Spicetify.Platform.version.split(".").map((i) => Number.parseInt(i));
	if (version[0] === 1 && version[1] === 2 && version[2] < 38) return;

	for (const [key, _] of Spicetify.Platform.Registry._map.entries()) {
		if (typeof key?.description !== "string" || !key?.description.endsWith("API")) continue;
		const symbolName = key.description;
		if (Object.hasOwn(Spicetify.Platform, symbolName)) continue;
		const resolvedAPI = Spicetify.Platform.Registry.resolve(key);
		if (!resolvedAPI) {
			console.warn(`[spicetifyWrapper] Failed to resolve PlatformAPI from Registry: ${symbolName}`);
			continue;
		}

		Spicetify.Platform[symbolName] = resolvedAPI;
		console.debug(`[spicetifyWrapper] Resolved PlatformAPI from Registry: ${symbolName}`);
	}
})();

(async function addProxyCosmos() {
	if (!Spicetify.Player.origin?._cosmos && !Spicetify.Platform?.Registry) {
		setTimeout(addProxyCosmos, 50);
		return;
	}

	const _cosmos = Spicetify.Player.origin?._cosmos ?? Spicetify.Platform?.Registry.resolve(Symbol.for("Cosmos"));

	const allowedMethodsMap = {
		get: "get",
		post: "post",
		del: "delete",
		put: "put",
		patch: "patch",
	};
	const allowedMethodsSet = new Set(Object.keys(allowedMethodsMap));
	const internalEndpoints = new Set(["sp:", "wg:"]);

	const handler = {
		get: (target, prop, receiver) => {
			const internalFetch = Reflect.get(target, prop, receiver);

			if (typeof internalFetch !== "function" || !allowedMethodsSet.has(prop)) return internalFetch;
			const version = Spicetify.Platform.version.split(".").map((i) => Number.parseInt(i));
			if (version[0] === 1 && version[1] === 2 && version[2] < 31) return internalFetch;

			return async function (url, body) {
				const urlObj = new URL(url);

				const corsProxyURLTemplate = window.localStorage.getItem("spicetify:corsProxyTemplate") ?? "https://cors-proxy.spicetify.app/{url}";
				const isWebAPI = urlObj.hostname === "api.spotify.com";
				const isSpClientAPI = urlObj.hostname.includes("spotify.com") && urlObj.hostname.includes("spclient");
				const isInternalURL = internalEndpoints.has(urlObj.protocol);
				if (isInternalURL) return internalFetch.apply(this, [url, body]);

				const shouldUseCORSProxy = !isWebAPI && !isSpClientAPI && !isInternalURL;

				const method = allowedMethodsMap[prop.toLowerCase()];
				const headers = {
					"Content-Type": "application/json",
				};

				const options = {
					method,
					headers,
					timeout: 1000 * 15,
				};

				let finalURL = urlObj.toString();
				if (body) {
					if (method === "get") {
						const params = new URLSearchParams(body);
						const useSeparator = shouldUseCORSProxy && new URL(finalURL).search.startsWith("?");
						finalURL += `${useSeparator ? "&" : "?"}${params.toString()}`;
					} else options.body = !Array.isArray(body) && typeof body === "object" ? JSON.stringify(body) : body;
				}
				if (shouldUseCORSProxy) {
					finalURL = corsProxyURLTemplate.replace(/{url}/, finalURL);
					try {
						new URL(finalURL);
					} catch {
						console.error("[spicetifyWrapper] Invalid CORS Proxy URL template");
					}
				}

				const Authorization = `Bearer ${Spicetify.Platform.AuthorizationAPI.getState().token.accessToken}`;
				let injectedHeaders = {};
				if (isWebAPI) injectedHeaders = { Authorization };
				if (isSpClientAPI) {
					injectedHeaders = {
						Authorization,
						"Spotify-App-Version": Spicetify.Platform.version,
						"App-Platform": Spicetify.Platform.PlatformData.app_platform,
					};
				}
				Object.assign(options.headers, injectedHeaders);

				try {
					return fetch(finalURL, options).then((res) => {
						if (!res.ok) return { code: res.status, error: res.statusText, message: "Failed to fetch", stack: undefined };
						try {
							return res.clone().json();
						} catch {
							try {
								return res.clone().blob();
							} catch {
								return res.clone().text();
							}
						}
					});
				} catch (e) {
					console.error(e);
				}
			};
		},
	};

	while (!Spicetify.Player.origin) await new Promise((r) => setTimeout(r, 50));
	Spicetify.Player.origin._cosmos = new Proxy(_cosmos, handler);
	Object.defineProperty(Spicetify, "CosmosAsync", {
		get: () => {
			return Spicetify.Player.origin?._cosmos;
		},
	});
})();

(async function hotloadWebpackModules() {
	while (!window?.webpackChunkclient_web) {
		await new Promise((r) => setTimeout(r, 50));
	}

	// Force all webpack modules to load
	const require = webpackChunkclient_web.push([[Symbol()], {}, (re) => re]);
	while (!require.m) await new Promise((r) => setTimeout(r, 50));
	console.log("[spicetifyWrapper] Waiting for required webpack modules to load");
	let webpackDidCallback = false;
	// https://github.com/webpack/webpack/blob/main/lib/runtime/OnChunksLoadedRuntimeModule.js
	require.O(
		null,
		[],
		() => {
			webpackDidCallback = true;
		},
		1
	);

	let chunks = Object.entries(require.m);
	let cache = Object.keys(require.m).map((id) => require(id));

	// For _renderNavLinks to work
	Spicetify.React = cache.find((m) => m?.useMemo);

	while (!webpackDidCallback) {
		await new Promise((r) => setTimeout(r, 100));
	}
	console.log("[spicetifyWrapper] All required webpack modules loaded");
	chunks = Object.entries(require.m);
	cache = Object.keys(require.m).map((id) => require(id));
	Spicetify.Events.platformLoaded.fire();

	const modules = cache
		.filter((module) => typeof module === "object")
		.flatMap((module) => {
			try {
				return Object.values(module);
			} catch {}
		});
	// polyfill for chromium <117
	const groupBy = (values, keyFinder) => {
		if (typeof Object.groupBy === "function") return Object.groupBy(values, keyFinder);
		return values.reduce((a, b) => {
			const key = typeof keyFinder === "function" ? keyFinder(b) : b[keyFinder];
			a[key] = a[key] ? [...a[key], b] : [b];
			return a;
		}, {});
	};
	const functionModules = modules.filter((module) => typeof module === "function");
	const exportedReactObjects = groupBy(modules.filter(Boolean), (x) => x.$$typeof);
	const exportedMemos = exportedReactObjects[Symbol.for("react.memo")];
	const exportedForwardRefs = exportedReactObjects[Symbol.for("react.forward_ref")];
	const exportedMemoFRefs = exportedMemos.filter((m) => m.type.$$typeof === Symbol.for("react.forward_ref"));
	const exposeReactComponentsUI = ({ modules, functionModules, exportedForwardRefs }) => {
		const componentNames = Object.keys(modules.filter(Boolean).find((e) => e.BrowserDefaultFocusStyleProvider));
		const componentRegexes = componentNames.map((n) => new RegExp(`"data-encore-id":(?:[a-zA-Z_\$][\w\$]*\\.){2}${n}\\b`));
		const componentPairs = [functionModules.map((f) => [f, f]), exportedForwardRefs.map((f) => [f.render, f])]
			.flat()
			.map(([s, f]) => [componentNames.find((_, i) => s.toString().match(componentRegexes[i])), f]);
		return Object.fromEntries(componentPairs);
	};
	const reactComponentsUI = exposeReactComponentsUI({ modules, functionModules, exportedForwardRefs });

	const knownMenuTypes = ["album", "show", "artist", "track"];
	const menus = modules
		.map((m) => m?.type?.toString().match(/value:"[\w-]+"/g) && [m, ...m.type.toString().match(/value:"[\w-]+"/g)])
		.filter(Boolean)
		.filter((m) => m[1] !== 'value:"row"')
		.map(([module, type]) => {
			type = type.match(/value:"([\w-]+)"/)[1];

			if (!knownMenuTypes.includes(type)) return;
			if (type === "show") type = "podcast-show";

			type = `${type
				.split("-")
				.map((str) => str[0].toUpperCase() + str.slice(1))
				.join("")}Menu`;
			return [type, module];
		})
		.filter(Boolean);

	const cardTypesToFind = ["album", "artist", "audiobook", "episode", "playlist", "profile", "show", "track"];
	const cards = [
		...functionModules
			.flatMap((m) => {
				return cardTypesToFind.map((type) => {
					if (m.toString().includes(`featureIdentifier:"${type}"`)) {
						cardTypesToFind.splice(cardTypesToFind.indexOf(type), 1);
						return [type[0].toUpperCase() + type.slice(1), m];
					}
				});
			})
			.filter(Boolean),
		...modules
			.flatMap((m) => {
				return cardTypesToFind.map((type) => {
					try {
						if (m?.type?.toString().includes(`featureIdentifier:"${type}"`)) {
							cardTypesToFind.splice(cardTypesToFind.indexOf(type), 1);
							return [type[0].toUpperCase() + type.slice(1), m];
						}
					} catch {}
				});
			})
			.filter(Boolean),
	];

	Object.assign(Spicetify, {
		React: cache.find((m) => m?.useMemo),
		ReactJSX: cache.find((m) => m?.jsx),
		ReactDOM: cache.find((m) => m?.createPortal),
		ReactDOMServer: cache.find((m) => m?.renderToString),
		// https://github.com/JedWatson/classnames/
		classnames: chunks
			.filter(([_, v]) => v.toString().includes("[native code]"))
			.map(([i]) => require(i))
			.find((e) => typeof e === "function"),
		Color: functionModules.find((m) => m.toString().includes("static fromHex") || m.toString().includes("this.rgb")),
		Player: {
			...Spicetify.Player,
			get origin() {
				return Spicetify.Platform?.PlayerAPI;
			},
		},
		GraphQL: {
			...Spicetify.GraphQL,
			get Request() {
				return Spicetify.Platform?.GraphQLLoader || Spicetify.GraphQL.Handler?.(Spicetify.GraphQL.Context);
			},
			Context: functionModules.find((m) => m.toString().includes("subscription") && m.toString().includes("mutation")),
			Handler: functionModules.find((m) => m.toString().includes("GraphQL subscriptions are not supported")),
		},
		ReactComponent: {
			...Spicetify.ReactComponent,
			TextComponent: modules.find((m) => m?.h1 && m?.render),
			ConfirmDialog: functionModules.find(
				(m) => m.toString().includes("isOpen") && m.toString().includes("shouldCloseOnEsc") && m.toString().includes("onClose")
			),
			Menu: functionModules.find((m) => m.toString().includes("getInitialFocusElement") && m.toString().includes("children")),
			MenuItem: functionModules.find((m) => m.toString().includes("handleMouseEnter") && m.toString().includes("onClick")),
			MenuSubMenuItem: functionModules.find((f) => f.toString().includes("subMenuIcon")),
			Slider: wrapProvider(functionModules.find((m) => m.toString().includes("progressBarRef"))),
			RemoteConfigProvider: functionModules.find((m) => m.toString().includes("resolveSuspense") && m.toString().includes("configuration")),
			RightClickMenu: functionModules.find(
				(m) =>
					m.toString().includes("action") && m.toString().includes("open") && m.toString().includes("trigger") && m.toString().includes("right-click")
			),
			TooltipWrapper: functionModules.find((m) => m.toString().includes("renderInline") && m.toString().includes("showDelay")),
			ButtonPrimary: reactComponentsUI.ButtonPrimary,
			ButtonSecondary: reactComponentsUI.ButtonSecondary,
			ButtonTertiary: reactComponentsUI.ButtonTertiary,
			Snackbar: {
				wrapper: functionModules.find((m) => m.toString().includes("encore-light-theme") && m.toString().includes("elevated")),
				simpleLayout: functionModules.find((m) => ["leading", "center", "trailing"].every((keyword) => m.toString().includes(keyword))),
				ctaText: functionModules.find((m) => m.toString().includes("ctaText")),
				styledImage: functionModules.find((m) => m.toString().includes("placeholderSrc")),
			},
			Chip: reactComponentsUI.Chip,
			Toggle: functionModules.find((m) => m.toString().includes("onSelected") && m.toString().includes('type:"checkbox"')),
			Cards: {
				Default: reactComponentsUI.Card,
				FeatureCard: functionModules.find(
					(m) => m.toString().includes("?highlight") && m.toString().includes("headerText") && m.toString().includes("imageContainer")
				),
				Hero: functionModules.find((m) => m?.toString().includes('"herocard-click-handler"')),
				CardImage: functionModules.find(
					(m) =>
						m.toString().includes("isHero") &&
						(m.toString().includes("withWaves") || m.toString().includes("isCircular")) &&
						m.toString().includes("imageWrapper")
				),
				...Object.fromEntries(cards),
			},
			Router: functionModules.find((m) => m.toString().includes("navigationType") && m.toString().includes("static")),
			Routes: functionModules.find((m) => m.toString().match(/\([\w$]+\)\{let\{children:[\w$]+,location:[\w$]+\}=[\w$]+/)),
			Route: functionModules.find((m) => m.toString().match(/^function [\w$]+\([\w$]+\)\{\(0,[\w$]+\.[\w$]+\)\(\!1\)\}$/)),
			StoreProvider: functionModules.find((m) => m.toString().includes("notifyNestedSubs") && m.toString().includes("serverState")),
			Navigation: exportedMemoFRefs.find((m) => m.type.render.toString().includes("navigationalRoot")),
			ScrollableContainer: functionModules.find((m) => m.toString().includes("scrollLeft") && m.toString().includes("showButtons")),
			IconComponent: reactComponentsUI.Icon,
			...Object.fromEntries(menus),
		},
		ReactHook: {
			DragHandler: functionModules.find((m) => m.toString().includes("dataTransfer") && m.toString().includes("data-dragging")),
			useExtractedColor: functionModules.find(
				(m) => m.toString().includes("extracted-color") || (m.toString().includes("colorRaw") && m.toString().includes("useEffect"))
			),
		},
		// React Query
		// https://github.com/TanStack/query
		// v3 until Spotify v1.2.29
		// v5 since Spotify v1.2.30
		ReactQuery: cache.find((module) => module.useQuery) || {
			PersistQueryClientProvider: functionModules.find((m) => m.toString().includes("persistOptions")),
			QueryClient: functionModules.find((m) => m.toString().includes("defaultMutationOptions")),
			QueryClientProvider: functionModules.find((m) => m.toString().includes("use QueryClientProvider")),
			notifyManager: modules.find((m) => m?.setBatchNotifyFunction),
			useMutation: functionModules.find((m) => m.toString().includes("mutateAsync")),
			useQuery: functionModules.find((m) =>
				m.toString().match(/^function [\w_$]+\(([\w_$]+),([\w_$]+)\)\{return\(0,[\w_$]+\.[\w_$]+\)\(\1,[\w_$]+\.[\w_$]+,\2\)\}$/)
			),
			useQueryClient: functionModules.find(
				(m) => m.toString().includes("client") && m.toString().includes("Provider") && m.toString().includes("mount")
			),
			useSuspenseQuery: functionModules.find(
				(m) => m.toString().includes("throwOnError") && m.toString().includes("suspense") && m.toString().includes("enabled")
			),
		},
		ReactFlipToolkit: {
			...Spicetify.ReactFlipToolkit,
			Flipper: functionModules.find((m) => m?.prototype?.getSnapshotBeforeUpdate),
			Flipped: functionModules.find((m) => m.displayName === "Flipped"),
		},
		_reservedPanelIds: modules.find((m) => m?.BuddyFeed),
		Mousetrap: cache.find((m) => m?.addKeycodes),
		Locale: modules.find((m) => m?._dictionary),
	});

	if (!Spicetify.ContextMenuV2._context) Spicetify.ContextMenuV2._context = Spicetify.React.createContext({});

	(function waitForChunks() {
		const listOfComponents = [
			"ScrollableContainer",
			"Slider",
			"Toggle",
			"Cards.Artist",
			"Cards.Audiobook",
			"Cards.Profile",
			"Cards.Show",
			"Cards.Track",
		];
		if (listOfComponents.every((component) => Spicetify.ReactComponent[component] !== undefined)) return;
		const cache = Object.keys(require.m).map((id) => require(id));
		const modules = cache
			.filter((module) => typeof module === "object")
			.flatMap((module) => {
				try {
					return Object.values(module);
				} catch {}
			});
		const functionModules = modules.filter((module) => typeof module === "function");
		const cardTypesToFind = ["artist", "audiobook", "profile", "show", "track"];
		const cards = [
			...functionModules
				.flatMap((m) => {
					return cardTypesToFind.map((type) => {
						if (m.toString().includes(`featureIdentifier:"${type}"`)) {
							cardTypesToFind.splice(cardTypesToFind.indexOf(type), 1);
							return [type[0].toUpperCase() + type.slice(1), m];
						}
					});
				})
				.filter(Boolean),
			...modules
				.flatMap((m) => {
					return cardTypesToFind.map((type) => {
						try {
							if (m?.type?.toString().includes(`featureIdentifier:"${type}"`)) {
								cardTypesToFind.splice(cardTypesToFind.indexOf(type), 1);
								return [type[0].toUpperCase() + type.slice(1), m];
							}
						} catch {}
					});
				})
				.filter(Boolean),
		];

		Spicetify.ReactComponent.Slider = wrapProvider(functionModules.find((m) => m.toString().includes("progressBarRef")));
		Spicetify.ReactComponent.Toggle = functionModules.find((m) => m.toString().includes("onSelected") && m.toString().includes('type:"checkbox"'));
		Spicetify.ReactComponent.ScrollableContainer = functionModules.find(
			(m) => m.toString().includes("scrollLeft") && m.toString().includes("showButtons")
		);
		Object.assign(Spicetify.ReactComponent.Cards, Object.fromEntries(cards));

		if (!listOfComponents.every((component) => Spicetify.ReactComponent[component] !== undefined)) {
			setTimeout(waitForChunks, 100);
			return;
		}

		if (Spicetify.ReactComponent.ScrollableContainer) setTimeout(refreshNavLinks?.(), 100);
	})();

	(function waitForSnackbar() {
		if (!Object.keys(Spicetify.Snackbar).length) {
			setTimeout(waitForSnackbar, 100);
			return;
		}
		// Snackbar notifications
		// https://github.com/iamhosseindhv/notistack
		Spicetify.Snackbar = {
			...Spicetify.Snackbar,
			SnackbarProvider: functionModules.find((m) => m.toString().includes("enqueueSnackbar called with invalid argument")),
			useSnackbar: functionModules.find((m) => m.toString().match(/^function\(\)\{return\(0,[\w$]+\.useContext\)\([\w$]+\)\}$/)),
		};
	})();

	const localeModule = modules.find((m) => m?.getTranslations);
	if (localeModule) {
		const createUrlLocale = functionModules.find(
			(m) => m.toString().includes("has") && m.toString().includes("baseName") && m.toString().includes("language")
		);
		Spicetify.Locale = {
			get _relativeTimeFormat() {
				return localeModule._relativeTimeFormat;
			},
			get _dateTimeFormats() {
				return localeModule._dateTimeFormats;
			},
			get _locale() {
				return localeModule._localeForTranslation.baseName;
			},
			get _urlLocale() {
				return localeModule._localeForURLPath;
			},
			get _dictionary() {
				return localeModule._translations;
			},
			formatDate: (date, options) => localeModule.formatDate(date, options),
			formatRelativeTime: (date, options) => localeModule.formatRelativeDate(date, options),
			formatNumber: (number, options) => localeModule.formatNumber(number, options),
			formatNumberCompact: (number, options) => localeModule.formatNumberCompact(number, options),
			get: (key, children) => localeModule.get(key, children),
			getDateTimeFormat: (options) => localeModule.getDateTimeFormat(options),
			getDictionary: () => localeModule.getTranslations(),
			getLocale: () => localeModule._localeForTranslation.baseName,
			getSmartlingLocale: () => localeModule.getLocaleForSmartling(),
			getUrlLocale: () => localeModule.getLocaleForURLPath(),
			getRelativeTimeFormat: () => localeModule.getRelativeTimeFormat(),
			getSeparator: () => localeModule.getSeparator(),
			setLocale: (locale) => {
				return localeModule.initialize({
					localeForTranslation: locale,
					localeForFormatting: localeModule._localeForFormatting.baseName,
					translations: localeModule._translations,
				});
			},
			setUrlLocale: (locale) => {
				if (createUrlLocale) localeModule._localeForURLPath = createUrlLocale(locale);
			},
			setDictionary: (dictionary) => {
				return localeModule.initialize({
					localeForTranslation: localeModule._localeForTranslation.baseName,
					localeForFormatting: localeModule._localeForFormatting.baseName,
					translations: dictionary,
				});
			},
			toLocaleLowerCase: (text) => localeModule.toLocaleLowerCase(text),
			toLocaleUpperCase: (text) => localeModule.toLocaleUpperCase(text),
		};
	}

	if (Spicetify.Locale) Spicetify.Locale._supportedLocales = cache.find((m) => typeof m?.ja === "string");

	Object.defineProperty(Spicetify, "Queue", {
		get() {
			return Spicetify.Player.origin?._queue?._state ?? Spicetify.Player.origin?._queue?._queue;
		},
	});

	const confirmDialogChunk = chunks.find(
		([, value]) => value.toString().includes("confirmDialog") && value.toString().includes("shouldCloseOnEsc") && value.toString().includes("isOpen")
	);
	if (!Spicetify.ReactComponent?.ConfirmDialog && confirmDialogChunk) {
		Spicetify.ReactComponent.ConfirmDialog = Object.values(require(confirmDialogChunk[0])).find((m) => typeof m === "object");
	}

	const contextMenuChunk = chunks.find(([, value]) => value.toString().includes("toggleContextMenu"));
	if (contextMenuChunk) {
		Spicetify.ReactComponent.ContextMenu = Object.values(require(contextMenuChunk[0])).find((m) => typeof m === "function");
	}

	const playlistMenuChunk = chunks.find(
		([, value]) => value.toString().includes('value:"playlist"') && value.toString().includes("canView") && value.toString().includes("permissions")
	);
	if (playlistMenuChunk) {
		Spicetify.ReactComponent.PlaylistMenu = Object.values(require(playlistMenuChunk[0])).find(
			(m) => typeof m === "function" || typeof m === "object"
		);
	}

	const dropdownChunk = chunks.find(([, value]) => value.toString().includes("dropDown") && value.toString().includes("isSafari"));
	if (dropdownChunk) {
		Spicetify.ReactComponent.Dropdown = Object.values(require(dropdownChunk[0])).find((m) => typeof m === "function");
	}

	const infiniteQueryChunk = chunks.find(
		([_, value]) => value.toString().includes("fetchPreviousPage") && value.toString().includes("getOptimisticResult")
	);
	if (infiniteQueryChunk) {
		Spicetify.ReactQuery.useInfiniteQuery = Object.values(require(infiniteQueryChunk[0])).find((m) => typeof m === "function");
	}

	if (Spicetify.Color) Spicetify.Color.CSSFormat = modules.find((m) => m?.RGBA);

	// Combine snackbar and notification
	(function bindShowNotification() {
		if (!Spicetify.Snackbar?.enqueueSnackbar && !Spicetify.showNotification) {
			setTimeout(bindShowNotification, 250);
			return;
		}

		if (Spicetify.Snackbar?.enqueueSnackbar) {
			Spicetify.showNotification = (message, isError, msTimeout) => {
				Spicetify.Snackbar.enqueueSnackbar(message, {
					variant: isError ? "error" : "default",
					autoHideDuration: msTimeout,
				});
			};

			return;
		}

		Spicetify.Snackbar.enqueueSnackbar = (message, { variant = "default", autoHideDuration } = {}) => {
			isError = variant === "error";
			Spicetify.showNotification(message, isError, autoHideDuration);
		};
	})();

	// Image color extractor
	(async function bindColorExtractor() {
		if (!Spicetify.GraphQL.Request) {
			setTimeout(bindColorExtractor, 10);
			return;
		}
		let imageAnalysis = functionModules.find((m) => m.toString().match(/\![\w$]+\.isFallback|\{extractColor/g));
		const fallbackPreset = modules.find((m) => m?.colorDark);

		// Search chunk in Spotify 1.2.13 or much older because it is impossible to find any distinguishing features
		if (!imageAnalysis) {
			let chunk = chunks.find(
				([, value]) =>
					(value.toString().match(/[\w$]+\.isFallback/g) || value.toString().includes("colorRaw:")) && value.toString().match(/.extractColor/g)
			);
			if (!chunk) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				chunk = chunks.find(([, value]) => value.toString().match(/[\w$]+\.isFallback/g) && value.toString().match(/.extractColor/g));
			}
			imageAnalysis = Object.values(require(chunk[0])).find((m) => typeof m === "function");
		}

		Spicetify.extractColorPreset = async (image) => {
			const analysis = await imageAnalysis(Spicetify.GraphQL.Request, image);
			for (const result of analysis) {
				if ("isFallback" in result === false) result.isFallback = fallbackPreset === result;
			}

			return analysis;
		};
	})();

	function wrapProvider(component) {
		if (!component) return null;
		return (props) =>
			Spicetify.React.createElement(
				Spicetify.ReactComponent.RemoteConfigProvider,
				{ configuration: Spicetify.Platform.RemoteConfiguration },
				Spicetify.React.createElement(component, props)
			);
	}

	(function waitForURI() {
		if (!Spicetify.URI) {
			setTimeout(waitForURI, 10);
			return;
		}

		// Ignore on versions older than 1.2.4
		if (Spicetify.URI.Type) return;

		const URIChunk = cache
			.filter((module) => typeof module === "object")
			.find((m) => {
				// Avoid creating 2 arrays of the same values
				try {
					const values = Object.values(m);
					return values.some((m) => typeof m === "function") && values.some((m) => m?.AD);
				} catch {
					return false;
				}
			});
		const URIModules = Object.values(URIChunk);

		// URI.Type
		Spicetify.URI.Type = URIModules.find((m) => m?.AD);

		// Parse functions
		Spicetify.URI.from = URIModules.find((m) => typeof m === "function" && m.toString().includes("allowedTypes"));
		Spicetify.URI.fromString = URIModules.find((m) => typeof m === "function" && m.toString().includes("Argument `uri`"));

		// createURI functions
		const createURIFunctions = URIModules.filter((m) => typeof m === "function" && m.toString().match(/\([\w$]+\./));
		for (const type of Object.keys(Spicetify.URI.Type)) {
			const func = createURIFunctions.find((m) => m.toString().match(new RegExp(`\\([\\w$]+\\.${type}\(?!_\)`)));
			if (!func) continue;

			const camelCaseType = type
				.toLowerCase()
				.split("_")
				.map((word, index) => {
					if (index === 0) return word;
					return word[0].toUpperCase() + word.slice(1);
				})
				.join("");
			Spicetify.URI[`${camelCaseType}URI`] = func;
		}

		// isURI functions
		const isURIFUnctions = URIModules.filter((m) => typeof m === "function" && m.toString().match(/=[\w$]+\./));
		for (const type of Object.keys(Spicetify.URI.Type)) {
			const func = isURIFUnctions.find((m) => m.toString().match(new RegExp(`===[\\w$]+\\.${type}\(?!_\)\\}`)));
			const camelCaseType = type
				.toLowerCase()
				.split("_")
				.map((word) => word[0].toUpperCase() + word.slice(1))
				.join("");

			// Fill in missing functions, only serves as placebo as they cannot be as accurate as the original functions
			Spicetify.URI[`is${camelCaseType}`] =
				func ??
				((uri) => {
					let uriObj;
					try {
						uriObj = Spicetify.URI.from?.(uri) ?? Spicetify.URI.fromString?.(uri);
					} catch {
						return false;
					}
					if (!uriObj) return false;
					return uriObj.type === Spicetify.URI.Type[type];
				});
		}

		Spicetify.URI.isPlaylistV1OrV2 = (uri) => Spicetify.URI.isPlaylist(uri) || Spicetify.URI.isPlaylistV2(uri);

		// Conversion functions
		Spicetify.URI.idToHex = URIModules.find((m) => typeof m === "function" && m.toString().includes("22==="));
		Spicetify.URI.hexToId = URIModules.find((m) => typeof m === "function" && m.toString().includes("32==="));

		// isSameIdentity
		Spicetify.URI.isSameIdentity = URIModules.find((m) => typeof m === "function" && m.toString().match(/[\w$]+\.id===[\w$]+\.id/));
	})();

	Spicetify.Events.webpackLoaded.fire();
	refreshNavLinks?.();
})();

Spicetify.Events = (() => {
	class Event {
		callbacks = [];
		on(callback) {
			if (!this.callbacks) return void callback();
			this.callbacks.push(callback);
		}
		fire() {
			for (const callback of this.callbacks) callback();
			this.callbacks = undefined;
		}
	}

	return { webpackLoaded: new Event(), platformLoaded: new Event() };
})();

// Wait for Spicetify.Player.origin._state before adding following APIs
(function waitOrigins() {
	if (!Spicetify?.Player?.origin?._state) {
		setTimeout(waitOrigins, 10);
		return;
	}

	const playerState = {
		cache: null,
		current: null,
	};

	const interval = setInterval(() => {
		if (!Spicetify.Player.origin._state?.item) return;
		Spicetify.Player.data = Spicetify.Player.origin._state;
		playerState.cache = Spicetify.Player.data;
		clearInterval(interval);
	}, 10);

	Spicetify.Player.origin._events.addListener("update", ({ data: playerEventData }) => {
		playerState.current = playerEventData.item ? playerEventData : null;
		Spicetify.Player.data = playerState.current;

		if (playerState.cache?.item?.uri !== playerState.current?.item?.uri) {
			const event = new Event("songchange");
			event.data = Spicetify.Player.data;
			Spicetify.Player.dispatchEvent(event);
		}

		if (playerState.cache?.isPaused !== playerState.current?.isPaused) {
			const event = new Event("onplaypause");
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
		if (!Spicetify.Platform?.ProductStateAPI) {
			setTimeout(waitProductStateAPI, 100);
			return;
		}

		const productStateApi = Spicetify.Platform.ProductStateAPI.productStateApi;
		Spicetify.Platform.UserAPI._product_state_service = productStateApi;
	})();

	(async function setButtonsHeight() {
		while (!Spicetify.CosmosAsync) {
			await new Promise((res) => setTimeout(res, 100));
		}
		const expFeatures = JSON.parse(localStorage.getItem("spicetify-exp-features") || "{}");
		const isGlobalNavbar = expFeatures?.enableGlobalNavBar?.value;

		if (typeof isGlobalNavbar !== "undefined" && isGlobalNavbar === "control") {
			await Spicetify.CosmosAsync.post("sp://messages/v1/container/control", {
				type: "update_titlebar",
				height: Spicetify.Platform.PlatformData.os_name === "osx" ? "42" : "40",
			});
		}
	})();

	setInterval(() => {
		if (playerState.cache?.isPaused === false) {
			const event = new Event("onprogress");
			event.data = Spicetify.Player.getProgress();
			Spicetify.Player.dispatchEvent(event);
		}
	}, 100);

	Spicetify.addToQueue = (uri) => {
		return Spicetify.Player.origin._queue.addToQueue(uri);
	};
	Spicetify.removeFromQueue = (uri) => {
		return Spicetify.Player.origin._queue.removeFromQueue(uri);
	};
})();

Spicetify.getAudioData = async (uri) => {
	const providedURI = uri || Spicetify.Player.data.item.uri;
	const uriObj = Spicetify.URI.from?.(providedURI) ?? Spicetify.URI.fromString?.(providedURI);
	if (!uriObj || (uriObj.Type || uriObj.type) !== Spicetify.URI.Type.TRACK) {
		throw "URI is invalid.";
	}

	return await Spicetify.CosmosAsync.get(
		`https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${uriObj.getBase62Id?.() ?? uriObj.id}?format=json`
	);
};

Spicetify.colorExtractor = async (uri) => {
	const body = await Spicetify.CosmosAsync.get(`https://spclient.wg.spotify.com/colorextractor/v1/extract-presets?uri=${uri}&format=json`);

	if (body.entries?.length) {
		const list = {};
		for (const color of body.entries[0].color_swatches) {
			list[color.preset] = `#${color.color?.toString(16).padStart(6, "0")}`;
		}
		return list;
	}
	return null;
};

Spicetify.LocalStorage = {
	clear: () => localStorage.clear(),
	get: (key) => localStorage.getItem(key),
	remove: (key) => localStorage.removeItem(key),
	set: (key, value) => localStorage.setItem(key, value),
};

Spicetify._getStyledClassName = (args, component) => {
	const includedKeys = [
		"role",
		"variant",
		"semanticColor",
		"iconColor",
		"color",
		"weight",
		"buttonSize",
		"iconSize",
		"position",
		"data-encore-id",
		"$size",
		"$iconColor",
		"$variant",
		"$semanticColor",
		"$buttonSize",
		"$position",
		"$iconSize",
	];
	const customKeys = ["blocksize"];
	const customExactKeys = ["$padding", "$paddingBottom", "paddingBottom", "padding"];

	const element = Array.from(args).find(
		(e) =>
			e?.children ||
			e?.dangerouslySetInnerHTML ||
			typeof e?.className !== "undefined" ||
			includedKeys.some((key) => typeof e?.[key] !== "undefined") ||
			customExactKeys.some((key) => typeof e?.[key] !== "undefined") ||
			customKeys.some((key) => Object.keys(e).some((k) => k.toLowerCase().includes(key)))
	);

	if (!element) return;

	let className = /(?:\w+__)?(\w+)-[\w-]+/.exec(component.componentId)?.[1];

	for (const key of includedKeys) {
		if ((typeof element[key] === "string" && element[key].length) || typeof element[key] === "number") {
			className += `-${element[key]}`;
		}
	}

	const excludedKeys = ["children", "className", "style", "dir", "key", "ref", "as", "$autoMirror", "autoMirror", "$hasFocus", ""];
	const excludedPrefix = ["aria-"];

	const childrenProps = ["iconLeading", "iconTrailing", "iconOnly", "$iconOnly", "$iconLeading", "$iconTrailing"];

	for (const key of childrenProps) {
		const sanitizedKey = key.startsWith("$") ? key.slice(1) : key;
		if (element[key]) className += `-${sanitizedKey}`;
	}

	const booleanKeys = Object.keys(element).filter((key) => typeof element[key] === "boolean" && element[key]);

	for (const key of booleanKeys) {
		if (excludedKeys.includes(key)) continue;
		if (excludedPrefix.some((prefix) => key.startsWith(prefix))) continue;
		const sanitizedKey = key.startsWith("$") ? key.slice(1) : key;
		className += `-${sanitizedKey}`;
	}

	const customEntries = Object.entries(element).filter(
		([key, value]) =>
			(customKeys.some((k) => key.toLowerCase().includes(k)) || customExactKeys.some((k) => key === k)) && typeof value === "string" && value.length
	);

	for (const [key, value] of customEntries) {
		const sanitizedKey = key.startsWith("$") ? key.slice(1) : key;
		className += `-${sanitizedKey}_${value.replace(/[^a-z0-9]/gi, "_")}`;
	}

	return className;
};

(function waitMouseTrap() {
	if (!Spicetify.Mousetrap) {
		setTimeout(waitMouseTrap, 10);
		return;
	}
	const KEYS = {
		BACKSPACE: "backspace",
		TAB: "tab",
		ENTER: "enter",
		SHIFT: "shift",
		CTRL: "ctrl",
		ALT: "alt",
		CAPS: "capslock",
		ESCAPE: "esc",
		SPACE: "space",
		PAGE_UP: "pageup",
		PAGE_DOWN: "pagedown",
		END: "end",
		HOME: "home",
		ARROW_LEFT: "left",
		ARROW_UP: "up",
		ARROW_RIGHT: "right",
		ARROW_DOWN: "down",
		INSERT: "ins",
		DELETE: "del",
		A: "a",
		B: "b",
		C: "c",
		D: "d",
		E: "e",
		F: "f",
		G: "g",
		H: "h",
		I: "i",
		J: "j",
		K: "k",
		L: "l",
		M: "m",
		N: "n",
		O: "o",
		P: "p",
		Q: "q",
		R: "r",
		S: "s",
		T: "t",
		U: "u",
		V: "v",
		W: "w",
		X: "x",
		Y: "y",
		Z: "z",
		WINDOW_LEFT: "meta",
		WINDOW_RIGHT: "meta",
		SELECT: "meta",
		NUMPAD_0: "0",
		NUMPAD_1: "1",
		NUMPAD_2: "2",
		NUMPAD_3: "3",
		NUMPAD_4: "4",
		NUMPAD_5: "5",
		NUMPAD_6: "6",
		NUMPAD_7: "7",
		NUMPAD_8: "8",
		NUMPAD_9: "9",
		MULTIPLY: "*",
		ADD: "+",
		SUBTRACT: "-",
		DECIMAL_POINT: ".",
		DIVIDE: "/",
		F1: "f1",
		F2: "f2",
		F3: "f3",
		F4: "f4",
		F5: "f5",
		F6: "f6",
		F7: "f7",
		F8: "f8",
		F9: "f9",
		F10: "f10",
		F11: "f11",
		F12: "f12",
		";": ";",
		"=": "=",
		",": ",",
		"-": "-",
		".": ".",
		"/": "/",
		"`": "`",
		"[": "[",
		"\\": "\\",
		"]": "]",
		// biome-ignore lint/suspicious/noDuplicateObjectKeys: <explanation>
		'"': '"',
		"~": "`",
		"!": "1",
		"@": "2",
		"#": "3",
		$: "4",
		"%": "5",
		"^": "6",
		"&": "7",
		"*": "8",
		"(": "9",
		")": "0",
		_: "-",
		"+": "=",
		":": ";",
		'"': "'",
		"<": ",",
		">": ".",
		"?": "/",
		"|": "\\",
	};

	function formatKeys(keys) {
		let keystroke = "";
		if (typeof keys === "object") {
			if (!keys.key || !Object.values(KEYS).includes(keys.key)) {
				throw `Spicetify.Keyboard.registerShortcut: Invalid key ${keys.key}`;
			}
			if (keys.ctrl) keystroke += "mod+";
			if (keys.meta) keystroke += "meta+";
			if (keys.alt) keystroke += "alt+";
			if (keys.shift) keystroke += "shift+";
			keystroke += keys.key;
		} else if (typeof keys === "string" && Object.values(KEYS).includes(keys)) {
			keystroke = keys;
		} else {
			throw `Spicetify.Keyboard.registerShortcut: Invalid keys ${keys}`;
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

			const callback = Object.keys(Spicetify.Mousetrap.trigger()._directMap).find((key) => key.startsWith(formatKeys(keys)));
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
	collaborative:
		'<path d="M4.765 1.423c-.42.459-.713.992-.903 1.554-.144.421-.264 1.173-.22 1.894.077 1.321.638 2.408 1.399 3.316v.002l.083.098c.611.293 1.16.696 1.621 1.183a2.244 2.244 0 00-.426-2.092l-.127-.153-.002-.001c-.612-.73-.997-1.52-1.051-2.442-.032-.54.066-1.097.143-1.323a2.85 2.85 0 01.589-1.022 2.888 2.888 0 014.258 0c.261.284.456.628.59 1.022.076.226.175.783.143 1.323-.055.921-.44 1.712-1.052 2.442l-.002.001-.127.153a2.25 2.25 0 00.603 3.39l2.209 1.275a3.248 3.248 0 011.605 2.457h-5.99a5.466 5.466 0 01-.594 1.5h8.259l-.184-1.665a4.75 4.75 0 00-2.346-3.591l-2.209-1.275a.75.75 0 01-.201-1.13l.126-.152h.001c.76-.909 1.32-1.995 1.399-3.316.043-.721-.077-1.473-.22-1.894a4.46 4.46 0 00-.644-1.24v-.002h-.002a4.388 4.388 0 00-6.728-.312zM2 12.5v-2h1.5v2h2V14h-2v2H2v-2H0v-1.5h2z"/>',
	album:
		'<path d="M7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14.012C3.909 14.012.988 11.091.988 7.5S3.909.988 7.5.988s6.512 2.921 6.512 6.512-2.921 6.512-6.512 6.512zM7.5 5a2.5 2.5 0 100 5 2.5 2.5 0 000-5zm0 4.012c-.834 0-1.512-.678-1.512-1.512S6.666 5.988 7.5 5.988s1.512.679 1.512 1.512S8.334 9.012 7.5 9.012z"/>',
	artist:
		'<path d="M9.692 9.133a.202.202 0 01-.1-.143.202.202 0 01.046-.169l.925-1.084a4.035 4.035 0 00.967-2.619v-.353a4.044 4.044 0 00-1.274-2.94A4.011 4.011 0 007.233.744C5.124.881 3.472 2.7 3.472 4.886v.232c0 .96.343 1.89.966 2.618l.925 1.085a.203.203 0 01.047.169.202.202 0 01-.1.143l-2.268 1.304a4.04 4.04 0 00-2.041 3.505V15h1v-1.058c0-1.088.588-2.098 1.537-2.637L5.808 10a1.205 1.205 0 00.316-1.828l-.926-1.085a3.028 3.028 0 01-.726-1.969v-.232c0-1.66 1.241-3.041 2.826-3.144a2.987 2.987 0 012.274.812c.618.579.958 1.364.958 2.21v.354c0 .722-.258 1.421-.728 1.969l-.925 1.085A1.205 1.205 0 009.194 10l.341.196c.284-.248.6-.459.954-.605l-.797-.458zM13 6.334v4.665a2.156 2.156 0 00-1.176-.351c-1.2 0-2.176.976-2.176 2.176S10.625 15 11.824 15 14 14.024 14 12.824V8.065l1.076.622.5-.866L13 6.334zM11.824 14a1.177 1.177 0 01-1.176-1.176A1.177 1.177 0 1111.824 14z"/>',
	block:
		'<path fill="none" d="M16 0v16H0V0z"/><path d="M4 8h7V7H4v1zm3.5-8a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14C3.916 14 1 11.084 1 7.5S3.916 1 7.5 1 14 3.916 14 7.5 11.084 14 7.5 14z"/>',
	brightness:
		'<path d="M8 5.25a2.75 2.75 0 100 5.5 2.75 2.75 0 000-5.5zM3.75 8a4.25 4.25 0 118.5 0 4.25 4.25 0 01-8.5 0zm3.5-6V0h1.5v2h-1.5zm0 14v-2h1.5v2h-1.5zm4.462-12.773l1.415-1.414 1.06 1.06-1.414 1.415-1.06-1.061zm-9.899 9.9l1.414-1.415 1.06 1.061-1.414 1.414-1.06-1.06zM14 7.25h2v1.5h-2v-1.5zm-14 0h2v1.5H0v-1.5zm12.773 4.462l1.414 1.415-1.06 1.06-1.415-1.414 1.061-1.06zM2.874 1.813l1.414 1.414-1.06 1.06-1.415-1.413 1.06-1.061z"/>',
	car: '<path d="M2.92 2.375A2.75 2.75 0 015.303 1h5.395c.983 0 1.89.524 2.382 1.375L14.017 4h1.233a.75.75 0 010 1.5h-.237c.989.9.988 2.117.987 2.707v7.043a.75.75 0 01-.75.75h-1.5a.75.75 0 01-.75-.75V14H3v1.25a.75.75 0 01-.75.75H.75a.75.75 0 01-.75-.75V8.207C0 7.617-.002 6.4.987 5.5H.75a.75.75 0 010-1.5h1.233l.938-1.625zm2.382.125c-.446 0-.859.238-1.082.625L3.137 5h9.726L11.78 3.125a1.25 1.25 0 00-1.083-.625H5.302zm8.57 4H2.128a2.72 2.72 0 01-.055.046c-.473.377-.556.894-.57 1.454h2.429a1 1 0 011 1v.5H1.5v3h13v-3h-3.43V9a1 1 0 011-1h2.427c-.013-.56-.096-1.077-.569-1.454a2.585 2.585 0 01-.055-.046z"/>',
	"chart-down": '<path d="M3 6l5 5.794L13 6z"/>',
	"chart-up": '<path d="M13 10L8 4.206 3 10z"/>',
	check: '<path d="M15.53 2.47a.75.75 0 0 1 0 1.06L4.907 14.153.47 9.716a.75.75 0 0 1 1.06-1.06l3.377 3.376L14.47 2.47a.75.75 0 0 1 1.06 0z"/>',
	"check-alt-fill":
		'<path d="M7.5 0C3.354 0 0 3.354 0 7.5S3.354 15 7.5 15 15 11.646 15 7.5 11.646 0 7.5 0zM6.246 12.086l-3.16-3.707 1.05-1.232 2.111 2.464 4.564-5.346 1.221 1.05-5.786 6.771z"/><path fill="none" d="M0 0h16v16H0z"/>',
	"chevron-left": '<path d="M11.521 1.38l-.65-.76L2.23 8l8.641 7.38.65-.76L3.77 8z"/>',
	"chevron-right": '<path d="M5.129.62l-.65.76L12.231 8l-7.752 6.62.65.76L13.771 8z"/>',
	"chromecast-disconnected":
		'<path d="M.667 12v2h2q0-.825-.588-1.413Q1.492 12 .667 12zm0-2.667v1.334q1.38 0 2.357.976Q4 12.619 4 14h1.333q0-.952-.369-1.817-.369-.866-.992-1.489-.623-.623-1.488-.992T.667 9.333zm0-2.666V8q1.627 0 3.008.806 1.38.805 2.186 2.186.806 1.381.806 3.008H8q0-1.198-.369-2.317-.37-1.12-1.048-2.02Q5.905 8.762 5 8.083q-.905-.678-2.024-1.047-1.119-.37-2.31-.37zM14 2H2q-.548 0-.94.393-.393.393-.393.94v2H2v-2h12v9.334H9.333V14H14q.548 0 .94-.393.393-.393.393-.94V3.333q0-.547-.393-.94Q14.548 2 14 2z"/>',
	clock:
		'<path d="M8 1.5a6.5 6.5 0 100 13 6.5 6.5 0 000-13zM0 8a8 8 0 1116 0A8 8 0 010 8z"/><path d="M8 3.25a.75.75 0 01.75.75v3.25H11a.75.75 0 010 1.5H7.25V4A.75.75 0 018 3.25z"/>',
	computer:
		'<path d="M0 2.75C0 1.784.784 1 1.75 1h12.5c.966 0 1.75.784 1.75 1.75v7.5A1.75 1.75 0 0114.25 12H1.75A1.75 1.75 0 010 10.25v-7.5zm1.75-.25a.25.25 0 00-.25.25v7.5c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25v-7.5a.25.25 0 00-.25-.25H1.75zm1.5 12.75A.75.75 0 014 14.5h8a.75.75 0 010 1.5H4a.75.75 0 01-.75-.75z"/>',
	copy: '<path d="M8.492 6.619a.522.522 0 00.058.737c.45.385.723.921.77 1.511.046.59-.14 1.163-.524 1.613l-2.372 2.777c-.385.45-.921.724-1.512.77a2.21 2.21 0 01-1.613-.524 2.22 2.22 0 01-.246-3.125l1.482-1.735a.522.522 0 10-.795-.679L2.259 9.7a3.266 3.266 0 00.362 4.599 3.237 3.237 0 002.374.771 3.234 3.234 0 002.224-1.134l2.372-2.777c.566-.663.84-1.505.771-2.375A3.238 3.238 0 009.228 6.56a.523.523 0 00-.736.059zm4.887-4.918A3.233 3.233 0 0011.004.93 3.234 3.234 0 008.78 2.064L6.409 4.84a3.241 3.241 0 00-.772 2.374 3.238 3.238 0 001.134 2.224.519.519 0 00.738-.058.522.522 0 00-.058-.737 2.198 2.198 0 01-.771-1.511 2.208 2.208 0 01.524-1.613l2.372-2.777c.385-.45.921-.724 1.512-.77a2.206 2.206 0 011.613.524 2.22 2.22 0 01.246 3.125l-1.482 1.735a.522.522 0 10.795.679L13.741 6.3a3.266 3.266 0 00-.362-4.599z"/>',
	download:
		'<path d="M7.999 9.657V4h-1v5.65L5.076 7.414l-.758.651 3.183 3.701 3.193-3.7-.758-.653-1.937 2.244zM7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14C3.916 14 1 11.084 1 7.5S3.916 1 7.5 1 14 3.916 14 7.5 11.084 14 7.5 14z"/>',
	downloaded:
		'<path d="M7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm.001 11.767L4.318 8.065l.758-.652L6.999 9.65V3h1v6.657l1.937-2.244.757.653-3.192 3.701z"/>',
	edit: '<path d="M11.472.279L2.583 10.686l-.887 4.786 4.588-1.625L15.173 3.44 11.472.279zM5.698 12.995l-2.703.957.523-2.819v-.001l2.18 1.863zm-1.53-2.623l7.416-8.683 2.18 1.862-7.415 8.683-2.181-1.862z"/>',
	enhance:
		'<path d="M11.777.972c-.364 1.054-1.195 2.322-2.798 2.83-.115.036-.115.36 0 .396 1.603.508 2.434 1.775 2.798 2.83.04.114.406.114.446 0 .364-1.055 1.195-2.322 2.798-2.83.115-.036.115-.36 0-.396-1.603-.508-2.434-1.776-2.798-2.83-.04-.114-.406-.114-.446 0zM5.295 4.5a.75.75 0 01.747.682c.06.65.334 1.68.954 2.572.606.87 1.527 1.596 2.927 1.75a.75.75 0 010 1.491c-1.4.154-2.321.88-2.927 1.751a5.683 5.683 0 00-.954 2.572.75.75 0 01-1.493 0 5.683 5.683 0 00-.954-2.572c-.606-.87-1.527-1.597-2.927-1.75a.75.75 0 010-1.492c1.4-.154 2.321-.88 2.927-1.75.62-.892.894-1.922.954-2.572a.75.75 0 01.746-.682z"/>',
	"exclamation-circle":
		'<path fill="none" d="M0 0h16v16H0z"/><path d="M8 0a8 8 0 100 16A8 8 0 008 0zm0 14.946c-3.83 0-6.946-3.116-6.946-6.946S4.17 1.054 8 1.054 14.946 4.17 14.946 8 11.83 14.946 8 14.946z"/><path d="M7.214 11.639c0-.216.076-.402.228-.558a.742.742 0 01.552-.234c.216 0 .402.078.558.234.156.155.234.342.234.558s-.078.4-.234.552a.773.773 0 01-.558.229.749.749 0 01-.552-.229.752.752 0 01-.228-.552zm1.188-1.716h-.804l-.312-6.072h1.416l-.3 6.072z"/>',
	"external-link": '<path fill-rule="evenodd" d="M15 7V1H9v1h4.29L7.11 8.18l.71.71L14 2.71V7h1zM1 15h12V9h-1v5H2V4h5V3H1v12z" clip-rule="evenodd"/>',
	facebook:
		'<path d="M8.929 14.992H6.032v-7H4.587V5.587h1.445V4.135q0-1.548.73-2.341Q7.492 1 9.167 1h1.936v2.413H9.897q-.334 0-.532.055-.198.056-.294.195-.095.139-.119.29-.023.15-.023.428v1.206h2.182l-.254 2.405H8.93v7z"/>',
	follow:
		'<path d="M3.645 6.352a2.442 2.442 0 01-.586-1.587v-.194c0-1.339 1-2.454 2.277-2.536a2.409 2.409 0 011.833.655c.129.121.241.254.34.395.266-.197.55-.368.851-.51a3.345 3.345 0 00-.507-.615 3.42 3.42 0 00-2.581-.923c-1.802.117-3.213 1.669-3.213 3.534v.193c0 .82.293 1.614.825 2.236l.772.904s.07.081-.024.134L1.743 9.125A3.449 3.449 0 000 12.118V13h1v-.882c0-.877.474-1.691 1.24-2.125l1.891-1.088a1.089 1.089 0 00.286-1.649l-.772-.904zm10.614 5.774l-1.892-1.087c-.077-.044-.023-.134-.023-.134l.771-.904a3.446 3.446 0 00.825-2.236v-.294c0-.947-.396-1.862-1.088-2.511a3.419 3.419 0 00-2.581-.923c-1.801.117-3.212 1.67-3.212 3.535v.193c0 .82.293 1.614.825 2.236l.771.904s.059.087-.023.134l-1.889 1.086A3.45 3.45 0 005 15.118V16h1v-.882c0-.877.474-1.691 1.239-2.125l1.892-1.087a1.089 1.089 0 00.286-1.65l-.773-.904a2.447 2.447 0 01-.585-1.587v-.193c0-1.339 1-2.454 2.277-2.537a2.413 2.413 0 011.833.654c.498.467.771 1.1.771 1.781v.294c0 .582-.208 1.145-.586 1.587l-.771.904a1.09 1.09 0 00.285 1.651l1.894 1.088A2.448 2.448 0 0115 15.118V16h1v-.882a3.447 3.447 0 00-1.741-2.992z"/>',
	fullscreen:
		'<path d="M6.064 10.229l-2.418 2.418L2 11v4h4l-1.647-1.646 2.418-2.418-.707-.707zM11 2l1.647 1.647-2.418 2.418.707.707 2.418-2.418L15 6V2h-4z"/>',
	gamepad:
		'<path d="M4.423 2.5a1.25 1.25 0 00-1.224.995l-1.652 7.923a1.313 1.313 0 002.423.925l1.57-2.718A1.25 1.25 0 016.622 9h2.756c.447 0 .86.238 1.083.625l1.57 2.718a1.313 1.313 0 002.422-.924l-1.652-7.924a1.25 1.25 0 00-1.224-.995H4.423zm-2.692.689A2.75 2.75 0 014.423 1h7.154a2.75 2.75 0 012.692 2.189l1.653 7.923a2.813 2.813 0 01-5.19 1.981L9.233 10.5H6.766L5.27 13.093a2.813 2.813 0 01-5.19-1.98l1.65-7.925z"/><path d="M7 5.5a1.25 1.25 0 11-2.5 0 1.25 1.25 0 012.5 0zm2 0a1.25 1.25 0 102.5 0 1.25 1.25 0 00-2.5 0z"/>',
	"grid-view": '<path d="M9 1v6h6V1H9zm5 5h-4V2h4v4zM.999 7h6V1h-6v6zM2 2h4v4H2V2zm7 13h6V9H9v6zm1-5h4v4h-4v-4zM.999 15h6V9h-6v6zM2 10h4v4H2v-4z"/>',
	heart:
		'<path d="M13.764 2.727a4.057 4.057 0 00-5.488-.253.558.558 0 01-.31.112.531.531 0 01-.311-.112 4.054 4.054 0 00-5.487.253A4.05 4.05 0 00.974 5.61c0 1.089.424 2.113 1.168 2.855l4.462 5.223a1.791 1.791 0 002.726 0l4.435-5.195A4.052 4.052 0 0014.96 5.61a4.057 4.057 0 00-1.196-2.883zm-.722 5.098L8.58 13.048c-.307.36-.921.36-1.228 0L2.864 7.797a3.072 3.072 0 01-.905-2.187c0-.826.321-1.603.905-2.187a3.091 3.091 0 012.191-.913 3.05 3.05 0 011.957.709c.041.036.408.351.954.351.531 0 .906-.31.94-.34a3.075 3.075 0 014.161.192 3.1 3.1 0 01-.025 4.403z"/>',
	"heart-active":
		'<path fill="none" d="M0 0h16v16H0z"/><path d="M13.797 2.727a4.057 4.057 0 00-5.488-.253.558.558 0 01-.31.112.531.531 0 01-.311-.112 4.054 4.054 0 00-5.487.253c-.77.77-1.194 1.794-1.194 2.883s.424 2.113 1.168 2.855l4.462 5.223a1.791 1.791 0 002.726 0l4.435-5.195a4.052 4.052 0 001.195-2.883 4.057 4.057 0 00-1.196-2.883z"/>',
	instagram:
		'<path d="M11.183 1.595Q10.175 1.548 8 1.548t-3.183.047q-.865.04-1.46.27-.516.198-.905.587-.389.39-.587.905-.23.595-.27 1.46Q1.548 5.825 1.548 8t.047 3.183q.04.865.27 1.46.198.516.587.905.39.389.905.587.595.23 1.46.27 1.008.047 3.183.047t3.183-.047q.865-.04 1.46-.27.516-.198.905-.587.389-.39.587-.905.23-.595.27-1.46.047-1.008.047-3.183t-.047-3.183q-.04-.865-.27-1.46-.198-.516-.587-.905-.39-.389-.905-.587-.595-.23-1.46-.27zM4.754.175Q5.794.127 8 .127t3.246.048q1.095.047 1.913.365.793.31 1.393.908.599.6.908 1.393.318.818.365 1.913.048 1.04.048 3.246t-.048 3.246q-.047 1.095-.365 1.913-.31.793-.908 1.393-.6.599-1.393.908-.818.318-1.913.365-1.04.048-3.246.048t-3.246-.048q-1.095-.047-1.913-.365-.793-.31-1.393-.908-.599-.6-.908-1.393-.318-.818-.365-1.913Q.127 10.206.127 8t.048-3.246Q.222 3.659.54 2.841q.31-.793.908-1.393.6-.599 1.393-.908Q3.66.222 4.754.175zm1.675 4.103Q7.175 3.96 8 3.96t1.571.318q.746.317 1.29.86.544.545.861 1.29.318.747.318 1.572 0 .825-.318 1.571-.317.746-.86 1.29-.545.544-1.29.861-.747.318-1.572.318-.825 0-1.571-.318-.746-.317-1.29-.86-.544-.545-.861-1.29Q3.96 8.824 3.96 8q0-.825.318-1.571.317-.746.86-1.29.545-.544 1.29-.861zm.254 5.996q.603.353 1.317.353t1.317-.353q.604-.353.957-.957.353-.603.353-1.317t-.353-1.317q-.353-.604-.957-.957Q8.714 5.373 8 5.373t-1.317.353q-.604.353-.957.957-.353.603-.353 1.317t.353 1.317q.353.604.957.957zm4.849-5.806q-.278-.278-.278-.67 0-.393.278-.671t.67-.278q.393 0 .671.278t.278.67q0 .393-.278.671t-.67.278q-.393 0-.671-.278z"/>',
	laptop:
		'<path d="M2 3.75C2 2.784 2.784 2 3.75 2h8.5c.966 0 1.75.784 1.75 1.75v6.5A1.75 1.75 0 0112.25 12h-8.5A1.75 1.75 0 012 10.25v-6.5zm1.75-.25a.25.25 0 00-.25.25v6.5c0 .138.112.25.25.25h8.5a.25.25 0 00.25-.25v-6.5a.25.25 0 00-.25-.25h-8.5zM.25 15.25A.75.75 0 011 14.5h14a.75.75 0 010 1.5H1a.75.75 0 01-.75-.75z"/>',
	library:
		'<path d="M8.375 1.098a.75.75 0 01.75 0l5.5 3.175a.75.75 0 01.375.65V15.25a.75.75 0 01-.75.75h-5.5a.75.75 0 01-.75-.75V1.747a.75.75 0 01.375-.65zM9.5 3.046V14.5h4V5.356l-4-2.31zM1 1.75a.75.75 0 011.5 0v13.5a.75.75 0 01-1.5 0V1.75zm3.5 0a.75.75 0 011.5 0v13.5a.75.75 0 01-1.5 0V1.75z"/>',
	"list-view": '<path d="M1 3h1V2H1v1zm3-1v1h11V2H4zM1 9h1V8H1v1zm3 0h11V8H4v1zm0 6h11v-1H4v1zm-3 0h1v-1H1v1z"/>',
	location:
		'<path d="M8 1.562a4.732 4.732 0 00-3.47 7.95l.013.014L8 13.646l3.456-4.12.013-.013A4.732 4.732 0 008 1.563zM1.768 6.294a6.232 6.232 0 1110.813 4.225L8 15.98l-4.582-5.46a6.212 6.212 0 01-1.65-4.225z"/><path d="M8 5.05a1.243 1.243 0 100 2.488A1.243 1.243 0 008 5.05zM5.257 6.295a2.743 2.743 0 115.486 0 2.743 2.743 0 01-5.486 0z"/>',
	locked:
		'<path d="M13 6h-1V4.5a4 4 0 00-8 0V6H3a1 1 0 00-1 1v7a1 1 0 001 1h10a1 1 0 001-1V7a1 1 0 00-1-1zM5 4.5c0-1.654 1.346-3 3-3s3 1.346 3 3V6H5V4.5zm8 9.5H3V7h10v7z"/>',
	"locked-active":
		'<path fill="none" d="M0 0h16v16H0z"/><path d="M13 6h-1V4.5c0-2.2-1.8-4-4-4s-4 1.8-4 4V6H3c-.6 0-1 .4-1 1v7c0 .6.4 1 1 1h10c.6 0 1-.4 1-1V7c0-.6-.4-1-1-1zM5 4.5c0-1.7 1.3-3 3-3s3 1.3 3 3V6H5V4.5z"/>',
	lyrics:
		'<path d="M8.5 1A4.505 4.505 0 004 5.5c0 .731.191 1.411.502 2.022L1.99 13.163a1.307 1.307 0 00.541 1.666l.605.349a1.307 1.307 0 001.649-.283L9.009 9.95C11.248 9.692 13 7.807 13 5.5 13 3.019 10.981 1 8.5 1zM4.023 14.245a.307.307 0 01-.388.066l-.605-.349a.309.309 0 01-.128-.393l2.26-5.078A4.476 4.476 0 007.715 9.92l-3.692 4.325zM8.5 9C6.57 9 5 7.43 5 5.5S6.57 2 8.5 2 12 3.57 12 5.5 10.429 9 8.5 9z"/>',
	menu: '<path d="M15.5 13.5H.5V12h15v1.5zm0-4.75H.5v-1.5h15v1.5zm0-4.75H.5V2.5h15V4z"/>',
	minimize:
		'<path d="M3.646 11.648l-2.418 2.417.707.707 2.418-2.418L5.999 14v-4h-4l1.647 1.648zm11.125-9.712l-.707-.707-2.418 2.418L10 2v4h4l-1.647-1.647 2.418-2.417z"/>',
	minus: '<path d="M2 7h12v2H0z"></path>',
	more: '<path d="M2 6.5a1.5 1.5 0 10-.001 2.999A1.5 1.5 0 002 6.5zm6 0a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm6 0a1.5 1.5 0 10-.001 2.999A1.5 1.5 0 0014 6.5z"/>',
	"new-spotify-connect":
		'<path d="M4 9.984v-4h1.802L9 4.143v7.69L5.802 9.984H4zm4 5.048q1.341 0 2.603-.508l.683.801q-1.58.707-3.286.707-1.627 0-3.107-.635-1.48-.635-2.552-1.707Q1.27 12.62.635 11.14 0 9.659 0 8.032q0-1.627.635-3.107.635-1.48 1.706-2.552Q3.413 1.302 4.893.667T8 .032q1.706 0 3.286.706l-.683.802Q9.341 1.032 8 1.032q-1.42 0-2.718.555-1.298.556-2.234 1.492-.937.937-1.492 2.234Q1 6.611 1 8.032q0 1.42.556 2.718.555 1.298 1.492 2.234.936.937 2.234 1.492 1.297.556 2.718.556zm4.357-12.469l.65-.761q1.398 1.119 2.195 2.746Q16 6.175 16 8.032t-.798 3.484q-.797 1.627-2.194 2.746l-.65-.762q1.23-.984 1.936-2.413Q15 9.66 15 8.032q0-1.627-.706-3.056-.707-1.428-1.937-2.413zM10.405 4.85l.643-.746q.904.699 1.428 1.722Q13 6.85 13 8.032q0 1.182-.524 2.206t-1.428 1.722l-.643-.746q.738-.563 1.166-1.393.429-.829.429-1.79 0-.96-.429-1.789-.428-.83-1.166-1.393z"/>',
	offline:
		'<path d="M12.715 3.341L13.89.703l-.913-.406-6.679 15 .913.406L8.414 13H11c2.75 0 5-2.25 5-5 0-2.143-1.38-3.954-3.285-4.659zM11 12H8.859l3.456-7.763C13.874 4.784 15 6.257 15 8c0 2.206-1.794 4-4 4zM8.79.297L7.586 3H5C2.25 3 0 5.25 0 8c0 2.143 1.38 3.954 3.285 4.659L2.11 15.297l.913.406 6.679-15L8.79.297zM3.684 11.763C2.126 11.216 1 9.743 1 8c0-2.206 1.794-4 4-4h2.141l-3.457 7.763z"/><path fill="none" d="M16 0v16H0V0z"/>',
	pause: '<path fill="none" d="M0 0h16v16H0z"/><path d="M3 2h3v12H3zM10 2h3v12h-3z"/>',
	phone:
		'<path d="M8 13a1 1 0 100-2 1 1 0 000 2z"/><path d="M4.75 0A1.75 1.75 0 003 1.75v12.5c0 .966.784 1.75 1.75 1.75h6.5A1.75 1.75 0 0013 14.25V1.75A1.75 1.75 0 0011.25 0h-6.5zM4.5 1.75a.25.25 0 01.25-.25h6.5a.25.25 0 01.25.25v12.5a.25.25 0 01-.25.25h-6.5a.25.25 0 01-.25-.25V1.75z"/>',
	play: '<path d="M4.018 14L14.41 8 4.018 2z"/>',
	playlist: '<path d="M15 14.5H5V13h10v1.5zm0-5.75H5v-1.5h10v1.5zM15 3H5V1.5h10V3zM3 3H1V1.5h2V3zm0 11.5H1V13h2v1.5zm0-5.75H1v-1.5h2v1.5z"/>',
	"playlist-folder":
		'<path d="M1.75 1A1.75 1.75 0 000 2.75v11.5C0 15.216.784 16 1.75 16h12.5A1.75 1.75 0 0016 14.25v-9.5A1.75 1.75 0 0014.25 3H7.82l-.65-1.125A1.75 1.75 0 005.655 1H1.75zM1.5 2.75a.25.25 0 01.25-.25h3.905a.25.25 0 01.216.125L6.954 4.5h7.296a.25.25 0 01.25.25v9.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25V2.75z"/>',
	plus2px: '<path d="M14 7H9V2H7v5H2v2h5v5h2V9h5z"/><path fill="none" d="M0 0h16v16H0z"/>',
	"plus-alt":
		'<path d="M7.5 0a7.5 7.5 0 100 15 7.5 7.5 0 000-15zm0 14C3.916 14 1 11.084 1 7.5S3.916 1 7.5 1 14 3.916 14 7.5 11.084 14 7.5 14zM8 3H7v4H3v1h4v4h1V8h4V7H8V3z"/>',
	podcasts:
		'<path d="M4.011 8.226a3.475 3.475 0 011.216-2.387c.179-.153.373-.288.578-.401l-.485-.875a4.533 4.533 0 00-.742.515 4.476 4.476 0 00-1.564 3.069 4.476 4.476 0 002.309 4.287l.483-.875a3.483 3.483 0 01-1.795-3.333zm-1.453 4.496a6.506 6.506 0 01.722-9.164c.207-.178.425-.334.647-.48l-.551-.835c-.257.169-.507.35-.746.554A7.449 7.449 0 00.024 7.912a7.458 7.458 0 003.351 6.848l.55-.835a6.553 6.553 0 01-1.367-1.203zm10.645-9.093a7.48 7.48 0 00-1.578-1.388l-.551.835c.518.342.978.746 1.368 1.203a6.452 6.452 0 011.537 4.731 6.455 6.455 0 01-2.906 4.914l.55.835c.257-.169.507-.351.747-.555a7.453 7.453 0 002.606-5.115 7.447 7.447 0 00-1.773-5.46zm-2.281 1.948a4.497 4.497 0 00-1.245-1.011l-.483.875a3.476 3.476 0 011.796 3.334 3.472 3.472 0 01-1.217 2.387 3.478 3.478 0 01-.577.401l.485.875a4.57 4.57 0 00.742-.515 4.476 4.476 0 001.564-3.069 4.482 4.482 0 00-1.065-3.277zM7.5 7A1.495 1.495 0 007 9.908V16h1V9.908A1.495 1.495 0 007.5 7z"/><path fill="none" d="M16 0v16H0V0z"/><path fill="none" d="M16 0v16H0V0z"/>',
	projector:
		'<path d="M11.5 9.5a1.5 1.5 0 100-3 1.5 1.5 0 000 3z"/><path d="M1.75 3A1.75 1.75 0 000 4.75v6.5C0 12.216.784 13 1.75 13H2v1.25a.75.75 0 001.5 0V13h9v1.25a.75.75 0 001.5 0V13h.25A1.75 1.75 0 0016 11.25v-6.5A1.75 1.75 0 0014.25 3H1.75zM1.5 4.75a.25.25 0 01.25-.25h12.5a.25.25 0 01.25.25v6.5a.25.25 0 01-.25.25H1.75a.25.25 0 01-.25-.25v-6.5z"/>',
	queue:
		'<path d="M15 15H1v-1.5h14V15zm0-4.5H1V9h14v1.5zm-14-7A2.5 2.5 0 013.5 1h9a2.5 2.5 0 010 5h-9A2.5 2.5 0 011 3.5zm2.5-1a1 1 0 000 2h9a1 1 0 100-2h-9z"/>',
	repeat:
		'<path d="M5.5 5H10v1.5l3.5-2-3.5-2V4H5.5C3 4 1 6 1 8.5c0 .6.1 1.2.4 1.8l.9-.5C2.1 9.4 2 9 2 8.5 2 6.6 3.6 5 5.5 5zm9.1 1.7l-.9.5c.2.4.3.8.3 1.3 0 1.9-1.6 3.5-3.5 3.5H6v-1.5l-3.5 2 3.5 2V13h4.5C13 13 15 11 15 8.5c0-.6-.1-1.2-.4-1.8z"/>',
	"repeat-once":
		'<path fill="none" d="M0 0h16v16H0z"/><path d="M5 5v-.5V4c-2.2.3-4 2.2-4 4.5 0 .6.1 1.2.4 1.8l.9-.5C2.1 9.4 2 9 2 8.5 2 6.7 3.3 5.3 5 5zM10.5 12H6v-1.5l-3.5 2 3.5 2V13h4.5c1.9 0 3.5-1.2 4.2-2.8-.5.3-1 .5-1.5.6-.7.7-1.6 1.2-2.7 1.2zM11.5 0C9 0 7 2 7 4.5S9 9 11.5 9 16 7 16 4.5 14 0 11.5 0zm.9 7h-1.3V3.6H10v-1h.1c.2 0 .3 0 .4-.1.1 0 .3-.1.4-.2.1-.1.2-.2.2-.3.1-.1.1-.2.1-.3v-.1h1.1V7z"/>',
	search:
		'<path d="M11.618 11.532A5.589 5.589 0 0013.22 7.61a5.61 5.61 0 10-5.61 5.61 5.58 5.58 0 003.246-1.04l2.912 3.409.76-.649-2.91-3.408zm-4.008.688C5.068 12.22 3 10.152 3 7.61S5.068 3 7.61 3s4.61 2.068 4.61 4.61-2.068 4.61-4.61 4.61z"/>',
	"search-active":
		'<path d="M11.955 11.157A5.61 5.61 0 107.61 13.22c1.03 0 1.992-.282 2.822-.767l2.956 3.46 1.521-1.299-2.954-3.457zm-4.345.063A3.614 3.614 0 014 7.61 3.614 3.614 0 017.61 4a3.614 3.614 0 013.61 3.61 3.614 3.614 0 01-3.61 3.61z"/>',
	shuffle:
		'<path d="M4.5 6.8l.7-.8C4.1 4.7 2.5 4 .9 4v1c1.3 0 2.6.6 3.5 1.6l.1.2zm7.5 4.7c-1.2 0-2.3-.5-3.2-1.3l-.6.8c1 1 2.4 1.5 3.8 1.5V14l3.5-2-3.5-2v1.5zm0-6V7l3.5-2L12 3v1.5c-1.6 0-3.2.7-4.2 2l-3.4 3.9c-.9 1-2.2 1.6-3.5 1.6v1c1.6 0 3.2-.7 4.2-2l3.4-3.9c.9-1 2.2-1.6 3.5-1.6z"/>',
	"skip-back": '<path d="M13 2.5L5 7.119V3H3v10h2V8.881l8 4.619z"/>',
	"skip-back15":
		'<path d="M10 4.001H6V2.5l-3.464 2L6 6.5V5h4c2.206 0 4 1.794 4 4s-1.794 4-4 4v1c2.75 0 5-2.25 5-5s-2.25-4.999-5-4.999zM2.393 8.739c-.083.126-.19.236-.32.332a1.642 1.642 0 01-.452.229 1.977 1.977 0 01-.56.092v.752h1.36V14h1.096V8.327h-.96c-.027.15-.081.287-.164.412zm5.74 2.036a1.762 1.762 0 00-.612-.368 2.295 2.295 0 00-.78-.128c-.191 0-.387.031-.584.092a1.188 1.188 0 00-.479.268l.327-1.352H8.38v-.96H5.252l-.688 2.872c.037.017.105.042.204.076l.308.108.309.107.212.076c.096-.112.223-.205.38-.28.157-.075.337-.112.54-.112.133 0 .264.021.392.063.128.043.24.105.336.188a.907.907 0 01.233.316c.059.128.088.275.088.44a.927.927 0 01-.628.916 1.19 1.19 0 01-.404.068c-.16 0-.306-.025-.435-.076a1.046 1.046 0 01-.34-.212.992.992 0 01-.229-.32 1.171 1.171 0 01-.1-.4l-1.04.248c.021.225.086.439.195.645.109.205.258.388.444.548.187.16.406.287.66.38.253.093.534.14.844.14.336 0 .636-.052.9-.156.264-.104.487-.246.672-.424.184-.179.325-.385.424-.62.099-.235.148-.485.148-.752 0-.298-.049-.565-.145-.8a1.686 1.686 0 00-.399-.591z"/>',
	"skip-forward": '<path d="M11 3v4.119L3 2.5v11l8-4.619V13h2V3z"/>',
	"skip-forward15":
		'<path d="M6 5h4v1.5l3.464-2L10 2.5V4H6C3.25 4 1 6.25 1 9s2.25 5 5 5v-1c-2.206 0-4-1.794-4-4s1.794-4 4-4zm1.935 3.739a1.306 1.306 0 01-.32.332c-.13.096-.281.172-.451.228a1.956 1.956 0 01-.562.092v.752h1.36v3.856h1.096V8.327h-.96c-.026.15-.08.287-.163.412zm6.139 2.628a1.664 1.664 0 00-.399-.592 1.747 1.747 0 00-.612-.368 2.295 2.295 0 00-.78-.128c-.191 0-.387.03-.584.092-.197.061-.357.15-.479.268l.327-1.352h2.376v-.96h-3.128l-.688 2.872c.037.016.106.041.204.076l.308.108.309.108.212.076c.096-.112.223-.206.38-.28.157-.075.337-.112.54-.112.133 0 .264.021.392.064a.97.97 0 01.336.188.907.907 0 01.233.316c.058.128.088.274.088.44a.941.941 0 01-.3.721.995.995 0 01-.328.196 1.19 1.19 0 01-.404.068c-.16 0-.306-.025-.436-.076a1.03 1.03 0 01-.569-.532 1.171 1.171 0 01-.1-.4l-1.04.248c.02.224.086.439.195.644.109.205.258.388.444.548.186.16.406.287.66.38.253.093.534.14.844.14.336 0 .636-.052.9-.156.264-.104.487-.245.672-.424.184-.179.325-.385.424-.62a1.91 1.91 0 00.148-.752c0-.3-.049-.566-.145-.801z"/>',
	soundbetter:
		'<path fill-rule="evenodd" d="M5.272 12.542h1.655V2H5.15v3.677C4.782 4.758 4.046 4.33 3.065 4.33c-.98 0-1.716.43-2.268 1.226C.245 6.352 0 7.332 0 8.435c0 1.226.245 2.207.736 3.004.49.796 1.226 1.226 2.207 1.226 1.103 0 1.9-.552 2.329-1.717v1.594zm-.49-6.068c.306.368.429.858.429 1.47v1.35c0 .55-.184 1.041-.49 1.409-.369.368-.737.552-1.166.552-1.103 0-1.655-.92-1.655-2.636 0-.92.123-1.594.49-2.023.307-.429.736-.674 1.227-.674.49 0 .858.184 1.164.552zM8.03 12.542V2h4.108c.674 0 1.287.061 1.716.245.43.123.859.43 1.165.92.307.429.49.98.49 1.593 0 .552-.183 1.103-.49 1.532-.368.43-.797.674-1.41.797.736.123 1.288.43 1.655.92.368.49.552 1.041.552 1.654 0 .797-.245 1.471-.797 2.023-.552.551-1.348.858-2.452.858H8.031zm1.778-6.13h2.33c.49 0 .858-.122 1.103-.428.245-.307.429-.674.429-1.103 0-.49-.184-.859-.49-1.042a1.712 1.712 0 00-1.104-.368H9.808v2.942zm2.452 4.536H9.808V7.884h2.452c.49 0 .92.122 1.226.429.245.306.43.674.43 1.103 0 .49-.123.858-.43 1.103-.306.307-.736.43-1.226.43z" clip-rule="evenodd"/><path d="M.674 13.523H16v1.226H.674z"/>',
	speaker:
		'<path d="M11 12.75a2 2 0 100-4 2 2 0 000 4z"/><path d="M6 2.75C6 1.784 6.783 1 7.75 1h6.5c.966 0 1.75.784 1.75 1.75v11.5A1.75 1.75 0 0114.25 16h-6.5A1.75 1.75 0 016 14.25V2.75zm1.75-.25a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h6.5a.25.25 0 00.25-.25V2.75a.25.25 0 00-.25-.25h-6.5zm-6 0a.25.25 0 00-.25.25v11.5c0 .138.112.25.25.25h2.375V16H1.75A1.75 1.75 0 010 14.25V2.75C0 1.784.784 1 1.75 1h2.375v1.5H1.75z"/><path d="M12 5.5a1 1 0 11-2 0 1 1 0 012 0z"/>',
	spotify:
		'<path d="M8 0a8 8 0 100 16A8 8 0 008 0zm3.669 11.539a.498.498 0 01-.686.166c-1.878-1.148-4.243-1.408-7.028-.772a.499.499 0 01-.222-.972c3.048-.696 5.662-.396 7.77.892a.5.5 0 01.166.686zm.979-2.178a.624.624 0 01-.858.205c-2.15-1.322-5.428-1.705-7.972-.932a.624.624 0 11-.362-1.194c2.905-.882 6.517-.455 8.987 1.063a.624.624 0 01.205.858zm.084-2.269C10.153 5.561 5.9 5.42 3.438 6.167a.748.748 0 11-.434-1.432c2.826-.857 7.523-.692 10.492 1.07a.748.748 0 01-.764 1.287z"/>',
	subtitles: '<path fill="none" d="M0 0h16v16H0z"/><path d="M3 7h10v1H3zM5 10h6v1H5z"/><path d="M15 3v10H1V3h14m1-1H0v12h16V2z"/>',
	tablet:
		'<path d="M1 1.75C1 .784 1.784 0 2.75 0h10.5C14.216 0 15 .784 15 1.75v12.5A1.75 1.75 0 0113.25 16H2.75A1.75 1.75 0 011 14.25V1.75zm1.75-.25a.25.25 0 00-.25.25v12.5c0 .138.112.25.25.25h10.5a.25.25 0 00.25-.25V1.75a.25.25 0 00-.25-.25H2.75z"/><path d="M9 12a1 1 0 11-2 0 1 1 0 012 0z"/>',
	ticket:
		'<path d="M0 2h16v5.486l-.563.145a.898.898 0 000 1.739l.563.144V15H0V9.514l.563-.144a.898.898 0 000-1.74L0 7.487V2zm1.5 1.5v2.902a2.396 2.396 0 010 4.196V13.5h13v-2.902a2.396 2.396 0 010-4.196V3.5h-13z"/><path d="M8 7.25a1.25 1.25 0 100 2.5 1.25 1.25 0 000-2.5zM5.25 8.5a2.75 2.75 0 115.5 0 2.75 2.75 0 01-5.5 0z"/>',
	twitter:
		'<path d="M13.54 3.889q.984-.595 1.333-1.683-.905.54-1.929.738-.42-.452-.996-.706-.575-.254-1.218-.254-1.254 0-2.143.889-.889.889-.889 2.15 0 .318.08.691-1.857-.095-3.484-.932-1.627-.838-2.762-2.242-.413.714-.413 1.523 0 .778.361 1.445t.988 1.08q-.714-.009-1.373-.374v.04q0 1.087.69 1.92.691.834 1.739 1.048-.397.111-.794.111-.254 0-.571-.055.285.912 1.063 1.5.778.587 1.77.603-1.659 1.302-3.77 1.302-.365 0-.722-.048Q2.619 14 5.15 14q1.358 0 2.572-.361 1.215-.361 2.147-.988.933-.627 1.683-1.46.75-.834 1.234-1.798.484-.964.738-1.988t.254-2.032q0-.262-.008-.397.88-.635 1.508-1.563-.841.373-1.738.476z"/>',
	visualizer: '<path d="M.999 15h2V5h-2v10zm4 0h2V1h-2v14zM9 15h2v-4H9v4zm4-7v7h2V8h-2z"/>',
	voice:
		'<path d="M4 4a4 4 0 118 0v3a4 4 0 01-8 0V4zm4-2.5A2.5 2.5 0 005.5 4v3a2.5 2.5 0 005 0V4A2.5 2.5 0 008 1.5z"/><path d="M2.25 6v1a5.75 5.75 0 0011.5 0V6h1.5v1a7.251 7.251 0 01-6.5 7.212V16h-1.5v-1.788A7.251 7.251 0 01.75 7V6h1.5z"/>',
	volume:
		'<path d="M12.945 1.379l-.652.763c1.577 1.462 2.57 3.544 2.57 5.858s-.994 4.396-2.57 5.858l.651.763a8.966 8.966 0 00.001-13.242zm-2.272 2.66l-.651.763a4.484 4.484 0 01-.001 6.397l.651.763c1.04-1 1.691-2.404 1.691-3.961s-.65-2.962-1.69-3.962zM0 5v6h2.804L8 14V2L2.804 5H0zm7-1.268v8.536L3.072 10H1V6h2.072L7 3.732z"/>',
	"volume-off":
		'<path d="M0 5v6h2.804L8 14V2L2.804 5H0zm7-1.268v8.536L3.072 10H1V6h2.072L7 3.732zm8.623 2.121l-.707-.707-2.147 2.147-2.146-2.147-.707.707L12.062 8l-2.146 2.146.707.707 2.146-2.147 2.147 2.147.707-.707L13.477 8l2.146-2.147z"/>',
	"volume-one-wave":
		'<path d="M10.04 5.984l.658-.77q.548.548.858 1.278.31.73.31 1.54 0 .54-.144 1.055-.143.516-.4.957-.259.44-.624.805l-.658-.77q.825-.865.825-2.047 0-1.183-.825-2.048zM0 11.032v-6h2.802l5.198-3v12l-5.198-3H0zm7 1.27v-8.54l-3.929 2.27H1v4h2.071L7 12.302z"/>',
	"volume-two-wave":
		'<path d="M0 11.032v-6h2.802l5.198-3v12l-5.198-3H0zm7 1.27v-8.54l-3.929 2.27H1v4h2.071L7 12.302zm4.464-2.314q.401-.925.401-1.956 0-1.032-.4-1.957-.402-.924-1.124-1.623L11 3.69q.873.834 1.369 1.957.496 1.123.496 2.385 0 1.262-.496 2.385-.496 1.123-1.369 1.956l-.659-.762q.722-.698 1.123-1.623z"/>',
	watch:
		'<path d="M4.347 1.122l-.403 1.899A2.25 2.25 0 002 5.25v5.5a2.25 2.25 0 001.944 2.23l.403 1.898c.14.654.717 1.122 1.386 1.122h4.535c.668 0 1.246-.468 1.385-1.122l.404-1.899A2.25 2.25 0 0014 10.75v-5.5a2.25 2.25 0 00-1.943-2.23l-.404-1.898A1.417 1.417 0 0010.267 0H5.734c-.67 0-1.247.468-1.386 1.122zM5.8 1.5h4.4l.319 1.5H5.48l.32-1.5zM10.52 13l-.319 1.5H5.8L5.481 13h5.038zM4.25 4.5h7.5a.75.75 0 01.75.75v5.5a.75.75 0 01-.75.75h-7.5a.75.75 0 01-.75-.75v-5.5a.75.75 0 01.75-.75z"/>',
	x: '<path d="M14.354 2.353l-.708-.707L8 7.293 2.353 1.646l-.707.707L7.293 8l-5.647 5.646.707.708L8 8.707l5.646 5.647.708-.708L8.707 8z"/>',
};

(async function waitUserAPI() {
	if (!Spicetify.Platform?.UserAPI) {
		setTimeout(waitUserAPI, 1000);
		return;
	}

	let subRequest;

	// product_state was renamed to product_state_service in Spotify 1.2.21
	const productState =
		Spicetify.Platform.UserAPI?._product_state ||
		Spicetify.Platform.UserAPI?._product_state_service ||
		Spicetify.Platform?.ProductStateAPI.productStateApi;

	Spicetify.AppTitle = {
		set: async (name) => {
			if (subRequest) subRequest.cancel();
			await productState.putOverridesValues({ pairs: { name } });
			subRequest = productState.subValues({ keys: ["name"] }, ({ pairs }) => {
				if (pairs.name !== name) {
					productState.putOverridesValues({ pairs: { name } }); // Restore name
				}
			});
			return subRequest;
		},
		get: async () => {
			const value = await productState.getValues();
			return value.pairs.name;
		},
		reset: async () => {
			if (subRequest) subRequest.cancel();
			await productState.delOverridesValues({ keys: ["name"] });
		},
		sub: (callback) => {
			return productState.subValues({ keys: ["name"] }, ({ pairs }) => {
				callback(pairs.name);
			});
		},
	};
})();

function parseIcon(icon, size = 16) {
	if (icon && Spicetify.SVGIcons[icon]) {
		return `<svg height="${size}" width="${size}" viewBox="0 0 ${size} ${size}" fill="currentColor">${Spicetify.SVGIcons[icon]}</svg>`;
	}
	return icon || "";
}

function createIconComponent(icon, size = 16) {
	return Spicetify.React.createElement(
		Spicetify.ReactComponent.IconComponent,
		{
			iconSize: size,
			dangerouslySetInnerHTML: {
				__html: parseIcon(icon),
			},
		},
		null
	);
}

Spicetify.ContextMenuV2 = (() => {
	const registeredItems = new Map();

	function parseProps(props) {
		if (!props) return;

		const uri = props.uri ?? props.item?.uri ?? props.reference?.uri;
		const uris = props.uris ?? (uri ? [uri] : undefined);
		if (!uris) return;

		const uid = props.uid ?? props.item?.uid;
		const uids = props.uids ?? (uid ? [uid] : undefined);

		const contextUri = props.contextUri ?? props.context?.uri;

		return [uris, uids, contextUri];
	}

	// these classes bridge the gap between react and js, insuring reactivity
	class Item {
		constructor({ children, disabled = false, leadingIcon, trailingIcon, divider, onClick, shouldAdd = () => true }) {
			// maybe use a props object and a setProps
			this.shouldAdd = shouldAdd;

			this._children = children;
			this._disabled = disabled;
			this._leadingIcon = leadingIcon;
			this._trailingIcon = trailingIcon;
			this._divider = divider;

			this._element = Spicetify.ReactJSX.jsx(() => {
				const [_children, setChildren] = Spicetify.React.useState(this._children);
				const [_disabled, setDisabled] = Spicetify.React.useState(this._disabled);
				const [_leadingIcon, setLeadingIcon] = Spicetify.React.useState(this._leadingIcon);
				const [_trailingIcon, setTrailingIcon] = Spicetify.React.useState(this._trailingIcon);
				const [_divider, setDivider] = Spicetify.React.useState(this._divider);

				Spicetify.React.useEffect(() => {
					this._setChildren = setChildren;
					this._setDisabled = setDisabled;
					this._setIcon = setLeadingIcon;
					this._setTrailingIcon = setTrailingIcon;
					this._setDivider = setDivider;

					return () => {
						this._setChildren = undefined;
						this._setDisabled = undefined;
						this._setIcon = undefined;
						this._setTrailingIcon = undefined;
						this._setDivider = undefined;
					};
				});

				const context = Spicetify.React.useContext(Spicetify.ContextMenuV2._context) ?? {};

				return Spicetify.React.createElement(Spicetify.ReactComponent.MenuItem, {
					disabled: _disabled,
					divider: _divider,
					onClick: (e) => {
						onClick(context, this, e);
					},
					leadingIcon: _leadingIcon && createIconComponent(_leadingIcon),
					trailingIcon: _trailingIcon && createIconComponent(_trailingIcon),
					children: _children,
				});
			}, {});
		}

		set children(children) {
			this._children = children;
			this._setChildren?.(this._children);
		}
		get children() {
			return this._children;
		}

		set disabled(bool) {
			this._disabled = bool;
			this._setDisabled?.(this._disabled);
		}
		get disabled() {
			return this._disabled;
		}

		set leadingIcon(name) {
			this._leadingIcon = name;
			this._setIcon?.(this._leadingIcon);
		}
		get leadingIcon() {
			return this._leadingIcon;
		}

		set trailingIcon(name) {
			this._trailingIcon = name;
			this._setTrailingIcon?.(this._trailingIcon);
		}
		get trailingIcon() {
			return this._trailingIcon;
		}

		set divider(divider) {
			this._divider = divider;
			this._setDivider?.(this._divider);
		}
		get divider() {
			return this._divider;
		}

		register() {
			Spicetify.ContextMenuV2.registerItem(this._element, this.shouldAdd);
		}
		deregister() {
			Spicetify.ContextMenuV2.unregisterItem(this._element);
		}
	}

	class ItemSubMenu {
		static itemsToComponents = (items) => items.map((item) => item._element);

		constructor({ text, disabled = false, leadingIcon, divider, items, shouldAdd = () => true }) {
			this.shouldAdd = shouldAdd;

			this._text = text;
			this._disabled = disabled;
			this._leadingIcon = leadingIcon;
			this._items = items;
			this._element = Spicetify.ReactJSX.jsx(() => {
				const [_text, setText] = Spicetify.React.useState(this._text);
				const [_disabled, setDisabled] = Spicetify.React.useState(this._disabled);
				const [_leadingIcon, setLeadingIcon] = Spicetify.React.useState(this._leadingIcon);
				const [_divider, setDivider] = Spicetify.React.useState(this._divider);
				const [_items, setItems] = Spicetify.React.useState(this._items);

				Spicetify.React.useEffect(() => {
					this._setText = setText;
					this._setDisabled = setDisabled;
					this._setLeadingIcon = setLeadingIcon;
					this._setDivider = setDivider;
					this._setItems = setItems;
					return () => {
						this._setText = undefined;
						this._setDisabled = undefined;
						this._setLeadingIcon = undefined;
						this._setDivider = undefined;
						this._setItems = undefined;
					};
				});

				return Spicetify.React.createElement(Spicetify.ReactComponent.MenuSubMenuItem, {
					displayText: _text,
					divider: _divider,
					depth: 1,
					placement: "right-start",
					onOpenChange: () => undefined,
					onClick: () => undefined,
					disabled: _disabled,
					leadingIcon: _leadingIcon && createIconComponent(_leadingIcon),
					children: ItemSubMenu.itemsToComponents(_items),
				});
			}, {});
		}

		set text(text) {
			this._text = text;
			this._setText?.(this._text);
		}
		get text() {
			return this._text;
		}

		set disabled(bool) {
			this._disabled = bool;
			this._setDisabled?.(this._disabled);
		}
		get disabled() {
			return this._disabled;
		}

		set leadingIcon(name) {
			this._leadingIcon = name;
			this._setIcon?.(this._leadingIcon);
		}
		get leadingIcon() {
			return this._leadingIcon;
		}

		set divider(divider) {
			this._divider = divider;
			this._setDivider?.(this._divider);
		}
		get divider() {
			return this._divider;
		}

		addItem(item) {
			this._items.add(item);
			this._setItems?.(this._items);
		}
		removeItem(item) {
			this._items.delete(item);
			this._setItems?.(this._items);
		}

		register() {
			registerItem(this._element, this.shouldAdd);
		}
		deregister() {
			unregisterItem(this._element);
		}
	}

	function registerItem(item, shouldAdd = () => true) {
		registeredItems.set(item, shouldAdd);
	}

	function unregisterItem(item) {
		registeredItems.delete(item);
	}

	const renderItems = () => {
		const { props, trigger, target } = Spicetify.React.useContext(Spicetify.ContextMenuV2._context) ?? {};

		return Array.from(registeredItems.entries())
			.map(([item, shouldAdd]) => shouldAdd?.(props, trigger, target) && item)
			.filter(Boolean);
	};

	return { parseProps, Item, ItemSubMenu, registerItem, unregisterItem, renderItems };
})();

Spicetify.Menu = (() => {
	const shouldAdd = (_, trigger, target) =>
		trigger === "click" && (target.classList.contains("main-userWidget-boxCondensed") || target.classList.contains("main-userWidget-box"));

	class Item extends Spicetify.ContextMenuV2.Item {
		constructor(children, isEnabled, onClick, leadingIcon) {
			super({ children, leadingIcon, onClick: (_, self) => onClick(self), shouldAdd });

			this.isEnabled = isEnabled;
		}

		setState(state) {
			this.isEnabled = state;
		}

		set isEnabled(bool) {
			this._isEnabled = bool;
			this.trailingIcon = this.isEnabled ? "check" : "";
		}
		get isEnabled() {
			return this._isEnabled;
		}
	}

	class SubMenu extends Spicetify.ContextMenuV2.ItemSubMenu {
		constructor(text, items, leadingIcon) {
			super({ text, leadingIcon, items, shouldAdd });
		}

		set name(text) {
			this.text = text;
		}
		get name() {
			return this.text;
		}

		set icon(icon) {
			this.leadingIcon = icon;
		}
		get icon() {
			return this.leadingIcon;
		}
	}

	return { Item, SubMenu };
})();

Spicetify.ContextMenu = (() => {
	const iconList = Object.keys(Spicetify.SVGIcons);

	class Item extends Spicetify.ContextMenuV2.Item {
		static iconList = iconList;

		constructor(name, onClick, shouldAdd = () => true, icon = undefined, trailingIcon = undefined, disabled = false) {
			super({
				children: name,
				disabled,
				leadingIcon: icon,
				trailingIcon,
				onClick: (context) => {
					const [uris, uids, contextUri] = Spicetify.ContextMenuV2.parseProps(context.props);
					onClick(uris, uids, contextUri);
				},
				shouldAdd: (props) => {
					const parsedProps = Spicetify.ContextMenuV2.parseProps(props);
					return parsedProps && shouldAdd(...parsedProps);
				},
			});
		}

		set name(name) {
			this.children = name;
		}
		get name() {
			return this.children;
		}

		set icon(name) {
			this.leadingIcon = name;
		}
		get icon() {
			return this.leadingIcon;
		}
	}

	class SubMenu extends Spicetify.ContextMenuV2.ItemSubMenu {
		static iconList = iconList;

		constructor(name, items, shouldAdd, disabled = false, icon = undefined) {
			super({
				text: name,
				disabled,
				leadingIcon: icon,
				items,
				shouldAdd: (props) => {
					const parsedProps = Spicetify.ContextMenuV2.parseProps(props);
					return parsedProps && shouldAdd(...parsedProps);
				},
			});
		}

		set name(name) {
			this.text = name;
		}
		get name() {
			return this.text;
		}
	}

	return { Item, SubMenu };
})();

let navLinkFactoryCtx = null;
let refreshNavLinks = null;

Spicetify._renderNavLinks = (list, isTouchScreenUi) => {
	const [refreshCount, refresh] = Spicetify.React.useReducer((x) => x + 1, 0);
	refreshNavLinks = refresh;

	if (
		!Spicetify.ReactComponent.ButtonTertiary ||
		!Spicetify.ReactComponent.Navigation ||
		!Spicetify.ReactComponent.TooltipWrapper ||
		!Spicetify.ReactComponent.ScrollableContainer ||
		!Spicetify.Platform.History ||
		!Spicetify.Platform.LocalStorageAPI
	)
		return;

	const navLinkFactory = isTouchScreenUi ? NavLinkGlobal : NavLinkSidebar;

	if (!navLinkFactoryCtx) navLinkFactoryCtx = Spicetify.React.createContext(null);
	const registered = [];

	for (const app of list) {
		let manifest;
		try {
			const request = new XMLHttpRequest();
			request.open("GET", `spicetify-routes-${app}.json`, false);
			request.send(null);
			manifest = JSON.parse(request.responseText);
		} catch {
			manifest = {};
		}

		let appProper = manifest.name;
		if (typeof appProper === "object") {
			appProper = appProper[Spicetify.Locale?.getLocale()] || appProper.en;
		}
		if (!appProper) {
			appProper = app[0].toUpperCase() + app.slice(1);
		}
		const icon = manifest.icon || "";
		const activeIcon = manifest["active-icon"] || icon;
		const appRoutePath = `/${app}`;
		registered.push({ appProper, appRoutePath, icon, activeIcon });
	}

	(function addStyling() {
		if (document.querySelector("style.spicetify-navlinks")) return;
		const style = document.createElement("style");
		style.className = "spicetify-navlinks";
		style.innerHTML = `
	:root {
		--max-custom-navlink-count: 4;
	}

	.custom-navlinks-scrollable_container {
		max-width: calc(48px * var(--max-custom-navlink-count) + 8px * (var(--max-custom-navlink-count) - 1));
		-webkit-app-region: no-drag;
	}

	.custom-navlinks-scrollable_container div[role="presentation"] > *:not(:last-child) {
		margin-inline-end: 8px;
	}

	.custom-navlinks-scrollable_container div[role="presentation"] {
		display: flex;
		flex-direction: row;
	}

	.custom-navlink {
		-webkit-app-region: unset;
	}
		`;
		document.head.appendChild(style);
	})();

	const wrapScrollableContainer = (element) =>
		Spicetify.React.createElement(
			"div",
			{ className: "custom-navlinks-scrollable_container" },
			Spicetify.React.createElement(Spicetify.ReactComponent.ScrollableContainer, null, element)
		);

	const NavLinks = () =>
		Spicetify.React.createElement(
			navLinkFactoryCtx.Provider,
			{ value: navLinkFactory },
			registered.map((NavLinkElement) => Spicetify.React.createElement(NavLink, NavLinkElement, null))
		);

	return isTouchScreenUi ? wrapScrollableContainer(NavLinks()) : NavLinks();
};

const NavLink = ({ appProper, appRoutePath, icon, activeIcon }) => {
	const isActive = Spicetify.Platform.History.location.pathname?.startsWith(appRoutePath);
	const createIcon = () => createIconComponent(isActive ? activeIcon : icon, 24);

	const NavLinkFactory = Spicetify.React.useContext(navLinkFactoryCtx);

	return NavLinkFactory && Spicetify.React.createElement(NavLinkFactory, { appProper, appRoutePath, createIcon, isActive }, null);
};

const NavLinkSidebar = ({ appProper, appRoutePath, createIcon, isActive }) => {
	const isSidebarCollapsed = Spicetify.Platform.LocalStorageAPI.getItem("ylx-sidebar-state") === 1;

	return Spicetify.React.createElement(
		"li",
		{ className: "main-yourLibraryX-navItem InvalidDropTarget" },
		Spicetify.React.createElement(
			Spicetify.ReactComponent.TooltipWrapper,
			{ label: isSidebarCollapsed ? appProper : null, disabled: !isSidebarCollapsed, placement: "right" },
			Spicetify.React.createElement(
				Spicetify.ReactComponent.Navigation,
				{
					to: appRoutePath,
					referrer: "other",
					className: Spicetify.classnames("link-subtle", "main-yourLibraryX-navLink", {
						"main-yourLibraryX-navLinkActive": isActive,
					}),
					onClick: () => undefined,
					"aria-label": appProper,
				},
				createIcon(),
				!isSidebarCollapsed && Spicetify.React.createElement(Spicetify.ReactComponent.TextComponent, { variant: "balladBold" }, appProper)
			)
		)
	);
};

const NavLinkGlobal = ({ appProper, appRoutePath, createIcon, isActive }) => {
	return Spicetify.React.createElement(
		Spicetify.ReactComponent.TooltipWrapper,
		{ label: appProper },
		Spicetify.React.createElement(Spicetify.ReactComponent.ButtonTertiary, {
			iconOnly: createIcon,
			className: Spicetify.classnames("link-subtle", "main-globalNav-navLink", "main-globalNav-link-icon", "custom-navlink", {
				"main-globalNav-navLinkActive": isActive,
			}),
			"aria-label": appProper,
			onClick: () => Spicetify.Platform.History.push(appRoutePath),
		})
	);
};

class _HTMLGenericModal extends HTMLElement {
	hide() {
		this.remove();
	}

	display({ title, content, isLarge = false }) {
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

		const hidePopup = this.hide.bind(this);

		// Listen for click events on Overlay
		this.querySelector(".GenericModal__overlay").addEventListener("click", (event) => {
			if (!this.querySelector(".GenericModal").contains(event.target)) hidePopup();
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

Object.defineProperty(Spicetify, "TippyProps", {
	value: {
		delay: [200, 0],
		animation: true,
		render(instance) {
			const popper = document.createElement("div");
			const box = document.createElement("div");

			popper.id = "context-menu";
			popper.appendChild(box);

			box.className = "main-contextMenu-tippy";
			box[instance.props.allowHTML ? "innerHTML" : "textContent"] = instance.props.content;

			function onUpdate(prevProps, nextProps) {
				if (prevProps.content !== nextProps.content) {
					if (nextProps.allowHTML) box.innerHTML = nextProps.content;
					else box.textContent = nextProps.content;
				}
			}

			return { popper, onUpdate };
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

Spicetify.Topbar = (() => {
	let leftGeneratedClassName;
	let rightGeneratedClassName;
	let leftContainer;
	let rightContainer;
	const leftButtonsStash = new Set();
	const rightButtonsStash = new Set();

	class Button {
		constructor(label, icon, onClick, disabled = false, isRight = false) {
			this.element = document.createElement("div");
			this.button = document.createElement("button");
			this.icon = icon;
			this.onClick = onClick;
			this.disabled = disabled;
			this.tippy = Spicetify.Tippy?.(this.element, {
				content: label,
				...Spicetify.TippyProps,
			});
			this.label = label;

			this.element.appendChild(this.button);
			if (isRight) {
				this.button.className = rightGeneratedClassName;
				rightButtonsStash.add(this.element);
				rightContainer?.prepend(this.element);
			} else {
				this.button.className = leftGeneratedClassName;
				leftButtonsStash.add(this.element);
				leftContainer?.append(this.element);
			}
		}
		get label() {
			return this._label;
		}
		set label(text) {
			this._label = text;
			this.button.setAttribute("aria-label", text);
			if (!this.tippy) this.button.setAttribute("title", text);
			else this.tippy.setContent(text);
		}
		get icon() {
			return this._icon;
		}
		set icon(input) {
			let newInput = input;
			if (newInput && Spicetify.SVGIcons[newInput]) {
				newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons[newInput]}</svg>`;
			}
			this._icon = newInput;
			this.button.innerHTML = newInput;
		}
		get onClick() {
			return this._onClick;
		}
		set onClick(func) {
			this._onClick = func;
			this.button.onclick = () => this._onClick(this);
		}
		get disabled() {
			return this._disabled;
		}
		set disabled(bool) {
			this._disabled = bool;
			this.button.disabled = bool;
			this.button.classList.toggle("disabled", bool);
		}
	}

	function waitForTopbarMounted() {
		const globalHistoryButtons = document.querySelector(".main-globalNav-historyButtons");
		leftGeneratedClassName = document.querySelector(
			".main-topBar-historyButtons .main-topBar-button, .main-globalNav-historyButtons .main-globalNav-icon"
		)?.className;
		rightGeneratedClassName = document.querySelector(
			".main-topBar-container .main-topBar-buddyFeed, .main-actionButtons .main-topBar-buddyFeed, .main-actionButtons .main-globalNav-buddyFeed"
		)?.className;
		leftContainer = document.querySelector(".main-topBar-historyButtons") ?? globalHistoryButtons;
		rightContainer = document.querySelector(".main-actionButtons");
		if (!leftContainer || !rightContainer || !leftGeneratedClassName || !rightGeneratedClassName) {
			setTimeout(waitForTopbarMounted, 100);
			return;
		}

		if (globalHistoryButtons) globalHistoryButtons.style = "gap: 4px; padding-inline: 4px 4px";
		for (const button of leftButtonsStash) {
			if (button.parentNode) button.parentNode.removeChild(button);

			const buttonElement = button.querySelector("button");
			buttonElement.className = leftGeneratedClassName;
		}
		leftContainer.append(...leftButtonsStash);
		for (const button of rightButtonsStash) {
			if (button.parentNode) button.parentNode.removeChild(button);

			const buttonElement = button.querySelector("button");
			buttonElement.className = rightGeneratedClassName;
		}
		rightContainer.prepend(...rightButtonsStash);
	}

	waitForTopbarMounted();
	(function waitForPlatform() {
		if (!Spicetify.Platform?.History) {
			setTimeout(waitForPlatform, 100);
			return;
		}

		Spicetify.Platform.History.listen(() => waitForTopbarMounted());
	})();

	return { Button };
})();

Spicetify.Playbar = (() => {
	let rightContainer;
	let sibling;
	const buttonsStash = new Set();

	class Button {
		constructor(label, icon, onClick = () => {}, disabled = false, active = false, registerOnCreate = true) {
			this.element = document.createElement("button");
			this.element.classList.add("main-genericButton-button");
			this.iconElement = document.createElement("span");
			this.iconElement.classList.add("Wrapper-sm-only", "Wrapper-small-only");
			this.element.appendChild(this.iconElement);
			this.icon = icon;
			this.onClick = onClick;
			this.disabled = disabled;
			this.active = active;
			addClassname(this.element);
			this.tippy = Spicetify.Tippy?.(this.element, {
				content: label,
				...Spicetify.TippyProps,
			});
			this.label = label;
			registerOnCreate && this.register();
		}
		get label() {
			return this._label;
		}
		set label(text) {
			this._label = text;
			if (!this.tippy) this.element.setAttribute("title", text);
			else this.tippy.setContent(text);
		}
		get icon() {
			return this._icon;
		}
		set icon(input) {
			let newInput = input;
			if (newInput && Spicetify.SVGIcons[newInput]) {
				newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor">${Spicetify.SVGIcons[newInput]}</svg>`;
			}
			this._icon = newInput;
			this.iconElement.innerHTML = newInput;
		}
		get onClick() {
			return this._onClick;
		}
		set onClick(func) {
			this._onClick = func;
			this.element.onclick = () => this._onClick(this);
		}
		get disabled() {
			return this._disabled;
		}
		set disabled(bool) {
			this._disabled = bool;
			this.element.disabled = bool;
			this.element.classList.toggle("disabled", bool);
		}
		set active(bool) {
			this._active = bool;
			this.element.classList.toggle("main-genericButton-buttonActive", bool);
			this.element.classList.toggle("main-genericButton-buttonActiveDot", bool);
		}
		get active() {
			return this._active;
		}
		register() {
			buttonsStash.add(this.element);
			rightContainer?.prepend(this.element);
		}
		deregister() {
			buttonsStash.delete(this.element);
			this.element.remove();
		}
	}

	(function waitForPlaybarMounted() {
		rightContainer = document.querySelector(".main-nowPlayingBar-right > div");
		if (!rightContainer) {
			setTimeout(waitForPlaybarMounted, 300);
			return;
		}
		for (const button of buttonsStash) {
			addClassname(button);
		}
		rightContainer.prepend(...buttonsStash);
	})();

	function addClassname(element) {
		sibling = document.querySelector(".main-nowPlayingBar-right .main-genericButton-button");
		if (!sibling) {
			setTimeout(addClassname, 300, element);
			return;
		}
		for (const className of Array.from(sibling.classList)) {
			if (!className.startsWith("main-genericButton")) element.classList.add(className);
		}
	}

	const widgetStash = new Set();
	let nowPlayingWidget;

	class Widget {
		constructor(label, icon, onClick = () => {}, disabled = false, active = false, registerOnCreate = true) {
			this.element = document.createElement("button");
			this.element.className = "main-addButton-button control-button control-button-heart";
			this.icon = icon;
			this.onClick = onClick;
			this.disabled = disabled;
			this.active = active;
			this.tippy = Spicetify.Tippy?.(this.element, {
				content: label,
				...Spicetify.TippyProps,
			});
			this.label = label;
			registerOnCreate && this.register();
		}
		get label() {
			return this._label;
		}
		set label(text) {
			this._label = text;
			if (!this.tippy) this.element.setAttribute("title", text);
			else this.tippy.setContent(text);
		}
		get icon() {
			return this._icon;
		}
		set icon(input) {
			let newInput = input;
			if (newInput && Spicetify.SVGIcons[newInput]) {
				newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons[newInput]}</svg>`;
			}
			this._icon = newInput;
			this.element.innerHTML = newInput;
		}
		get onClick() {
			return this._onClick;
		}
		set onClick(func) {
			this._onClick = func;
			this.element.onclick = () => this._onClick(this);
		}
		get disabled() {
			return this._disabled;
		}
		set disabled(bool) {
			this._disabled = bool;
			this.element.disabled = bool;
			this.element.classList.toggle("main-addButton-disabled", bool);
			this.element.ariaDisabled = bool;
		}
		set active(bool) {
			this._active = bool;
			this.element.classList.toggle("main-addButton-active", bool);
			this.element.ariaChecked = bool;
		}
		get active() {
			return this._active;
		}
		register() {
			widgetStash.add(this.element);
			nowPlayingWidget?.append(this.element);
		}
		deregister() {
			widgetStash.delete(this.element);
			this.element.remove();
		}
	}

	function waitForWidgetMounted() {
		nowPlayingWidget = document.querySelector(".main-nowPlayingWidget-nowPlaying");
		if (!nowPlayingWidget) {
			setTimeout(waitForWidgetMounted, 300);
			return;
		}
		nowPlayingWidget.append(...widgetStash);
	}

	(function attachObserver() {
		const leftPlayer = document.querySelector(".main-nowPlayingBar-left");
		if (!leftPlayer) {
			setTimeout(attachObserver, 300);
			return;
		}
		waitForWidgetMounted();
		const observer = new MutationObserver((mutations) => {
			for (const mutation of mutations) {
				if (mutation.removedNodes.length > 0) {
					nowPlayingWidget = null;
					waitForWidgetMounted();
				}
			}
		});
		observer.observe(leftPlayer, { childList: true });
	})();

	return { Button, Widget };
})();

(async function checkForUpdate() {
	if (!Spicetify.Config) {
		setTimeout(checkForUpdate, 300);
		return;
	}
	const { check_spicetify_update, version } = Spicetify.Config;
	// Skip checking if upgrade check is disabled, or version is Dev/version is not set
	if (!check_spicetify_update || !version || version === "Dev") return;
	// Fetch latest version from GitHub
	try {
		let changelog;
		const res = await fetch("https://api.github.com/repos/spicetify/cli/releases/latest");
		const { tag_name, html_url, body } = await res.json();
		const semver = tag_name.slice(1);
		const changelogRawDataOld = body.match(/## What's Changed([\s\S]*?)\r\n\r/)?.[1];
		if (changelogRawDataOld) {
			changelog = [...changelogRawDataOld.matchAll(/\r\n\*\s(.+?)\sin\shttps/g)]
				.map((match) => {
					const featureData = match[1].split("@");
					const feature = featureData[0];
					const committerID = featureData[1];
					return `<li>${feature}<a href="https://github.com/${committerID}">${committerID}</a></li>`;
				})
				.join("\n");
		} else {
			const sections = body.split("\n## ");
			const filteredSections = sections.filter((section) => !section.startsWith("Compatibility"));
			const filteredText = filteredSections.join("\n## ");
			changelog = [...filteredText.matchAll(/- (?:\*\*(.+?)\*\*:? )?(.+?) \(\[(.+?)\]\((.+?)\)\)/g)]
				.map((match) => {
					const feature = match[1];
					const description = match[2];
					const prNumber = match[3];
					const prLink = match[4];
					let text = "<li>";
					if (feature) text += `<strong>${feature}</strong>${!feature.endsWith(":") ? ": " : " "}`;
					text += `${description} (<a href="${prLink}">${prNumber}</a>)</li>`;
					return text;
				})
				.join("\n");
		}

		if (semver !== version) {
			const content = document.createElement("div");
			content.id = "spicetify-update";
			content.innerHTML = `
				<style>
					#spicetify-update a {
						text-decoration: underline;
					}
					#spicetify-update pre {
						cursor: pointer;
						font-size: 1rem;
						padding: 0.5rem;
						background-color: var(--spice-highlight-elevated);
						border-radius: 0.25rem;
					}
					#spicetify-update hr {
						border-color: var(--spice-subtext);
						margin-top: 1rem;
						margin-bottom: 1rem;
					}
					#spicetify-update ul,
					#spicetify-update ol {
						padding-left: 1.5rem;
					}
					#spicetify-update li {
						margin-top: 0.5rem;
						margin-bottom: 0.5rem;
						list-style-type: disc;
					}
					#spicetify-update ol > li {
						list-style-type: decimal;
					}
					.spicetify-update-space {
						margin-bottom: 25px;
					}
					.spicetify-update-little-space {
						margin-bottom: 8px;
					}
				</style>
				<p class="spicetify-update-space">Update Spicetify to receive new features and bug fixes.</p>
				<p> Current version: ${version} </p>
				<p> Latest version:
					<a href="${html_url}" target="_blank" rel="noopener noreferrer">
						${semver}
					</a>
				</p>
				<hr>
				<h3>What's Changed</h3>
				<details>
					<summary>
						See changelog
					</summary>
					<ul>
						${changelog}
					</ul>
				</details>
				<hr>
				<h3>Guide</h3>
				<p>Run these commands in the terminal:</p>
				<ol>
					<li>Update Spicetify CLI</li>
					<pre class="spicetify-update-little-space">spicetify update</pre>
					<p>Spicetify will automatically apply changes to Spotify after upgrading to the latest version.</p>
					<p>If you installed Spicetify via a package manager, update using said package manager.</p>
				</ol>
			`;

			(function waitForTippy() {
				if (!Spicetify.Tippy) {
					setTimeout(waitForTippy, 300);
					return;
				}

				const tippy = Spicetify.Tippy(content.querySelectorAll("pre"), {
					content: "Click to copy",
					hideOnClick: false,
					...Spicetify.TippyProps,
				});

				for (const instance of tippy) {
					instance.reference.addEventListener("click", () => {
						Spicetify.Platform.ClipboardAPI.copy(instance.reference.textContent);
						instance.setContent("Copied!");
						setTimeout(() => instance.setContent("Click to copy"), 1000);
					});
				}
			})();

			const updateModal = {
				title: "Update Spicetify",
				content,
				isLarge: true,
			};

			new Spicetify.Topbar.Button(
				"Update Spicetify",
				`<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width="22px" height="22px" viewBox="0 0 320.000000 400.000000"><g transform="translate(0.000000,400.000000) scale(0.100000,-0.100000)" fill="currentColor"><path d="M2213 3833 c3 -10 18 -52 34 -93 25 -67 28 -88 28 -200 0 -113 -3 -131 -27 -188 -87 -207 -222 -340 -613 -602 -206 -139 -308 -223 -442 -364 -117 -124 -133 -129 -146 -51 -28 173 -52 229 -130 307 -69 69 -133 101 -214 106 -80 5 -113 -3 -113 -28 0 -13 14 -25 43 -38 63 -28 113 -76 144 -140 25 -51 28 -68 28 -152 -1 -141 -27 -221 -193 -600 -133 -305 -164 -459 -138 -685 20 -168 46 -268 101 -382 127 -262 351 -451 642 -540 81 -24 102 -27 268 -27 159 -1 190 2 265 22 172 47 315 129 447 255 164 157 251 322 304 572 26 124 31 308 15 585 -7 130 -6 168 8 240 42 211 148 335 316 371 38 8 50 15 50 29 0 23 -27 30 -120 30 -101 0 -183 -22 -250 -68 -52 -36 -71 -58 -163 -203 -46 -73 -90 -96 -141 -75 -41 17 -51 43 -44 118 4 39 29 97 106 248 198 388 264 606 264 880 0 200 -37 347 -123 492 -53 91 -156 198 -188 198 -18 0 -22 -4 -18 -17z m-591 -2208 c277 -37 576 -148 608 -226 25 -59 -20 -129 -82 -129 -15 0 -61 16 -101 36 -133 67 -288 111 -480 135 -131 16 -447 7 -542 -16 -38 -10 -95 -19 -125 -22 -46 -4 -59 -1 -77 16 -41 38 -42 102 -4 140 33 33 270 78 441 84 109 4 249 -4 362 -18z m-40 -354 c142 -25 276 -68 397 -129 76 -38 97 -53 107 -79 23 -53 -8 -103 -63 -103 -19 0 -67 17 -111 39 -92 46 -203 84 -315 108 -128 28 -450 25 -573 -5 -68 -17 -97 -20 -117 -13 -47 18 -62 80 -29 120 55 69 457 104 704 62z m-48 -326 c183 -28 418 -126 432 -181 7 -29 -16 -69 -45 -77 -12 -3 -62 15 -123 43 -175 82 -240 95 -468 95 -149 0 -214 -4 -274 -18 -43 -9 -87 -17 -97 -17 -27 0 -59 35 -59 64 0 50 47 67 280 100 67 9 266 4 354 -9z"/></g></svg>`,
				() => Spicetify.PopupModal.display(updateModal)
			);
		}
	} catch (err) {
		console.error(err);
	}
})();
