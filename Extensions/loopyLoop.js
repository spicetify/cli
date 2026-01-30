// NAME: Loopy Loop
// AUTHOR: khanhas (Fixed by A2R14N)
// VERSION: 0.3
// DESCRIPTION: Practice hitting that note right by looping sections of a track. Right-click the progress bar to set start/end points.

// <reference path="../globals.d.ts" />

(async function LoopyLoop() {
    // 1. Wait for Spicetify Player and the Progress Bar element to be available
    while (!Spicetify?.Player || !document.querySelector(".main-nowPlayingBar-center .playback-progressbar")) {
        await new Promise(r => setTimeout(r, 100));
    }

    const bar = document.querySelector(".main-nowPlayingBar-center .playback-progressbar");

    // 2. Inject Custom Styles for Markers and Context Menu
    const style = document.createElement("style");
    style.innerHTML = `
        /* Markers Style */
        #loopy-loop-start, #loopy-loop-end {
            position: absolute;
            font-weight: bold;
            font-size: 14px;
            top: 50%;
            transform: translateY(-55%);
            color: var(--spice-text);
            z-index: 10;
            pointer-events: none;
            line-height: 1;
            text-shadow: 0 0 2px var(--spice-shadow);
        }
        
        /* Context Menu Style */
        #loopy-context-menu {
            position: absolute;
            background-color: var(--spice-card);
            border: 1px solid var(--spice-button-disabled);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(var(--spice-rgb-shadow), 0.5);
            padding: 4px;
            z-index: 99999;
            display: none;
            min-width: 150px;
        }
        
        /* Menu Items */
        #loopy-context-menu .menu-item {
            padding: 8px 12px;
            cursor: pointer;
            color: var(--spice-text);
            font-size: 14px;
            border-radius: 2px;
            display: flex;
            align-items: center;
        }
        
        #loopy-context-menu .menu-item:hover {
            background-color: var(--spice-highlight);
            color: var(--spice-text);
        }
    `;
    document.head.appendChild(style);

    // 3. Create DOM Elements for Start/End Markers
    const startMark = document.createElement("div");
    startMark.id = "loopy-loop-start";
    startMark.innerText = "[";

    const endMark = document.createElement("div");
    endMark.id = "loopy-loop-end";
    endMark.innerText = "]";

    // Append markers to the progress bar container
    // 'relative' positioning is required for markers to align absolutely within the bar
    bar.style.position = "relative";
    bar.append(startMark, endMark);

    // 4. Logic State
    let start = null;
    let end = null;
    let mouseOnBarPercent = 0.0;

    // Helper to update visual markers based on state
    function drawOnBar() {
        startMark.style.display = start !== null ? "block" : "none";
        endMark.style.display = end !== null ? "block" : "none";

        if (start !== null) startMark.style.left = `${start * 100}%`;
        if (end !== null) endMark.style.left = `${end * 100}%`;
    }

    // Helper to reset loop state
    function reset() {
        start = null;
        end = null;
        drawOnBar();
    }

    // 5. Player Event Listeners
    // Monitor progress and loop back if needed
    Spicetify.Player.addEventListener("onprogress", (_event) => {
        if (start !== null && end !== null) {
            const progress = Spicetify.Player.getProgressPercent();
            if (progress >= end) {
                Spicetify.Player.seek(start);
            }
        }
    });

    // Auto-reset when the song changes
    Spicetify.Player.addEventListener("songchange", reset);

    // 6. Build Context Menu
    const contextMenu = document.createElement("div");
    contextMenu.id = "loopy-context-menu";

    function createItem(text, onClick) {
        const item = document.createElement("div");
        item.className = "menu-item";
        item.innerText = text;
        item.onclick = (e) => {
            e.stopPropagation(); // Stop click from closing menu immediately 
            onClick();
            contextMenu.style.display = "none";
        };
        return item;
    }

    contextMenu.append(
        createItem("Set Start Loop", () => {
            start = mouseOnBarPercent;
            // If start is after end, clear end
            if (end !== null && start >= end) end = null;
            drawOnBar();
        }),
        createItem("Set End Loop", () => {
            end = mouseOnBarPercent;
            // If end is before start, clear start
            if (start !== null && end <= start) start = null;
            drawOnBar();
        }),
        createItem("Clear Loop", reset)
    );

    document.body.appendChild(contextMenu);

    // 7. Global Event Listeners to Handle Menu
    // Close context menu when clicking outside
    window.addEventListener("click", (e) => {
        if (!contextMenu.contains(e.target)) {
            contextMenu.style.display = "none";
        }
    });

    // Prevent default context menu on the progress bar
    bar.addEventListener("contextmenu", (e) => e.preventDefault());

    // Listen for Right-Click (MouseUp button 2) to open our custom menu
    bar.addEventListener("mouseup", (event) => {
        if (event.button !== 2) return; // Ignore left/middle clicks

        event.preventDefault();

        // Calculate click position percentage relative to the bar
        const rect = bar.getBoundingClientRect();
        mouseOnBarPercent = (event.clientX - rect.left) / rect.width;

        // Reset display to measure dimensions
        contextMenu.style.display = "block";
        contextMenu.style.visibility = "hidden";
        contextMenu.style.left = "0px";
        contextMenu.style.top = "0px";

        const height = contextMenu.offsetHeight;
        const width = contextMenu.offsetWidth;

        // Position menu above the cursor with padding
        let left = event.clientX;
        let top = event.clientY - height - 10;

        // Boundary checks to keep menu on screen
        if (top < 0) top = event.clientY + 10;
        if ((left + width) > window.innerWidth) left = window.innerWidth - width - 10;

        // Apply final position
        contextMenu.style.left = `${left}px`;
        contextMenu.style.top = `${top}px`;
        contextMenu.style.visibility = "visible";
    });

    // Initial draw
    drawOnBar();
})();
