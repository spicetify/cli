// @ts-check

// NAME: Shuffle+
// AUTHOR: khanhas
// DESCRIPTION: True shuffle with no bias.

/// <reference path="../globals.d.ts" />

(function ShufflePlus() {
    if (!Spicetify.CosmosAsync) {
        setTimeout(ShufflePlus, 1000);
        return;
    }

    // Text of notification when queue is shuffled successfully
    /** @param {number} count */
    const NOTIFICATION_TEXT = (count) => `Shuffled ${count} items!`;

    // Whether Shuffler Queue should show.
    const showShuffleQueueButton = true;

    // Context shuffle buttons
    function createContextButton() {
        const b = document.createElement("button");
        b.classList.add("button", "button-green");
        b.innerText = "Shuffle Context";
        b.setAttribute(
            "data-tooltip",
            "Detect current playing context and shuffle all its items."
        );
        b.onclick = () => {
            const contextURI = Spicetify.Player.data.context_uri;
            fetchListFromUri(contextURI)
                .then((list) => {
                    if (list && list.length > 0) {
                        setQueue(shuffle(list));
                    }
                })
                .catch((err) => Spicetify.showNotification(`${err}`));
        };
        return b;
    }

    // Queue shuffle buttons
    function createQueueButton() {
        const b = document.createElement("button");
        b.classList.add("button", "button-green");
        b.innerText = "Shuffle Queue";
        b.setAttribute(
            "data-tooltip",
            "Shuffle first 80 items or less that are visible in Queue page. Only useful for mixed context queue."
        );
        b.onclick = () => {
            /** @type {Array} */
            let replace = Spicetify.Queue.next_tracks;
            let delimiterIndex = replace.findIndex(
                (value) => value.uri === "spotify:delimiter"
            );

            if (delimiterIndex !== -1) {
                replace.splice(delimiterIndex);
            }

            setQueue(shuffle(replace));
        };
        return b;
    }

    const iframeInterval = setInterval(() => {
        /** @type {HTMLIFrameElement} */
        const currentIframe = document.querySelector("iframe.active");
        if (!currentIframe ||
            currentIframe.id !== "app-queue"
        ) {
            return;
        }

        const headers = currentIframe.contentDocument.querySelectorAll(
            ".glue-page-header__buttons"
        );

        for (const e of headers) {
            e.append(createContextButton());
            if (showShuffleQueueButton) {
                e.append(createQueueButton());
            }
        }

        if (headers.length > 0) clearInterval(iframeInterval);
    }, 500)

    const cntxMenu = new Spicetify.ContextMenu.Item(
        "Play with Shuffle+",
        (uris) => {
            if (uris.length === 1) {
                fetchListFromUri(uris[0])
                    .then((list) => playList(shuffle(list)))
                    .catch((err) => Spicetify.showNotification(`${err}`));
                return;
            }

            const list = uris.map((uri) => ({ uri }));
            playList(shuffle(list));
        },
        (uris) => {
            if (uris.length === 1) {
                const uriObj = Spicetify.URI.fromString(uris[0]);
                switch (uriObj.type) {
                    case Spicetify.URI.Type.SHOW:
                    case Spicetify.URI.Type.PLAYLIST:
                    case Spicetify.URI.Type.PLAYLIST_V2:
                    case Spicetify.URI.Type.FOLDER:
                    case Spicetify.URI.Type.ALBUM:
                    case Spicetify.URI.Type.COLLECTION:
                    case Spicetify.URI.Type.ARTIST:
                        return true;
                }
                return false;
            }
            // User selects multiple tracks in a list.
            return true;
        },
        "shuffle"
    )
    cntxMenu.register();

    /**
     * 
     * @param {string} uri 
     * @returns {Promise<{uri: string}[]>}
     */
    async function fetchListFromUri(uri) {
        const uriObj = Spicetify.URI.fromString(uri);

        switch (uriObj.type) {
            case Spicetify.URI.Type.SHOW:
                return await fetchShow(uriObj.getBase62Id())
            case Spicetify.URI.Type.PLAYLIST:
            case Spicetify.URI.Type.PLAYLIST_V2:
                return await fetchPlaylist(uri)
            case Spicetify.URI.Type.FOLDER:
                return await fetchFolder(uri)
            case Spicetify.URI.Type.ALBUM:
                return await fetchAlbum(uri)
            case Spicetify.URI.Type.COLLECTION:
                return await fetchCollection()
            case Spicetify.URI.Type.ARTIST:
                return await fetchArtist(uriObj.getBase62Id())
        }
        throw `Unsupported fetching URI type: ${uriObj.type}`;
    }

    /**
     *
     * @param {string} uri
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchPlaylist = async (uri) => {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-playlist/v1/playlist/${uri}/rows`,
            { policy: { link: true } }
        );
        return res.rows.map((item) => item.link);
    }

    /**
    *
    * @param {object} rows
    * @param {string} uri
    * @returns {object} folder
    */
    const searchFolder = (rows, uri) => {
        for (const r of rows) {
            if (r.type !== "folder") {
                continue;
            }

            if (r.link === uri) {
                return r;
            }

            const found = searchFolder(r.rows, uri);
            if (found) return found;
        }
    };

    /**
     *
     * @param {string} uri
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchFolder = async (uri) => {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-playlist/v1/rootlist`,
            { policy: { folder: { rows: true, link: true } } }
        );

        const requestFolder = searchFolder(res.rows, uri);
        if (requestFolder == null) {
            throw "Cannot find folder";
        }

        let requestPlaylists = [];
        const fetchNested = (folder) => {
            for (const i of folder.rows) {
                if (i.type === "playlist") requestPlaylists.push(fetchPlaylist(i.link));
                else if (i.type === "folder") fetchNested(i);
            }
        };

        fetchNested(requestFolder);

        return await Promise.all(requestPlaylists)
            .then((playlists) => {
                const trackList = [];

                playlists.forEach((p) => {
                    trackList.push(...p);
                });

                return trackList;
            });
    };

    /**
     *
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchCollection = async () => {
        const res = await Spicetify.CosmosAsync.get(
            "sp://core-collection/unstable/@/list/tracks/all",
            { policy: { list: { link: true } } }
        );
        return res.items.map((item) => item.link);
    };


    /**
     *
     * @param {string} uri
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchAlbum = async (uri) => {
        const arg = uri.split(":")[2];
        const res = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${arg}`)
        return res.tracks.items.map((item) => item.uri);
    };

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchShow = async (uriBase62) => {
        const res = await Spicetify.CosmosAsync.get(`sp://core-show/unstable/show/${uriBase62}`);
        return res.items.map((item) => item.link);
    };

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchArtist = async (uriBase62) => {
        const res = await Spicetify.CosmosAsync.get(`hm://artist/v1/${uriBase62}/desktop?format=json`);
        return res.top_tracks.tracks.map((item) => item.uri);
    };

    /**
     *
     * @param {Array<{ uri: string }>} array list of items to shuffle
     * @returns {Array<{ uri: string }>} shuffled array
     *
     * From: https://bost.ocks.org/mike/shuffle/
     */
    function shuffle(array) {
        let counter = array.length;

        // While there are elements in the array
        while (counter > 0) {
            // Pick a random index
            let index = Math.floor(Math.random() * counter);

            // Decrease counter by 1
            counter--;

            // And swap the last element with it
            let temp = array[counter];
            array[counter] = array[index];
            array[index] = temp;
        }
        return array;
    }

    /**
     * 
     * @param {number} total 
     */
    function success(total) {
        Spicetify.showNotification(NOTIFICATION_TEXT(total));
    }

    /**
     * 
     * @param {{uri: string}[]} queue 
     */
    async function putQueueRequest(queue) {
        return await Spicetify.Player.origin2.insertIntoQueue({
            uris: queue,
            dropIndex: 0,
            meta: { section: 2 } // enum QueueSection { NowPlaying, NextInQueue, NextUp }
        });
    }

    /**
     * Replaces current queue with new queue without playing it.
     * @param {{uri: string}[]} list 
     */
    function setQueue(list) {
        const count = list.length;

        putQueueRequest(list)
            .then(() => success(count))
            .catch((err) => Spicetify.showNotification(`${err}`));
    }

    /**
     * Replace queue and play first track immediately.
     * @param {{uri: string}[]} list 
     */
    async function playList(list) {
        const count = list.length;
        await putQueueRequest(list)
            .then(() => success(count))
            .catch((err) => Spicetify.showNotification(`${err}`));
        Spicetify.Player.next();
    }
})();
