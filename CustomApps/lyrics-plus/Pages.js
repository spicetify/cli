const CreditFooter = react.memo(({ provider, copyright }) => {
    const credit = [Spicetify.Locale.get("lyrics.providedBy", provider)];
    if (copyright) {
        credit.push(...copyright.split("\n"));
    }

    return provider && react.createElement("p", {
        as: "p",
        variant: "main-type-mesto",
        className: "lyrics-lyricsContainer-Provider",
        dir: "auto"
    }, credit.join(" • "));
});

const emptyLine = {
    startTime: 0,
    text: ''
};

const LINES_TO_SHOW = 3;
const lyricsLineCount = {
    '--line-count': LINES_TO_SHOW
};

const useTrackPosition = (callback) => {
    const callbackRef = useRef();
    callbackRef.current = callback;

    useEffect(() => {
        const interval = setInterval(callbackRef.current, 50);

        return () => {
            clearInterval(interval);
        };
    }, [callbackRef]);
};

const SyncedLyricsPage = react.memo(
    ({ lyrics = [], provider, copyright }) => {
        const [position, setPosition] = useState(0);
        useTrackPosition(() => {
            if (!Player.data.is_paused) {
                setPosition(Spicetify.Player.getProgress());
            }
        });

        const lyricWithEmptyLines = useMemo(
            () => [emptyLine, emptyLine, ...lyrics]
                .map((line, i) => ({
                    ...line,
                    lineNumber: i
                })),
            [lyrics]
        );

        let activeLineIndex = 0;
        for (let i = lyricWithEmptyLines.length - 1; i > 0; i--) {
            if (position >= lyricWithEmptyLines[i].startTime) {
                activeLineIndex = i;
                break;
            }
        }

        const activeLines = useMemo(() => {
            const startIndex = Math.max(activeLineIndex - 1, 0);
            return lyricWithEmptyLines.slice(startIndex, startIndex + LINES_TO_SHOW + 2);
        }, [activeLineIndex, lyricWithEmptyLines]);


        return react.createElement("div", {
            className: "lyrics-lyricsContainer-SyncedLyricsPage",
            style: lyricsLineCount
        }, react.createElement("div", {
            className: "lyrics-lyricsContainer-SyncedLyrics"
        }, activeLines.map(({ text, lineNumber }, i) => {
            return react.createElement("p", {
                className: "lyrics-lyricsContainer-LyricsLine",
                style: {
                    '--animation-index': i
                },
                key: lineNumber,
                dir: "auto"
            }, text);
        })), react.createElement(CreditFooter, {
            provider, copyright
        }));
    }
);

const emptyLineKara = {
    startTime: 0,
    endTime: 0,
    text: []
};

const KaraokeLyricsPage = react.memo(
    ({ lyrics = [], provider, copyright }) => {
        const [position, setPosition] = useState(0);
        useTrackPosition(() => {
            if (!Player.data.is_paused) {
                setPosition(Spicetify.Player.getProgress());
            }
        });

        const padded = useMemo(
            () => [emptyLineKara, emptyLineKara, ...lyrics]
                .map((line, i) => ({
                    ...line,
                    lineNumber: i
                })),
            [lyrics]
        );

        let activeLineIndex = 0;

        for (let i = padded.length - 1; i >= 0; i--) {
            const line = padded[i];
            if (position >= line.startTime) {
                activeLineIndex = i;
                break;
            }
        }

        const activeLines = useMemo(() => {
            const startIndex = Math.max(activeLineIndex - 1, 0);
            return padded.slice(startIndex, startIndex + LINES_TO_SHOW + 2);
        }, [activeLineIndex, padded]);

        return react.createElement("div", {
            className: "lyrics-lyricsContainer-SyncedLyricsPage",
            style: lyricsLineCount
        }, react.createElement("div", {
            className: "lyrics-lyricsContainer-SyncedLyrics"
        }, activeLines.map(({ text, lineNumber, startTime }, i) => {
            let timeAcc = startTime;
            return react.createElement("p", {
                className: "lyrics-lyricsContainer-LyricsLine",
                style: {
                    '--animation-index': i
                },
                key: lineNumber,
                dir: "auto"
            }, i == 1 ? text.map(({ word, time }) => {
                const isWordActive = position >= timeAcc;
                timeAcc += time
                return react.createElement("span", {
                    className: "lyrics-lyricsContainer-Karaoke-Word" + (isWordActive ? " lyrics-lyricsContainer-Karaoke-WordActive" : ""),
                    style: {
                        "--word-duration": time + "ms"
                    }
                }, word);
            }) : text.map(({ word }) => word).join(" "));
        })), react.createElement(CreditFooter, {
            provider, copyright
        }));
    }
);

class SearchBar extends react.Component {
    constructor() {
        super();
        this.state = {
            hidden: true,
            atNode: 0,
            foundNodes: [],
        };
        this.container = null;
    }

