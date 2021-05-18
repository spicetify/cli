class TabBarItem extends react.Component {
    render() {
        return react.createElement("li", {
            className: "reddit-tabBar-headerItem",
            onClick: this.props.switchTo,
        }, react.createElement("a", {
            "aria-current": "page",
            className: `reddit-tabBar-headerItemLink ${this.props.isActive ? "reddit-tabBar-active" : ""}`,
            draggable: "false",
            href: "",
        }, react.createElement("span", {
            className: "main-type-mestoBold"
        }, this.props.name)));
    }
}

class TabBarMore extends react.Component {
    render() {
        const hasActiveItem = this.props.items.includes(this.props.activeItem);
        return react.createElement("div", {
            className: `reddit-tabBar-headerItemLink reddit-tabBar-headerItem ${hasActiveItem ? "reddit-tabBar-active" : ""}`,
        }, react.createElement("select", {
            className: "main-type-mestoBold",
            onChange: this.props.switchTo,
            value: hasActiveItem ? this.props.activeItem : "",
        }, react.createElement("option", {
            value: "",
            selected: true,
            disabled: true,
        }, "More"), this.props.items.map((name) => react.createElement("option", {
            value: name
        }, name))), react.createElement("svg", {
            height: "16" ,
            width: "16" ,
            fill: "currentColor" ,
            viewBox: "0 0 16 16",
        }, react.createElement("path", {
            d: "M3 6l5 5.794L13 6z",
        })));
    }
}

const TopBarContent = ({ links, activeLink, switchCallback }) => {
    const [windowSize, setWindowSize] = useState(window.innerWidth);
    const resizeHandler = () => setWindowSize(window.innerWidth);

    useEffect(() => {
        window.addEventListener("resize", resizeHandler);
        return () => {
          window.removeEventListener("resize", resizeHandler);
        };
    }, [resizeHandler]);

    return react.createElement(TabBarContext, null, react.createElement(TabBar, {
        className: "queue-queueHistoryTopBar-tabBar",
        links,
        activeLink,
        windowSize,
        switchCallback,
    }))
}

const TabBarContext = ({ children }) => {
    return reactDOM.createPortal(
        react.createElement("div", {
            className: "main-topBar-topbarContent"
        }, children),
        document.querySelector(".main-topBar-topbarContentWrapper")
    );
}

const TabBar = react.memo(({ links, activeLink, switchCallback, windowSize = Infinity }) => {
    const tabBarRef = react.useRef(null);
    const [childrenSizes, setChildrenSizes] = useState([]);
    const [availableSpace, setAvailableSpace] = useState(0);
    const [droplistItem, setDroplistItems] = useState([]);

    useEffect(() => {
        if (!tabBarRef.current) return;
        setAvailableSpace(tabBarRef.current.clientWidth);
    }, [windowSize]);

    useEffect(() => {
        if (!tabBarRef.current) return;

        const children = Array.from(tabBarRef.current.children);
        const tabbarItemSizes = children.map(child => child.clientWidth);

        setChildrenSizes(tabbarItemSizes);
    }, [links]);

    useEffect(() => {
        if (!tabBarRef.current) return;

        const totalSize = childrenSizes.slice(0, -1).reduce((a, b) => a + b, 0);

        // Can we render everything?
        if (totalSize <= availableSpace) {
            setDroplistItems([]);
            return;
        }

        // The `More` button can be set to _any_ of the children. So we
        // reserve space for the largest item instead of always taking
        // the last item.
        const viewMoreButtonSize = childrenSizes.reduce(
            (buttonASize, buttonBSize) =>
                buttonASize > buttonBSize ? buttonASize : buttonBSize,
            0,
        );

        // Figure out how many children we can render while also showing
        // the More button
        const itemsToHide = [];
        let stopWidth = viewMoreButtonSize;

        childrenSizes.forEach((childWidth, i) => {
            if (availableSpace >= stopWidth + childWidth) {
                stopWidth += childWidth;
            } else {
                itemsToHide.push(i);
            }
        });

        setDroplistItems(itemsToHide.map(i => CONFIG.services[i]).filter(i => i));
    }, [availableSpace, childrenSizes]);

    return react.createElement("nav", {
            className: "reddit-tabBar reddit-tabBar-nav",
        }, react.createElement("ul", {
            className: "reddit-tabBar-header",
            ref: tabBarRef,
        }, links
            .filter(item=> !droplistItem.includes(item))
            .map(item => react.createElement(TabBarItem, {
                name: item,
                switchTo: switchCallback,
                isActive: activeLink === item,
            })),
            (droplistItem.length || childrenSizes.length === 0) ?
                react.createElement(TabBarMore, {
                    items: droplistItem,
                    switchTo: switchCallback,
                    activeItem: activeLink,
                }) : null)
        );
});