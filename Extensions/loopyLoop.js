// NAME: Loopy loop
// AUTHOR: khanhas
// VERSION: 0.7
// DESCRIPTION: Right click on the progress bar to set song markers and skip sections.
// All points persist per song across sessions.

/// <reference path="../globals.d.ts" />

(function LoopyLoop() {
	function getProgressContainer() {
		return document.querySelector('[data-testid="playback-progressbar"]') ?? document.querySelector(".playback-progressbar-container");
	}

	function getBar(progressContainer = getProgressContainer()) {
		const rangeInput = progressContainer?.querySelector('input[type="range"]');
		return progressContainer?.querySelector('[data-testid="progress-bar"]') ?? rangeInput?.closest("label")?.nextElementSibling ?? null;
	}

	const bar = getBar();
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
    z-index: 20;
    padding: 2px 6px;
}
.loopy-menu {
    position: fixed;
    z-index: 2147483647;
}
.loopy-menu > ul {
    box-sizing: border-box;
    width: max-content;
    min-width: 196px;
    max-width: calc(100vw - 8px);
    margin: 0;
    padding: 4px;
    border-radius: 4px;
    background: var(--spice-main-elevated, var(--background-elevated-base, #282828));
    box-shadow: 0 16px 24px rgba(0, 0, 0, 0.3), 0 6px 8px rgba(0, 0, 0, 0.2);
    color: var(--spice-text, var(--text-base, #fff));
    font-family: var(--encore-body-font-stack, "Helvetica Neue", helvetica, arial, sans-serif);
    list-style: none;
}
.loopy-menu li {
    margin: 0;
    padding: 0;
    list-style: none;
}
.loopy-menu button {
    box-sizing: border-box;
    display: flex;
    align-items: center;
    width: 100%;
    min-height: 40px;
    padding: 8px 12px;
    border: 0;
    border-radius: 2px;
    background: transparent;
    color: inherit;
    cursor: pointer;
    font: inherit;
    font-size: 14px;
    font-weight: 400;
    line-height: 20px;
    text-align: start;
    white-space: nowrap;
}
.loopy-menu button:hover {
    background: var(--background-tinted-base, rgba(255, 255, 255, 0.1));
}
.loopy-menu button:active {
    background: var(--background-tinted-press, rgba(255, 255, 255, 0.2));
}
.loopy-menu button:focus-visible {
    outline: 2px solid var(--spice-text, var(--text-base, #fff));
    outline-offset: -2px;
}
.loopy-menu .loopy-menu-divider {
    height: 1px;
    margin: 4px;
    background: rgba(255, 255, 255, 0.1);
}
.loopy-menu-item--submenu::after {
    width: 6px;
    height: 6px;
    margin-inline-start: auto;
    border-block-start: 1.5px solid currentColor;
    border-inline-end: 1.5px solid currentColor;
    content: "";
    transform: rotate(45deg);
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

	document.head.append(style);
	bar.append(startMark, endMark);

	let start = null;
	let end = null;
	let mouseOnBarPercent = 0.0;
	let skipZones = [];
	let pendingSkipStart = null;
	let lastSkipSeek = 0;
	let lastSkippedZoneIdx = -1;
	let lastNextCall = 0;
	let lastEndLoopSeek = 0;
	let seekStartPendingUri = null;
	let lastStartEnforce = 0;
	let prevProgressPercent = -1;
	let prevPressedAt = 0; // timestamp of first prev press; second press within 1.5s skips to prev song
	let navigatingBack = false; // true after back() is called; cleared in songchange to skip stale onprogress ticks
	let activeMarkerType = null; // "start" | "end" | "zoneStart" | "zoneEnd" | "zone" | null

	function drawOnBar() {
		const currentBar = getBar();
		if (currentBar && startMark.parentElement !== currentBar) {
			currentBar.append(startMark, endMark);
		}
		startMark.hidden = start === null;
		endMark.hidden = end === null;
		if (start !== null) startMark.style.left = `${start * 100}%`;
		if (end !== null) endMark.style.left = `${end * 100}%`;
	}

	function drawSkipMarkers() {
		const currentBar = getBar() ?? bar;
		if (!currentBar) return;
		currentBar.querySelectorAll(".loopy-skip-marker").forEach((el) => el.remove());
		skipZones.forEach((zone, index) => {
			const s = document.createElement("div");
			s.className = "loopy-skip-marker";
			s.innerText = "{";
			s.style.left = `${zone.start * 100}%`;
			s.dataset.zoneIndex = String(index);
			s.dataset.zoneSide = "start";

			const e = document.createElement("div");
			e.className = "loopy-skip-marker";
			e.innerText = "}";
			e.style.left = `${zone.end * 100}%`;
			e.dataset.zoneIndex = String(index);
			e.dataset.zoneSide = "end";

			currentBar.append(e, s); // { appended after } so { sits higher in stacking order
		});

		if (pendingSkipStart !== null) {
			const p = document.createElement("div");
			p.className = "loopy-skip-marker";
			p.innerText = "{";
			p.style.left = `${pendingSkipStart * 100}%`;
			p.style.opacity = "0.4";
			currentBar.append(p);
		}
	}

	function saveState() {
		const uri = Spicetify.Player.data?.item?.uri;
		if (!uri) return;
		Spicetify.LocalStorage.set(`loopyLoop:${uri}`, JSON.stringify({ start, end, skipZones }));
	}

	function loadState() {
		const uri = Spicetify.Player.data?.item?.uri;
		start = null;
		end = null;
		skipZones = [];
		pendingSkipStart = null;
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

	function openContextMenu(x, y) {
		skipStartBtn.querySelector("button").textContent = pendingSkipStart !== null ? "Cancel skip start" : "Set section skip start";
		openMenu(contextMenu, x, y);
	}

	function createMenu(id) {
		const menu = document.createElement("div");
		menu.id = id;
		menu.className = "loopy-menu";
		menu.innerHTML = `<ul tabindex="0" role="menu" class="main-contextMenu-menu"></ul>`;
		menu.hidden = true;
		document.body.append(menu);
		return menu;
	}

	// Configure the conditional bottom section of the context menu
	function setupActiveMarker(type, zoneIdx) {
		activeMarkerType = type;
		activeZoneIndex = zoneIdx ?? -1;
		const hasMarker = type !== null;
		const isSpecificMarker = type !== null && type !== "zone";
		divider2.hidden = !hasMarker;
		moveBtnItem.hidden = !isSpecificMarker;
		removeActiveBtn.hidden = !hasMarker;

		const removeBtn = removeActiveBtn.querySelector("button");
		if (type === "start") {
			removeBtn.textContent = "Remove song start";
			removeBtn.onclick = (ev) => {
				ev.stopPropagation();
				start = null;
				drawOnBar();
				saveState();
				contextMenu.hidden = true;
				moveSubmenu.hidden = true;
			};
		} else if (type === "end") {
			removeBtn.textContent = "Remove song end";
			removeBtn.onclick = (ev) => {
				ev.stopPropagation();
				end = null;
				drawOnBar();
				saveState();
				contextMenu.hidden = true;
				moveSubmenu.hidden = true;
			};
		} else {
			removeBtn.textContent = "Remove section";
			removeBtn.onclick = (ev) => {
				ev.stopPropagation();
				if (activeZoneIndex >= 0) {
					skipZones.splice(activeZoneIndex, 1);
					saveState();
					drawSkipMarkers();
					activeZoneIndex = -1;
				}
				contextMenu.hidden = true;
				moveSubmenu.hidden = true;
			};
		}
	}

	// Move submenu
	const moveSubmenu = createMenu("loopy-move-submenu");

	function applyMoveAdjustment(deltaSeconds) {
		const durationMs = Spicetify.Player.getDuration();
		if (!durationMs) return;
		const delta = (deltaSeconds * 1000) / durationMs;
		if (activeMarkerType === "start") {
			start = Math.max(0, Math.min(end !== null ? end - 1e-6 : 1, start + delta));
			drawOnBar();
		} else if (activeMarkerType === "end") {
			end = Math.max(start !== null ? start + 1e-6 : 0, Math.min(1, end + delta));
			drawOnBar();
		} else if (activeMarkerType === "zoneStart") {
			if (activeZoneIndex < 0 || activeZoneIndex >= skipZones.length) return;
			skipZones[activeZoneIndex].start = Math.max(0, Math.min(skipZones[activeZoneIndex].end - 1e-6, skipZones[activeZoneIndex].start + delta));
			drawSkipMarkers();
		} else if (activeMarkerType === "zoneEnd") {
			if (activeZoneIndex < 0 || activeZoneIndex >= skipZones.length) return;
			skipZones[activeZoneIndex].end = Math.max(skipZones[activeZoneIndex].start + 1e-6, Math.min(1, skipZones[activeZoneIndex].end + delta));
			drawSkipMarkers();
		}
		saveState();
	}

	[-0.5, -0.1, -0.01, 0.01, 0.1, 0.5].forEach((delta) => {
		const li = document.createElement("li");
		li.setAttribute("role", "presentation");
		const btn = document.createElement("button");
		btn.type = "button";
		btn.setAttribute("role", "menuitem");
		btn.classList.add("main-contextMenu-menuItemButton");
		btn.textContent = `${delta > 0 ? "+" : ""}${delta}s`;
		btn.onclick = (e) => {
			e.stopPropagation();
			applyMoveAdjustment(delta);
		};
		li.append(btn);
		moveSubmenu.firstElementChild.append(li);
	});

	// Skip zone seeking only — no loop-back behavior
	Spicetify.Player.addEventListener("onprogress", (event) => {
		const ts = event?.timeStamp ?? performance.now();
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

		// Detect prev button press: jump to ~0 from past Spotify's 3-second restart threshold
		const durationMs = Spicetify.Player.getDuration() || 0;
		const threeSecFrac = durationMs > 0 ? 3000 / durationMs : 0.02;
		const nearZeroFrac = durationMs > 0 ? 1500 / durationMs : 0.01;
		if (prevProgressPercent > threeSecFrac && percent < nearZeroFrac) {
			if (prevPressedAt > 0 && ts - prevPressedAt < 1500) {
				// Second press within 1.5s — go to previous song
				prevPressedAt = 0;
				prevProgressPercent = percent;
				navigatingBack = true;
				setTimeout(() => {
					navigatingBack = false;
				}, 2000);
				Spicetify.Player.back();
				return;
			} else {
				// First press — go to [ (or stay at 0 if no start set)
				prevPressedAt = ts;
				prevProgressPercent = percent;
				if (start !== null) Spicetify.Player.seek(start);
				return;
			}
		}
		prevProgressPercent = percent;

		// Song start enforcement: seek to [ if playback is before it (covers song load + manual scrub)
		if (start !== null && percent < start) {
			if (navigatingBack) return;
			if (ts - lastStartEnforce > 500) {
				lastStartEnforce = ts;
				Spicetify.Player.seek(start);
			}
			return;
		}

		// Song end enforcement: at ], either loop back (repeat-one) or advance to next track
		if (end !== null && percent >= end) {
			// Spicetify.Player.getRepeat(): 0 = off, 1 = repeat context, 2 = repeat track
			if (Spicetify.Player.getRepeat() === 2) {
				if (ts - lastEndLoopSeek > 500) {
					lastEndLoopSeek = ts;
					Spicetify.Player.seek(start ?? 0);
				}
			} else if (ts - lastNextCall > 2000) {
				lastNextCall = ts;
				seekStartPendingUri = Spicetify.Player.data?.item?.uri ?? null;
				Spicetify.Player.next();
			}
			return;
		}

		// Skip zone seeking
		if (skipZones.length > 0) {
			let inZone = false;
			for (let i = 0; i < skipZones.length; i++) {
				const zone = skipZones[i];
				if (percent >= zone.start && percent < zone.end) {
					inZone = true;
					if (i !== lastSkippedZoneIdx || ts - lastSkipSeek > 500) {
						lastSkipSeek = ts;
						lastSkippedZoneIdx = i;
						Spicetify.Player.seek(zone.end);
					}
					break;
				}
			}
			if (!inZone) lastSkippedZoneIdx = -1;
		}
	});

	Spicetify.Player.addEventListener("songchange", () => {
		navigatingBack = false;
		// Clear seekStartPendingUri only when the new song differs — preserves repeat-one seek-to-[ behavior
		if (Spicetify.Player.data?.item?.uri !== seekStartPendingUri) seekStartPendingUri = null;
		loadState();
		drawOnBar();
		drawSkipMarkers();
		prevProgressPercent = -1;
		prevPressedAt = 0;
		lastStartEnforce = 0;
		lastNextCall = 0;
		lastEndLoopSeek = 0;
		lastSkipSeek = 0;
		lastSkippedZoneIdx = -1;
	});

	// Context menu
	function createMenuItem(title, callback) {
		const item = document.createElement("li");
		item.setAttribute("role", "presentation");
		const button = document.createElement("button");
		button.type = "button";
		button.setAttribute("role", "menuitem");
		button.classList.add("main-contextMenu-menuItemButton");
		button.textContent = title;
		button.onclick = (e) => {
			e.stopPropagation();
			contextMenu.hidden = true;
			moveSubmenu.hidden = true;
			callback?.();
		};
		item.append(button);
		return item;
	}

	const startBtn = createMenuItem("Set song start", () => {
		if (end !== null && mouseOnBarPercent >= end) {
			Spicetify.showNotification("Song start must be before song end");
			return;
		}
		start = mouseOnBarPercent;
		drawOnBar();
		saveState();
	});
	const endBtn = createMenuItem("Set song end", () => {
		if (start !== null && mouseOnBarPercent <= start) {
			Spicetify.showNotification("Song end must be after song start");
			return;
		}
		end = mouseOnBarPercent;
		drawOnBar();
		saveState();
	});

	const divider1 = document.createElement("li");
	divider1.className = "loopy-menu-divider";
	divider1.setAttribute("role", "separator");

	const skipStartBtn = createMenuItem("Set section skip start", () => {
		if (pendingSkipStart !== null) {
			pendingSkipStart = null;
		} else {
			pendingSkipStart = mouseOnBarPercent;
		}
		drawSkipMarkers();
	});
	const skipEndBtn = createMenuItem("Set section skip end", () => {
		if (pendingSkipStart === null) {
			Spicetify.showNotification("No section skip start selected!");
			return;
		}
		const s = Math.min(pendingSkipStart, mouseOnBarPercent);
		const e = Math.max(pendingSkipStart, mouseOnBarPercent);
		if (e > s) {
			if (skipZones.length < 10) {
				skipZones.push({ start: s, end: e });
				saveState();
				drawSkipMarkers();
			} else {
				Spicetify.showNotification("Maximum 10 skip zones reached");
			}
		}
		pendingSkipStart = null;
	});
	const clearSkipsBtn = createMenuItem("Clear section skips", () => {
		skipZones = [];
		pendingSkipStart = null;
		saveState();
		drawSkipMarkers();
	});

	const resetMarkersBtn = createMenuItem("Reset song start/end", () => {
		start = null;
		end = null;
		drawOnBar();
		saveState();
	});

	const divider2 = document.createElement("li");
	divider2.className = "loopy-menu-divider";
	divider2.setAttribute("role", "separator");
	divider2.hidden = true;
	let activeZoneIndex = -1;

	const moveBtnItem = document.createElement("li");
	moveBtnItem.setAttribute("role", "presentation");
	const moveBtnEl = document.createElement("button");
	moveBtnEl.type = "button";
	moveBtnEl.setAttribute("role", "menuitem");
	moveBtnEl.setAttribute("aria-haspopup", "menu");
	moveBtnEl.classList.add("main-contextMenu-menuItemButton", "loopy-menu-item--submenu");
	moveBtnEl.textContent = "Move";
	moveBtnItem.append(moveBtnEl);
	moveBtnItem.hidden = true;

	// Dynamic remove button — label/callback set by setupActiveMarker
	const removeActiveBtn = document.createElement("li");
	removeActiveBtn.setAttribute("role", "presentation");
	const removeActiveBtnEl = document.createElement("button");
	removeActiveBtnEl.type = "button";
	removeActiveBtnEl.setAttribute("role", "menuitem");
	removeActiveBtnEl.classList.add("main-contextMenu-menuItemButton");
	removeActiveBtnEl.textContent = "Remove section";
	removeActiveBtn.append(removeActiveBtnEl);
	removeActiveBtn.hidden = true;

	const contextMenu = createMenu("loopy-context-menu");
	contextMenu.firstElementChild.append(
		startBtn,
		endBtn,
		resetMarkersBtn,
		divider1,
		skipStartBtn,
		skipEndBtn,
		clearSkipsBtn,
		divider2,
		moveBtnItem,
		removeActiveBtn
	);

	function showMoveSubmenu() {
		const rect = moveBtnEl.getBoundingClientRect();
		moveSubmenu.style.left = "-9999px";
		moveSubmenu.style.top = "0px";
		moveSubmenu.hidden = false;
		const { height, width } = moveSubmenu.getBoundingClientRect();
		moveSubmenu.style.left = Math.min(rect.right + 2, window.innerWidth - width - 4) + "px";
		moveSubmenu.style.top = Math.max(0, Math.min(rect.top, window.innerHeight - height - 4)) + "px";
	}

	let moveHideTimer = null;
	function scheduleMoveHide() {
		cancelMoveHide();
		moveHideTimer = setTimeout(() => {
			moveSubmenu.hidden = true;
			moveHideTimer = null;
		}, 150);
	}
	function cancelMoveHide() {
		if (moveHideTimer) {
			clearTimeout(moveHideTimer);
			moveHideTimer = null;
		}
	}

	moveBtnEl.onclick = (e) => {
		e.stopPropagation();
		cancelMoveHide();
		showMoveSubmenu();
	};
	moveBtnItem.addEventListener("mouseenter", () => {
		cancelMoveHide();
		showMoveSubmenu();
	});
	moveBtnItem.addEventListener("mouseleave", () => scheduleMoveHide());
	moveSubmenu.addEventListener("mouseenter", () => cancelMoveHide());
	moveSubmenu.addEventListener("mouseleave", () => scheduleMoveHide());

	// Close menus on outside click
	window.addEventListener("click", (e) => {
		if (!contextMenu.contains(e.target) && !moveSubmenu.contains(e.target)) {
			contextMenu.hidden = true;
			moveSubmenu.hidden = true;
		}
	});

	// Single capture-phase handler at document level — survives React re-renders
	document.addEventListener(
		"contextmenu",
		(event) => {
			const target = event.target;

			// [ song start marker
			if (target.id === "loopy-loop-start") {
				event.preventDefault();
				event.stopPropagation();
				mouseOnBarPercent = start ?? 0;
				setupActiveMarker("start");
				openContextMenu(event.clientX, event.clientY);
				return;
			}
			// ] song end marker
			if (target.id === "loopy-loop-end") {
				event.preventDefault();
				event.stopPropagation();
				mouseOnBarPercent = end ?? 1;
				setupActiveMarker("end");
				openContextMenu(event.clientX, event.clientY);
				return;
			}
			// { or } skip marker
			if (target.classList?.contains("loopy-skip-marker") && target.getAttribute("data-zone-index") !== null) {
				event.preventDefault();
				event.stopPropagation();
				const zIdx = parseInt(target.getAttribute("data-zone-index"), 10);
				if (!Number.isFinite(zIdx) || zIdx < 0 || zIdx >= skipZones.length) return;
				const side = target.getAttribute("data-zone-side") === "end" ? "zoneEnd" : "zoneStart";
				const smBar = getBar();
				if (smBar) {
					const { x, width } = smBar.getBoundingClientRect();
					mouseOnBarPercent = Math.max(0, Math.min(1, (event.clientX - x) / width));
				}
				setupActiveMarker(side, zIdx);
				openContextMenu(event.clientX, event.clientY);
				return;
			}

			// Progress bar area
			const currentProgressContainer = getProgressContainer();
			if (!currentProgressContainer?.contains(target)) return;
			event.preventDefault();
			event.stopPropagation();

			const currentBar = getBar(currentProgressContainer);
			if (!currentBar) return;

			const { x, width } = currentBar.getBoundingClientRect();
			mouseOnBarPercent = Math.max(0, Math.min(1, (event.clientX - x) / width));

			const hitZone = skipZones.findIndex((z) => mouseOnBarPercent > z.start && mouseOnBarPercent < z.end);
			setupActiveMarker(hitZone >= 0 ? "zone" : null, hitZone);
			openContextMenu(event.clientX, event.clientY);
		},
		true
	); // capture phase

	// Load state for the currently playing song on startup.
	// Retry until the player has track data (uri may be null immediately after init).
	function tryLoadInitialState(attemptsLeft) {
		if (Spicetify.Player.data?.item?.uri) {
			loadState();
			drawOnBar();
			drawSkipMarkers();
		} else if (attemptsLeft > 0) {
			setTimeout(() => tryLoadInitialState(attemptsLeft - 1), 200);
		}
	}
	tryLoadInitialState(10);

	// Toolbar button
	try {
		const markerIcon = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" height="16" width="16"><rect x="1" y="7" width="14" height="2" rx="1"/><rect x="3" y="3" width="2" height="10" rx="1"/><rect x="11" y="3" width="2" height="10" rx="1"/><rect x="6" y="5" width="1.5" height="6" rx="0.75"/><rect x="8.5" y="5" width="1.5" height="6" rx="0.75"/></svg>`;
		const toolbarBtn = new Spicetify.Playbar.Button("Loopy Loop", markerIcon, () => {
			mouseOnBarPercent = Spicetify.Player.getProgressPercent();
			setupActiveMarker(null, -1);
			const rect = toolbarBtn.element.getBoundingClientRect();
			openContextMenu(rect.left, rect.top);
		});
		toolbarBtn.element.addEventListener("click", (e) => e.stopPropagation());
	} catch (_) {}
})();