    componentDidMount() {
        this.viewPort = document.querySelector(".main-view-container .os-viewport");
        this.mainViewOffsetTop = document.querySelector(".Root__main-view").offsetTop;
        this.toggleCallback = () => {
            if (this.state.hidden) {
                this.setState({ hidden: false });
                this.container.focus();
            } else {
                this.setState({ hidden: true });
                this.container.blur();
            }
        }
        this.unFocusCallback = () => {
            this.container.blur();
            this.setState({ hidden: true });
        }
        this.loopThroughCallback = (event) => {
            if (!this.state.foundNodes.length) {
                return;
            }

            if (event.key === "Enter") {
                const dir = event.shiftKey ? -1 : 1;
                let atNode = (this.state.atNode + dir);
                if (atNode < 0) {
                    atNode =  this.state.foundNodes.length - 1;
                }
                atNode %= this.state.foundNodes.length
                const rects = this.state.foundNodes[atNode].getBoundingClientRect();
                this.viewPort.scrollBy(0, rects.y - 100);
                this.setState({ atNode })
            }
        };

        Spicetify.Mousetrap().bind("mod+shift+f", this.toggleCallback);
        Spicetify.Mousetrap(this.container).bind("mod+shift+f", this.toggleCallback);
        Spicetify.Mousetrap(this.container).bind("enter", this.loopThroughCallback);
        Spicetify.Mousetrap(this.container).bind("shift+enter", this.loopThroughCallback);
        Spicetify.Mousetrap(this.container).bind("esc", this.unFocusCallback);
    }

    componentWillUnmount() {
        Spicetify.Mousetrap().unbind("mod+shift+f", this.toggleCallback);
        Spicetify.Mousetrap(this.container).unbind("mod+shift+f", this.toggleCallback);
        Spicetify.Mousetrap(this.container).unbind("enter", this.loopThroughCallback);
        Spicetify.Mousetrap(this.container).unbind("shift+enter", this.loopThroughCallback);
        Spicetify.Mousetrap(this.container).unbind("esc", this.unFocusCallback);
    }

    getNodeFromInput(event) {
        const value = event.target.value.toLowerCase();
        if (!value) {
            this.setState({ foundNodes: [] });
            this.viewPort.scrollTo(0, 0);
            return;
        }

        const el = document.querySelector(".lyrics-lyricsContainer-UnsyncedLyricsPage");
        const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
        const foundNodes = [];
        let node;
        while(node = walker.nextNode()) {
            if (node.textContent.toLowerCase().includes(value)) {
                const range = document.createRange();
                range.selectNodeContents(node);
                foundNodes.push(range);
            }
        }

        if (!foundNodes.length) {
            this.viewPort.scrollBy(0, 0);
        } else {
            const rects = foundNodes[0].getBoundingClientRect();
            this.viewPort.scrollBy(0, rects.y - 100);
        }

        this.setState({ foundNodes, atNode: 0 });
    }

    render() {
        let y = 0, height = 0;
        if (this.state.foundNodes.length) {
            const node = this.state.foundNodes[this.state.atNode];
            const rects = node.getBoundingClientRect();
            y = rects.y + this.viewPort.scrollTop - this.mainViewOffsetTop;
            height = rects.height;
        }
        return react.createElement("div", {
            className: "lyrics-Searchbar" + (this.state.hidden ? " hidden" : ""),
        }, react.createElement("input", {
            ref: c => (this.container = c),
            onChange: this.getNodeFromInput.bind(this),
        }), react.createElement("svg", {
            width: 16,
            height: 16,
            viewBox: "0 0 16 16",
            fill: "currentColor",
            dangerouslySetInnerHTML: {
                __html: Spicetify.SVGIcons.search,
            }
        }), react.createElement("span", {
            hidden: this.state.foundNodes.length === 0,
        }, `${this.state.atNode + 1}/${this.state.foundNodes.length}`),
        react.createElement("div", {
            className: "lyrics-Searchbar-highlight",
            style: {
                "--search-highlight-top": y + "px",
                "--search-highlight-height": height + "px",
            }
        }),
        );
    }
};

const UnsyncedLyricsPage = react.memo(
    ({ lyrics, provider, copyright }) => {
        return react.createElement("div", {
            className: "lyrics-lyricsContainer-UnsyncedLyricsPage",
        }, react.createElement("p", {
            variant: "main-type-ballad",
            className: "lyrics-lyricsContainer-LyricsUnsyncedMessage",
        }), react.createElement("div", null,
            lyrics.map(({ text, desc }) => {
                return react.createElement("p", {
                    className: "lyrics-lyricsContainer-LyricsLine",
                    dir: "auto"
                }, text);
            })
        ), react.createElement(CreditFooter, {
            provider, copyright
        }),
        react.createElement(SearchBar, null)
        );
    }
);

