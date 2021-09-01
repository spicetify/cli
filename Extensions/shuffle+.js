// @ts-check

// NAME: Shuffle+
// AUTHOR: khanhas
// DESCRIPTION: True shuffle with no bias.

/// <reference path="../globals.d.ts" />

(function ShufflePlus() {
    if (
        !Spicetify.CosmosAsync ||
        !Spicetify.Player.origin2 ||
        !Spicetify.Platform
    ) {
        setTimeout(ShufflePlus, 1000);
        return;
    }
    let playDiscography =
        localStorage.getItem("shuffleplus:artist_discography") === "true";
    const playDiscographyMenu = new Spicetify.Menu.Item(
        "Shuffle artist discography",
        playDiscography,
        (menuItem) => {
            playDiscography = !playDiscography;
            localStorage.setItem(
                "shuffleplus:artist_discography",
                String(playDiscography)
            );
            menuItem.isEnabled = playDiscography;
        }
    );

    let playUriOGFunc = Spicetify.Player.origin2.playUri.bind(
        Spicetify.Player.origin2
    );
    let playerPlayOGFunc = Spicetify.Platform.PlayerAPI.play.bind(
        Spicetify.Platform.PlayerAPI
    );
    let isInjected = localStorage.getItem("shuffleplus:on") === "true";
    injectFunctions(isInjected);

    const autoShuffleMenu = new Spicetify.Menu.Item(
        "Auto shuffle",
        isInjected,
        (menuItem) => {
            isInjected = !isInjected;
            localStorage.setItem("shuffleplus:on", String(isInjected));
            menuItem.isEnabled = isInjected;
            injectFunctions(isInjected);
        }
    );

    new Spicetify.Menu.SubMenu("Shuffle+", [
        autoShuffleMenu,
        playDiscographyMenu,
    ]).register();

    function injectFunctions(bool) {
        if (bool) {
            Spicetify.Player.origin2.playUri = (uri, options) => {
                if (options?.trackUid) {
                    playUriOGFunc(uri, options);
                    return;
                }
                fetchAndPlay(uri);
            };
            Spicetify.Platform.PlayerAPI.play = (uri, origins, options) => {
                if (options?.skipTo) {
                    if (options.skipTo.index !== undefined) {
                        playerPlayOGFunc(uri, origins, options);
                        return;
                    } else if (options.skipTo.pageIndex !== undefined) {
                        uri.uri = options.skipTo.fallbackContextURI;
                    } else {
                        throw "No idea what to do. Please report on Github repo, specify which page you are in.";
                    }
                }
                fetchAndPlay(uri.uri);
            };
        } else {
            // Revert
            Spicetify.Player.origin2.playUri = playUriOGFunc;
            Spicetify.Platform.PlayerAPI.play = playerPlayOGFunc;
        }
    }

    // Text of notification when queue is shuffled successfully
    /** @param {number} count */
    const NOTIFICATION_TEXT = (count) => `Shuffled ${count} items!`;

    const cntxMenu = new Spicetify.ContextMenu.Item(
        "Play with Shuffle+",
        (uris) => {
            if (uris.length === 1) {
                fetchAndPlay(uris[0]);
                return;
            }

            playList(shuffle(uris));
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
    );
    cntxMenu.register();

    /**
     *
     * @param {string} uri
     * @returns {Promise<string[]>}
     */
    async function fetchListFromUri(uri) {
        const uriObj = Spicetify.URI.fromString(uri);

        switch (uriObj.type) {
            case Spicetify.URI.Type.SHOW:
                return await fetchShow(uriObj.getBase62Id());
            case Spicetify.URI.Type.PLAYLIST:
            case Spicetify.URI.Type.PLAYLIST_V2:
                return await fetchPlaylist(uri);
            case Spicetify.URI.Type.FOLDER:
                return await fetchFolder(uri);
            case Spicetify.URI.Type.ALBUM:
                return await fetchAlbum(uri);
            case Spicetify.URI.Type.COLLECTION:
                return await fetchCollection();
            case Spicetify.URI.Type.ARTIST:
                if (playDiscography) {
                    return await fetchDiscography(uriObj.getBase62Id());
                }
                return await fetchArtist(uriObj.getBase62Id());
            case Spicetify.URI.Type.TRACK:
            case Spicetify.URI.Type.EPISODE:
                return [uri];
        }
        throw `Unsupported fetching URI type: ${uriObj.type}`;
    }

    /**
     *
     * @param {string} uri
     * @returns {Promise<string[]>}
     */
    const fetchPlaylist = async (uri) => {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-playlist/v1/playlist/${uri}/rows`,
            { policy: { link: true } }
        );
        return res.rows.map((item) => item.link);
    };

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
     * @returns {Promise<string[]>}
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
            if (!folder.rows) return;

            for (const i of folder.rows) {
                if (i.type === "playlist")
                    requestPlaylists.push(fetchPlaylist(i.link));
                else if (i.type === "folder") fetchNested(i);
            }
        };

        fetchNested(requestFolder);

        return await Promise.all(requestPlaylists).then((playlists) => {
            const trackList = [];

            playlists.forEach((p) => {
                trackList.push(...p);
            });

            return trackList;
        });
    };

    /**
     *
     * @returns {Promise<string[]>}
     */
    const fetchCollection = async () => {
        const res = await Spicetify.CosmosAsync.get(
            "sp://core-collection/unstable/@/list/tracks/all?responseFormat=protobufJson",
            { policy: { list: { link: true } } }
        );
        return res.item.map((item) => item.trackMetadata.link);
    };

    /**
     *
     * @param {string} uri
     * @returns {Promise<string[]>}
     */
    const fetchAlbum = async (uri) => {
        const arg = uri.split(":")[2];
        const res = await Spicetify.CosmosAsync.get(
            `hm://album/v1/album-app/album/${arg}/desktop`
        );
        const items = [];
        for (const disc of res.discs) {
            const availables = disc.tracks.filter((track) => track.playable);
            items.push(...availables.map((track) => track.uri));
        }
        return items;
    };

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<string[]>}
     */
    const fetchShow = async (uriBase62) => {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-show/unstable/show/${uriBase62}?responseFormat=protobufJson`
        );
        const availables = res.items.filter(
            (track) => track.episodePlayState.isPlayable
        );
        return availables.map((item) => item.episodeMetadata.link);
    };

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<string[]>}
     */
    const fetchArtist = async (uriBase62) => {
        const res = await Spicetify.CosmosAsync.get(
            `hm://artist/v1/${uriBase62}/desktop?format=json`
        );
        return res.top_tracks.tracks.map((item) => item.uri);
    };

    /**
     *
     * @param {string} uriBase62
     * @returns {Promise<string[]>}
     */
    const fetchDiscography = async (uriBase62) => {
        Spicetify.showNotification(`Fetching albums list...`);
        let res = await Spicetify.CosmosAsync.get(
            `hm://artist/v1/${uriBase62}/desktop?format=json`
        );
        let albums = res.releases.albums.releases;
        const tracks = [];
        for (const album of albums) {
            tracks.push(...(await fetchAlbum(album.uri)));
        }
        return tracks;
    };

    /**
     *
     * @param {string[]} array list of items to shuffle
     * @returns {string[]} shuffled array
     *
     * From: https://bost.ocks.org/mike/shuffle/
     */
    function shuffle(array) {
        let counter = array.length;
        if (counter <= 1) return array;

        const first = array[0];

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

        // Re-shuffle if first item is the same as pre-shuffled first item
        while (array[0] === first) {
            array = shuffle(array);
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
     * Replace queue and play first track immediately.
     * @param {string[]} list
     */
    async function playList(list, context) {
        const count = list.length;
        if (count === 0) {
            throw "There is no available track to play";
        } else if (count === 1) {
            playUriOGFunc(list[0]);
            return;
        }
        list.push("spotify:delimiter");

        const isQueue = !context || Spicetify.URI.isCollection(context);
        if (!isQueue) {
            await Spicetify.CosmosAsync.post("sp://player/v2/main/update", {
                context: {
                    uri: context,
                    url: "context://" + context,
                },
            });
        }
        await Spicetify.CosmosAsync.put("sp://player/v2/main/queue", {
            revision: Spicetify.Queue?.revision,
            next_tracks: list.map((uri) => ({
                uri,
                provider: context ? "context" : "queue",
                metadata: {
                    is_queued: isQueue,
                },
            })),
            prev_tracks: Spicetify.Queue?.prev_tracks,
        });
        success(count);
        Spicetify.Player.next();
    }

    function fetchAndPlay(uri) {
        fetchListFromUri(uri)
            .then((list) => playList(shuffle(list), uri))
            .catch((err) => Spicetify.showNotification(`${err}`));
    }
})();
