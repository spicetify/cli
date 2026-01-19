(function PlaybarButton() {
	let retryCount = 0;
	let button;
	const style = document.createElement("style");
	style.innerHTML = `
		.main-nowPlayingBar-lyricsButton[data-testid="lyrics-button"] {
			display: none !important;
		}
		li[data-id="/lyrics-plus"] {
			display: none;
		}
	`;
	style.classList.add("lyrics-plus:visual:playbar-button");

	function setPlaybarButton() {
		document.head.appendChild(style);
		button?.register();
	}

	function removePlaybarButton() {
		style.remove();
		button?.deregister();
	}

	const checkHistory = () => {
		if (retryCount > 100) return; // Stop after ~30 seconds
		if (!Spicetify.Platform.History) {
			retryCount++;
			setTimeout(checkHistory, 300);
			return;
		}
		init();
	};

	function init() {
		const history = Spicetify.Platform.History;
		if (!history._lyricsPlusPatched) {
			const originalPush = history.push;
			history.push = (path, state) => {
				if (typeof path === "string" && path.includes("lyrics-plus")) {
					path = { pathname: path, state: { ...state, cinemaState: null } };
					return originalPush.apply(history, [path]);
				} else if (typeof path === "object" && path.pathname && path.pathname.includes("lyrics-plus")) {
					path.state = { ...path.state, cinemaState: null };
				}
				return originalPush.apply(history, [path, state]);
			};
			history._lyricsPlusPatched = true;
		}

		button = new Spicetify.Playbar.Button(
			"Lyrics Plus",
			`<svg role="img" height="16" width="16" aria-hidden="true" viewBox="0 0 16 16" data-encore-id="icon" fill="currentColor"><path d="M13.426 2.574a2.831 2.831 0 0 0-4.797 1.55l3.247 3.247a2.831 2.831 0 0 0 1.55-4.797zM10.5 8.118l-2.619-2.62A63303.13 63303.13 0 0 0 4.74 9.075L2.065 12.12a1.287 1.287 0 0 0 1.816 1.816l3.06-2.688 3.56-3.129zM7.12 4.094a4.331 4.331 0 1 1 4.786 4.786l-3.974 3.493-3.06 2.689a2.787 2.787 0 0 1-3.933-3.933l2.676-3.045 3.505-3.99z"></path></svg>`,
			() =>
				Spicetify.Platform.History.location.pathname !== "/lyrics-plus"
					? Spicetify.Platform.History.push({ pathname: "/lyrics-plus", state: { cinemaState: null } })
					: Spicetify.Platform.History.goBack(),
			false,
			Spicetify.Platform.History.location.pathname === "/lyrics-plus",
			false
		);

		history.listen((location) => {
			button.active = location.pathname === "/lyrics-plus";
		});

		if (Spicetify.LocalStorage.get("lyrics-plus:visual:playbar-button") === "true") setPlaybarButton();

		window.addEventListener("lyrics-plus", (event) => {
			if (event.detail?.name === "playbar-button") event.detail.value ? setPlaybarButton() : removePlaybarButton();
		});
	}

	checkHistory();
})();
