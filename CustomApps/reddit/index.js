// Run "npm i @type/react" to have this type package available in workspace
/// <reference types="react" />

/** @type {React} */
const {
    URI,
    React: react,
    React: { useState, useEffect, useCallback },
    ReactDOM: reactDOM,
    Platform: { History },
} = Spicetify;

// Define a function called "render" to specify app entry point
// This function will be used to mount app to main view.
function render() {
    return react.createElement(Grid, { title: "Reddit" });
}

const CONFIG = {
    visual: {
        type: localStorage.getItem("reddit:type") === "true",
        upvotes: localStorage.getItem("reddit:upvotes") === "true",
        followers: localStorage.getItem("reddit:followers") === "true",
        longDescription: localStorage.getItem("reddit:longDescription") === "true",
    },
    services: localStorage.getItem("reddit:services") || `["spotify","makemeaplaylist","SpotifyPlaylists","music","edm","popheads"]`,
    lastService: localStorage.getItem("reddit:last-service"),
};

try {
    CONFIG.services = JSON.parse(CONFIG.services);
    if (!Array.isArray(CONFIG.services)) {
        throw "";
    }
} catch {
    CONFIG.services = ["spotify", "makemeaplaylist", "SpotifyPlaylists", "music", "edm", "popheads"];
    localStorage.setItem("reddit:services", JSON.stringify(CONFIG.services));
}

if (!CONFIG.lastService || !CONFIG.services.includes(CONFIG.lastService)) {
    CONFIG.lastService = CONFIG.services[0];
}
let sortConfig = {
    by: localStorage.getItem("reddit:sort-by") || "top",
    time: localStorage.getItem("reddit:sort-time") || "month",
};
let cardList = [];
let endOfList = false;
let lastScroll = 0;
let requestQueue = [];
let requestAfter = null;

let gridUpdateTabs, gridUpdatePostsVisual;

class Grid extends react.Component {
    constructor(props) {
        super(props);
        Object.assign(this, props);
        this.state = {
            cards: [],
            tabs: CONFIG.services,
            rest: true,
            endOfList: endOfList,
        }
    }

    newRequest(amount) {
        cardList = [];
        const queue = [];
        requestQueue.unshift(queue);
        this.loadAmount(queue, amount);
    }

    appendCards(items) {
        for (const item of items) {
            item.visual = CONFIG.visual;
            cardList.push(react.createElement(Card, item));
        }

        this.setState({ cards: [...cardList] });
    }

    updateSort() {
        sortConfig.by = document.querySelector("#reddit-sort-by").value;
        localStorage.setItem("reddit:sort-by", sortConfig.by);
        const sortTime = document.querySelector("#reddit-sort-time");
        if (sortTime) {
            sortConfig.time = sortTime.value;
            localStorage.setItem("reddit:sort-time", sortConfig.time);
        }

        requestAfter = null;
        cardList = [];
        this.setState({
            cards: [],
            rest: false,
            endOfList: false,
        });
        endOfList = false;

        this.newRequest(30);
    }

    updateTabs() {
        this.setState({
            tabs: [...CONFIG.services],
        });
    }

    updatePostsVisual() {
        cardList = cardList.map(card => {
            return react.createElement(Card, card.props);
        });
        this.setState({ cards: [...cardList] });
    }

    switchTo(event) {
        event.preventDefault();
        CONFIG.lastService = event.target.value || event.target.innerText;
        localStorage.setItem("reddit:last-service", CONFIG.lastService);
        cardList = [];
        requestAfter = null;
        this.setState({
            cards: [],
            rest: false,
            endOfList: false,
        });
        endOfList = false;

        this.newRequest(30);
    }

    async loadPage(queue) {
        let subMeta = await getSubreddit(requestAfter);
        let items = await getItemsMeta(postMapper(subMeta.data.children));

        if (requestQueue.length > 1 && queue !== requestQueue[0]) {
            // Stop this queue from continuing to fetch and append to cards list
            return -1;
        }

        this.appendCards(items);

        if (subMeta.data.after) {
            return subMeta.data.after;
        }

        this.setState({ rest: true, endOfList: true });
        endOfList = true;
        return null;
    }

    async loadAmount(queue, quantity = 50) {
        this.setState({ rest: false });
        quantity += cardList.length;

        requestAfter = await this.loadPage(queue);
        while (
            requestAfter &&
            requestAfter !== -1 &&
            cardList.length < quantity &&
            !this.endOfList
        ) {
            requestAfter = await this.loadPage(queue);
        }

        if (requestAfter === -1) {
            requestQueue = requestQueue.filter(a => a !== queue);
            return;
        }

        // Remove this queue from queue list
        requestQueue.shift();
        this.setState({ rest: true });
    }

    loadMore() {
        if (this.state.rest && !endOfList) {
            this.loadAmount(requestQueue[0], 50);
        }
    }

