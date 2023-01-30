const CreditFooter = react.memo(({ provider, copyright }) => {
	if (provider === "local") return null;
	const credit = [Spicetify.Locale.get("web-player.lyrics.providedBy", provider)];
	if (copyright) {
		credit.push(...copyright.split("\n"));
	}

	return (
		provider &&
		react.createElement(
			"p",
			{
				className: "lyrics-lyricsContainer-Provider main-type-mesto",
				dir: "auto"
			},
			credit.join(" • ")
		)
	);
});

const IdlingIndicator = ({ isActive, progress, delay }) => {
	return react.createElement(
		"div",
		{
			className: `lyrics-idling-indicator ${
				!isActive ? "lyrics-idling-indicator-hidden" : ""
			} lyrics-lyricsContainer-LyricsLine lyrics-lyricsContainer-LyricsLine-active`,
			style: {
				"--position-index": 0,
				"--animation-index": 1,
				"--indicator-delay": delay + "ms"
			}
		},
		react.createElement("div", { className: `lyrics-idling-indicator__circle ${progress >= 0.05 ? "active" : ""}` }),
		react.createElement("div", { className: `lyrics-idling-indicator__circle ${progress >= 0.33 ? "active" : ""}` }),
		react.createElement("div", { className: `lyrics-idling-indicator__circle ${progress >= 0.66 ? "active" : ""}` })
	);
};

const emptyLine = {
	startTime: 0,
	endTime: 0,
	text: []
};

const useTrackPosition = callback => {
	const callbackRef = useRef();
	callbackRef.current = callback;

	useEffect(() => {
		const interval = setInterval(callbackRef.current, 50);

		return () => {
			clearInterval(interval);
		};
	}, [callbackRef]);
};

const KaraokeLine = ({ text, isActive, position, startTime }) => {
	if (!isActive) {
		return text.map(({ word }) => word).join("");
	}

	return text.map(({ word, time }) => {
		const isWordActive = position >= startTime;
		startTime += time;
		return react.createElement(
			"span",
			{
				className: "lyrics-lyricsContainer-Karaoke-Word" + (isWordActive ? " lyrics-lyricsContainer-Karaoke-WordActive" : ""),
				style: {
					"--word-duration": time + "ms"
				}
			},
			word
		);
	});
};

const SyncedLyricsPage = react.memo(({ lyrics = [], provider, copyright, isKara }) => {
	const [position, setPosition] = useState(0);
	const activeLineEle = useRef();
	const lyricContainerEle = useRef();

	useTrackPosition(() => {
		const newPos = Spicetify.Player.getProgress();
		if (newPos != position) {
			setPosition(newPos + CONFIG.visual.delay);
		}
	});

	const lyricWithEmptyLines = useMemo(
		() =>
			[emptyLine, emptyLine, ...lyrics].map((line, i) => ({
				...line,
				lineNumber: i
			})),
		[lyrics]
	);

	const lyricsId = lyrics[0].text;

	let activeLineIndex = 0;
	for (let i = lyricWithEmptyLines.length - 1; i > 0; i--) {
		if (position >= lyricWithEmptyLines[i].startTime) {
			activeLineIndex = i;
			break;
		}
	}

	const activeLines = useMemo(() => {
		const startIndex = Math.max(activeLineIndex - 1 - CONFIG.visual["lines-before"], 0);
		// 3 lines = 1 padding top + 1 padding bottom + 1 active
		const linesCount = CONFIG.visual["lines-before"] + CONFIG.visual["lines-after"] + 3;
		return lyricWithEmptyLines.slice(startIndex, startIndex + linesCount);
	}, [activeLineIndex, lyricWithEmptyLines]);

	let offset = lyricContainerEle.current ? lyricContainerEle.current.clientHeight / 2 : 0;
	if (activeLineEle.current) {
		offset += -(activeLineEle.current.offsetTop + activeLineEle.current.clientHeight / 2);
	}

	const rawLyrics = Utils.convertParsedToLRC(lyrics);

	return react.createElement(
		"div",
		{
			className: "lyrics-lyricsContainer-SyncedLyricsPage",
			ref: lyricContainerEle
		},
		react.createElement(
			"div",
			{
				className: "lyrics-lyricsContainer-SyncedLyrics",
				style: {
					"--offset": offset + "px"
				},
				key: lyricsId
			},
			activeLines.map(({ text, lineNumber, startTime }, i) => {
				if (i == 1 && activeLineIndex == 1) {
					return react.createElement(IdlingIndicator, {
						progress: position / activeLines[2].startTime,
						delay: activeLines[2].startTime / 3
					});
				}

				let className = "lyrics-lyricsContainer-LyricsLine";
				let activeElementIndex = Math.min(activeLineIndex, CONFIG.visual["lines-before"] + 1);
				let ref;

				const isActive = activeElementIndex === i;
				if (isActive) {
					className += " lyrics-lyricsContainer-LyricsLine-active";
					ref = activeLineEle;
				}

				let animationIndex;
				if (activeLineIndex <= CONFIG.visual["lines-before"]) {
					animationIndex = i - activeLineIndex;
				} else {
					animationIndex = i - CONFIG.visual["lines-before"] - 1;
				}

				return react.createElement(
					"p",
					{
						className,
						style: {
							cursor: "pointer",
							"--position-index": animationIndex,
							"--animation-index": (animationIndex < 0 ? 0 : animationIndex) + 1,
							"--blur-index": Math.abs(animationIndex)
						},
						key: lineNumber,
						dir: "auto",
						ref,
						onClick: event => {
							if (startTime) {
								Spicetify.Player.seek(startTime);
							}
						},
						onAuxClick: async event => {
							await Spicetify.Platform.ClipboardAPI.copy(rawLyrics)
								.then(() => Spicetify.showNotification("Lyrics copied to clipboard"))
								.catch(() => Spicetify.showNotification("Failed to copy lyrics to clipboard"));
						}
					},
					!isKara ? text : react.createElement(KaraokeLine, { text, startTime, position, isActive })
				);
			})
		),
		react.createElement(CreditFooter, {
			provider,
			copyright
		})
	);
});

