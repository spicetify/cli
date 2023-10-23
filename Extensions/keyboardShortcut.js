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

		// Activate Vim mode and set cancel key to 'ESCAPE'
		f: {
			callback: event => {
				vim.activate(event);
				vim.setCancelKey("ESCAPE");
			}
		}
	};
	Object.entries(binds).forEach(([key, { staticCondition, callback }]) => {
		if (typeof staticCondition === "undefined" || staticCondition) {
			Spicetify.Mousetrap.bind(key, event => {
				if (!vim.isActive) {
					callback(event);
				}
			});
		}
	});

	// Functions
	function focusOnApp() {
		return document.querySelector(".Root__main-view .os-viewport");
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
			"#spicetify-sticky-list .main-yourLibraryX-navLink, .main-yourLibraryX-listItem > div > div:first-child"
		);
		const maxIndex = allItems.length - 1;

		let index = findActiveIndex(allItems) + direction;
		if (index < 0) index = maxIndex;
		else if (index > maxIndex) index = 0;

		allItems[index].click();
	}
})();

function VimBind() {
	const elementQuery = ["[href]", "button", "td.tl-play", "td.tl-number", "tr.TableRow", "[role='button']"].join(",");

	const keyList = "qwertasdfgzxcvyuiophjklbnm".split("");

	const lastKeyIndex = keyList.length - 1;

	this.isActive = false;

	const vimOverlay = document.createElement("div");
	vimOverlay.id = "vim-overlay";
	vimOverlay.style.zIndex = "9999";
	vimOverlay.style.position = "absolute";
	vimOverlay.style.width = "100%";
	vimOverlay.style.height = "100%";
	vimOverlay.style.display = "none";
	vimOverlay.innerHTML = `<style>
.vim-key {
    position: fixed;
    padding: 3px 6px;
    background-color: black;
    border-radius: 3px;
    border: solid 2px white;
    color: white;
    text-transform: lowercase;
    line-height: normal;
    font-size: 14px;
    font-weight: 500;
}
</style>`;
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
			vimkey.forEach(e => e.remove());
			return;
		}

		let firstKey = 0;
		let secondKey = 0;

		getLinks().forEach(e => {
			if (e.style.display === "none" || e.style.visibility === "hidden" || e.style.opacity === "0") {
				return;
			}

			const bound = e.getBoundingClientRect();
			let owner = document.body;

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
				return;
			}

			vimOverlay.append(createKey(e, keyList[firstKey] + keyList[secondKey], top, left));

			secondKey++;
			if (secondKey > lastKeyIndex) {
				secondKey = 0;
				firstKey++;
			}
		});

		this.isActive = true;
		setTimeout(() => (mousetrap.stopCallback = orgStopCallback.bind(mousetrap)), 100);
	};

	/**
	 *
	 * @param {KeyboardEvent} event
	 */
	this.deactivate = function (event) {
		mousetrap.stopCallback = () => true;
		this.isActive = false;
		vimOverlay.style.display = "none";
		getVims().forEach(e => e.remove());
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
				click(div.target);
				this.deactivate(event);
				return;
			}

			div.innerText = newText;
		}

		if (vimOverlay.childNodes.length === 1) {
			this.deactivate(event);
		}
	}

	/**
	 * @param {HTMLElement} element
	 */
	function click(element) {
		if (element.hasAttribute("href") || element.tagName === "BUTTON" || element.role === "button") {
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
		div.style.top = top + "px";
		div.style.left = left + "px";
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
