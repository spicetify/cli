// NAME: Keyboard Shortcut
// AUTHOR: khanhas, OhItsTom
// DESCRIPTION: Register a few more keybinds to support keyboard-driven navigation in Spotify client.

/// <reference path="../globals.d.ts" />

(function KeyboardShortcut() {
	if (!Spicetify.Mousetrap) {
		setTimeout(KeyboardShortcut, 1000);
		return;
	}

	// Variables / Conditions
	const vim = new VimBind();
	const SCROLL_STEP = 25;

	/**
	 * Binds a keyboard shortcut using Mousetrap.
	 * @param {string} key - The Mousetrap keybind.
	 * @param {boolean | undefined} staticCondition - A static condition.
	 * @param {(event: KeyboardEvent) => void} callback - Callback function for the event.
	 */
	const binds = {
		// Shutdown Spotify using Ctrl+Q
		"ctrl+q": {
			callback: () =>
				Spicetify.CosmosAsync.post("sp://esperanto/spotify.desktop.lifecycle_esperanto.proto.DesktopLifecycle/Shutdown") &&
				Spicetify.CosmosAsync.post("sp://desktop/v1/shutdown"),
		},

		// Rotate through sidebar items using Ctrl+Tab and Ctrl+Shift+Tab
		"ctrl+tab": { callback: () => rotateSidebar(1) },
		"ctrl+shift+tab": { callback: () => rotateSidebar(-1) },

		// Focus on the app content before scrolling using Shift+PageUp and Shift+PageDown
		"shift+pageup": { callback: () => focusOnApp() },
		"shift+pagedown": { callback: () => focusOnApp() },

		// Scroll actions using 'j' and 'k' keys
		j: { callback: () => createScrollCallback(SCROLL_STEP) },
		k: { callback: () => createScrollCallback(-SCROLL_STEP) },

		// Scroll to the top ('g') or bottom ('Shift+g') of the page
		g: { callback: () => scrollToPosition(0) },
		"shift+g": { callback: () => scrollToPosition(1) },

		// Shift + H and Shift + L to go back and forward page
		"shift+h": { callback: () => Spicetify.Platform.History.goBack() },
		"shift+l": { callback: () => Spicetify.Platform.History.goForward() },

		// M to Like/Unlike track
		m: { callback: () => Spicetify.Player.toggleHeart() },

		// Forward Slash to open search page
		"/": { callback: () => Spicetify.Platform.History.replace("/search") },

		// CTRL + Arrow Left Next and CTRL + Arrow Right  Previous Song
		"ctrl+left": { callback: () => Spicetify.Player.back() },
		"ctrl+right": { callback: () => Spicetify.Player.next() },

		// CTRL + Arrow Up Increase Volume CTRL + Arrow Down Decrease Volume
		"ctrl+up": { callback: () => Spicetify.Player.setVolume(Spicetify.Player.getVolume() + 0.05) },
		"ctrl+down": { callback: () => Spicetify.Player.setVolume(Spicetify.Player.getVolume() - 0.05) },

		// Activate Vim mode and set cancel key to 'ESCAPE'
		f: {
			callback: (event) => {
				vim.activate(event);
				vim.setCancelKey("ESCAPE");
			},
		},
	};

	// Bind all the keys
	for (const [key, { staticCondition, callback }] of Object.entries(binds)) {
		if (typeof staticCondition === "undefined" || staticCondition) {
			Spicetify.Mousetrap.bind(key, (event) => {
				event.preventDefault();
				if (!vim.isActive) {
					callback(event);
				}
			});
		}
	}

	// re-render vim on window resize & prevent mouse event while active
	window.addEventListener(
		"resize",
		(event) => {
			if (vim.isActive) {
				vim.activate();
			}
		},
		true
	);

	window.addEventListener(
		"mousedown",
		(event) => {
			if (vim.isActive) {
				event.stopPropagation();
			}
		},
		true
	);

	// Functions
	function focusOnApp() {
		return document.querySelector(
			".Root__main-view .os-viewport, .Root__main-view .main-view-container > .main-view-container__scroll-node:not([data-overlayscrollbars-initialize]), .Root__main-view .main-view-container__scroll-node > [data-overlayscrollbars-viewport]"
		);
	}

	function createScrollCallback(step) {
		const app = focusOnApp();
		if (app) {
			const scrollInterval = setInterval(() => {
				app.scrollTop += step;
			}, 10);
			document.addEventListener("keyup", () => {
				clearInterval(scrollInterval);
			});
		}
	}

	function scrollToPosition(position) {
		const app = focusOnApp();
		app.scroll(0, position === 0 ? 0 : app.scrollHeight);
	}

	/**
	 * @returns {number | undefined}
	 * @param {NodeListOf<Element>} allItems
	 */
	function findActiveIndex(allItems) {
		const activeLink = document.querySelector(".main-yourLibraryX-navLinkActive");
		const historyURI = Spicetify.Platform.History.location.pathname.replace(/^\//, "spotify:").replace(/\//g, ":");
		const activePage = document.querySelector(`[aria-describedby="onClickHint${historyURI}"]`);

		if (!activeLink && !activePage) {
			return -1;
		}

		let index = 0;
		for (const item of allItems) {
			if (item === activeLink || item === activePage) {
				return index;
			}

			index++;
		}
	}

	/**
	 *
	 * @param {1 | -1} direction
	 */
	function rotateSidebar(direction) {
		const allItems = document.querySelectorAll(
			"#spicetify-sticky-list .main-yourLibraryX-navLink, .main-yourLibraryX-listItem > div:not(:has([data-skip-in-keyboard-nav])) > div:first-child"
		);
		const maxIndex = allItems.length - 1;

		let index = findActiveIndex(allItems) + direction;
		if (index < 0) index = maxIndex;
		else if (index > maxIndex) index = 0;

		allItems[index].click();
	}
})();

function VimBind() {
	const elementQuery = ["[href]", "button", ".main-trackList-trackListRow", "[role='button']"].join(",");

	const keyList = "qwertasdfgzxcvyuiophjklbnm".split("");

	const lastKeyIndex = keyList.length - 1;

	this.isActive = false;

	const vimOverlay = document.createElement("div");
	const baseOverlay = document.createElement("div");
	const tippyOverlay = document.createElement("div");
	vimOverlay.id = "vim-overlay";
	baseOverlay.id = "base-overlay";
	tippyOverlay.id = "tippy-overlay";
	vimOverlay.style.position = baseOverlay.style.position = tippyOverlay.style.position = "absolute";
	vimOverlay.style.width = baseOverlay.style.width = tippyOverlay.style.width = "100%";
	vimOverlay.style.height = baseOverlay.style.height = tippyOverlay.style.height = "100%";
	baseOverlay.style.zIndex = "9999";
	tippyOverlay.style.zIndex = "10000";
	vimOverlay.style.display = "none";
	vimOverlay.innerHTML = `<style>
.vim-key {
    position: fixed;
    padding: 3px 6px;
    background-color: var(--spice-button-disabled);
    border-radius: 3px;
    border: solid 2px var(--spice-text);
    color: var(--spice-text);
    text-transform: lowercase;
    line-height: normal;
    font-size: 14px;
    font-weight: 500;
}
</style>`;
	vimOverlay.append(baseOverlay);
	vimOverlay.append(tippyOverlay);
	document.body.append(vimOverlay);

	const mousetrap = new Spicetify.Mousetrap(document);
	mousetrap.bind(keyList, listenToKeys.bind(this), "keypress");
	// Pause mousetrap event emitter
	const orgStopCallback = mousetrap.stopCallback;
	mousetrap.stopCallback = () => true;

	/**
	 *
	 * @param {KeyboardEvent} event
	 */
	this.activate = function (event) {
		vimOverlay.style.display = "block";

		const vimkey = getVims();
		if (vimkey.length > 0) {
			for (const e of vimkey) {
				e.remove();
			}
		}

		let firstKey = 0;
		let secondKey = 0;

		for (const e of getLinks()) {
			const computed = window.getComputedStyle(e);
			if (computed.display === "none" || computed.visibility === "hidden" || computed.opacity === "0") {
				continue;
			}

			const bound = e.getBoundingClientRect();
			const owner = document.body;

			let top = bound.top;
			let left = bound.left;

			if (
				bound.bottom > owner.clientHeight ||
				bound.left > owner.clientWidth ||
				bound.right < 0 ||
				bound.top < 0 ||
				bound.width === 0 ||
				bound.height === 0
			) {
				continue;
			}

			// Exclude certain elements from the centering calculation
			if (e.parentNode.role !== "row") {
				top = top + bound.height / 2 - 15;
				left = left + bound.width / 2 - 15;
			}

			// Append the key to the correct overlay
			if (e.tagName === "BUTTON" && e.parentNode.tagName === "LI") {
				tippyOverlay.append(createKey(e, keyList[firstKey] + keyList[secondKey], top, left));
			} else {
				baseOverlay.append(createKey(e, keyList[firstKey] + keyList[secondKey], top, left));
			}

			secondKey++;
			if (secondKey > lastKeyIndex) {
				secondKey = 0;
				firstKey++;
			}
		}

		this.isActive = true;
		setTimeout(() => {
			mousetrap.stopCallback = orgStopCallback.bind(mousetrap);
		}, 100);
	};

	/**
	 *
	 * @param {KeyboardEvent} event
	 */
	this.deactivate = function (event) {
		mousetrap.stopCallback = () => true;
		this.isActive = false;
		vimOverlay.style.display = "none";
		for (const e of getVims()) {
			e.remove();
		}
	};

	function getLinks() {
		const elements = Array.from(document.querySelectorAll(elementQuery));
		return elements;
	}

	function getVims() {
		return Array.from(vimOverlay.getElementsByClassName("vim-key"));
	}

	/**
	 * @param {KeyboardEvent} event
	 */
	function listenToKeys(event) {
		if (!this.isActive) {
			return;
		}

		const vimkey = getVims();

		if (vimkey.length === 0) {
			this.deactivate(event);
			return;
		}

		for (const div of vimkey) {
			const text = div.innerText.toLowerCase();
			if (text[0] !== event.key) {
				div.remove();
				continue;
			}

			const newText = text.slice(1);
			if (newText.length === 0) {
				interact(div.target);
				this.deactivate(event);
				return;
			}

			div.innerText = newText;
		}

		if (baseOverlay.childNodes.length === 0 && tippyOverlay.childNodes.length === 0) {
			this.deactivate(event);
		}
	}

	/**
	 * @param {HTMLElement} element
	 */
	function interact(element) {
		// Hover on contextmenu dropdown list items
		if (element.tagName === "BUTTON" && element.parentNode.tagName === "LI" && element.ariaExpanded !== null) {
			const event = new MouseEvent("mouseover", {
				view: window,
				bubbles: true,
				cancelable: true,
			});

			element.dispatchEvent(event);
			return;
		}

		if (element.hasAttribute("href") || element.tagName === "BUTTON" || element.role === "button" || element.parentNode.role === "row") {
			element.click();
			return;
		}

		const findButton = element.querySelector(`button[data-ta-id="play-button"]`) || element.querySelector(`button[data-button="play"]`);
		if (findButton instanceof HTMLButtonElement) {
			findButton.click();
			return;
		}
		alert("Let me know where you found this button, please. I can't click this for you without that information.");
		return;
	}

	/**
	 * @param {Element} target
	 * @param {string} key
	 * @param {string | number} top
	 * @param {string | number} left
	 */
	function createKey(target, key, top, left) {
		const div = document.createElement("span");
		div.classList.add("vim-key");
		div.innerText = key;
		div.style.top = `${top}px`;
		div.style.left = `${left}px`;
		div.target = target;
		return div;
	}

	/**
	 *
	 * @param {Spicetify.Keyboard.ValidKey} key
	 */
	this.setCancelKey = function (key) {
		mousetrap.bind(Spicetify.Keyboard.KEYS[key], this.deactivate.bind(this));
	};

	return this;
}
