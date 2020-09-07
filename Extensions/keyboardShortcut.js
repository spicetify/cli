//@ts-check

// NAME: Keyboard Shortcut
// AUTHOR: khanhas
// DESCRIPTION: Register a few more keybinds to support keyboard-driven navigation in Spotify client. 

/// <reference path="../globals.d.ts" />

(function KeyboardShortcut() {
    if (!Spicetify.Keyboard) {
        setTimeout(KeyboardShortcut, 1000);
        return;
    }

    const SCROLL_STEP = 50;

    /**
     * Register your own keybind with function `registerBind`
     * 
     * Syntax:
     *     registerBind(keyName, ctrl, shift, alt, callback)
     * 
     * ctrl, shift and alt are boolean, true or false
     * 
     * Valid keyName:
     * - BACKSPACE       - C               - Y               - F3
     * - TAB             - D               - Z               - F4
     * - ENTER           - E               - WINDOW_LEFT     - F5
     * - SHIFT           - F               - WINDOW_RIGHT    - F6
     * - CTRL            - G               - SELECT          - F7
     * - ALT             - H               - NUMPAD_0        - F8
     * - PAUSE/BREAK     - I               - NUMPAD_1        - F9
     * - CAPS            - J               - NUMPAD_2        - F10
     * - ESCAPE          - K               - NUMPAD_3        - F11
     * - SPACE           - L               - NUMPAD_4        - F12
     * - PAGE_UP         - M               - NUMPAD_5        - NUM_LOCK
     * - PAGE_DOWN       - N               - NUMPAD_6        - SCROLL_LOCK
     * - END             - O               - NUMPAD_7        - ;
     * - HOME            - P               - NUMPAD_8        - =
     * - ARROW_LEFT      - Q               - NUMPAD_9        - ,
     * - ARROW_UP        - R               - MULTIPLY        - -
     * - ARROW_RIGHT     - S               - ADD             - /
     * - ARROW_DOWN      - T               - SUBTRACT        - `
     * - INSERT          - U               - DECIMAL_POINT   - [
     * - DELETE          - V               - DIVIDE          - \
     * - A               - W               - F1              - ]
     * - B               - X               - F2              - "
     * 
     * Use one of keyName as a string. If key that you want isn't in that list,
     * you can also put its keycode number in keyName as a number.
     * 
     * callback is name of function you want your shortcut to bind to. It also 
     * returns one KeyboardEvent parameter.
     * 
     * Following are my default keybinds, use them as examples.
     */

    // Ctrl + Tab and Ctrl + Shift + Tab to switch sidebar items
    registerBind("TAB", true, false, false, rotateSidebarDown);
    registerBind("TAB", true, true, false, rotateSidebarUp);

    // Ctrl + Q to open Queue page
    registerBind("Q", true, false, false, clickQueueButton);

    // Shift + H and Shift + L to go back and forward page
    registerBind("H", false, true, false, clickNavigatingBackButton);
    registerBind("L", false, true, false, clickNavigatingForwardButton);

    // PageUp, PageDown to focus on iframe app before scrolling
    registerBind("PAGE_UP", false, true, false, focusOnApp);
    registerBind("PAGE_DOWN", false, true, false, focusOnApp);

    // J and K to vertically scroll app
    registerBind("J", false, false, false, appScrollDown);
    registerBind("K", false, false, false, appScrollUp);

    // H and L to horizontally scroll carousel
    registerBind("H", false, false, false, carouselScrollLeft);
    registerBind("L", false, false, false, carouselScrollRight);

    // G and Shift + G to scroll to top and to bottom
    registerBind("G", false, false, false, appScrollTop);
    registerBind("G", false, true, false, appScrollBottom);

    // M to Like/Unlike track
    registerBind("M", false, false, false, Spicetify.Player.toggleHeart);

    // Forward Slash to open search page
    registerBind("/", false, false, false, openSearchPage);

    // F to activate Link Follow function
    const vim = new VimBind();
    registerBind("F", false, false, false, vim.activate.bind(vim));
    // Esc to cancle Link Follow
    Spicetify.Keyboard.registerImportantShortcut(Spicetify.Keyboard.KEYS["ESCAPE"], vim.deactivate.bind(vim));

    function rotateSidebarDown() {
        rotateSidebar(1)
    }

    function rotateSidebarUp() {
        rotateSidebar(-1)
    }

    function clickQueueButton() {
        document.getElementById("player-button-queue").click();
    }

    function clickNavigatingBackButton() {
        document.querySelector("#header .back").click();
    }

    function clickNavigatingForwardButton() {
        document.querySelector("#header .forward").click();
    }

    function appScrollDown() {
        const app = focusOnApp();
        if (app) {
            app.scrollBy(0, SCROLL_STEP);
        }
    }

    function appScrollUp() {
        const app = focusOnApp();
        if (app) {
            app.scrollBy(0, -SCROLL_STEP);
        }
    }

    function carouselScrollLeft() {
        const app = focusOnApp();
        if (app) {
            scrollCarousel(app.querySelectorAll(CAROUSEL_CLASSES), false);
        }
    }

    function carouselScrollRight() {
        const app = focusOnApp();
        if (app) {
            scrollCarousel(app.querySelectorAll(CAROUSEL_CLASSES), true);
        }
    }

    function appScrollBottom() {
        const app = focusOnApp();
        app.scroll(0, app.scrollHeight);
    }

    function appScrollTop() {
        const app = focusOnApp();
        app.scroll(0, 0);
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    function openSearchPage(event) {
        const sidebarItem = document.querySelector(`#view-navigation-bar a[href="spotify:app:search:"]`);
        if (sidebarItem) {
            sidebarItem.click();
            return;
        }

        const searchInput = document.querySelector(".SearchInput__input");
        if (searchInput) {
            searchInput.focus();
        }

        event.preventDefault();
    }

    const CAROUSEL_CLASSES = `.Carousel, .crsl-item.col-xs-12.col-sm-12.col-md-12.col-lg-12`;
    const CAROUSEL_NEXT_CLASSES = `[data-ta-id="next-button"], [data-button="carousel-next"]`;
    const CAROUSEL_PREVIOUS_CLASSES = `[data-ta-id="previous-button"], [data-button="carousel-previous"]`;

    /**
     * 
     * @param {string | number} keyName 
     * @param {boolean} ctrl 
     * @param {boolean} shift 
     * @param {boolean} alt 
     * @param {(event: KeyboardEvent) => void} callback 
     */
    function registerBind(keyName, ctrl, shift, alt, callback) {
        if (typeof keyName === "string") {
            keyName = Spicetify.Keyboard.KEYS[keyName];
        }

        Spicetify.Keyboard.registerShortcut(
            {
                key: keyName,
                ctrl,
                shift,
                alt,
            },
            (event) => {
                if (!event.cancelBubble && !vim.isActive) {
                    callback(event);
                }
            },
        );
    }

    function focusOnApp() {
        /** @type {HTMLIFrameElement} */
        const iframe = document.querySelector("iframe.active");
        if (iframe) {
            iframe.focus();
            return iframe.contentDocument.querySelector("html");
        }

        /** @type {HTMLDivElement} */
        const embebbed = document.querySelector(".embedded-app.active");
        if (embebbed) {
            embebbed.firstChild.focus();
            return embebbed;
        }
    }

    /**
     * @returns {number}
     */
    function findActiveIndex(allItems) {
        const active = document.querySelector(
            ".SidebarListItem--is-active, .SidebarListItemLink--is-highlighted"
        );
        if (!active) {
            return -1;
        }

        let index = 0;
        for (const item of allItems) {
            if (item === active) {
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
            ".SidebarListItem, .RootlistItem__link .SidebarListItemLink"
        );
        const maxIndex = allItems.length - 1;
        let index = findActiveIndex(allItems) + direction;

        if (index < 0) index = maxIndex;
        else if (index > maxIndex) index = 0;

        let toClick = allItems[index];
        if (!toClick.hasAttribute("href")) {
            toClick = toClick.querySelector(".SidebarListItemLink");
        }

        toClick.click();
    }

    /**
     * Find first visible carousel and hit next/previous button
     * @param {NodeListOf<Element>} carouselList 
     * @param {boolean} isNext
     */
    function scrollCarousel(carouselList, isNext) {
        if (carouselList.length === 0) {
            return;
        }

        for (const carousel of carouselList) {
            const bound = carousel.getBoundingClientRect();
            if (bound.top < 0) {
                continue;
            }

            if (isNext) {
                const next = carousel.querySelector(CAROUSEL_NEXT_CLASSES);
                if (next) {
                    next.click();
                }
            } else {
                const previous = carousel.querySelector(CAROUSEL_PREVIOUS_CLASSES);
                if (previous) {
                    previous.click();
                }
            }

            return;
        }
    }
})();

function VimBind() {
    const elementQuery = [
        "[href]",
        "button.button-green",
        "button.button-with-stroke",
        "button.Button--style-green",
        "button.Button--style-stroke",
        "td.tl-play",
        "td.tl-number",
        "tr.TableRow",
    ].join(",");

    const keyList = "qwertasdfgzxcvyuiophjklbnm".split("");

    const lastKeyIndex = keyList.length - 1;

    /** @type {Document | undefined} */
    let currentIframe;
    /** @type {HTMLDivElement} */
    let currentEmbedded;
    const sidebar = document.getElementById("view-navigation-bar");
    const player = document.getElementById("view-player-footer");
    const buddyList = document.getElementById("iframe-buddy-list");

    this.isActive = false;

    keyList.forEach((key) => {
        Spicetify.Keyboard.registerImportantShortcut(
            Spicetify.Keyboard.KEYS[key.toUpperCase()],
            listenToKeys.bind(this),
        );
    });

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

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    this.activate = function (event) {
        /** @type {HTMLIFrameElement} */
        const iframe = document.querySelector("iframe.active");
        let iframeBound = null;
        let buddyBound = null;

        if (iframe) {
            currentIframe = iframe.contentDocument;
            iframeBound = iframe.getBoundingClientRect();
            currentEmbedded = undefined;
        } else {
            currentIframe = undefined;
            currentEmbedded = document.querySelector(".embedded-app.active");
        }

        if (buddyList.src !== "about:blank") {
            buddyBound = buddyList.getBoundingClientRect();
        }

        vimOverlay.style.display = "block";

        const vimkey = getVims();
        if (vimkey.length > 0) {
            vimkey.forEach((e) => e.remove());
            return;
        }

        let firstKey = 0;
        let secondKey = 0;

        getLinks().forEach((e) => {
            if (e.style.display === "none" ||
                e.style.visibility === "hidden" ||
                e.style.opacity === "0") {
                return;
            }

            const bound = e.getBoundingClientRect();
            let owner;

            let top = bound.top;
            let left = bound.left;

            if (e.ownerDocument === currentIframe && iframeBound) {
                top += iframeBound.top;
                left += iframeBound.left;
                owner = iframe;

            } else if (e.ownerDocument === buddyList.contentDocument && buddyBound) {
                top += buddyBound.top;
                left += buddyBound.left;
                owner = buddyList;
            } else {
                owner = document.body;
            }

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

            vimOverlay.append(createKey(
                e,
                keyList[firstKey] + keyList[secondKey],
                top,
                left
            ));

            secondKey++;
            if (secondKey > lastKeyIndex) {
                secondKey = 0;
                firstKey++;
            }
        });

        this.isActive = true;
    }

    /**
     * 
     * @param {KeyboardEvent} event 
     */
    this.deactivate = function (event) {
        event.cancelBubble = true;
        this.isActive = false;
        vimOverlay.style.display = "none";
        getVims().forEach((e) => e.remove());
    }

    function getLinks() {
        const elements = Array.from(sidebar.querySelectorAll(elementQuery));
        elements.push(...player.querySelectorAll(elementQuery));
        elements.push(...buddyList.contentDocument.querySelectorAll(elementQuery));

        if (currentIframe || currentEmbedded) {
            const el = (currentIframe || currentEmbedded).querySelectorAll(elementQuery);
            elements.push(...el);
        }

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
            const text = div.innerText.toLowerCase()
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
    }

    function click(element) {
        if (element.hasAttribute("href") || element.tagName === "BUTTON") {
            element.click();
            return;
        }

        const findButton = element.querySelector(`button[data-ta-id="play-button"]`) ||
            element.querySelector(`button[data-button="play"]`);
        if (findButton) {
            findButton.click();
            return;
        }

        // TableCell case where play button is hidden
        // Index number is in first column
        const index = parseInt(element.firstChild.innerText) - 1;
        const context = getContextUri();
        if (index >= 0 && context) {
            console.log(index, context)
            Spicetify.PlaybackControl.playFromResolver(context, { index }, () => {});
            return;
        }
    }

    function createKey(target, key, top, left) {
        const div = document.createElement("span");
        div.classList.add("vim-key");
        div.innerText = key;
        div.style.top = top + "px";
        div.style.left = left + "px";
        div.target = target;
        return div;
    }

    function getContextUri() {
        const username = __spotify.username;
        const activeApp = localStorage.getItem(username + ":activeApp");
        if (activeApp) {
            try {
                return JSON.parse(activeApp).uri.replace("app:", "");
            }
            catch {
                return null;
            }
        }

        return null;
    }

    return this;
}