const noteContainer = document.createElement("div");
noteContainer.classList.add("lyrics-Genius-noteContainer");
const noteDivider = document.createElement("div");
noteDivider.classList.add("lyrics-Genius-divider");
noteDivider.innerHTML = `<svg width="32" height="32" viewBox="0 0 13 4" fill="currentColor"><path d=\"M13 10L8 4.206 3 10z\"/></svg>`
noteDivider.style.setProperty("--link-left", 0);
const noteTextContainer = document.createElement("div");
noteTextContainer.classList.add("lyrics-Genius-noteTextContainer");
noteTextContainer.onclick = (event) => {
    event.preventDefault();
    event.stopPropagation();
}
noteContainer.append(noteDivider, noteTextContainer);

function showNote(parent, note) {
    if (noteContainer.parentElement === parent) {
        noteContainer.remove();
        return;
    }
    noteTextContainer.innerText = note;
    parent.append(noteContainer);
    const arrowPos = parent.offsetLeft - noteContainer.offsetLeft;
    noteDivider.style.setProperty("--link-left", arrowPos + "px");
    const box = noteTextContainer.getBoundingClientRect();
    if ((box.y + box.height) > window.innerHeight) {
        // Wait for noteContainer is mounted
        setTimeout(() => {
            noteContainer.scrollIntoView({
                behavior: "smooth",
                block: "center",
                inline: "nearest"
            });
        }, 50);
    }
}

const GeniusPage = react.memo(
    ({ lyrics, provider, copyright, versions, versionIndex, onVersionChange }) => {
        let notes = {};
        let container = null;
        
        // Fetch notes
        useEffect(() => {
            if (!container) return;
            notes = {};
            const links = container.querySelectorAll("a");
            for (const link of links) {
                let id = link.pathname.match(/\/(\d+)\//);
                if (!id) {
                    id = link.dataset.id;
                } else {
                    id = id[1];
                }
                ProviderGenius.getNote(id).then(note => {
                    notes[id] = note;
                    link.classList.add("fetched");
                });
                link.onclick = (event) => {
                    event.preventDefault();
                    if (!notes[id]) return;
                    showNote(link, notes[id]);
                }
            }
        }, [lyrics])

        return react.createElement("div", {
            className: "lyrics-lyricsContainer-UnsyncedLyricsPage",
        }, react.createElement("p", {
            variant: "main-type-ballad",
            className: "lyrics-lyricsContainer-LyricsUnsyncedMessage",
        },  versions?.length > 1 && react.createElement(VersionSelector, {
            items: versions,
            index: versionIndex,
            callback: onVersionChange,
        })), react.createElement("div", {
            className: "lyrics-lyricsContainer-LyricsLine",
            ref: c => (container = c),
            dangerouslySetInnerHTML: {
                __html: lyrics,
            },
        }), react.createElement(CreditFooter, {
            provider, copyright
        }),
        react.createElement(SearchBar, null)
        );
    }
);

const LoadingIcon = react.createElement("svg", {
    width: "200px", height: "200px", viewBox: "0 0 100 100", preserveAspectRatio: "xMidYMid"
}, react.createElement("circle", {
    cx: "50", cy: "50", r: "0", fill: "none", stroke: "currentColor", "stroke-width": "2"
}, react.createElement("animate", {
    attributeName: "r", repeatCount: "indefinite", dur: "1s", values: "0;40", keyTimes: "0;1", keySplines: "0 0.2 0.8 1", calcMode: "spline", begin: "0s"
}), react.createElement("animate", {
    attributeName: "opacity", repeatCount: "indefinite", dur: "1s", values: "1;0", keyTimes: "0;1", keySplines: "0.2 0 0.8 1", calcMode: "spline", begin: "0s"
})), react.createElement("circle", {
    cx: "50", cy: "50", r: "0", fill: "none", stroke: "currentColor", "stroke-width": "2"
}, react.createElement("animate", {
    attributeName: "r", repeatCount: "indefinite", dur: "1s", values: "0;40", keyTimes: "0;1", keySplines: "0 0.2 0.8 1", calcMode: "spline", begin: "-0.5s"
}), react.createElement("animate", {
    attributeName: "opacity", repeatCount: "indefinite", dur: "1s", values: "1;0", keyTimes: "0;1", keySplines: "0.2 0 0.8 1", calcMode: "spline", begin: "-0.5s"
})));

const VersionSelector = react.memo(({ items, index, callback }) => {
    return react.createElement("div", {
        className: "lyrics-versionSelector",
    }, react.createElement("select", {
        onChange: (event) => {
            callback(items, event.target.value);
        },
        value: index,
    }, items.map((a, i) => {
        return react.createElement("option", { value: i, }, a.title);
    })), react.createElement("svg", {
        height: "16",
        width: "16",
        fill: "currentColor",
        viewBox: "0 0 16 16",
    }, react.createElement("path", {
        d: "M3 6l5 5.794L13 6z",
    })))
});
