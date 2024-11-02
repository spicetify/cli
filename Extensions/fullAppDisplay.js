// NAME: Full App Display
// AUTHOR: khanhas
// VERSION: 1.0
// DESCRIPTION: Fancy artwork and track status display.

/// <reference path="../globals.d.ts" />
(function FullAppDisplay() {
	if (!Spicetify.Keyboard || !Spicetify.React || !Spicetify.ReactDOM) {
		setTimeout(FullAppDisplay, 200);
		return;
	}

	const { React: react, ReactDOM: reactDOM } = Spicetify;
	const { useState, useEffect, useRef } = react;

	const CONFIG = getConfig();
	let updateVisual;

	const style = document.createElement("style");
	const styleBase = `
#full-app-display {
    display: none;
    position: fixed;
    width: 100%;
    height: 100%;
    cursor: default;
    left: 0;
    top: 0;
}
#full-app-display.hide-cursor {
	cursor: none;
}
#fad-header {
    position: fixed;
    width: 100%;
    height: 80px;
    -webkit-app-region: drag;
}
#fad-body {
    height: 100vh;
}
#fad-foreground {
    position: relative;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    display: flex;
    align-items: center;
    justify-content: center;
    transform: scale(var(--fad-scale));
}
#fad-art-image {
    position: relative;
    width: 100%;
    height: 100%;
    padding-bottom: 100%;
    border-radius: 15px;
    background-size: cover;
}
#fad-art-inner {
    position: absolute;
    left: 3%;
    bottom: 0;
    width: 94%;
    height: 94%;
    z-index: -1;
    backface-visibility: hidden;
    transform: translateZ(0);
    filter: blur(6px);
    backdrop-filter: blur(6px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.6);
}
#fad-art-overlay {
    display: none;
}
#fad-art:hover #fad-art-overlay {
    position: absolute;
    width: 100%;
    height: 100%;
    display: flex;
    align-content: center;
    align-items: center;
    justify-content: center;
    border-radius: 15px;
    backdrop-filter: brightness(0.75);
}
#fad-heart {
    background-color: transparent;
    border: 0;
    color: #fff;
    padding: 0 5px;
    cursor: pointer;
}
#fad-progress-container {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-grow: 1;
    gap: 10px;
}
#fad-progress {
    width: 100%;
    height: 6px;
    border-radius: 6px;
    background-color: #ffffff50;
    flex-grow: 1;
    min-width: 150px;
}
#fad-progress:hover #fad-progress-inner {
    background-color: var(--spice-button);
}
#fad-progress:hover #fad-thumb {
    visibility: visible;
}
#fad-progress-inner {
    width: var(--progress-width);
    height: 100%;
    border-radius: 6px;
    background-color: #ffffff;
    box-shadow: 4px 0 12px rgba(0, 0, 0, 0.8);
	position: relative;
}
#fad-thumb {
    position: absolute;
    top: -3px;
    right: -6px;
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background-color: #ffffff;
    cursor: pointer;
    visibility: hidden;
}
#fad-background {
    position: absolute;
    left: 0;
    top: 0;
    width: 100%;
    height: 100%;
    z-index: -2;
}
body.fad-activated #full-app-display {
    display: block
}
.fad-background-fade {
    transition: background-image 1s linear;
}
body.video-full-screen.video-full-screen--hide-ui {
    cursor: auto;
}
#fad-controls button {
    background-color: transparent;
    border: 0;
    color: currentColor;
    padding: 0 5px;
    cursor: pointer;
}
#fad-controls button svg {
    vertical-align: middle;
}
#fad-elapsed, #fad-duration {
    font-variant-numeric: tabular-nums;
}
#fad-artist svg, #fad-album svg, #fad-release-date svg {
    display: inline-block;
}
::-webkit-scrollbar {
    width: 8px;
}
`;

	const styleChoices = [
		`
#fad-foreground {
    flex-direction: row;
    text-align: left;
}
#fad-art {
    width: calc(100vw - 840px);
    min-width: 200px;
    max-width: 340px;
}
#fad-details {
    padding-left: 50px;
    line-height: initial;
    max-width: 70%;
    color: #FFFFFF;
}
#fad-title {
    font-size: 87px;
    font-weight: var(--glue-font-weight-black);
}
#fad-artist, #fad-album, #fad-release-date {
    font-size: 54px;
    font-weight: var(--glue-font-weight-medium);
}
#fad-artist svg, #fad-album svg, #fad-release-date svg {
    margin-right: 5px;
}
#fad-status {
    display: flex;
    align-items: center;
    flex-wrap: wrap;
    gap: 10px;
}
#fad-status.active {
    margin-top: 20px;
}
#fad-controls {
    display: flex;
    margin: 0 auto;
}`,
		`
#fad-art {
    width: calc(100vh - 400px);
    max-width: 340px;
}
#fad-foreground {
    flex-direction: column;
    text-align: center;
}
#fad-details {
    padding-top: 50px;
    line-height: initial;
    max-width: 70%;
    color: #FFFFFF;
}
#fad-title {
    font-size: 54px;
    font-weight: var(--glue-font-weight-black);
}
#fad-artist, #fad-album, #fad-release-date {
    font-size: 33px;
    font-weight: var(--glue-font-weight-medium);
}
#fad-artist svg, #fad-album svg, #fad-release-date svg {
    width: 25px;
    height: 25px;
    margin-right: 5px;
}
#fad-status {
    display: flex;
    min-width: 400px;
    max-width: 400px;
    align-items: center;
    flex-direction: column;
}
#fad-status.active {
    margin: 20px auto 0;
}
#fad-controls {
    margin-top: 20px;
    order: 2
}
#fad-progress-container {
    width: 100%;
}`,
	];

	const lyricsPlusBase = `
#fad-body {
    display: grid;
    grid-template-columns: 1fr 1fr;
}
#fad-foreground {
    padding: 0 50px 0 100px;
    width: 50vw;
}
#fad-lyrics-plus-container {
    position: relative;
    width: 50vw;
}
`;
	const lyricsPlusStyleChoices = [
		`
#fad-title {
    font-size: 54px;
}
#fad-art {
    max-width: 210px;
}`,
		"",
	];
	updateStyle();

	const DisplayIcon = ({ icon, size }) => {
		return react.createElement("svg", {
			width: size,
			height: size,
			viewBox: "0 0 16 16",
			fill: "currentColor",
			dangerouslySetInnerHTML: {
				__html: icon,
			},
		});
	};

	const SubInfo = ({ text, id, icon }) => {
		return react.createElement(
			"div",
			{
				id,
			},
			CONFIG.icons && react.createElement(DisplayIcon, { icon, size: 35 }),
			react.createElement("span", null, text)
		);
	};

	const ButtonIcon = ({ icon, onClick }) => {
		return react.createElement(
			"button",
			{
				onClick,
			},
			react.createElement(DisplayIcon, { icon, size: 20 })
		);
	};

	const ProgressBar = () => {
		const [progress, setProgress] = useState(Spicetify.Player.getProgress());
		const duration = Spicetify.Platform.PlayerAPI._state.duration;

		const progressDivRef = useRef(null);
		const [isDragging, setIsDragging] = useState(false);

		useEffect(() => {
			if (isDragging) {
				return;
			}

			const update = ({ data }) => setProgress(data);
			Spicetify.Player.addEventListener("onprogress", update);
			return () => Spicetify.Player.removeEventListener("onprogress", update);
		}, [isDragging]);

		// Handle click on progress bar to set progress
		const handleClick = (e) => {
			const container = progressDivRef.current;
			if (isDragging || !container) {
				return;
			}

			const containerRect = container.getBoundingClientRect();
			const clickX = e.clientX - containerRect.left;
			const newProgress = (clickX / containerRect.width) * duration;
			Spicetify.Player.seek(newProgress);
			setProgress(newProgress);
		};

		// Handle dragging functionality
		const handleMouseDown = () => setIsDragging(true);
		const handleMouseMove = (e) => {
			const container = progressDivRef.current;
			if (!isDragging || !container) {
				return;
			}

			const containerRect = container.getBoundingClientRect();
			const offsetX = e.clientX - containerRect.left;
			const newProgress = (offsetX / containerRect.width) * duration;
			setProgress(newProgress);
		};
		const handleMouseUp = () => {
			if (!isDragging) {
				return;
			}

			Spicetify.Player.seek(progress);
			setIsDragging(false);
		};

		// Attach mousemove and mouseup listeners when dragging starts
		useEffect(() => {
			if (isDragging) {
				window.addEventListener("mousemove", handleMouseMove);
				window.addEventListener("mouseup", handleMouseUp);
			} else {
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			}

			return () => {
				window.removeEventListener("mousemove", handleMouseMove);
				window.removeEventListener("mouseup", handleMouseUp);
			};
		}, [isDragging]);

		// Calculate the thumb position
		const thumbPosition = (progress / duration) * 100;

		return react.createElement(
			"div",
			{ id: "fad-progress-container" },
			react.createElement("span", { id: "fad-elapsed" }, Spicetify.Player.formatTime(progress)),
			react.createElement(
				"div",
				{
					id: "fad-progress",
					ref: progressDivRef,
					onClick: handleClick,
					style: {
						"--progress-width": `${thumbPosition}%`,
					},
				},
				react.createElement(
					"div",
					{ id: "fad-progress-inner" },
					react.createElement("div", {
						id: "fad-thumb",
						onMouseDown: handleMouseDown,
					})
				)
			),
			react.createElement("span", { id: "fad-duration" }, Spicetify.Player.formatTime(duration))
		);
	};

	const PlayerControls = () => {
		const [value, setValue] = useState(Spicetify.Player.isPlaying());
		useEffect(() => {
			const update = ({ data }) => setValue(!data.isPaused);
			Spicetify.Player.addEventListener("onplaypause", update);
			return () => Spicetify.Player.removeEventListener("onplaypause", update);
		});
		return react.createElement(
			"div",
			{ id: "fad-controls" },
			react.createElement(ButtonIcon, {
				icon: Spicetify.SVGIcons["skip-back"],
				onClick: Spicetify.Player.back,
			}),
			react.createElement(ButtonIcon, {
				icon: Spicetify.SVGIcons[value ? "pause" : "play"],
				onClick: Spicetify.Player.togglePlay,
			}),
			react.createElement(ButtonIcon, {
				icon: Spicetify.SVGIcons["skip-forward"],
				onClick: Spicetify.Player.next,
			})
		);
	};

	class FAD extends react.Component {
		constructor(props) {
			super(props);

			this.state = {
				title: "",
				artist: "",
				album: "",
				releaseDate: "",
				cover: "",
				heart: Spicetify.Player.getHeart(),
			};
			this.currTrackImg = new Image();
			this.nextTrackImg = new Image();
			this.mousetrap = new Spicetify.Mousetrap();
		}

		async getAlbumDate(uri) {
			const id = uri.replace("spotify:album:", "");

			const albumInfo = await Spicetify.CosmosAsync.get(`https://api.spotify.com/v1/albums/${id}`);

			const albumDate = new Date(albumInfo.release_date);
			return albumDate.toLocaleString("default", {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
		}

		async fetchInfo() {
			const meta = Spicetify.Player.data.item.metadata;

			// prepare title
			let rawTitle = meta.title;
			if (CONFIG.trimTitle) {
				rawTitle = rawTitle
					.replace(/\(.+?\)/g, "")
					.replace(/\[.+?\]/g, "")
					.replace(/\s\-\s.+?$/, "")
					.replace(/,.+?$/, "")
					.trim();
			}

			// prepare artist
			let artistName;
			if (CONFIG.showAllArtists) {
				artistName = Object.keys(meta)
					.filter((key) => key.startsWith("artist_name"))
					.sort()
					.map((key) => meta[key])
					.join(", ");
			} else {
				artistName = meta.artist_name;
			}

			// prepare release date
			let releaseDate;
			if (CONFIG.showReleaseDate) {
				const albumURI = meta.album_uri;
				if (albumURI?.startsWith("spotify:album:")) {
					releaseDate = await this.getAlbumDate(albumURI);
				}
			}

			// prepare album
			const albumText = meta.album_title || "";

			if (meta.image_xlarge_url === this.currTrackImg.src) {
				this.setState({
					title: rawTitle || "",
					artist: artistName || "",
					album: albumText || "",
					releaseDate: releaseDate || "",
					heart: Spicetify.Player.getHeart(),
				});
				return;
			}

			// TODO: Pre-load next track
			// Wait until next track image is downloaded then update UI text and images
			const previousImg = this.currTrackImg.cloneNode();
			this.currTrackImg.src = meta.image_xlarge_url;
			this.currTrackImg.onload = () => {
				const bgImage = `url("${this.currTrackImg.src}")`;

				this.animateCanvas(previousImg, this.currTrackImg);
				this.setState({
					title: rawTitle || "",
					artist: artistName || "",
					album: albumText || "",
					releaseDate: releaseDate || "",
					cover: bgImage,
					heart: Spicetify.Player.getHeart(),
				});
			};
			this.currTrackImg.onerror = () => {
				// Placeholder
				this.currTrackImg.src =
					"data:image/svg+xml;base64,PD94bWwgdmVyc2lvbj0iMS4wIiBlbmNvZGluZz0iVVRGLTgiIHN0YW5kYWxvbmU9Im5vIj8+CjxzdmcgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHZpZXdCb3g9IjAgMCA0MCA0MCI+CiAgPHJlY3Qgc3R5bGU9ImZpbGw6I2ZmZmZmZiIgd2lkdGg9IjQwIiBoZWlnaHQ9IjQwIiB4PSIwIiB5PSIwIiAvPgogIDxwYXRoIGZpbGw9IiNCM0IzQjMiIGQ9Ik0yNi4yNSAxNi4xNjJMMjEuMDA1IDEzLjEzNEwyMS4wMTIgMjIuNTA2QzIwLjU5NCAyMi4xOTIgMjAuMDgxIDIxLjk5OSAxOS41MTkgMjEuOTk5QzE4LjE0MSAyMS45OTkgMTcuMDE5IDIzLjEyMSAxNy4wMTkgMjQuNDk5QzE3LjAxOSAyNS44NzggMTguMTQxIDI2Ljk5OSAxOS41MTkgMjYuOTk5QzIwLjg5NyAyNi45OTkgMjIuMDE5IDI1Ljg3OCAyMi4wMTkgMjQuNDk5QzIyLjAxOSAyNC40MjIgMjIuMDA2IDE0Ljg2NyAyMi4wMDYgMTQuODY3TDI1Ljc1IDE3LjAyOUwyNi4yNSAxNi4xNjJaTTE5LjUxOSAyNS45OThDMTguNjkyIDI1Ljk5OCAxOC4wMTkgMjUuMzI1IDE4LjAxOSAyNC40OThDMTguMDE5IDIzLjY3MSAxOC42OTIgMjIuOTk4IDE5LjUxOSAyMi45OThDMjAuMzQ2IDIyLjk5OCAyMS4wMTkgMjMuNjcxIDIxLjAxOSAyNC40OThDMjEuMDE5IDI1LjMyNSAyMC4zNDYgMjUuOTk4IDE5LjUxOSAyNS45OThaIi8+Cjwvc3ZnPgo=";
			};
		}

		animateCanvas(prevImg, nextImg) {
			const { innerWidth: width, innerHeight: height } = window;
			this.back.width = width;
			this.back.height = height;

			const ctx = this.back.getContext("2d");
			ctx.imageSmoothingEnabled = false;
			ctx.filter = "blur(30px) brightness(0.6)";
			const blur = 30;

			const x = -blur * 2;

			let y;
			let dim;

			if (width > height) {
				dim = width;
				y = x - (width - height) / 2;
			} else {
				dim = height;
				y = x;
			}

			const size = dim + 4 * blur;

			if (!CONFIG.enableFade) {
				ctx.globalAlpha = 1;
				ctx.drawImage(nextImg, x, y, size, size);
				return;
			}

			let factor = 0.0;
			const animate = () => {
				ctx.globalAlpha = 1;
				ctx.drawImage(prevImg, x, y, size, size);
				ctx.globalAlpha = Math.sin((Math.PI / 2) * factor);
				ctx.drawImage(nextImg, x, y, size, size);

				if (factor < 1.0) {
					factor += 0.016;
					requestAnimationFrame(animate);
				}
			};

			requestAnimationFrame(animate);
		}

		componentDidMount() {
			this.updateInfo = this.fetchInfo.bind(this);
			Spicetify.Player.addEventListener("songchange", this.updateInfo);
			this.updateInfo();

			updateVisual = () => {
				updateStyle();
				this.fetchInfo();
			};

			this.onQueueChange = async (queueData) => {
				const queue = queueData.data;
				let nextTrack;
				if (queue.queued.length) {
					nextTrack = queue.queued[0];
				} else {
					nextTrack = queue.nextUp[0];
				}
				this.nextTrackImg.src = nextTrack.metadata.image_xlarge_url;
			};

			const scaleLimit = { min: 0.1, max: 4, step: 0.05 };
			this.onScaleChange = (event) => {
				if (!event.ctrlKey) return;
				const dir = event.deltaY < 0 ? 1 : -1;
				let temp = (CONFIG.scale || 1) + dir * scaleLimit.step;
				if (temp < scaleLimit.min) {
					temp = scaleLimit.min;
				} else if (temp > scaleLimit.max) {
					temp = scaleLimit.max;
				}
				CONFIG.scale = temp;
				saveConfig();
				updateVisual();
			};

			Spicetify.Platform.PlayerAPI._events.addListener("queue_update", this.onQueueChange);
			this.mousetrap.bind("esc", deactivate);
			window.dispatchEvent(new Event("fad-request"));
		}

		componentWillUnmount() {
			Spicetify.Player.removeEventListener("songchange", this.updateInfo);
			Spicetify.Platform.PlayerAPI._events.removeListener("queue_update", this.onQueueChange);
			this.mousetrap.unbind("esc");
		}

		render() {
			return react.createElement(
				"div",
				{
					id: "full-app-display",
					className: "Video VideoPlayer--fullscreen VideoPlayer--landscape",
					onDoubleClick: deactivate,
					onContextMenu: openConfig,
				},
				react.createElement("canvas", {
					id: "fad-background",
					ref: (el) => {
						this.back = el;
					},
				}),
				react.createElement("div", { id: "fad-header" }),
				react.createElement(
					"div",
					{ id: "fad-body" },
					react.createElement(
						"div",
						{
							id: "fad-foreground",
							style: {
								"--fad-scale": CONFIG.scale || 1,
							},
							ref: (el) => {
								if (!el) return;
								el.onmousewheel = this.onScaleChange;
							},
						},
						react.createElement(
							"div",
							{ id: "fad-art" },
							react.createElement(
								"div",
								{
									id: "fad-art-image",
									className: CONFIG.enableFade && "fad-background-fade",
									style: {
										backgroundImage: this.state.cover,
									},
								},
								react.createElement(
									"div",
									{
										id: "fad-art-overlay",
									},
									react.createElement(
										"button",
										{
											id: "fad-heart",
											onClick: () => {
												Spicetify.Player.toggleHeart();
												this.setState({ heart: !this.state.heart });
											},
										},
										react.createElement(DisplayIcon, {
											icon: Spicetify.SVGIcons[this.state.heart ? "heart-active" : "heart"],
											size: 50,
										})
									)
								),
								react.createElement("div", {
									id: "fad-art-inner",
								})
							)
						),
						react.createElement(
							"div",
							{ id: "fad-details" },
							react.createElement("div", { id: "fad-title" }, this.state.title),
							react.createElement(SubInfo, {
								id: "fad-artist",
								text: this.state.artist,
								icon: Spicetify.SVGIcons.artist,
							}),
							CONFIG.showAlbum &&
								react.createElement(SubInfo, {
									id: "fad-album",
									text: this.state.album,
									icon: Spicetify.SVGIcons.album,
								}),
							CONFIG.showReleaseDate &&
								react.createElement(SubInfo, {
									id: "fad-release-date",
									text: this.state.releaseDate,
									icon: Spicetify.SVGIcons.clock,
								}),
							react.createElement(
								"div",
								{
									id: "fad-status",
									className: (CONFIG.enableControl || CONFIG.enableProgress) && "active",
								},
								CONFIG.enableControl && react.createElement(PlayerControls),
								CONFIG.enableProgress && react.createElement(ProgressBar)
							)
						)
					),
					CONFIG.lyricsPlus &&
						react.createElement("div", {
							id: "fad-lyrics-plus-container",
							style: {
								"--lyrics-color-active": "#ffffff",
								"--lyrics-color-inactive": "#ffffff50",
							},
						})
				)
			);
		}
	}

	const classes = ["video", "video-full-screen", "video-full-window", "video-full-screen--hide-ui", "fad-activated"];

	const container = document.createElement("div");
	container.id = "fad-main";
	let lastApp;
	let cursorTimeout;
	let fad;

	async function toggleFullscreen() {
		if (CONFIG.enableFullscreen) {
			await document.documentElement.requestFullscreen();
			toggleCursor(false);
		} else if (document.webkitIsFullScreen) {
			await document.exitFullscreen();
			toggleCursor(true);
		}
	}

	function eventListener() {
		showCursor();
		cursorTimeout = setTimeout(hideCursor, 2000);
	}

	function showCursor() {
		fad.classList.remove("hide-cursor");
		clearTimeout(cursorTimeout);
	}

	function hideCursor() {
		fad.classList.add("hide-cursor");
	}

	function toggleCursor(show = true) {
		fad = document.getElementById("full-app-display");

		if (!fad) {
			setTimeout(toggleCursor, 300, show);
			return;
		}

		if (show) {
			document.removeEventListener("mousemove", eventListener);
			showCursor();
		} else {
			cursorTimeout = setTimeout(hideCursor, 2000);
			document.addEventListener("mousemove", eventListener);
		}
	}

	async function activate() {
		if (!Spicetify.Player.data) return;

		await toggleFullscreen();

		document.body.classList.add(...classes);
		document.body.append(style, container);
		reactDOM.render(react.createElement(FAD), container);

		requestLyricsPlus();
	}

	function deactivate() {
		if (CONFIG.enableFullscreen || document.webkitIsFullScreen) {
			document.exitFullscreen();
		}
		toggleCursor(true);
		document.body.classList.remove(...classes);
		reactDOM.unmountComponentAtNode(container);
		style.remove();
		container.remove();
		window.dispatchEvent(new Event("fad-request"));

		if (lastApp && lastApp !== "/lyrics-plus") {
			Spicetify.Platform.History.push(lastApp);
		}
	}

	function toggleFad() {
		if (document.body.classList.contains("fad-activated")) {
			deactivate();
		} else {
			activate();
		}
	}

	function updateStyle() {
		style.innerHTML =
			styleBase +
			styleChoices[CONFIG.vertical ? 1 : 0] +
			(checkLyricsPlus() && CONFIG.lyricsPlus ? lyricsPlusBase + lyricsPlusStyleChoices[CONFIG.vertical ? 1 : 0] : "");
	}

	function checkLyricsPlus() {
		return Spicetify.Config?.custom_apps?.includes("lyrics-plus") || !!document.querySelector("a[href='/lyrics-plus']");
	}

	function requestLyricsPlus() {
		if (CONFIG.lyricsPlus && checkLyricsPlus()) {
			lastApp = Spicetify.Platform.History.location.pathname;
			if (lastApp !== "/lyrics-plus") {
				Spicetify.Platform.History.push("/lyrics-plus");
			}
		}
		window.dispatchEvent(new Event("fad-request"));
	}

	function getConfig() {
		try {
			const parsed = JSON.parse(Spicetify.LocalStorage.get("full-app-display-config") || "{}");
			if (parsed && typeof parsed === "object") {
				return parsed;
			}
			throw "";
		} catch {
			Spicetify.LocalStorage.set("full-app-display-config", "{}");
			return {};
		}
	}

	function saveConfig() {
		Spicetify.LocalStorage.set("full-app-display-config", JSON.stringify(CONFIG));
	}

	const ConfigItem = ({ name, field, func, disabled = false }) => {
		const [value, setValue] = useState(CONFIG[field]);
		return react.createElement(
			"div",
			{ className: "setting-row" },
			react.createElement("label", { className: "col description" }, name),
			react.createElement(
				"div",
				{ className: "col action" },
				react.createElement(
					"button",
					{
						className: `switch${value ? "" : " disabled"}`,
						disabled,
						onClick: () => {
							const state = !value;
							CONFIG[field] = state;
							setValue(state);
							saveConfig();
							func();
						},
					},
					react.createElement(DisplayIcon, {
						icon: Spicetify.SVGIcons.check,
						size: 16,
					})
				)
			)
		);
	};

	function openConfig(event) {
		event.preventDefault();
		const style = react.createElement("style", {
			dangerouslySetInnerHTML: {
				__html: `
.setting-row::after {
    content: "";
    display: table;
    clear: both;
}
.setting-row .col {
    display: flex;
    padding: 10px 0;
    align-items: center;
}
.setting-row .col.description {
    float: left;
    padding-right: 15px;
}
.setting-row .col.action {
    float: right;
    text-align: right;
}
button.switch {
    align-items: center;
    border: 0px;
    border-radius: 50%;
    background-color: rgba(var(--spice-rgb-shadow), .7);
    color: var(--spice-text);
    cursor: pointer;
    display: flex;
    margin-inline-start: 12px;
    padding: 8px;
}
button.switch.disabled,
button.switch[disabled] {
    color: rgba(var(--spice-rgb-text), .3);
}
`,
			},
		});
		const configContainer = react.createElement(
			"div",
			null,
			style,
			react.createElement(ConfigItem, {
				name: checkLyricsPlus() ? "Enable Lyrics Plus integration" : "Lyrics Plus not applied",
				field: "lyricsPlus",
				func: () => {
					updateVisual();
					requestLyricsPlus();
				},
				disabled: !checkLyricsPlus(),
			}),
			react.createElement(ConfigItem, {
				name: "Enable progress bar",
				field: "enableProgress",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Enable controls",
				field: "enableControl",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Trim title",
				field: "trimTitle",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Show album",
				field: "showAlbum",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Show all artists",
				field: "showAllArtists",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Show release date",
				field: "showReleaseDate",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Show icons",
				field: "icons",
				func: updateVisual,
			}),
			react.createElement(ConfigItem, {
				name: "Vertical mode",
				field: "vertical",
				func: updateStyle,
			}),
			react.createElement(ConfigItem, {
				name: "Enable fullscreen",
				field: "enableFullscreen",
				func: toggleFullscreen,
			}),
			react.createElement(ConfigItem, {
				name: "Enable song change animation",
				field: "enableFade",
				func: updateVisual,
			})
		);
		Spicetify.PopupModal.display({
			title: "Full App Display",
			content: configContainer,
		});
	}

	// Add activator on top bar
	new Spicetify.Topbar.Button(
		"Full App Display",
		`<svg role="img" height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons.projector}</svg>`,
		activate
	);

	Spicetify.Mousetrap.bind("f11", toggleFad);
})();
