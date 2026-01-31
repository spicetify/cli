// NAME: Loopy Loop
// AUTHOR: A2R14N
// VERSION: 1
// DESCRIPTION: Practice hitting that right note by looping sections of a track.

(async function LoopyLoop() {
    const waitForSpicetify = () => new Promise(resolve => {
        const check = () => {
            if (Spicetify?.Player && Spicetify?.React && Spicetify?.ReactDOM) resolve();
            else setTimeout(check, 100);
        };
        check();
    });

    const waitForProgressBar = () => new Promise(resolve => {
        const check = () => {
            const bar = document.querySelector(".main-nowPlayingBar-center .playback-progressbar");
            if (bar) resolve(bar);
            else setTimeout(check, 100);
        };
        check();
    });

    await waitForSpicetify();
    const progressBar = await waitForProgressBar();

    const { React, ReactDOM } = Spicetify;
    const { useState, useEffect, useCallback, useRef } = React;

    const STYLES = `
        .loopy-marker {
            position: absolute;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 10;
            pointer-events: none;
            color: var(--spice-text);
            filter: drop-shadow(0 0 2px rgba(0,0,0,0.5));
        }
        .loopy-region {
            position: absolute;
            top: 50%;
            transform: translateY(-50%);
            height: 4px;
            background-color: var(--spice-button-active);
            opacity: 0.4;
            z-index: 5;
            pointer-events: none;
            border-radius: 2px;
            transition: opacity 0.2s;
        }
        .main-nowPlayingBar-center .playback-progressbar:hover .loopy-region {
            height: 6px;
            opacity: 0.6;
        }
        .loopy-menu {
            position: fixed;
            background-color: var(--spice-card);
            border: 1px solid var(--spice-button-disabled);
            border-radius: 4px;
            box-shadow: 0 4px 12px rgba(var(--spice-rgb-shadow), 0.5);
            padding: 4px;
            z-index: 10000;
            min-width: 160px;
        }
        .loopy-menu-item {
            padding: 8px 12px;
            cursor: pointer;
            color: var(--spice-text);
            font-size: 13px;
            border-radius: 2px;
            display: flex;
            align-items: center;
            transition: background 0.1s;
        }
        .loopy-menu-item:hover {
            background-color: var(--spice-highlight);
        }
    `;

    const LoopVisuals = ({ start, end, container }) => {
        if (!container) return null;

        return ReactDOM.createPortal(
            React.createElement(React.Fragment, null,
                // Loop Region Bar
                start !== null && end !== null && React.createElement("div", {
                    className: "loopy-region",
                    style: {
                        left: `${start * 100}%`,
                        width: `${(end - start) * 100}%`
                    }
                }),
                // Start Marker (Icon)
                start !== null && React.createElement("div", {
                    className: "loopy-marker",
                    style: { left: `${start * 100}%` },
                }, React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "currentColor" },
                    React.createElement("path", { d: "M5 3l14 9-14 9V3z" }) // Play/Arrow triangle pointing right
                )),
                // End Marker (Icon)
                end !== null && React.createElement("div", {
                    className: "loopy-marker",
                    style: { left: `${end * 100}%` },
                }, React.createElement("svg", { width: "12", height: "12", viewBox: "0 0 24 24", fill: "currentColor" },
                    React.createElement("path", { d: "M19 3l-14 9 14 9V3z" }) // Arrow triangle pointing left
                ))
            ),
            container
        );
    };

    const ContextMenu = ({ x, y, onClose, onSetStart, onSetEnd, onClear }) => {
        const menuRef = useRef(null);

        useEffect(() => {
            const handleClick = (e) => {
                if (menuRef.current && !menuRef.current.contains(e.target)) {
                    onClose();
                }
            };
            window.addEventListener("mousedown", handleClick);
            return () => window.removeEventListener("mousedown", handleClick);
        }, [onClose]);

        const style = { top: y, left: x };

        return React.createElement("div", { className: "loopy-menu", style, ref: menuRef },
            React.createElement("div", { className: "loopy-menu-item", onClick: onSetStart }, "Set Loop Start"),
            React.createElement("div", { className: "loopy-menu-item", onClick: onSetEnd }, "Set Loop End"),
            React.createElement("div", { className: "loopy-menu-item", onClick: onClear }, "Clear Loop")
        );
    };

    const App = () => {
        const [loops, setLoops] = useState({ start: null, end: null });
        const [menu, setMenu] = useState({ visible: false, x: 0, y: 0, progress: 0 });
        const [barContainer, setBarContainer] = useState(null);

        useEffect(() => {
            const findBar = () => {
                const bar = document.querySelector(".main-nowPlayingBar-center .playback-progressbar");
                if (bar && bar !== barContainer) {
                    setBarContainer(bar);
                }
            };
            findBar();
            const interval = setInterval(findBar, 1000);
            return () => clearInterval(interval);
        }, [barContainer]);

        useEffect(() => {
            const handleProgress = () => {
                const { start, end } = loops;
                if (start !== null && end !== null) {
                    const current = Spicetify.Player.getProgressPercent();
                    if (current >= end) {
                        const duration = Spicetify.Player.getDuration();
                        Spicetify.Player.seek(start * duration);
                    }
                }
            };

            const handleSongChange = () => {
                setLoops({ start: null, end: null });
            };

            Spicetify.Player.addEventListener("onprogress", handleProgress);
            Spicetify.Player.addEventListener("songchange", handleSongChange);

            return () => {
                Spicetify.Player.removeEventListener("onprogress", handleProgress);
                Spicetify.Player.removeEventListener("songchange", handleSongChange);
            };
        }, [loops]);

        useEffect(() => {
            if (!barContainer) return;

            const handleContextMenu = (e) => {
                if (e.button !== 2 && e.type !== 'contextmenu') return;

                e.preventDefault();
                const rect = barContainer.getBoundingClientRect();
                const progress = (e.clientX - rect.left) / rect.width;

                setMenu({
                    visible: true,
                    x: e.clientX,
                    y: e.clientY - 120,
                    progress
                });
            };

            barContainer.addEventListener("contextmenu", handleContextMenu);
            return () => barContainer.removeEventListener("contextmenu", handleContextMenu);
        }, [barContainer]);

        const handleSetStart = () => {
            setLoops(prev => ({
                ...prev,
                start: menu.progress,
                end: (prev.end !== null && menu.progress >= prev.end) ? null : prev.end
            }));
            setMenu(m => ({ ...m, visible: false }));
        };

        const handleSetEnd = () => {
            setLoops(prev => ({
                ...prev,
                end: menu.progress,
                start: (prev.start !== null && menu.progress <= prev.start) ? null : prev.start
            }));
            setMenu(m => ({ ...m, visible: false }));
        };

        const handleClear = () => {
            setLoops({ start: null, end: null });
            setMenu(m => ({ ...m, visible: false }));
        };

        return React.createElement(React.Fragment, null,
            barContainer && React.createElement(LoopVisuals, { start: loops.start, end: loops.end, container: barContainer }),

            menu.visible && React.createElement(ContextMenu, {
                x: menu.x,
                y: menu.y,
                onClose: () => setMenu(m => ({ ...m, visible: false })),
                onSetStart: handleSetStart,
                onSetEnd: handleSetEnd,
                onClear: handleClear
            })
        );
    };

    const styleTag = document.createElement("style");
    styleTag.innerHTML = STYLES;
    document.head.appendChild(styleTag);

    const mountPoint = document.createElement("div");
    mountPoint.id = "loopy-loop-react-root";
    document.body.appendChild(mountPoint);

    if (ReactDOM.createRoot) {
        const root = ReactDOM.createRoot(mountPoint);
        root.render(React.createElement(App));
    } else {
        ReactDOM.render(React.createElement(App), mountPoint);
    }
})();
