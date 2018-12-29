// @ts-check

// NAME: Queue All
// AUTHOR: khanhas
// DESCRIPTION: Add Queue All button in every album carousel.

/// <reference path="../globals.d.ts" />

(function QueueAll() {
    if (!Spicetify.addToQueue) {
        setTimeout(QueueAll, 1000);
        return;
    }

    const BUTTON_TEXT = "Queue all";
    const ADDING_TEXT = "Adding";
    const ADDED_TEXT = "Added";

    const COLLECTION_CLASSES =
        "div.crsl-item.col-xs-12.col-sm-12.col-md-12.col-lg-12";
    const ARTIST_CLASSES = ".albums, .singles, .appears_on";
    const MOUNT_CLASSES = ".GlueCarousel, .Carousel";
    const CARD_CLASSES =
        ".card, header.header.header-inline.header-album, .GlueCard, .Card";

    const BROWSE_REGEXP = new RegExp(
        /spotify:app:browse:(discover|releases|podcasts)/
    );

    function createQueueAllButton() {
        const button = document.createElement("button");
        button.classList.add(
            "custom-queue-all",
            "button",
            "button-green",
            "button-play"
        );
        button.innerText = BUTTON_TEXT;
        button.style.marginLeft = "24px";
        return button;
    }

    Spicetify.Player.addEventListener("appchange", ({ data: data }) => {
        if (data.isEmbeddedApp === true) {
            if (data.id === "album") {
                findCarousel(data.container, MOUNT_CLASSES);
            }
        } else {
            const doc = data.container.contentDocument;
            if (BROWSE_REGEXP.test(data.uri)) {
                findCarousel(doc, COLLECTION_CLASSES);
            } else if (data.id === "artist") {
                findCarousel(doc, ARTIST_CLASSES);
            } else if (data.id === "genre") {
                findCarousel(doc, COLLECTION_CLASSES);
            }
        }
    });

    /**
     *
     * @param {HTMLElement | Document} activeDoc
     * @param {string} classes
     * @param {number} retry
     */
    function findCarousel(activeDoc, classes, retry = 0) {
        if (retry > 10) return;
        const crslItems = activeDoc.querySelectorAll(classes);
        if (crslItems.length > 0) {
            crslItems.forEach(appendQueueAll);
        } else {
            setTimeout(() => findCarousel(activeDoc, classes, ++retry), 1000);
        }
    }

    /**
     *
     * @param {HTMLElement} item
     */
    function appendQueueAll(item) {
        const uris = [];
        item.querySelectorAll(CARD_CLASSES).forEach((element) => {
            const uri = element.getAttribute("data-uri");
            uri && filterURI(uri) && uris.push(uri);
        });

        if (
            item.querySelectorAll("button.custom-queue-all").length === 0 &&
            uris.length > 0
        ) {
            const h2 = item.querySelector("h2");
            const button = createQueueAllButton();
            button.onclick = () => {
                button.innerText = ADDING_TEXT;
                Spicetify.addToQueue(uris)
                    .then(() => {
                        button.innerText = ADDED_TEXT;
                        setTimeout(
                            () => (button.innerText = BUTTON_TEXT),
                            2000
                        );
                    })
                    .catch(console.log);
            };
            h2.append(button);
        }
    }

    /**
     * @param {string} uri
     * @returns {boolean}
     */
    function filterURI(uri) {
        const uriObj = Spicetify.URI.from(uri);
        if (
            uriObj.type === Spicetify.URI.Type.ALBUM ||
            uriObj.type === Spicetify.URI.Type.TRACK ||
            uriObj.type === Spicetify.URI.Type.EPISODE
        ) {
            return true;
        }

        return false;
    }
})();
