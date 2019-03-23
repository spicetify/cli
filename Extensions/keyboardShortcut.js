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
    const QUERY = `[href], button.button-green, button.button-with-stroke, button.Button--style-green, button.Button--style-stroke`;

    const CAROUSEL_CLASSES = `.Carousel, .crsl-item.col-xs-12.col-sm-12.col-md-12.col-lg-12`;
    const CAROUSEL_NEXT_CLASSES = `[data-ta-id="next-button"], [data-button="carousel-next"]`;
    const CAROUSEL_PREVIOUS_CLASSES = `[data-ta-id="previous-button"], [data-button="carousel-previous"]`;

    // Register Ctrl + Tab and Ctrl + Shift + Tab to switch sidebar items
    Spicetify.Keyboard.registerShortcut(
        {
            key: Spicetify.Keyboard.KEYS.TAB,
            ctrl: true,
        },
        () => {
            rotateSidebar(1);
        }
    );

    Spicetify.Keyboard.registerShortcut(
        {
            key: Spicetify.Keyboard.KEYS.TAB,
            ctrl: true,
            shift: true,
        },
        () => {
            rotateSidebar(-1);
        }
    );

    // Register Ctrl + Q to open Queue page
    Spicetify.Keyboard.registerShortcut(
        {
            key: Spicetify.Keyboard.KEYS.Q,
            ctrl: true,
        },
        () => {
            document.getElementById("player-button-queue").click();
        }
    );

    // Register Backspace and Shift + Backspace to go back and forward page
    Spicetify.Keyboard.registerShortcut(
        Spicetify.Keyboard.KEYS.BACKSPACE,
        () => {
            document
                .querySelector("#view-browser-navigation-top-bar .back")
                .click();
        }
    );

    Spicetify.Keyboard.registerShortcut(
        {
            key: Spicetify.Keyboard.KEYS.BACKSPACE,
            ctrl: true,
        },
        () => {
            document
                .querySelector("#view-browser-navigation-top-bar .forward")
                .click();
        }
    );

    // Register PageUp, PageDown to focus on iframe app before scrolling
    Spicetify.Keyboard.registerShortcut(
        Spicetify.Keyboard.KEYS.PAGE_UP,
        focusOnApp
    );
    Spicetify.Keyboard.registerShortcut(
        Spicetify.Keyboard.KEYS.PAGE_DOWN,
        focusOnApp
    );

    // Register J and K to scroll
    Spicetify.Keyboard.registerShortcut(Spicetify.Keyboard.KEYS.J, () => {
        const app = focusOnApp();
        if (app) {
            app.scrollBy(0, SCROLL_STEP);
        }
    });

    Spicetify.Keyboard.registerShortcut(Spicetify.Keyboard.KEYS.K, () => {
        const app = focusOnApp();
        if (app) {
            app.scrollBy(0, -SCROLL_STEP);
        }
    });

     // Register H and L to scroll carousel horizontally
     Spicetify.Keyboard.registerShortcut(Spicetify.Keyboard.KEYS.H, () => {
        const app = focusOnApp();
        if (app) {
            scrollCarousel(app.querySelectorAll(CAROUSEL_CLASSES), false);
        }
    });

    Spicetify.Keyboard.registerShortcut(Spicetify.Keyboard.KEYS.L, () => {
        const app = focusOnApp();
        if (app) {
            scrollCarousel(app.querySelectorAll(CAROUSEL_CLASSES), true);
        }
    });

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

    let currentIframe;

    const keyList = "qwertyuiopasdfgzxcvbnm".split("");
    const lastKey = keyList.length - 1;

    // Register Backtick as
    Spicetify.Keyboard.registerShortcut(
        192, // Backtick
        /**
         * @param {KeyboardEvent} event
         */
        (event) => {
            /** @type {HTMLIFrameElement} */
            const iframe = document.querySelector("iframe.active");
            if (iframe) {
                currentIframe = iframe.contentDocument;
            } else {
                currentIframe = undefined;
            }

            const vimkey = getVims();
            if (vimkey.length > 0) {
                vimkey.forEach((e) => e.remove());
            } else {
                let firstKey = 0;
                let secondKey = 0;
                const elements = getLinks();

                elements.forEach((e) => {
                    if (e.style.display === "none") {
                        return;
                    }

                    e.append(
                        createKey(
                            keyList[firstKey] + keyList[secondKey],
                            e.tagName === "A"
                        )
                    );

                    secondKey++;
                    if (secondKey > lastKey) {
                        secondKey = 0;
                        firstKey++;
                    }
                });
                event.stopPropagation();
                window.addEventListener("keydown", listenFirstKey);
                if (currentIframe) {
                    currentIframe.addEventListener("keydown", listenFirstKey);
                }
            }
        }
    );

    function getLinks() {
        const elements = [];
        elements.push(...document.body.querySelectorAll(QUERY));

        if (currentIframe) {
            const el = currentIframe.querySelectorAll(QUERY);
            elements.push(...el);
        }

        return elements;
    }

    /**
     * @returns {HTMLDivElement[]}
     */
    function getVims() {
        /** @type {HTMLDivElement[]} */
        const elements = [];

        /** @type {NodeListOf<HTMLDivElement>} */
        let vimKeys = document.querySelectorAll(".vim-key");

        elements.push(...vimKeys);

        if (currentIframe) {
            vimKeys = currentIframe.querySelectorAll(".vim-key");
            elements.push(...vimKeys);
        }

        return elements;
    }

    /**
     * @param {KeyboardEvent} event
     */
    function listenFirstKey(event) {
        window.removeEventListener("keydown", listenFirstKey);
        if (currentIframe) {
            currentIframe.removeEventListener("keydown", listenFirstKey);
        }

        const vimkey = getVims();

        if (keyList.indexOf(event.key) == -1) {
            vimkey.forEach((e) => e.remove());
            return;
        }

        for (const div of vimkey) {
            if (div.innerText[0] !== event.key) {
                div.remove();
            } else {
                div.innerText = div.innerText[1];
            }
        }

        event.stopImmediatePropagation();
        window.addEventListener("keydown", listenSecondKey);
        if (currentIframe) {
            currentIframe.addEventListener("keydown", listenSecondKey);
        }
    }

    /**
     * @param {KeyboardEvent} event
     */
    function listenSecondKey(event) {
        window.removeEventListener("keydown", listenSecondKey);
        if (currentIframe) {
            currentIframe.removeEventListener("keydown", listenSecondKey);
        }

        const vimkey = getVims();

        if (keyList.indexOf(event.key) == -1) {
            vimkey.forEach((e) => e.remove());
            return;
        }

        for (const div of vimkey) {
            if (div.innerText === event.key) {
                click(div);
            }
            div.remove();
        }

        event.stopImmediatePropagation();
    }

    function click(div) {
        const element = div.parentNode;

        if (element.hasAttribute("href") || element.tagName === "BUTTON") {
            element.click();
            return;
        }

        const findButton = element.querySelector("button");
        if (findButton) {
            findButton.click();
            return;
        }
    }

    /**
     * @param {string} key
     * @param {boolean} isATag
     * @returns {HTMLSpanElement}
     */
    function createKey(key, isATag) {
        const div = document.createElement("span");
        div.classList.add("vim-key");
        div.innerText = key;
        div.style.backgroundColor = "black";
        div.style.border = "solid 1px white";
        div.style.color = "white";
        div.style.textTransform = "lowercase";
        div.style.position = "absolute";
        div.style.zIndex = "10";
        div.style.padding = "3px 6px";
        div.style.lineHeight = "normal";
        div.style.left = "0";
        if (!isATag) {
            div.style.top = "0";
        }
        return div;
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
