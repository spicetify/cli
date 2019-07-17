// @ts-check

// NAME: Shuffle+
// AUTHOR: khanhas
// DESCRIPTION: True shuffle with no bias.

/// <reference path="../globals.d.ts" />

(function ShufflePlus() {
    if (!Spicetify.CosmosAPI || !Spicetify.BridgeAPI) {
        setTimeout(ShufflePlus, 1000);
        return;
    }

    // Text of notification when queue is shuffled sucessfully
    /** @param {number} count */
    const NOTIFICATION_TEXT = (count) => `Shuffled ${count} items!`;

    // Whether Shuffer Queue should show.
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
    const fetchPlaylist = (uri) => new Promise((resolve, reject) => {
        Spicetify.BridgeAPI.cosmosJSON(
            {
                method: "GET",
                uri: `sp://core-playlist/v1/playlist/${uri}/rows`,
                body: {
                    policy: {
                        link: true,
                    },
                },
            },
            (error, res) => {
                if (error) {
                    reject(error);
                    return;
                }

                let replace = res.rows.map((item) => ({
                    uri: item.link,
                }));

                resolve(replace);
            }
        );
    });

    /**
     *
     * @param {string} uri
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchFolder = (uri) => new Promise((resolve, reject) => {
        Spicetify.BridgeAPI.cosmosJSON(
            {
                method: "GET",
                uri: `sp://core-playlist/v1/rootlist`,
                body: {
                    policy: {
                        folder: {
                            rows: true,
                            link: true,
                        },
                    },
                },
            },
            (error, res) => {
                if (error) {
                    reject(error);
                    return;
                }

                const requestFolder = res.rows.filter(
                    (item) => item.link === uri
                );

                if (requestFolder === 0) {
                    reject("Cannot find folder");
                    return;
                }

                const requestPlaylists = requestFolder[0].rows.map((item) =>
                    fetchPlaylist(item.link)
                );
                Promise.all(requestPlaylists)
                    .then((playlists) => {
                        const trackList = [];

                        playlists.forEach((p) => {
                            trackList.push(...p);
                        });

                        resolve(trackList);
                    })
                    .catch(reject);
            }
        );
    });

    /**
     *
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchCollection = () => new Promise((resolve, reject) => {
        Spicetify.BridgeAPI.cosmosJSON(
            {
                method: "GET",
                uri: "sp://core-collection/unstable/@/list/tracks/all",
                body: {
                    policy: {
                        list: {
                            link: true,
                        },
                    },
                },
            },
            (error, res) => {
                if (error) {
                    reject(error);
                    return;
                }
                const list = res.items.map((item) => ({
                    uri: item.link,
                }));

                resolve(list);
            }
        );
    });

    /**
     *
     * @param {string} uri
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchAlbum = (uri) => new Promise((resolve, reject) => {
        const arg = [uri, 0, -1];
        Spicetify.BridgeAPI.request(
            "album_tracks_snapshot",
            arg,
            (error, res) => {
                if (error) {
                    reject(error);
                    return;
                }
                const list = res.array.map((item) => ({
                    uri: item,
                }));

                resolve(list);
            }
        );
    });

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchShow = (uriBase62) => new Promise((resolve, reject) => {
        Spicetify.CosmosAPI.resolver.get(
            {
                url: `sp://core-show/unstable/show/${uriBase62}`,
            },
            (error, res) => {
                if (error) {
                    reject(error);
                    return;
                }
                const list = res.getJSONBody().items.map((item) => ({
                    uri: item.link,
                }));

                resolve(list);
            }
        );
    });

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<{uri: string}[]>}
     */
    const fetchArtist = (uriBase62) => new Promise((resolve, reject) => {
        Spicetify.CosmosAPI.resolver.get(
            {
                url: `hm://artist/v1/${uriBase62}/desktop?format=json`,
            },
            (error, res) => {
                if (error) {
                    reject(error);
                    return;
                }
                const list = res.getJSONBody()
                    .top_tracks.tracks.map((item) => ({
                        uri: item.uri,
                    }));

                resolve(list);
            }
        );
    });

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
    function putQueueRequest(queue) {
        queue.push({ uri: "spotify:delimiter" });
        const queueState = Spicetify.Queue;
        queueState.next_tracks = queue;

        return new Promise((resolve, reject) => {
            Spicetify.CosmosAPI.resolver.put({
                url: "sp://player/v2/main/queue",
                body: { ...queueState }
            }, (error) => {
                if (error) {
                    reject(error);
                    return;
                }
                resolve();
            });
        })
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
    function playList(list) {
        const count = list.length;
        const firstTrack = list.shift().uri;
        Spicetify.PlaybackControl.playTrack(firstTrack, {}, () => {
            putQueueRequest(list)
                .then(() => success(count))
                .catch((err) => Spicetify.showNotification(`${err}`));
        });
    }
})();
