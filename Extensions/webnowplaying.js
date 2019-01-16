// NAME: WebNowPlaying Companion
// AUTHOR: khanhas (based on https://github.com/tjhrulz/WebNowPlaying-BrowserExtension)
// DESCRIPTION: Get song information and control player

/// <reference path="../globals.d.ts" />

(function WebNowPlaying() {
    let currentMusicInfo;
    let ws;
    let currState = 0;

    const info = {
        STATE: () => (Spicetify.Player.isPlaying() ? 1 : 2),
        TITLE: () => Spicetify.Player.data.track.metadata.title || "N/A",
        ARTIST: () => {
            if (Spicetify.URI.isShow(Spicetify.Player.data.track.uri)) {
                return info.ALBUM();
            }

            return document.querySelector("#view-player-footer .artist").innerText
        },
        ALBUM: () => Spicetify.Player.data.track.metadata.album_title || "N/A",
        DURATION: () => convertTimeToString(Spicetify.Player.getDuration()),
        POSITION: () => convertTimeToString(Spicetify.Player.getProgress()),
        VOLUME: () => Math.round(Spicetify.Player.getVolume() * 100),
        RATING: () =>
            Spicetify.LiveAPI(Spicetify.Player.data.track.uri).get("added")
                ? 5
                : 0,
        REPEAT: () => Spicetify.Player.getRepeat(),
        SHUFFLE: () => (Spicetify.Player.getShuffle() ? 1 : 0),
        COVER: () => {
            const cover =
                Spicetify.Player.data.track.metadata.image_xlarge_url || "";
            if (cover !== "" && cover.indexOf("localfile") === -1) {
                return (
                    "https://i.scdn.co/image/" +
                    cover.substring(cover.lastIndexOf(":") + 1)
                );
            }

            return "";
        },
    };

    function updateInfo() {
        if (!Spicetify.Player.data && currState !== 0) {
            ws.send("STATE:" + 0);
            currState = 0;
            return;
        }
        for (const field in info) {
            try {
                const data = info[field].call();
                if (data !== undefined && currentMusicInfo[field] !== data) {
                    ws.send(`${field}:${data}`);
                    currentMusicInfo[field] = data;
                }
            } catch (e) {
                ws.send(`Error:Error updating ${field} for Spotify Desktop`);
                ws.send("ErrorD:" + e);
            }
        }
    }

    function fireEvent(event) {
        const m = event.data;
        const n = m.indexOf(" ");
        let type = n === -1 ? m : m.substring(0, n);
        type = type.toUpperCase();
        const info = m.substring(n + 1);

        switch (type) {
            case "PLAYPAUSE":
                Spicetify.Player.togglePlay();
                break;
            case "NEXT":
                Spicetify.Player.next();
                break;
            case "PREVIOUS":
                Spicetify.Player.back();
                break;
            case "SETPOSITION":
                Spicetify.Player.seek(parseInt(info) * 1000);
                break;
            case "SETVOLUME":
                Spicetify.Player.setVolume(parseInt(info) / 100);
                break;
            case "REPEAT":
                Spicetify.Player.toggleRepeat();
                break;
            case "SHUFFLE":
                Spicetify.Player.toggleShuffle();
                break;
            case "RATING":
                const like = parseInt(info) > 3;
                const isLiked = Spicetify.Player.getHeart();
                if ((like && !isLiked) || (!like && isLiked)) {
                    Spicetify.Player.toggleHeart();
                }
                break;
        }
    }

    (function init() {
        ws = new WebSocket("ws://127.0.0.1:8974/");
        let sendData;

        ws.onopen = () => {
            ws.send("PLAYER: Spotify Desktop");
            currState = 1;
            currentMusicInfo = {};
            sendData = setInterval(updateInfo, 500);
        };

        ws.onclose = () => {
            clearInterval(sendData);
            setTimeout(init, 2000);
        };

        ws.onmessage = fireEvent;
    })();

    window.onbeforeunload = () => {
        ws.onclose = null; // disable onclose handler first
        ws.close();
    };

    /**
     * Zero padding a number
     * @param {number} number number to pad
     * @param {number} length
     */
    function pad(number, length) {
        var str = String(number);
        while (str.length < length) {
            str = "0" + str;
        }
        return str;
    }

    /**
     * Convert seconds to a time string acceptable to Rainmeter
     * @param {number} timeInMs
     * @returns {string}
     */
    function convertTimeToString(timeInMs) {
        const seconds = Math.round(timeInMs / 1000);
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) {
            return `${minutes}:${pad(seconds % 60, 2)}`;
        }
        return `${Math.floor(minutes / 60)}:${pad(minutes % 60, 2)}:${pad(
            seconds % 60,
            2
        )}`;
    }
})();
