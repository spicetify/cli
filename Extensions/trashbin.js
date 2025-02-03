// NAME: Trashbin
// AUTHOR: khanhas and OhItsTom
// DESCRIPTION: Throw songs to trashbin and never hear it again.

/// <reference path="../globals.d.ts" />

(function TrashBin() {
	const skipBackBtn =
		document.querySelector(".main-skipBackButton-button") ??
		document.querySelector(".player-controls__left > button[data-encore-id='buttonTertiary']");
	if (!Spicetify.Player.data || !Spicetify.LocalStorage || !skipBackBtn) {
		setTimeout(TrashBin, 1000);
		return;
	}

	function createButton(text, description, callback) {
		const container = document.createElement("div");
		container.classList.add("setting-row");
		container.innerHTML = `
		<label class="col description">${description}</label>
		<div class="col action"><button class="reset">${text}</button></div>
		`;

		const button = container.querySelector("button.reset");
		button.onclick = callback;
		return container;
	}

	function createSlider(name, desc, defaultVal, callback) {
		const container = document.createElement("div");
		container.classList.add("setting-row");
		container.innerHTML = `
			<label class="col description">${desc}</label>
			<div class="col action"><button class="switch">
			<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
			${Spicetify.SVGIcons.check}
			</svg>
			</button></div>
		`;

		const slider = container.querySelector("button.switch");
		slider.classList.toggle("disabled", !defaultVal);

		slider.onclick = () => {
			const state = slider.classList.contains("disabled");
			slider.classList.toggle("disabled");
			Spicetify.LocalStorage.set(name, state);
			console.log(name, state);
			callback(state);
		};

		return container;
	}

	function settingsContent() {
		// Options
		header = document.createElement("h2");
		header.innerText = "Options";
		content.appendChild(header);

		content.appendChild(createSlider("trashbin-enabled", "Enabled", trashbinStatus, refreshEventListeners));
		content.appendChild(
			createSlider("TrashbinWidgetIcon", "Show Widget Icon", enableWidget, (state) => {
				enableWidget = state;
				state && trashbinStatus ? widget.register() : widget.deregister();
			})
		);

		// Local Storage
		header = document.createElement("h2");
		header.innerText = "Local Storage";
		content.appendChild(header);

		content.appendChild(createButton("Copy", "Copy all items in trashbin to clipboard.", copyItems));
		content.appendChild(createButton("Export", "Save all items in trashbin to a .json file.", exportItems));
		content.appendChild(createButton("Import", "Overwrite all items in trashbin via .json file.", importItems));
		content.appendChild(
			createButton("Clear ", "Clear all items from trashbin (cannot be reverted).", () => {
				trashSongList = {};
				trashArtistList = {};
				setWidgetState(false);
				putDataLocal();
				Spicetify.showNotification("Trashbin cleared!");
			})
		);
	}

	function styleSettings() {
		const style = document.createElement("style");
		style.innerHTML = `
		.main-trackCreditsModal-container {
			width: auto !important;
			background-color: var(--spice-player) !important;
		}

		.setting-row::after {
		  content: "";
		  display: table;
		  clear: both;
		}
		.setting-row {
		  display: flex;
		  padding: 10px 0;
		  align-items: center;
		  justify-content: space-between;
		}
		.setting-row .col.description {
		  float: left;
		  padding-right: 15px;
		  width: 100%;
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
		button.reset {
		  font-weight: 700;
		  font-size: medium;
		  background-color: transparent;
		  border-radius: 500px;
		  transition-duration: 33ms;
		  transition-property: background-color, border-color, color, box-shadow, filter, transform;
		  padding-inline: 15px;
		  border: 1px solid #727272;
		  color: var(--spice-text);
		  min-block-size: 32px;
		  cursor: pointer;
		}
		button.reset:hover {
		  transform: scale(1.04);
		  border-color: var(--spice-text);
		}`;
		content.appendChild(style);
	}

	function initValue(item, defaultValue) {
		try {
			const value = JSON.parse(Spicetify.LocalStorage.get(item));
			return value ?? defaultValue;
		} catch {
			return defaultValue;
		}
	}

	// Settings Variables - Initial Values
	let trashbinStatus = initValue("trashbin-enabled", true);
	let enableWidget = initValue("TrashbinWidgetIcon", true);

	// Settings Menu Initialization
	const content = document.createElement("div");
	styleSettings();
	settingsContent();

	const trashbinIcon =
		'<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="currentcolor"><path d="M5.25 3v-.917C5.25.933 6.183 0 7.333 0h1.334c1.15 0 2.083.933 2.083 2.083V3h4.75v1.5h-.972l-1.257 9.544A2.25 2.25 0 0 1 11.041 16H4.96a2.25 2.25 0 0 1-2.23-1.956L1.472 4.5H.5V3h4.75zm1.5-.917V3h2.5v-.917a.583.583 0 0 0-.583-.583H7.333a.583.583 0 0 0-.583.583zM2.986 4.5l1.23 9.348a.75.75 0 0 0 .744.652h6.08a.75.75 0 0 0 .744-.652L13.015 4.5H2.985z"/></svg>';

	const THROW_TEXT = "Place in Trashbin";
	const UNTHROW_TEXT = "Remove from Trashbin";

	new Spicetify.Menu.Item(
		"Trashbin",
		false,
		() => {
			Spicetify.PopupModal.display({
				title: "Trashbin Settings",
				content,
			});
		},
		trashbinIcon
	).register();

	const widget = new Spicetify.Playbar.Widget(
		THROW_TEXT,
		trashbinIcon,
		(self) => {
			const uri = Spicetify.Player.data.item.uri;
			const uriObj = Spicetify.URI.fromString(uri);
			const type = uriObj.type;

			if (!trashSongList[uri]) {
				trashSongList[uri] = true;
				if (shouldSkipCurrentTrack(uri, type)) Spicetify.Player.next();
				Spicetify.showNotification("Song added to trashbin");
			} else {
				delete trashSongList[uri];
				setWidgetState(false);
				Spicetify.showNotification("Song removed from trashbin");
			}

			putDataLocal();
		},
		false,
		false,
		enableWidget
	);

	// LocalStorage Setup
	let trashSongList = initValue("TrashSongList", {});
	let trashArtistList = initValue("TrashArtistList", {});
	let userHitBack = false;
	const eventListener = () => {
		userHitBack = true;
	};

	putDataLocal();
	refreshEventListeners(trashbinStatus);
	setWidgetState(
		trashSongList[Spicetify.Player.data.item.uri],
		Spicetify.URI.fromString(Spicetify.Player.data.item.uri).type !== Spicetify.URI.Type.TRACK
	);

	function refreshEventListeners(state) {
		trashbinStatus = state;
		if (state) {
			skipBackBtn.addEventListener("click", eventListener);
			Spicetify.Player.addEventListener("songchange", watchChange);
			enableWidget && widget.register();
			watchChange();
		} else {
			skipBackBtn.removeEventListener("click", eventListener);
			Spicetify.Player.removeEventListener("songchange", watchChange);
			widget.deregister();
		}
	}

	function setWidgetState(state, hidden = false) {
		hidden ? widget.deregister() : enableWidget && widget.register();
		widget.active = !!state;
		widget.label = state ? UNTHROW_TEXT : THROW_TEXT;
	}

	function watchChange() {
		const data = Spicetify.Player.data || Spicetify.Queue;
		if (!data) return;

		const isBanned = trashSongList[data.item.uri];
		setWidgetState(isBanned, Spicetify.URI.fromString(data.item.uri).type !== Spicetify.URI.Type.TRACK);

		if (userHitBack) {
			userHitBack = false;
			return;
		}

		if (isBanned) {
			Spicetify.Player.next();
			return;
		}

		let uriIndex = 0;
		let artistUri = data.item.metadata.artist_uri;

		while (artistUri) {
			if (trashArtistList[artistUri]) {
				Spicetify.Player.next();
				return;
			}

			uriIndex++;
			artistUri = data.item.metadata[`artist_uri:${uriIndex}`];
		}
	}

	/**
	 *
	 * @param {string} uri
	 * @param {string} type
	 * @returns {boolean}
	 */
	function shouldSkipCurrentTrack(uri, type) {
		const curTrack = Spicetify.Player.data.item;
		if (type === Spicetify.URI.Type.TRACK) {
			if (uri === curTrack.uri) {
				return true;
			}
		}

		if (type === Spicetify.URI.Type.ARTIST) {
			let count = 1;
			let artUri = curTrack.metadata.artist_uri;
			while (artUri) {
				if (uri === artUri) {
					return true;
				}
				artUri = curTrack.metadata[`artist_uri:${count}`];
				count++;
			}
		}

		return false;
	}

	/**
	 *
	 * @param {string[]} uris
	 */
	function toggleThrow(uris) {
		const uri = uris[0];
		const uriObj = Spicetify.URI.fromString(uri);
		const type = uriObj.type;

		const list = type === Spicetify.URI.Type.TRACK ? trashSongList : trashArtistList;

		if (!list[uri]) {
			list[uri] = true;
			if (shouldSkipCurrentTrack(uri, type)) Spicetify.Player.next();
			Spicetify.Player.data?.item.uri === uri && setWidgetState(true);
			Spicetify.showNotification(type === Spicetify.URI.Type.TRACK ? "Song added to trashbin" : "Artist added to trashbin");
		} else {
			delete list[uri];
			Spicetify.Player.data?.item.uri === uri && setWidgetState(false);
			Spicetify.showNotification(type === Spicetify.URI.Type.TRACK ? "Song removed from trashbin" : "Artist removed from trashbin");
		}

		putDataLocal();
	}

	/**
	 * Only accept one track or artist URI
	 * @param {string[]} uris
	 * @returns {boolean}
	 */
	function shouldAddContextMenu(uris) {
		if (uris.length > 1 || !trashbinStatus) {
			return false;
		}

		const uri = uris[0];
		const uriObj = Spicetify.URI.fromString(uri);
		if (uriObj.type === Spicetify.URI.Type.TRACK) {
			this.name = trashSongList[uri] ? UNTHROW_TEXT : THROW_TEXT;
			return true;
		}

		if (uriObj.type === Spicetify.URI.Type.ARTIST) {
			this.name = trashArtistList[uri] ? UNTHROW_TEXT : THROW_TEXT;
			return true;
		}

		return false;
	}

	const cntxMenu = new Spicetify.ContextMenu.Item(THROW_TEXT, toggleThrow, shouldAddContextMenu, trashbinIcon);
	cntxMenu.register();

	function putDataLocal() {
		Spicetify.LocalStorage.set("TrashSongList", JSON.stringify(trashSongList));
		Spicetify.LocalStorage.set("TrashArtistList", JSON.stringify(trashArtistList));
	}

	function copyItems() {
		const data = {
			songs: trashSongList,
			artists: trashArtistList,
		};
		Spicetify.Platform.ClipboardAPI.copy(JSON.stringify(data));
		Spicetify.showNotification("Copied to clipboard");
	}

	async function exportItems() {
		const data = {
			songs: trashSongList,
			artists: trashArtistList,
		};

		try {
			const handle = await window.showSaveFilePicker({
				suggestedName: "spicetify-trashbin.json",
				types: [
					{
						description: "Spicetify trashbin backup",
						accept: {
							"application/json": [".json"],
						},
					},
				],
			});

			const writable = await handle.createWritable();
			await writable.write(JSON.stringify(data));
			await writable.close();

			Spicetify.showNotification("Backup saved succesfully.");
		} catch {
			Spicetify.showNotification("Failed to save, try copying trashbin contents to clipboard and creating a backup manually.");
		}
	}

	function importItems() {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = ".json";
		input.onchange = (e) => {
			const file = e.target.files[0];
			const reader = new FileReader();
			reader.onload = (e) => {
				try {
					const data = JSON.parse(e.target.result);
					trashSongList = data.songs;
					trashArtistList = data.artists;
					putDataLocal();
					Spicetify.showNotification("File Import Successful!");
				} catch (e) {
					Spicetify.showNotification("File Import Failed!", true);
					console.error(e);
				}
			};
			reader.onerror = () => {
				Spicetify.showNotification("File Read Failed!", true);
				console.error(reader.error);
			};
			reader.readAsText(file);
		};
		input.click();
	}
})();
