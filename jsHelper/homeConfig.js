SpicetifyHomeConfig = {};

(function () {
	// Status enum
	const NORMAL = 0,
		STICKY = 1,
		LOWERED = 2;
	// List of sections' metadata
	let list;
	// Store sections' statuses
	const statusDic = {};
	let mounted = false;

	SpicetifyHomeConfig.arrange = function (sections) {
		mounted = true;
		if (list) {
			return list;
		}
		const stickList = (localStorage.getItem("spicetify-home-config:stick") || "").split(",");
		const lowList = (localStorage.getItem("spicetify-home-config:low") || "").split(",");
		let stickSections = [];
		let lowSections = [];
		for (const uri of stickList) {
			const index = sections.findIndex(a => a?.uri === uri);
			if (index !== -1) {
				const item = sections[index];
				statusDic[item.uri] = STICKY;
				stickSections.push(item);
				sections[index] = undefined;
			}
		}
		for (const uri of lowList) {
			const index = sections.findIndex(a => a?.uri === uri);
			if (index !== -1) {
				const item = sections[index];
				statusDic[item.uri] = LOWERED;
				lowSections.push(item);
				sections[index] = undefined;
			}
		}
		sections = sections.filter(a => a);

		list = [...stickSections, ...sections, ...lowSections];
		return list;
	};

	const up = document.createElement("button");
	up.innerText = "Up";
	const down = document.createElement("button");
	down.innerText = "Down";
	const lower = document.createElement("button");
	const stick = document.createElement("button");
	const style = document.createElement("style");
	style.innerHTML = `
#spicetify-home-config {
    position: relative;
    width: 100%;
    height: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 5px;
}
#spicetify-home-config button {
    min-width: 60px;
    height: 40px;
    border-radius: 3px;
    background-color: var(--spice-main);
    color: var(--spice-text);
    border: 1px solid var(--spice-text);
}
#spicetify-home-config button:disabled {
    color: var(--spice-button-disabled);
}
`;

	const container = document.createElement("div");
	container.id = "spicetify-home-config";
	container.append(style, up, down, lower, stick);
	let elem = [];

	function injectInteraction() {
		const main = document.querySelector(".main-home-content");
		elem = [...main.querySelectorAll("section")];
		elem.forEach((item, index) => (item.dataset.uri = list[index].uri));

		function appendItems() {
			const stick = [],
				low = [],
				normal = [];
			for (const el of elem) {
				if (statusDic[el.dataset.uri] === STICKY) stick.push(el);
				else if (statusDic[el.dataset.uri] === LOWERED) low.push(el);
				else normal.push(el);
			}

			localStorage.setItem(
				"spicetify-home-config:stick",
				stick.map(a => a.dataset.uri)
			);
			localStorage.setItem(
				"spicetify-home-config:low",
				low.map(a => a.dataset.uri)
			);

			elem = [...stick, ...normal, ...low];
			main.append(...elem);
		}

		function onSwap(item, dir) {
			container.remove();
			const curPos = elem.findIndex(e => e === item);
			const newPos = curPos + dir;
			if (newPos < 0 || newPos > elem.length - 1) return;

			[elem[curPos], elem[newPos]] = [elem[newPos], elem[curPos]];
			[list[curPos], list[newPos]] = [list[newPos], list[curPos]];
			appendItems();
		}

		function onChangeStatus(item, status) {
			container.remove();
			const isToggle = statusDic[item.dataset.uri] === status;
			statusDic[item.dataset.uri] = isToggle ? NORMAL : status;
			appendItems();
		}

		elem.forEach(el => {
			el.onmouseover = () => {
				const status = statusDic[el.dataset.uri];
				const index = elem.findIndex(a => a === el);

				if (!status || index === 0 || status !== statusDic[elem[index - 1]?.dataset.uri]) {
					up.disabled = true;
				} else {
					up.disabled = false;
					up.onclick = () => onSwap(el, -1);
				}

				if (!status || index === elem.length - 1 || status !== statusDic[elem[index + 1]?.dataset.uri]) {
					down.disabled = true;
				} else {
					down.disabled = false;
					down.onclick = () => onSwap(el, 1);
				}

				stick.innerText = status === STICKY ? "Unstick" : "Stick";
				lower.innerText = status === LOWERED ? "Unlower" : "Lower";
				lower.onclick = () => onChangeStatus(el, LOWERED);
				stick.onclick = () => onChangeStatus(el, STICKY);

				el.prepend(container);
			};
		});
	}

	function removeInteraction() {
		container.remove();
		elem.forEach(a => (a.onmouseover = undefined));
	}

	const menu = new Spicetify.Menu.Item("Home config", false, self => {
		self.isEnabled = !self.isEnabled;
		if (self.isEnabled) {
			injectInteraction();
		} else {
			removeInteraction();
		}
	});
	SpicetifyHomeConfig.addToMenu = () => menu.register();
	SpicetifyHomeConfig.removeMenu = () => {
		menu.isEnabled = false;
		menu.deregister();
	};

	(function waitForHistoryAPI() {
		if (!Spicetify.Platform?.History || !mounted) {
			setTimeout(waitForHistoryAPI, 100);
			return;
		}
		// Init
		if (Spicetify.Platform.History.location.pathname === "/") {
			SpicetifyHomeConfig.addToMenu();
		}

		Spicetify.Platform.History.listen(({ pathname }) => {
			if (pathname === "/") {
				SpicetifyHomeConfig.addToMenu();
			} else {
				SpicetifyHomeConfig.removeMenu();
			}
		});
	})();
})();
