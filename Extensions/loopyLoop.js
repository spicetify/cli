// NAME: Loopy loop
// AUTHOR: khanhas
// VERSION: 0.7
// DESCRIPTION: Right click on the progress bar to set song markers and skip sections.
// All points persist per song across sessions.

/// <reference path="../globals.d.ts" />

(function LoopyLoop() {
	const playbackBar = document.querySelector(".playback-bar");
	const progressContainer = playbackBar?.querySelector(".playback-progressbar-container");
	const rangeInput = progressContainer?.querySelector('input[type="range"]');
	const bar = rangeInput?.closest("label")?.nextElementSibling;
	if (!(bar && Spicetify.Player)) {
		setTimeout(LoopyLoop, 100);
		return;
	}

	const style = document.createElement("style");
	style.innerHTML = `
#loopy-loop-start, #loopy-loop-end {
    position: absolute;
    font-weight: bolder;
    font-size: 15px;
    top: -7px;
    cursor: context-menu;
    z-index: 10;
    padding: 2px 4px;
}
.loopy-skip-marker {
    position: absolute;
    font-weight: bolder;
    font-size: 15px;
    top: -7px;
    color: #e74c3c;
    cursor: context-menu;
    z-index: 15;
    padding: 2px 6px;
}
#loopy-context-menu, #loopy-remove-menu {
    position: fixed;
    z-index: 2147483647;
}
`;

	const startMark = document.createElement("div");
	startMark.id = "loopy-loop-start";
	startMark.innerText = "[";
	const endMark = document.createElement("div");
	endMark.id = "loopy-loop-end";
	endMark.innerText = "]";
	startMark.style.position = endMark.style.position = "absolute";
	startMark.hidden = endMark.hidden = true;

	bar.append(style, startMark, endMark);

	let start = null;
	let end = null;
	let mouseOnBarPercent = 0.0;
	let skipZones = [];
	let pendingSkipStart = null;
	let lastSkipSeek = 0;
	let lastNextCall = 0;
	let seekStartPendingUri = null;
	let lastStartEnforce = 0;

	function drawOnBar() {
		startMark.hidden = start === null;
		endMark.hidden = end === null;
		if (start !== null) startMark.style.left = `${start * 100}%`;
		if (end !== null) endMark.style.left = `${end * 100}%`;
	}

	function drawSkipMarkers() {
		bar.querySelectorAll(".loopy-skip-marker").forEach(el => el.remove());
		skipZones.forEach((zone, index) => {
			const s = document.createElement("div");
			s.className = "loopy-skip-marker";
			s.innerText = "{";
			s.style.left = `${zone.start * 100}%`;
			s.dataset.zoneIndex = String(index);

			const e = document.createElement("div");
			e.className = "loopy-skip-marker";
			e.innerText = "}";
			e.style.left = `${zone.end * 100}%`;
			e.dataset.zoneIndex = String(index);

			bar.append(s, e);
		});

		if (pendingSkipStart !== null) {
			const p = document.createElement("div");
			p.className = "loopy-skip-marker";
			p.innerText = "{";
			p.style.left = `${pendingSkipStart * 100}%`;
			p.style.opacity = "0.4";
			bar.append(p);
		}
	}

	function saveState() {
		const uri = Spicetify.Player.data?.item?.uri;
		if (!uri) return;
		Spicetify.LocalStorage.set(`loopyLoop:${uri}`, JSON.stringify({ start, end, skipZones }));
	}

	function loadState() {
		const uri = Spicetify.Player.data?.item?.uri;
		start = null; end = null; skipZones = []; pendingSkipStart = null;
		if (!uri) return;
		try {
			const saved = Spicetify.LocalStorage.get(`loopyLoop:${uri}`);
			if (saved) {
				const data = JSON.parse(saved);
				start = data.start ?? null;
				end = data.end ?? null;
				skipZones = Array.isArray(data.skipZones) ? data.skipZones : [];
			}
		} catch (_) {}
	}

	// Position menu within viewport using fixed positioning
	function openMenu(menu, x, y) {
		menu.style.left = "-9999px";
		menu.style.top = "0px";
		menu.hidden = false;
		const { height, width } = menu.getBoundingClientRect();
		menu.style.left = Math.min(x, window.innerWidth - width - 4) + "px";
		menu.style.top = Math.max(0, y - height) + "px";
	}

	// Small remove-point popup
	const removeMenu = document.createElement("div");
	removeMenu.id = "loopy-remove-menu";
	removeMenu.innerHTML = `<ul tabindex="0" class="main-contextMenu-menu"></ul>`;
	removeMenu.hidden = true;
	document.body.append(removeMenu);

	function showRemoveMenu(x, y, type, zoneIndex) {
		removeMenu.firstElementChild.innerHTML = "";
		const labels = { zone: "Remove this zone", start: "Remove song start", end: "Remove song end" };

		const item = document.createElement("li");
		item.setAttribute("role", "menuitem");
		const btn = document.createElement("button");
		btn.classList.add("main-contextMenu-menuItemButton");
		btn.textContent = labels[type];
		btn.onclick = (e) => {
			e.stopPropagation();
			if (type === "zone") { skipZones.splice(zoneIndex, 1); drawSkipMarkers(); }
			else if (type === "start") { start = null; drawOnBar(); }
			else if (type === "end") { end = null; drawOnBar(); }
			saveState();
			removeMenu.hidden = true;
		};
		item.append(btn);
		removeMenu.firstElementChild.append(item);
		openMenu(removeMenu, x, y);
	}

	// Skip zone seeking only — no loop-back behavior
	Spicetify.Player.addEventListener("onprogress", (event) => {
		const percent = Spicetify.Player.getProgressPercent();

		// Repeat-mode restart: song restarted from 0 after hitting ], seek to [
		if (seekStartPendingUri !== null && percent < 0.05) {
			const currentUri = Spicetify.Player.data?.item?.uri;
			if (currentUri === seekStartPendingUri && start !== null) {
				seekStartPendingUri = null;
				Spicetify.Player.seek(start);
				return;
			}
			seekStartPendingUri = null;
		}

		// Song start enforcement: seek to [ if playback is before it (covers song load + manual scrub)
		if (start !== null && percent < start) {
			if (event.timeStamp - lastStartEnforce > 500) {
				lastStartEnforce = event.timeStamp;
				Spicetify.Player.seek(start);
			}
			return;
		}

		// Song end enforcement: advance to next track when playback reaches ]
		if (end !== null && percent >= end) {
			if (event.timeStamp - lastNextCall > 2000) {
				lastNextCall = event.timeStamp;
				seekStartPendingUri = Spicetify.Player.data?.item?.uri ?? null;
				Spicetify.Player.next();
			}
			return;
		}

		// Skip zone seeking
		if (skipZones.length > 0) {
			for (const zone of skipZones) {
				if (percent >= zone.start && percent < zone.end) {
					if (event.timeStamp - lastSkipSeek > 1000) {
						lastSkipSeek = event.timeStamp;
						Spicetify.Player.seek(zone.end);
					}
					break;
				}
			}
		}
	});

	Spicetify.Player.addEventListener("songchange", () => {
		loadState(); drawOnBar(); drawSkipMarkers();
	});

	// Context menu
	function createMenuItem(title, callback) {
		const item = document.createElement("li");
		item.setAttribute("role", "menuitem");
		const button = document.createElement("button");
		button.classList.add("main-contextMenu-menuItemButton");
		button.textContent = title;
		button.onclick = (e) => {
			e.stopPropagation();
			contextMenu.hidden = true;
			callback?.();
		};
		item.append(button);
		return item;
	}

	const startBtn = createMenuItem("Set song start", () => {
		start = mouseOnBarPercent;
		if (end === null || start > end) end = 0.99;
		drawOnBar(); saveState();
	});
	const endBtn = createMenuItem("Set song end", () => {
		end = mouseOnBarPercent;
		if (start === null || end < start) start = 0;
		drawOnBar(); saveState();
	});

	const divider1 = document.createElement("li");
	divider1.style.cssText = "border-top:1px solid rgba(255,255,255,0.2);margin:4px 0;list-style:none;";

	const skipStartBtn = createMenuItem("Set section skip start", () => {
		pendingSkipStart = mouseOnBarPercent;
		drawSkipMarkers();
	});
	const skipEndBtn = createMenuItem("Set section skip end", () => {
		if (pendingSkipStart === null) {
			Spicetify.showNotification("No section skip start selected!");
			return;
		}
		const s = Math.min(pendingSkipStart, mouseOnBarPercent);
		const e = Math.max(pendingSkipStart, mouseOnBarPercent);
		if (e > s && skipZones.length < 10) {
			skipZones.push({ start: s, end: e });
			saveState(); drawSkipMarkers();
		}
		pendingSkipStart = null;
	});
	const clearSkipsBtn = createMenuItem("Clear section skips", () => {
		skipZones = []; pendingSkipStart = null;
		saveState(); drawSkipMarkers();
	});

	const resetMarkersBtn = createMenuItem("Reset song start/end", () => {
		start = null; end = null;
		drawOnBar(); saveState();
	});

	const divider2 = document.createElement("li");
	divider2.style.cssText = "border-top:1px solid rgba(255,255,255,0.2);margin:4px 0;list-style:none;";
	divider2.hidden = true;
	let activeZoneIndex = -1;
	const removeSectionBtn = createMenuItem("Remove section", () => {
		if (activeZoneIndex >= 0) {
			skipZones.splice(activeZoneIndex, 1);
			saveState(); drawSkipMarkers(); activeZoneIndex = -1;
		}
	});
	removeSectionBtn.hidden = true;

	const contextMenu = document.createElement("div");
	contextMenu.id = "loopy-context-menu";
	contextMenu.innerHTML = `<ul tabindex="0" class="main-contextMenu-menu"></ul>`;
	contextMenu.firstElementChild.append(
		startBtn, endBtn, resetMarkersBtn, divider1,
		skipStartBtn, skipEndBtn, clearSkipsBtn,
		divider2, removeSectionBtn
	);
	document.body.append(contextMenu);
	contextMenu.hidden = true;

	// Close menus on outside click
	window.addEventListener("click", (e) => {
		if (!contextMenu.contains(e.target)) contextMenu.hidden = true;
		if (!removeMenu.contains(e.target)) removeMenu.hidden = true;
	});

	// Single capture-phase handler at document level — survives React re-renders
	document.addEventListener("contextmenu", (event) => {
		const target = event.target;

		// Our own markers — show remove popup
		if (target.id === "loopy-loop-start") {
			event.preventDefault(); event.stopPropagation();
			showRemoveMenu(event.clientX, event.clientY, "start");
			return;
		}
		if (target.id === "loopy-loop-end") {
			event.preventDefault(); event.stopPropagation();
			showRemoveMenu(event.clientX, event.clientY, "end");
			return;
		}
		if (target.classList?.contains("loopy-skip-marker") && target.dataset.zoneIndex !== undefined) {
			event.preventDefault(); event.stopPropagation();
			activeZoneIndex = parseInt(target.dataset.zoneIndex);
			divider2.hidden = false;
			removeSectionBtn.hidden = false;
			const smContainer = document.querySelector(".playback-progressbar-container");
			const smBar = smContainer?.querySelector('input[type="range"]')?.closest("label")?.nextElementSibling;
			if (smBar) {
				const { x, width } = smBar.getBoundingClientRect();
				mouseOnBarPercent = Math.max(0, Math.min(1, (event.clientX - x) / width));
			}
			openMenu(contextMenu, event.clientX, event.clientY);
			return;
		}

		// Progress bar area — show main context menu
		const currentProgressContainer = document.querySelector(".playback-progressbar-container");
		if (!currentProgressContainer?.contains(target)) return;
		event.preventDefault(); event.stopPropagation();

		const currentBar = currentProgressContainer.querySelector('input[type="range"]')
			?.closest("label")?.nextElementSibling;
		if (!currentBar) return;

		const { x, width } = currentBar.getBoundingClientRect();
		mouseOnBarPercent = Math.max(0, Math.min(1, (event.clientX - x) / width));

		activeZoneIndex = skipZones.findIndex(z => mouseOnBarPercent > z.start && mouseOnBarPercent < z.end);
		const inZone = activeZoneIndex >= 0;
		divider2.hidden = !inZone;
		removeSectionBtn.hidden = !inZone;

		openMenu(contextMenu, event.clientX, event.clientY);
	}, true); // capture phase

	// Toolbar button
	try {
		const markerIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" height="16" width="16"><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="3" y="3" width="2" height="10" rx="1"/><rect x="11" y="3" width="2" height="10" rx="1"/><rect x="6" y="5" width="1.5" height="6" rx="0.75"/><rect x="8.5" y="5" width="1.5" height="6" rx="0.75"/></svg>`;
		const toolbarBtn = new Spicetify.Playbar.Button("Loopy Loop", markerIcon, () => {
			mouseOnBarPercent = Spicetify.Player.getProgressPercent();
			activeZoneIndex = -1; divider2.hidden = true; removeSectionBtn.hidden = true;
			const rect = toolbarBtn.element.getBoundingClientRect();
			openMenu(contextMenu, rect.left, rect.top);
		});
		toolbarBtn.element.addEventListener("click", (e) => e.stopPropagation());
	} catch (_) {}
})();
