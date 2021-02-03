// @ts-check
// NAME: Loopy loop
// AUTHOR: khanhas
// VERSION: 0.1
// DESCRIPTION: Simple tool to help you practice hitting that note right. Right click at process bar to open up menu.

/// <reference path="../globals.d.ts" />

(function LoopyLoop(){
    const bar = document.querySelector(".progressbar .progress-bar");
	if (!bar) {
		setTimeout(LoopyLoop, 100);
		return;
	}

    const DEFAULT_URI = "spotify:special:loopyloop";

    bar.setAttribute("data-contextmenu", "");
    bar.setAttribute("data-uri", DEFAULT_URI);
    const style = document.createElement("style");
    style.innerHTML = `
#loopy-loop-start, #loopy-loop-end {
    position: absolute;
    font-weight: bolder;
    font-size: 15px;
    top: -8px;
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

    let start = null, end = null;
    let mouseOnBarPercent = 0.0;

	function getPercent() {
		return Spicetify.Player.getProgressPercent();
	}
	function drawOnBar() {
        if (start === null && end === null) {
            startMark.hidden = endMark.hidden = true;
            return;
        }
        startMark.hidden = endMark.hidden = false;
        startMark.style.left = (start * 100) + "%";
        endMark.style.left = (end * 100) + "%";
	}
	function reset() {
		start = null;
        end = null;
        drawOnBar();
	}

	Spicetify.Player.addEventListener("onprogress", (event) => {
		if (start != null && end != null) {
			const percent = getPercent();
			if (percent > end || percent < start) {
				Spicetify.Player.seek(start);
				return;
			}
		}
    });
    
	Spicetify.Player.addEventListener("songchange", reset);

	new Spicetify.ContextMenu.Item(
		"Set start",
		() => {
			start = mouseOnBarPercent;
			if (end === null || start > end) {
				end = 0.99;
            }
            drawOnBar();
		},
		([uri]) => uri === DEFAULT_URI
	).register();

	new Spicetify.ContextMenu.Item(
		"Set end",
		() => {
			end = mouseOnBarPercent;
			if (start === null || end < start) {
				start = 0;
            }
            drawOnBar();
		},
		([uri]) => uri === DEFAULT_URI
	).register();

	new Spicetify.ContextMenu.Item(
		"Reset",
		reset,
		([uri]) => uri === DEFAULT_URI
	).register();

    bar.oncontextmenu = (event) => {
        const { x , width } = bar.getBoundingClientRect(); 
        mouseOnBarPercent = (event.clientX - x) / width;
    };
})()
