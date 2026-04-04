// NAME: Loopy Loop
// AUTHOR: khanhas
// VERSION: 0.2
// DESCRIPTION: Simple tool to help you practice hitting that note right. Right click at progress bar to open up menu.

/// <reference path="../globals.d.ts" />

(function LoopyLoop() {
    // Modern Spotify selectors
    const playbackBar = document.querySelector(".playback-bar") 
        || document.querySelector("[data-testid='playback-progressbar']")?.parentElement;
    
    const progressContainer = playbackBar?.querySelector(".playback-progressbar-container")
        || playbackBar?.querySelector("[data-testid='playback-progressbar']")
        || playbackBar?.querySelector(".progress-bar");

    // Try multiple approaches to find the actual bar element
    const bar = progressContainer?.querySelector(".x-progressBar-progressBarBg")
        || progressContainer?.querySelector("[data-testid='progress-bar-background']")
        || progressContainer?.querySelector(".progress-bar__bg")
        || progressContainer;

    if (!(bar && progressContainer && Spicetify?.Player?.origin && Spicetify?.Player?.getDuration)) {
        if (document.readyState !== "complete") {
            setTimeout(LoopyLoop, 300);
            return;
        }
        setTimeout(LoopyLoop, 1000);
        return;
    }

    console.log("[LoopyLoop] Initialized successfully");
    console.log("[LoopyLoop] bar element:", bar);
    console.log("[LoopyLoop] progressContainer:", progressContainer);

    const style = document.createElement("style");
    style.innerHTML = `
#loopy-loop-start, #loopy-loop-end {
    position: absolute;
    font-weight: bolder;
    font-size: 15px;
    top: -7px;
    color: #1db954;
    z-index: 9999;
    pointer-events: none;
}
#loopy-context-menu {
    z-index: 99999;
    background: var(--spice-card, #282828);
    border-radius: 4px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,.5);
}
#loopy-context-menu ul {
    list-style: none;
    margin: 0;
    padding: 0;
}
#loopy-context-menu li button {
    width: 100%;
    background: transparent;
    border: none;
    color: var(--spice-text, #fff);
    padding: 8px 16px;
    cursor: pointer;
    text-align: left;
    font-size: 13px;
    white-space: nowrap;
}
#loopy-context-menu li button:hover {
    background: var(--spice-button, hsla(0,0%,100%,.1));
}
`;
    document.head.append(style);

    // Make the bar position relative so absolute children work
    bar.style.position = "relative";

    const startMark = document.createElement("div");
    startMark.id = "loopy-loop-start";
    startMark.innerText = "[";
    const endMark = document.createElement("div");
    endMark.id = "loopy-loop-end";
    endMark.innerText = "]";
    startMark.hidden = endMark.hidden = true;

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

    // Use setInterval instead of deprecated onprogress event
    let debounceUntil = 0;
    setInterval(() => {
        if (start != null && end != null && Spicetify.Player.isPlaying()) {
            const now = Date.now();
            if (now < debounceUntil) return;

            const progress = Spicetify.Player.getProgress(); // ms
            const duration = Spicetify.Player.getDuration(); // ms
            if (!duration) return;
            
            const percent = progress / duration;
            
            if (percent > end || percent < start - 0.01) {
                debounceUntil = now + 1000;
                const seekTo = Math.round(start * duration);
                Spicetify.Player.seek(seekTo);
            }
        }
    }, 200);

    // Reset on song change
    Spicetify.Player.addEventListener("songchange", reset);

    // --- Context Menu ---
    function createMenuItem(title, callback) {
        const item = document.createElement("li");
        item.setAttribute("role", "menuitem");
        const button = document.createElement("button");
        button.textContent = title;
        button.onclick = (e) => {
            e.stopPropagation();
            contextMenu.hidden = true;
            callback?.();
        };
        item.append(button);
        return item;
    }

    const startBtn = createMenuItem("Set loop start", () => {
        start = mouseOnBarPercent;
        if (end === null || start > end) {
            end = 0.99;
        }
        console.log(`[LoopyLoop] Start set to ${(start * 100).toFixed(1)}%`);
        drawOnBar();
    });

    const endBtn = createMenuItem("Set loop end", () => {
        end = mouseOnBarPercent;
        if (start === null || end < start) {
            start = 0;
        }
        console.log(`[LoopyLoop] End set to ${(end * 100).toFixed(1)}%`);
        drawOnBar();
    });

    const resetBtn = createMenuItem("Reset loop", reset);

    const contextMenu = document.createElement("div");
    contextMenu.id = "loopy-context-menu";
    contextMenu.innerHTML = `<ul tabindex="0"></ul>`;
    contextMenu.style.position = "fixed";
    contextMenu.firstElementChild.append(startBtn, endBtn, resetBtn);
    document.body.append(contextMenu);
    const { height: contextMenuHeight } = contextMenu.getBoundingClientRect();
    contextMenu.hidden = true;

    window.addEventListener("click", () => {
        contextMenu.hidden = true;
    });

    progressContainer.addEventListener("contextmenu", (event) => {
        const rect = bar.getBoundingClientRect();
        mouseOnBarPercent = Math.max(0, Math.min(1, (event.clientX - rect.x) / rect.width));
        
        // Position the menu
        let menuX = event.clientX;
        let menuY = event.clientY - contextMenuHeight - 5;
        if (menuY < 0) menuY = event.clientY + 5;
        
        contextMenu.style.left = `${menuX}px`;
        contextMenu.style.top = `${menuY}px`;
        contextMenu.style.transform = "none";
        contextMenu.hidden = false;
        event.preventDefault();
        event.stopPropagation();
    });
})();
