// NAME: Loopy loop
// AUTHOR: khanhas
// VERSION: 0.1
// DESCRIPTION: Simple tool to help you practice hitting that note right. Right click at process bar to open up menu.

/// <reference path="../globals.d.ts" />

(function LoopyLoop() {
	const bar = document.querySelector(".playback-bar .progress-bar");
	if (!(bar && Spicetify.React)) {
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

	bar.append(style);
	bar.append(startMark);
	bar.append(endMark);

	let start = null;
	let end = null;
	let mouseOnBarPercent = 0.0;

	function drawOnBar() {
		if (start === null && end === null) {
			startMark.hidden = endMark.hidden = true;
			return;
		}
		startMark.hidden = endMark.hidden = false;
		startMark.style.left = `${start * 100}%`;
		endMark.style.left = `${end * 100}%`;
	}
	function reset() {
		start = null;
		end = null;
		drawOnBar();
	}

	let debouncing = 0;
	Spicetify.Player.addEventListener("onprogress", (event) => {
		if (start != null && end != null) {
			if (debouncing) {
				if (event.timeStamp - debouncing > 1000) {
					debouncing = 0;
				}
				return;
			}
			const percent = Spicetify.Player.getProgressPercent();
			if (percent > end || percent < start) {
				debouncing = event.timeStamp;
				Spicetify.Player.seek(start);
				return;
			}
		}
	});

	Spicetify.Player.addEventListener("songchange", reset);

	function createMenuItem(title, callback) {
		const wrapper = document.createElement("div");
		Spicetify.ReactDOM.render(
			Spicetify.React.createElement(
				Spicetify.ReactComponent.MenuItem,
				{
					onClick: () => {
						contextMenu.hidden = true;
						callback?.();
					},
				},
				title
			),
			wrapper
		);

		return wrapper;
	}

	const startBtn = createMenuItem("Set start", () => {
		start = mouseOnBarPercent;
		if (end === null || start > end) {
			end = 0.99;
		}
		drawOnBar();
	});
	const endBtn = createMenuItem("Set end", () => {
		end = mouseOnBarPercent;
		if (start === null || end < start) {
			start = 0;
		}
		drawOnBar();
	});
	const resetBtn = createMenuItem("Reset", reset);

	const contextMenu = document.createElement("div");
	contextMenu.id = "loopy-context-menu";
	contextMenu.innerHTML = `<ul tabindex="0" class="main-contextMenu-menu"></ul>`;
	contextMenu.style.position = "absolute";
	contextMenu.firstElementChild.append(startBtn, endBtn, resetBtn);
	document.body.append(contextMenu);
	const { height: contextMenuHeight } = contextMenu.getBoundingClientRect();
	contextMenu.hidden = true;
	window.addEventListener("click", () => {
		contextMenu.hidden = true;
	});

	bar.oncontextmenu = (event) => {
		const { x, width } = bar.firstElementChild.getBoundingClientRect();
		mouseOnBarPercent = (event.clientX - x) / width;
		contextMenu.style.transform = `translate(${event.clientX}px,${event.clientY - contextMenuHeight}px)`;
		contextMenu.hidden = false;
		event.preventDefault();
	};
})();