    async componentDidMount() {
        gridUpdateTabs = this.updateTabs.bind(this);
        gridUpdatePostsVisual = this.updatePostsVisual.bind(this);

        const viewPort = document.querySelector("main .os-viewport");
        this.checkScroll = this.isScrolledBottom.bind(this);
        viewPort.addEventListener("scroll", this.checkScroll);

        if (cardList.length) { // Already loaded
            if (lastScroll > 0) {
                viewPort.scrollTo(0, lastScroll);
            }
            if (requestAfter && requestAfter !== -1 && requestQueue.length > 0) {
                // Resume the request that is canceled when app is unmounted
                this.loadMore();
            }
            return;
        }

        this.newRequest(30);
    }

    componentWillUnmount() {
        gridUpdateTabs = gridUpdatePostsVisual = null;
        const viewPort = document.querySelector("main .os-viewport");
        lastScroll = viewPort.scrollTop;
        viewPort.removeEventListener("scroll", this.checkScroll);
    }

    isScrolledBottom(event) {
        const viewPort = event.target;
        if ((viewPort.scrollTop + viewPort.clientHeight) >= viewPort.scrollHeight) {
            // At bottom, load more posts
            this.loadMore();
        }
    }

    render() {
        return react.createElement("section", {
            className: "contentSpacing"
        }, react.createElement("div", {
            className: "reddit-header"
        }, react.createElement("h1", null, this.props.title), 
        react.createElement(SortBox, {
            onChange: this.updateSort.bind(this),
            onServicesChange: this.updateTabs.bind(this),
        })), react.createElement("div", {
            id: "reddit-grid",
            className: "main-gridContainer-gridContainer",
            style: {
                "--minimumColumnWidth": "180px"
            },
        }, [...cardList]), react.createElement("footer", {
            style: {
                margin: "auto",
                textAlign: "center",
            }
        }, !this.state.endOfList && (this.state.rest ? react.createElement(LoadMoreIcon, { onClick: this.loadMore.bind(this) }) : react.createElement(LoadingIcon))
        ), react.createElement(TopBarContent, {
            switchCallback: this.switchTo.bind(this),
            links: CONFIG.services,
            activeLink: CONFIG.lastService,
        }));
    }
}

async function getSubreddit(after = '') {
    // www is needed or it will block with "cross-origin" error.
    var url = `https://www.reddit.com/r/${CONFIG.lastService}/${sortConfig.by}.json?limit=100&count=10&raw_json=1`
    if (after) {
        url += `&after=${after}`
    }
    if (sortConfig.by.match(/top|controversial/) && sortConfig.time) {
        url += `&t=${sortConfig.time}`
    }

    return await Spicetify.CosmosAsync.get(url);
}

async function fetchPlaylist(post) {
    try {
        const res = await Spicetify.CosmosAsync.get(
            `sp://core-playlist/v1/playlist/${post.uri}/metadata`,
            {
                policy: {
                    name: true,
                    picture: true,
                    followed: true,
                    followers: true,
                    owner: {
                        name: true
                    }
                }
            }
        )

        const { metadata } = res;
        return ({
            type: "Playlist",
            uri: post.uri,
            title: metadata.name,
            subtitle: post.title,
            imageURL: "https://i.scdn.co/image/" + metadata.picture.split(":")[2],
            upvotes: post.upvotes,
            followersCount: metadata.followers,
            isFollowing: metadata.followed,
        });
    } catch {
        return null;
    }
}

async function fetchAlbum(post) {
    const arg = post.uri.split(":")[2];
    const metadata = await Spicetify.CosmosAsync.get(`hm://album/v1/album-app/album/${arg}/desktop`)
    return ({
        type: "Album",
        uri: post.uri,
        title: metadata.name,
        subtitle: metadata.artists.map(a => a.name).join(", "),
        imageURL: metadata.cover.uri,
        upvotes: post.upvotes,
    });
}

async function fetchTrack(post) {
    const arg = post.uri.split(":")[2];
    const metadata = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/tracks/${arg}`)
    return ({
        type: "Track",
        uri: post.uri,
        title: metadata.name,
        subtitle: metadata.artists.map(a => a.name).join(", "),
        imageURL: metadata.album.images[0].url,
        upvotes: post.upvotes,
    });
}

function postMapper(posts) {
    var mappedPosts = [];
    posts.forEach(post => {
        var uri = URI.from(post.data.url);
        if (uri && (
            uri.type == "playlist" ||
            uri.type == "playlist-v2" ||
            uri.type == "track" ||
            uri.type == "album"
        )) {
            mappedPosts.push({
                uri: uri.toURI(),
                type: uri.type,
                title: post.data.title,
                upvotes: post.data.ups
            })
        }
    });
    return mappedPosts;
}

async function getItemsMeta(posts) {
    var promises = [];
    for (const post of posts) {
        switch (post.type) {
            case "playlist":
            case "playlist-v2":
                promises.push(fetchPlaylist(post));
                break;
            case "track":
                promises.push(fetchTrack(post));
                break;
            case "album":
                promises.push(fetchAlbum(post));
                break;
        }
    }

    const results = await Promise.all(promises);
    return results.filter(a => a);
}