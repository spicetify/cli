// @ts-check

// NAME: Shuffle+
// AUTHOR: khanhas
// DESCRIPTION: True shuffle with no bias.

/// <reference path="../globals.d.ts" />

(function ShufflePlus() {
    if (!Spicetify.CosmosAPI) {
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
            const uriObj = Spicetify.URI.fromString(contextURI);

            switch (uriObj.type) {
                case Spicetify.URI.Type.SHOW:
                    showShuffle(uriObj.getBase62Id());
                    break;
                case Spicetify.URI.Type.PLAYLIST:
                    playlistShuffle(contextURI);
                    break;
                case Spicetify.URI.Type.FOLDER:
                    folderShuffle(contextURI);
                    break;
                case Spicetify.URI.Type.ALBUM:
                    albumShuffle(contextURI);
                    break;
                case Spicetify.URI.Type.COLLECTION:
                    collectionShuffle();
                    break;
                default:
                    Spicetify.showNotification(
                        `Unsupported context URI type: ${uriObj.type}`
                    );
            }
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

    /**
     *
     * @param {string} uri
     * @returns {Promise<Array<{ uri: string }>>}
     */
    function requestPlaylist(uri) {
        return new Promise((resolve, reject) => {
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

                    let replace = res.rows;
                    replace = replace.map((item) => ({
                        uri: item.link,
                    }));

                    resolve(replace);
                }
            );
        });
    }

    /**
     *
     * @param {string} uri
     */
    function playlistShuffle(uri) {
        requestPlaylist(uri)
            .then((res) => setQueue(shuffle(res)))
            .catch((error) => console.error("Playlist Shuffle:", error));
    }

    /**
     *
     * @param {string} uri
     */
    function folderShuffle(uri) {
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
                    console.error("Folder Shuffle:", error);
                    return;
                }

                const requestFolder = res.rows.filter(
                    (item) => item.link === uri
                );

                if (requestFolder === 0) {
                    console.error("Folder Shuffle: Cannot find folder");
                    return;
                }

                const requestPlaylists = requestFolder[0].rows.map((item) =>
                    requestPlaylist(item.link)
                );
                Promise.all(requestPlaylists)
                    .then((playlists) => {
                        const trackList = [];

                        playlists.forEach((p) => {
                            trackList.push(...p);
                        });

                        setQueue(shuffle(trackList));
                    })
                    .catch((error) => console.error("Folder Shuffle:", error));
            }
        );
    }

    function collectionShuffle() {
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
                    console.log("collectionShuffle", error);
                    return;
                }
                let replace = res.items;
                replace = replace.map((item) => ({
                    uri: item.link,
                }));

                setQueue(shuffle(replace));
            }
        );
    }

    /**
     *
     * @param {string} uri
     */
    function albumShuffle(uri) {
        const arg = [uri, 0, -1];
        Spicetify.BridgeAPI.request(
            "album_tracks_snapshot",
            arg,
            (error, res) => {
                if (error) {
                    console.error("Album Shuffle: ", error);
                    return;
                }
                let replace = res.array;
                replace = replace.map((item) => ({
                    uri: item,
                }));

                setQueue(shuffle(replace));
            }
        );
    }

    /**
     *
     * @param {string} uriBase62
     */
    function showShuffle(uriBase62) {
        Spicetify.CosmosAPI.resolver.get(
            {
                url: `sp://core-show/unstable/show/${uriBase62}`,
            },
            (error, res) => {
                if (error) {
                    console.error("Shows Shuffle:", error);
                    return;
                }
                let replace = res.getJSONBody().items;

                replace = replace.map((item) => ({
                    uri: item.link,
                }));

                setQueue(shuffle(replace));
            }
        );
    }

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
     * @param {Array<{ uri: string }>} state
     */
    function setQueue(state) {
        const count = state.length;

        state.push({ uri: "spotify:delimiter" });
        const currentQueue = Spicetify.Queue;
        currentQueue.next_tracks = state;

        const stringified = JSON.stringify(currentQueue);

        state.length = 0; // Flush array.

        const request = new Spicetify.CosmosAPI.Request(
            "PUT",
            "sp://player/v2/main/queue",
            null,
            stringified
        );

        Spicetify.CosmosAPI.resolver.resolve(request, (error, _) => {
            if (error) {
                console.log(error);
                return;
            }

            Spicetify.showNotification(NOTIFICATION_TEXT(count));
        });
    }
})();
