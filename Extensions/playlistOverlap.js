/*
Peter Stenger
3/2/2021


Window Event Listener
----------------------
-> on navigate, set the current page variable & other variables
-> on load, do the stuffs

the stuffs
----------
get a list of every playlist
get the songs for every playlist
compute the overlap between our playlist and the other playlists
display it with a number
*/
(async function () {
  let get = (uri, body) => {
    return new Promise((resolve, reject) => {
      let req = {
        method: "GET",
        uri: uri,
        body,
      };
      Spicetify.BridgeAPI.cosmosJSON(req, (err, res) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(res);
      });
    });
  };
  function getLiked() {
    return get("sp://core-collection/unstable/@/list/tracks/all", {
      policy: {
        list: {
          link: true,
        },
      },
    });
  }
  function getRoot() {
    return get("sp://core-playlist/v1/rootlist", {
      policy: {
        folder: {
          rows: true,
          link: true,
        },
      },
    });
  }

  function getPlaylist(playlist) {
    return get(`sp://core-playlist/v1/playlist/${playlist}`, {});
  }
  function buildPlaylistCollection(folder) {
    let playlists = [];
    for (let row of folder.rows) {
      if (row.type == "playlist") {
        playlists.push({ link: row.link, name: row.name });
      } else if (row.type == "folder") {
        playlists.push(...buildPlaylistCollection(row));
      }
    }
    return playlists;
  }

  async function buildSongMap(filterURL) {
    let root = await getRoot();
    let playlistData = buildPlaylistCollection(root);
    let playlistLookup = playlistData.reduce((accum, val) => {
      accum[val.link] = val.name;
      return accum;
    }, {});
    let paths = playlistData.map((x) => x.link).filter((url) => url !== filterURL);
    let allSongs = {};
    let allSongsList = await Promise.all(
      paths.map((path) =>
        getPlaylist(path).then((playlist) => {
          return {
            items: playlist.items.map((i) => i.link),
            link: playlist.playlist.link,
            name: playlist.playlist.name,
          };
        })
      )
    );
    for (let songList of allSongsList) {
      for (let song of songList.items) {
        if (allSongs[song] === undefined) {
          allSongs[song] = [songList.link];
        } else {
          allSongs[song] = allSongs[song].concat(songList.link);
        }
      }
    }
    if (allSongs === null || playlistLookup === null) {
      throw new Error("Not supposed to be null [buildSongMap]!");
    }
    return [allSongs, playlistLookup];
  }

  async function retrieveData(page, isPlaylist) {
    if (isPlaylist === null) {
      throw new Error("Not supposed to be null!");
    }
    let playlistSongs = isPlaylist ? await getPlaylist(page) : await getLiked();
    let [allSongs, playlistLookup] = await buildSongMap(page);
    overlap = {};
    for (let song of playlistSongs.items) {
      if (allSongs[song.link] !== undefined) {
        overlap[song.link] = allSongs[song.link];
      }
    }
    applyVisuals(overlap, playlistLookup);
  }
  async function applyVisuals(overlap, lookup) {
    if (overlap === null || lookup === null) {
      throw new Error("Not supposed to be null [applyVisuals]!");
    }
    let table = document.querySelector("iframe.active").contentDocument.querySelector("table");
    let songTable = document.querySelector("iframe.active").contentDocument.querySelector("table > tbody");
    let mutationConfig = {
      childList: true,
    };

    let initialRows = songTable.querySelectorAll("tr.tl-row");
    if (table === null || songTable === null || initialRows.length <= 1) {
      throw new Error("Something was supossed to be loaded but wasn't.");
    }

    console.log(initialRows[0].getAttribute("aria-label"));
    handleNodes(initialRows);
    async function handleNodes(nodes) {
      nodes.forEach((item) => {
        const uri = item.getAttribute("data-uri");
        const name = item.getAttribute("aria-label");
        const overlapping = (overlap[uri] || []).map((x) => lookup[x]);
        const playlistCountNode = `<span class="num-playlists" data-tooltip="${overlapping.join(
          "\n"
        )}" class="tl-cell__content">${String(overlapping.length)}</span>`;
        const save = item.querySelector(".tl-save");
        if (!save) {
          console.warn("Could not query save icon");
        }
        if (save && !save.querySelector(".num-playlists")) {
          save.style = "padding-left: 0px; padding-top: 5px;";
          save.insertAdjacentHTML("beforeend", playlistCountNode);
        }
      });
    }
    let observer = new MutationObserver(async function (mutations) {
      let allAdded = mutations.flatMap((mutation) => [...mutation.addedNodes]);
      handleNodes(allAdded);
    });
    observer.observe(songTable, mutationConfig);
  }
  let currentlyLoadedPage = null;
  let hasLoadedCurrentPlaylist = false;
  let hasLoadedLikedSongs = false;

  window.addEventListener("message", async ({ data: info }) => {
    if (info.type == "navigation_request_state" && info.method == "open") {
      let pageJustClicked = JSON.parse(info.state).uri.slice(12);
      let isPlaylist = null;
      if (pageJustClicked.startsWith("playlist")) {
        isPlaylist = true;
      } else if (pageJustClicked == "collection-songs") {
        isPlaylist = false;
      } else {
        return;
      }

      if (currentlyLoadedPage !== pageJustClicked) {
        if (currentlyLoadedPage === "collection-songs" && isPlaylist === true) {
          hasLoadedLikedSongs = true;
        }
        hasLoadedCurrentPlaylist = false;
        currentlyLoadedPage = pageJustClicked;
      }

      if (!isPlaylist && hasLoadedLikedSongs) {
        retrieveData("spotify:" + currentlyLoadedPage, false); // TODO caching?
      }
    } else if (info.type == "notify_loaded" && currentlyLoadedPage !== null) {
      console.log("NOTIFY_LOADED", info);
      let loadedPage = info.pageId.replace("/", "-");
      if (loadedPage == "playlist") {
        hasLoadedCurrentPlaylist = true;
        retrieveData("spotify:" + currentlyLoadedPage, true);
      } else if (loadedPage == "collection-songs") {
        hasLoadedLikedSongs = true;
        retrieveData("spotify:" + currentlyLoadedPage, false);
      }
    }
  });
})();
