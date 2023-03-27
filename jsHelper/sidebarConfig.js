(function SidebarConfig() {
	const sidebar = document.querySelector(".Root__nav-bar");
	if (!sidebar) return setTimeout(SidebarConfig, 100);
	// Status enum
	const HIDDEN = 0,
		SHOW = 1,
		STICKY = 2;
	// Store sidebar buttons elements
	let appItems;
	let list;
	let hiddenList;
	let isYLX;

	// Store sidebar buttons
	let buttons = [];
	let ordered = [];
	let initialized = false;

	function arrangeItems(storage) {
		const newButtons = [...buttons];
		const orderedButtons = [];
		for (const ele of storage) {
			const index = newButtons.findIndex(a => ele[0] === a?.dataset.id);
			if (index !== -1) {
				orderedButtons.push([newButtons[index], ele[1]]);
				newButtons[index] = undefined;
			}
		}
		newButtons.filter(a => a).forEach(a => orderedButtons.push([a, STICKY]));
		ordered = orderedButtons;
	}

	function appendItems() {
		const toShow = [],
			toHide = [],
			toStick = [];
		for (const el of ordered) {
			const [item, status] = el;
			if (status === STICKY) {
				appItems.append(item);
				toStick.push(el);
			} else if (status === SHOW) {
				list.append(item);
				toShow.push(el);
			} else {
				hiddenList.append(item);
				toHide.push(el);
			}
		}
		ordered = [...toStick, ...toShow, ...toHide];
	}

	function writeStorage(isYLX = false) {
		const array = ordered.map(a => [a[0].dataset.id, a[1]]);

		if (isYLX) return localStorage.setItem("spicetify-sidebar-config:ylx", JSON.stringify(array));
		return localStorage.setItem("spicetify-sidebar-config", JSON.stringify(array));
	}

	const container = document.createElement("div");
	container.id = "spicetify-sidebar-config";
	const up = document.createElement("button");
	up.innerText = "Up";
	const down = document.createElement("button");
	down.innerText = "Down";
	const hide = document.createElement("button");
	const stick = document.createElement("button");
	const style = document.createElement("style");
	style.innerHTML = `
#spicetify-hidden-list {
background-color: rgba(var(--spice-rgb-main), .3);
}
#spicetify-sidebar-config {
position: relative;
width: 100%;
height: 0;
display: flex;
justify-content: space-evenly;
align-items: center;
top: -20px;
left: 0;
}
#spicetify-sidebar-config button {
min-width: 60px;
border-radius: 3px;
background-color: var(--spice-main);
color: var(--spice-text);
border: 1px solid var(--spice-text);
}
#spicetify-sidebar-config button:disabled {
color: var(--spice-button-disabled);
}
`;
	container.append(style, up, down, hide, stick);

	function injectInteraction() {
		function onSwap(item, dir) {
			container.remove();
			const curPos = ordered.findIndex(e => e[0] === item);
			const newPos = curPos + dir;
			if (newPos < 0 || newPos > ordered.length - 1) return;

			[ordered[curPos], ordered[newPos]] = [ordered[newPos], ordered[curPos]];
			appendItems();
		}

		function onChangeStatus(item, status) {
			container.remove();
			const curPos = ordered.findIndex(e => e[0] === item);
			ordered[curPos][1] = ordered[curPos][1] === status ? SHOW : status;
			appendItems();
		}

		document.documentElement.style.setProperty("--nav-bar-width", "280px");

		hiddenList.classList.remove("hidden-visually");
		for (const el of ordered) {
			el[0].onmouseover = () => {
				const [item, status] = el;
				const index = ordered.findIndex(a => a === el);
				if (index === 0 || ordered[index][1] !== ordered[index - 1][1]) {
					up.disabled = true;
				} else {
					up.disabled = false;
					up.onclick = () => onSwap(item, -1);
				}
				if (index === ordered.length - 1 || ordered[index][1] !== ordered[index + 1][1]) {
					down.disabled = true;
				} else {
					down.disabled = false;
					down.onclick = () => onSwap(item, 1);
				}

				stick.innerText = status === STICKY ? "Unstick" : "Stick";
				hide.innerText = status === HIDDEN ? "Unhide" : "Hide";
				hide.onclick = () => onChangeStatus(item, HIDDEN);
				stick.onclick = () => onChangeStatus(item, STICKY);

				item.append(container);
			};
		}
	}

	function removeInteraction(isYLX) {
		hiddenList.classList.add("hidden-visually");
		container.remove();
		ordered.forEach(a => (a[0].onmouseover = undefined));
		document.documentElement.style.setProperty("--nav-bar-width", Spicetify.Platform.LocalStorageAPI.getItem("nav-bar-width") + "px");
		writeStorage(isYLX);
	}

	const sidebarConfigItem = new Spicetify.Menu.Item(
		"Sidebar config",
		false,
		self => {
			self.isEnabled = !self.isEnabled;
			if (self.isEnabled) {
				injectInteraction();
			} else {
				removeInteraction(isYLX);
			}
		},
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48" width="16px" height="16px" fill="currentcolor"><path d="M44.7,11L36,19.6c0,0-2.6,0-5.2-2.6s-2.6-5.2-2.6-5.2l8.7-8.7c-4.9-1.2-10.8,0.4-14.4,4c-5.4,5.4-0.6,12.3-2,13.7C12.9,28.7,5.1,34.7,4.9,35c-2.3,2.3-2.4,6-0.2,8.2c2.2,2.2,5.9,2.1,8.2-0.2c0.3-0.3,6.7-8.4,14.2-15.9c1.4-1.4,8,3.7,13.6-1.8C44.2,21.7,45.9,15.9,44.7,11z M9.4,41.1c-1.4,0-2.5-1.1-2.5-2.5C6.9,37.1,8,36,9.4,36c1.4,0,2.5,1.1,2.5,2.5C11.9,39.9,10.8,41.1,9.4,41.1z"/></svg>`
	);

	function finishInit() {
		if (initialized) return;
		sidebarConfigItem.register();
		initialized = true;
	}

	function InitSidebarConfig() {
		// STICKY container
		const legacyAppItems = document.querySelector(".main-navBar-entryPoints");
		const rootList = document.querySelector(".main-rootlist-rootlist");
		const playlistItems = document.querySelector(".main-navBar-navBar .os-content");

		if (!legacyAppItems || !playlistItems || !rootList) {
			setTimeout(InitSidebarConfig, 300);
			return;
		}

		appItems = legacyAppItems;
		buttons = [];
		ordered = [];
		isYLX = false;

		appItems.id = "spicetify-sticky-list";
		// SHOW container
		list = document.createElement("ul");
		list.id = "spicetify-show-list";
		// HIDDEN container
		hiddenList = document.createElement("ul");
		hiddenList.id = "spicetify-hidden-list";
		hiddenList.classList.add("hidden-visually");
		const playlistList = playlistItems.querySelector("ul");
		playlistList.id = "spicetify-playlist-list";
		playlistItems.prepend(list, hiddenList);

		for (const ele of appItems.children) {
			ele.dataset.id = ele.querySelector("a").pathname;
			buttons.push(ele);
		}

		for (const ele of rootList.querySelectorAll("div.GlueDropTarget")) {
			if (ele.classList.contains("GlueDropTarget--playlists")) break;
			const link = ele.querySelector("a");
			if (!link) {
				ele.dataset.id = "/add";
			} else {
				ele.dataset.id = link.pathname;
			}
			ele.classList.add("personal-library");
			new MutationObserver(mutations => {
				for (const mutation of mutations) {
					if (mutation.type === "attributes" && mutation.attributeName === "class") {
						if (!mutation.target.classList.contains("personal-library")) {
							mutation.target.classList.add("personal-library");
						}
					}
				}
			}).observe(ele, { attributes: true, attributeFilter: ["class"] });

			buttons.push(ele);
		}

		let storage = [];
		try {
			storage = JSON.parse(localStorage.getItem("spicetify-sidebar-config"));
			if (!Array.isArray(storage)) throw "";
		} catch {
			storage = buttons.map(el => [el.dataset.id, STICKY]);
		}

		arrangeItems(storage);
		appendItems();

		finishInit();
	}

	function InitSidebarXConfig() {
		// STICKY container
		const YLXAppItems = document.querySelector(".main-yourLibraryX-navItems");
		const libraryItems = document.querySelector(".main-yourLibraryX-library");

		if (!YLXAppItems || !libraryItems) {
			setTimeout(InitSidebarXConfig, 300);
			return;
		}

		appItems = YLXAppItems;
		buttons = [];
		ordered = [];
		isYLX = true;

		appItems.id = "spicetify-sticky-list";
		// SHOW container
		list = document.createElement("ul");
		list.id = "spicetify-show-list";
		// HIDDEN container
		hiddenList = document.createElement("ul");
		hiddenList.id = "spicetify-hidden-list";
		hiddenList.classList.add("hidden-visually");
		const playlistList = libraryItems.querySelector("ul");
		playlistList.id = "spicetify-playlist-list";
		libraryItems.prepend(list, hiddenList);

		for (const ele of appItems.children) {
			ele.dataset.id = ele.querySelector("a").pathname;
			buttons.push(ele);
		}

		let storage = [];
		try {
			storage = JSON.parse(localStorage.getItem("spicetify-sidebar-config:ylx"));
			if (!Array.isArray(storage)) throw "";
		} catch {
			storage = buttons.map(el => [el.dataset.id, STICKY]);
		}

		arrangeItems(storage);
		appendItems();

		finishInit();
	}

	InitSidebarConfig();
	InitSidebarXConfig();

	// Rearrange sidebar when dynamically switching in Experimental Features
	new MutationObserver(mutations => {
		for (const mutation of mutations) {
			if (mutation.attributeName === "class") {
				if (mutation.target.classList.contains("hasYLXSidebar")) {
					InitSidebarXConfig();
				} else {
					InitSidebarConfig();
				}
			}
		}
	}).observe(sidebar, { attributes: true, attributeFilter: ["class"] });

	const customButtonStyle = document.createElement("style");
	customButtonStyle.innerHTML = `
div.GlueDropTarget.personal-library  {
padding: 0 8px;
}
div.GlueDropTarget.personal-library >* {
padding: 0 16px;
height: 40px;
border-radius: 4px;
}
div.GlueDropTarget.personal-library >*.active {
background: var(--spice-card);
}
.main-rootlist-rootlist {
margin-top: 0;
}
.Root__nav-bar:not(.hasYLXSidebar) #spicetify-show-list >* {
padding: 0 24px 0 8px;
}
.hasYLXSidebar #spicetify-show-list,
.hasYLXSidebar #spicetify-hidden-list {
padding: 0 12px;
}
`;
	document.head.append(customButtonStyle);
})();
