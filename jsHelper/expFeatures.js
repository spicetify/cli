(function () {
	let overrideList,
		newFeatures = [],
		hooksPatched = false,
		featureMap = {};

	try {
		overrideList = JSON.parse(localStorage.getItem("spicetify-exp-features"));
		if (!overrideList || overrideList !== Object(overrideList)) throw "";
	} catch {
		overrideList = {};
	}

	try {
		remoteConfig = JSON.parse(localStorage.getItem("spicetify-remote-config"));
		if (!remoteConfig || remoteConfig !== Object(remoteConfig)) throw "";
	} catch {
		remoteConfig = {};
	}

	Spicetify.expFeatureOverride = function (feature) {
		hooksPatched = true;
		newFeatures.push(feature.name);

		switch (feature.type) {
			case "enum":
				if (!overrideList[feature.name]) {
					overrideList[feature.name] = { description: feature.description, value: feature.default, values: feature.values };
				}
				feature.default = overrideList[feature.name].value;
				break;
			case "bool":
				if (!overrideList[feature.name]) {
					overrideList[feature.name] = { description: feature.description, value: feature.default };
				}
				feature.default = overrideList[feature.name].value;
				break;
		}

		if (remoteConfig[feature.name] !== undefined && overrideList[feature.name]) {
			feature.default = remoteConfig[feature.name];
			overrideList[feature.name].value = remoteConfig[feature.name];
		}

		// Internal stuff may changes after updates, filter if so
		if (overrideList[feature.name] && typeof overrideList[feature.name].value !== typeof feature.default) {
			newFeatures = newFeatures.filter(f => f !== feature.name);
		}

		localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
		return feature;
	};

	let content = document.createElement("div");
	content.classList.add("spicetify-exp-features");
	let style = document.createElement("style");
	style.innerHTML = `
.spicetify-exp-features .col {
    padding: 0;
}
.spicetify-exp-features .setting-row::after {
    content: "";
    display: table;
    clear: both;
}
.spicetify-exp-features .setting-row {
    display: flex;
    padding: 10px 0;
    align-items: center;
}
.spicetify-exp-features .setting-row .col.description {
    float: left;
    padding-right: 15px;
    width: 100%;
}
.spicetify-exp-features .setting-row .col.action {
    float: right;
    text-align: right;
}
.spicetify-exp-features .setting-row .col.action .dropdown {
	width: max-content;
}
.spicetify-exp-features button.switch {
    align-items: center;
    border: 0px;
    border-radius: 50%;
    background-color: rgba(var(--spice-rgb-shadow), .7);
    color: var(--spice-text);
    cursor: pointer;
    display: flex;
    margin-inline-start: 12px;
    padding: 8px;
}
.spicetify-exp-features button.switch.disabled,
.spicetify-exp-features button.switch[disabled] {
    color: rgba(var(--spice-rgb-text), .3);
}
.spicetify-exp-features button.reset {
	font-weight: 700;
	font-size: medium;
	background-color: transparent;
	border-radius: 500px;
	transition-duration: 33ms;
	transition-property: background-color, border-color, color, box-shadow, filter, transform;
	padding-inline: 15px;
	border: 1px solid #727272;
	color: var(--spice-text);
	min-block-size: 32px;
	cursor: pointer;
}
.spicetify-exp-features button.reset:hover {
	transform: scale(1.04);
	border-color: var(--spice-text);
}
.spicetify-exp-features .search-container {
    width: 100%;
}
.spicetify-exp-features .setting-row#search .col.action {
    position: relative;
    width: 100%;
}
.spicetify-exp-features .setting-row#search svg {
    position: absolute;
    margin: 12px;
}
.spicetify-exp-features input.search {
    border-style: solid;
    border-color: var(--spice-sidebar);
    background-color: var(--spice-sidebar);
    border-radius: 8px;
    padding: 10px 36px;
    color: var(--spice-text);
    width: 100%;
}`;
	content.appendChild(style);

	new Spicetify.Menu.Item(
		"Experimental features",
		false,
		() => {
			Spicetify.PopupModal.display({
				title: "Experimental features",
				content,
				isLarge: true
			});
		},
		`<svg xmlns="http://www.w3.org/2000/svg" version="1.0" viewBox="0 0 863 924" width="18px" height="18px" fill="currentcolor"><g transform="translate(0,924) scale(0.1,-0.1)"><path d="M3725 9160 c-148 -4 -306 -10 -350 -14 -117 -11 -190 -49 -291 -150 -132 -133 -170 -234 -162 -431 7 -163 50 -255 185 -396 l64 -66 -10 -994 c-13 -1268 -15 -1302 -63 -1494 -87 -352 -263 -756 -511 -1172 -111 -186 -705 -1084 -1371 -2073 -537 -797 -585 -882 -607 -1090 -33 -317 39 -586 218 -810 114 -142 229 -235 386 -311 90 -43 116 -51 217 -65 209 -27 723 -33 2725 -33 2278 1 3098 9 3190 32 231 59 482 234 607 423 142 215 195 408 185 674 -9 241 -46 337 -240 634 -53 81 -97 156 -97 167 0 10 -6 19 -13 19 -19 0 -1264 1863 -1621 2424 -166 261 -361 668 -444 928 -42 129 -88 314 -107 428 -20 119 -34 783 -34 1683 l-1 629 80 91 c125 142 170 250 170 408 0 96 -16 162 -61 255 -74 152 -221 264 -371 284 -182 25 -1072 35 -1673 20z m1574 -388 c89 -20 141 -84 141 -172 0 -47 -5 -64 -30 -98 -16 -23 -38 -46 -50 -52 -45 -24 -311 -33 -985 -33 -764 0 -958 8 -1004 44 -42 33 -71 89 -71 138 0 56 34 127 69 145 30 16 151 35 256 40 159 7 1633 -3 1674 -12z m-116 -839 c11 -175 18 -570 27 -1378 9 -824 10 -825 70 -1066 81 -320 193 -597 398 -984 178 -337 326 -569 1065 -1663 186 -277 337 -505 335 -508 -3 -2 -1223 -3 -2712 -2 l-2707 3 82 120 c45 66 290 431 544 810 437 654 626 953 779 1233 229 416 404 893 445 1207 21 158 31 532 31 1175 0 360 3 766 7 902 l6 247 126 4 c69 1 435 4 812 5 l686 2 6 -107z"/></g></svg>`
	).register();

	(function waitForRemoteConfigResolver() {
		// Don't show options if hooks aren't patched/loaded
		if (!hooksPatched || !Spicetify.RemoteConfigResolver) {
			setTimeout(waitForRemoteConfigResolver, 500);
			return;
		}

		localStorage.removeItem("spicetify-remote-config");

		const { setOverrides, remoteConfiguration } = Spicetify.RemoteConfigResolver.value;

		Object.keys(overrideList).forEach(key => {
			if (newFeatures.length > 0 && !newFeatures.includes(key)) {
				delete overrideList[key];
				console.warn(`[spicetify-exp-features] Removed ${key} from override list`);
				localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
			}
		});

		function changeValue(name, value) {
			overrideList[name].value = value;
			localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));

			featureMap[name] = value;
			setOverrides(Spicetify.createInternalMap(featureMap));
		}

		function createSlider(name, desc, defaultVal) {
			const container = document.createElement("div");
			container.classList.add("setting-row");
			container.id = name;
			container.innerHTML = `
<label class="col description">${desc}</label>
<div class="col action"><button class="switch">
    <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
        ${Spicetify.SVGIcons.check}
    </svg>
</button></div>`;

			const slider = container.querySelector("button.switch");
			slider.classList.toggle("disabled", !defaultVal);

			slider.onclick = () => {
				const state = slider.classList.contains("disabled");
				slider.classList.toggle("disabled");
				changeValue(name, state);
			};

			return container;
		}

		function createDropdown(name, desc, defaultVal, options) {
			const container = document.createElement("div");
			container.classList.add("setting-row");
			container.id = name;
			container.innerHTML = `
<label class="col description">${desc}</label>
<div class="col action">
<select class="dropdown main-dropDown-dropDown">
    ${options.map(option => `<option value="${option}">${option}</option>`).join("")}
</select>
</div>`;
			const dropdown = container.querySelector("select");
			dropdown.value = defaultVal;

			dropdown.onchange = () => {
				changeValue(name, dropdown.value);
			};

			return container;
		}

		function searchBar() {
			const container = document.createElement("div");
			container.classList.add("setting-row");
			container.id = "search";
			container.innerHTML = `
<div class="col action">
<div class="search-container">
<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
    ${Spicetify.SVGIcons.search}
</svg>
<input type="text" class="search" placeholder="Search for a feature">
</div>
</div>`;
			const search = container.querySelector("input.search");

			search.oninput = () => {
				const query = search.value.toLowerCase();
				const rows = content.querySelectorAll(".setting-row");
				rows.forEach(row => {
					if (row.id === "search" || row.id === "reset") return;
					if (row.textContent.trim().toLowerCase().includes(query) || row.id.toLowerCase().includes(query)) {
						row.style.display = "flex";
					} else {
						row.style.display = "none";
					}
				});
			};

			return container;
		}

		function resetButton() {
			const resetRow = document.createElement("div");
			resetRow.classList.add("setting-row");
			resetRow.id = "reset";
			resetRow.innerHTML += `
                        <label class="col description">Clear all cached features and preferences</label>
                        <div class="col action">
                            <button class="reset">Reset</button>
                        </div>`;
			const resetButton = resetRow.querySelector("button.reset");
			resetButton.onclick = () => {
				const defaultRemoteConfig = remoteConfiguration.values;
				featureMap = {};

				localStorage.removeItem("spicetify-exp-features");
				defaultRemoteConfig.forEach((value, name) => {
					featureMap[name] = value;
				});
				localStorage.setItem("spicetify-remote-config", JSON.stringify(featureMap));
				window.location.reload();
			};

			return resetRow;
		}

		content.appendChild(searchBar());

		Object.keys(overrideList).forEach(name => {
			const feature = overrideList[name];

			if (!overrideList[name]?.description) return;

			if (overrideList[name].values) {
				content.appendChild(createDropdown(name, feature.description, feature.value, feature.values));
			} else content.appendChild(createSlider(name, feature.description, feature.value));

			featureMap[name] = feature.value;
		});

		content.appendChild(resetButton());

		setOverrides(Spicetify.createInternalMap(featureMap));
	})();
})();