class SearchBar extends react.Component {
	constructor() {
		super();
		this.state = {
			hidden: true,
			atNode: 0,
			foundNodes: []
		};
		this.container = null;
	}

	componentDidMount() {
		this.viewPort = document.querySelector(".main-view-container .os-viewport");
		this.mainViewOffsetTop = document.querySelector(".Root__main-view").offsetTop;
		this.toggleCallback = () => {
			if (!(Spicetify.Platform.History.location.pathname === "/lyrics-plus" && this.container)) return;

			if (this.state.hidden) {
				this.setState({ hidden: false });
				this.container.focus();
			} else {
				this.setState({ hidden: true });
				this.container.blur();
			}
		};
		this.unFocusCallback = () => {
			this.container.blur();
			this.setState({ hidden: true });
		};
		this.loopThroughCallback = event => {
			if (!this.state.foundNodes.length) {
				return;
			}

			if (event.key === "Enter") {
				const dir = event.shiftKey ? -1 : 1;
				let atNode = this.state.atNode + dir;
				if (atNode < 0) {
					atNode = this.state.foundNodes.length - 1;
				}
				atNode %= this.state.foundNodes.length;
				const rects = this.state.foundNodes[atNode].getBoundingClientRect();
				this.viewPort.scrollBy(0, rects.y - 100);
				this.setState({ atNode });
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
		while ((node = walker.nextNode())) {
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
		let y = 0,
			height = 0;
		if (this.state.foundNodes.length) {
			const node = this.state.foundNodes[this.state.atNode];
			const rects = node.getBoundingClientRect();
			y = rects.y + this.viewPort.scrollTop - this.mainViewOffsetTop;
			height = rects.height;
		}
		return react.createElement(
			"div",
			{
				className: "lyrics-Searchbar" + (this.state.hidden ? " hidden" : "")
			},
			react.createElement("input", {
				ref: c => (this.container = c),
				onChange: this.getNodeFromInput.bind(this)
			}),
			react.createElement("svg", {
				width: 16,
				height: 16,
				viewBox: "0 0 16 16",
				fill: "currentColor",
				dangerouslySetInnerHTML: {
					__html: Spicetify.SVGIcons.search
				}
			}),
			react.createElement(
				"span",
				{
					hidden: this.state.foundNodes.length === 0
				},
				`${this.state.atNode + 1}/${this.state.foundNodes.length}`
			),
			react.createElement("div", {
				className: "lyrics-Searchbar-highlight",
				style: {
					"--search-highlight-top": y + "px",
					"--search-highlight-height": height + "px"
				}
			})
		);
	}
}

function isInViewport(element) {
	const rect = element.getBoundingClientRect();
	return (
		rect.top >= 0 &&
		rect.left >= 0 &&
		rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
		rect.right <= (window.innerWidth || document.documentElement.clientWidth)
	);
}

const SyncedExpandedLyricsPage = react.memo(({ lyrics, provider, copyright, isKara }) => {
	const [position, setPosition] = useState(0);
	const activeLineRef = useRef(null);
	const pageRef = useRef(null);

	useTrackPosition(() => {
		if (!Player.data.is_paused) {
			setPosition(Spicetify.Player.getProgress() + CONFIG.visual.delay);
		}
	});

	const padded = useMemo(() => [emptyLine, ...lyrics], [lyrics]);

	const intialScroll = useMemo(() => [false], [lyrics]);

	const lyricsId = lyrics[0].text;

	let activeLineIndex = 0;
	for (let i = padded.length - 1; i >= 0; i--) {
		const line = padded[i];
		if (position >= line.startTime) {
			activeLineIndex = i;
			break;
		}
	}

	const rawLyrics = Utils.convertParsedToLRC(lyrics);

	useEffect(() => {
		if (activeLineRef.current && (!intialScroll[0] || isInViewport(activeLineRef.current))) {
			activeLineRef.current.scrollIntoView({
				behavior: "smooth",
				block: "center",
				inline: "nearest"
			});
			intialScroll[0] = true;
		}
	}, [activeLineRef.current]);

	return react.createElement(
		"div",
		{
			className: "lyrics-lyricsContainer-UnsyncedLyricsPage",
			key: lyricsId,
			ref: pageRef
		},
		react.createElement("p", {
			className: "lyrics-lyricsContainer-LyricsUnsyncedPadding"
		}),
		padded.map(({ text, startTime }, i) => {
			if (i == 0) {
				return react.createElement(IdlingIndicator, {
					isActive: activeLineIndex == 0,
					progress: position / padded[1].startTime,
					delay: padded[1].startTime / 3
				});
			}

			const isActive = i == activeLineIndex;
			return react.createElement(
				"p",
				{
					className: "lyrics-lyricsContainer-LyricsLine" + (i <= activeLineIndex ? " lyrics-lyricsContainer-LyricsLine-active" : ""),
					style: {
						cursor: "pointer"
					},
					dir: "auto",
					ref: isActive ? activeLineRef : null,
					onClick: event => {
						if (startTime) {
							Spicetify.Player.seek(startTime);
						}
					},
					onAuxClick: async event => {
						await Spicetify.Platform.ClipboardAPI.copy(rawLyrics)
							.then(() => Spicetify.showNotification("Lyrics copied to clipboard"))
							.catch(() => Spicetify.showNotification("Failed to copy lyrics to clipboard"));
					}
				},
				!isKara ? text : react.createElement(KaraokeLine, { text, startTime, position, isActive })
			);
		}),
		react.createElement("p", {
			className: "lyrics-lyricsContainer-LyricsUnsyncedPadding"
		}),
		react.createElement(CreditFooter, {
			provider,
			copyright
		}),
		react.createElement(SearchBar, null)
	);
});

const UnsyncedLyricsPage = react.memo(({ lyrics, provider, copyright }) => {
	const rawLyrics = lyrics.map(lyrics => lyrics.text).join("\n");

	return react.createElement(
		"div",
		{
			className: "lyrics-lyricsContainer-UnsyncedLyricsPage"
		},
		react.createElement("p", {
			className: "lyrics-lyricsContainer-LyricsUnsyncedPadding"
		}),
		lyrics.map(({ text }) => {
			return react.createElement(
				"p",
				{
					className: "lyrics-lyricsContainer-LyricsLine lyrics-lyricsContainer-LyricsLine-active",
					dir: "auto",
					onAuxClick: async event => {
						await Spicetify.Platform.ClipboardAPI.copy(rawLyrics)
							.then(() => Spicetify.showNotification("Lyrics copied to clipboard"))
							.catch(() => Spicetify.showNotification("Failed to copy lyrics to clipboard"));
					}
				},
				text
			);
		}),
		react.createElement("p", {
			className: "lyrics-lyricsContainer-LyricsUnsyncedPadding"
		}),
		react.createElement(CreditFooter, {
			provider,
			copyright
		}),
		react.createElement(SearchBar, null)
	);
});

const noteContainer = document.createElement("div");
noteContainer.classList.add("lyrics-Genius-noteContainer");
const noteDivider = document.createElement("div");
noteDivider.classList.add("lyrics-Genius-divider");
noteDivider.innerHTML = `<svg width="32" height="32" viewBox="0 0 13 4" fill="currentColor"><path d=\"M13 10L8 4.206 3 10z\"/></svg>`;
noteDivider.style.setProperty("--link-left", 0);
const noteTextContainer = document.createElement("div");
noteTextContainer.classList.add("lyrics-Genius-noteTextContainer");
noteTextContainer.onclick = event => {
	event.preventDefault();
	event.stopPropagation();
};
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
	if (box.y + box.height > window.innerHeight) {
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
	({ lyrics, provider, copyright, versions, versionIndex, onVersionChange, isSplitted, lyrics2, versionIndex2, onVersionChange2 }) => {
		let notes = {};
		let container = null;
		let container2 = null;

		// Fetch notes
		useEffect(() => {
			if (!container) return;
			notes = {};
			let links = container.querySelectorAll("a");
			if (isSplitted && container2) {
				links = [...links, ...container2.querySelectorAll("a")];
			}
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
				link.onclick = event => {
					event.preventDefault();
					if (!notes[id]) return;
					showNote(link, notes[id]);
				};
			}
		}, [lyrics, lyrics2]);

		const lyricsEl1 = react.createElement(
			"div",
			null,
			react.createElement(VersionSelector, { items: versions, index: versionIndex, callback: onVersionChange }),
			react.createElement("div", {
				className: "lyrics-lyricsContainer-LyricsLine lyrics-lyricsContainer-LyricsLine-active",
				ref: c => (container = c),
				dangerouslySetInnerHTML: {
					__html: lyrics
				}
			})
		);

		let mainContainer = [lyricsEl1];
		//remove "&& false" below to restore the split display
		const shouldSplit = versions.length > 1 && isSplitted && false;

		if (shouldSplit) {
			const lyricsEl2 = react.createElement(
				"div",
				null,
				react.createElement(VersionSelector, { items: versions, index: versionIndex2, callback: onVersionChange2 }),
				react.createElement("div", {
					className: "lyrics-lyricsContainer-LyricsLine lyrics-lyricsContainer-LyricsLine-active",
					ref: c => (container2 = c),
					dangerouslySetInnerHTML: {
						__html: lyrics2
					}
				})
			);
			mainContainer.push(lyricsEl2);
		}

		return react.createElement(
			"div",
			{
				className: "lyrics-lyricsContainer-UnsyncedLyricsPage"
			},
			react.createElement("p", {
				className: "lyrics-lyricsContainer-LyricsUnsyncedPadding main-type-ballad"
			}),
			react.createElement("div", { className: shouldSplit ? "split" : "" }, mainContainer),
			react.createElement(CreditFooter, {
				provider,
				copyright
			}),
			react.createElement(SearchBar, null)
		);
	}
);

const LoadingIcon = react.createElement(
	"svg",
	{
		width: "200px",
		height: "200px",
		viewBox: "0 0 100 100",
		preserveAspectRatio: "xMidYMid"
	},
	react.createElement(
		"circle",
		{
			cx: "50",
			cy: "50",
			r: "0",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2"
		},
		react.createElement("animate", {
			attributeName: "r",
			repeatCount: "indefinite",
			dur: "1s",
			values: "0;40",
			keyTimes: "0;1",
			keySplines: "0 0.2 0.8 1",
			calcMode: "spline",
			begin: "0s"
		}),
		react.createElement("animate", {
			attributeName: "opacity",
			repeatCount: "indefinite",
			dur: "1s",
			values: "1;0",
			keyTimes: "0;1",
			keySplines: "0.2 0 0.8 1",
			calcMode: "spline",
			begin: "0s"
		})
	),
	react.createElement(
		"circle",
		{
			cx: "50",
			cy: "50",
			r: "0",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2"
		},
		react.createElement("animate", {
			attributeName: "r",
			repeatCount: "indefinite",
			dur: "1s",
			values: "0;40",
			keyTimes: "0;1",
			keySplines: "0 0.2 0.8 1",
			calcMode: "spline",
			begin: "-0.5s"
		}),
		react.createElement("animate", {
			attributeName: "opacity",
			repeatCount: "indefinite",
			dur: "1s",
			values: "1;0",
			keyTimes: "0;1",
			keySplines: "0.2 0 0.8 1",
			calcMode: "spline",
			begin: "-0.5s"
		})
	)
);

const VersionSelector = react.memo(({ items, index, callback }) => {
	if (items.length < 2) {
		return null;
	}
	return react.createElement(
		"div",
		{
			className: "lyrics-versionSelector"
		},
		react.createElement(
			"select",
			{
				onChange: event => {
					callback(items, event.target.value);
				},
				value: index
			},
			items.map((a, i) => {
				return react.createElement("option", { value: i }, a.title);
			})
		),
		react.createElement(
			"svg",
			{
				height: "16",
				width: "16",
				fill: "currentColor",
				viewBox: "0 0 16 16"
			},
			react.createElement("path", {
				d: "M3 6l5 5.794L13 6z"
			})
		)
	);
});
