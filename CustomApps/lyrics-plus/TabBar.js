class TabBarItem extends react.Component {
	onSelect(event) {
		event.preventDefault();
		this.props.switchTo(this.props.item.key);
	}
	onLock(event) {
		event.preventDefault();
		this.props.lockIn(this.props.item.key);
	}
	render() {
		return react.createElement(
			"li",
			{
				className: "lyrics-tabBar-headerItem",
				onClick: this.onSelect.bind(this),
				onDoubleClick: this.onLock.bind(this),
				onContextMenu: this.onLock.bind(this),
			},
			react.createElement(
				"a",
				{
					"aria-current": "page",
					className: `lyrics-tabBar-headerItemLink ${this.props.item.active ? "lyrics-tabBar-active" : ""}`,
					draggable: "false",
					href: "",
				},
				react.createElement(
					"span",
					{
						className: "main-type-mestoBold",
					},
					this.props.item.value
				)
			)
		);
	}
}

const TabBarMore = react.memo(({ items, switchTo, lockIn }) => {
	const activeItem = items.find((item) => item.active);

	function onLock(event) {
		event.preventDefault();
		if (activeItem) {
			lockIn(activeItem.key);
		}
	}
	return react.createElement(
		"li",
		{
			className: `lyrics-tabBar-headerItem ${activeItem ? "lyrics-tabBar-active" : ""}`,
			onDoubleClick: onLock,
			onContextMenu: onLock,
		},
		react.createElement(OptionsMenu, {
			options: items,
			onSelect: switchTo,
			selected: activeItem,
			defaultValue: "More",
			bold: true,
		})
	);
});

const TopBarContent = ({ links, activeLink, lockLink, switchCallback, lockCallback }) => {
	const resizeHost =
		document.querySelector(".Root__main-view .os-resize-observer-host") ?? document.querySelector(".Root__main-view .os-size-observer");
	const [windowSize, setWindowSize] = useState(resizeHost.clientWidth);
	const resizeHandler = () => setWindowSize(resizeHost.clientWidth);

	useEffect(() => {
		const observer = new ResizeObserver(resizeHandler);
		observer.observe(resizeHost);
		return () => {
			observer.disconnect();
		};
	}, [resizeHandler]);

	return react.createElement(
		TabBarContext,
		null,
		react.createElement(TabBar, {
			className: "queue-queueHistoryTopBar-tabBar",
			links,
			activeLink,
			lockLink,
			switchCallback,
			lockCallback,
			windowSize,
		})
	);
};

const TabBarContext = ({ children }) => {
	return reactDOM.createPortal(
		react.createElement(
			"div",
			{
				className: "main-topBar-topbarContent",
			},
			children
		),
		document.querySelector(".main-topBar-topbarContentWrapper")
	);
};

const TabBar = react.memo(({ links, activeLink, lockLink, switchCallback, lockCallback, windowSize = Number.POSITIVE_INFINITY }) => {
	const tabBarRef = react.useRef(null);
	const [childrenSizes, setChildrenSizes] = useState([]);
	const [availableSpace, setAvailableSpace] = useState(0);
	const [droplistItem, setDroplistItems] = useState([]);

	const options = [];
	for (let i = 0; i < links.length; i++) {
		const key = links[i];
		if (spotifyVersion >= "1.2.31" && key === "genius") continue;
		let value = key[0].toUpperCase() + key.slice(1);
		if (key === lockLink) value = `• ${value}`;
		const active = key === activeLink;
		options.push({ key, value, active });
	}

	useEffect(() => {
		if (!tabBarRef.current) return;
		setAvailableSpace(tabBarRef.current.clientWidth);
	}, [windowSize]);

	useEffect(() => {
		if (!tabBarRef.current) return;

		const tabbarItemSizes = [];
		for (const child of tabBarRef.current.children) {
			tabbarItemSizes.push(child.clientWidth);
		}

		setChildrenSizes(tabbarItemSizes);
	}, [links]);

	useEffect(() => {
		if (!tabBarRef.current) return;

		const totalSize = childrenSizes.reduce((a, b) => a + b, 0);

		// Can we render everything?
		if (totalSize <= availableSpace) {
			setDroplistItems([]);
			return;
		}

		// The `More` button can be set to _any_ of the children. So we
		// reserve space for the largest item instead of always taking
		// the last item.
		const viewMoreButtonSize = Math.max(...childrenSizes);

		// Figure out how many children we can render while also showing
		// the More button
		const itemsToHide = [];
		let stopWidth = viewMoreButtonSize;

		childrenSizes.forEach((childWidth, i) => {
			if (availableSpace >= stopWidth + childWidth) {
				stopWidth += childWidth;
			} else {
				// First elem is edit button
				itemsToHide.push(i);
			}
		});

		setDroplistItems(itemsToHide);
	}, [availableSpace, childrenSizes]);

	return react.createElement(
		"nav",
		{
			className: "lyrics-tabBar lyrics-tabBar-nav",
		},
		react.createElement(
			"ul",
			{
				className: "lyrics-tabBar-header",
				ref: tabBarRef,
			},
			react.createElement("li", {
				className: "lyrics-tabBar-headerItem",
			}),
			options
				.filter((_, id) => !droplistItem.includes(id))
				.map((item) =>
					react.createElement(TabBarItem, {
						item,
						switchTo: switchCallback,
						lockIn: lockCallback,
					})
				),
			droplistItem.length || childrenSizes.length === 0
				? react.createElement(TabBarMore, {
						items: droplistItem.map((i) => options[i]).filter(Boolean),
						switchTo: switchCallback,
						lockIn: lockCallback,
					})
				: null
		)
	);
});
