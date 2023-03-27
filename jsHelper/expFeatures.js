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
		`<svg xmlns="http://www.w3.org/2000/svg" version="1.0" width=18px height=18px fill="currentcolor" viewBox="0 0 767 769"><g transform="translate(0,769) scale(0.1,-0.1)"><path d="M3139 7490 c-139 -7 -149 -9 -207 -40 -78 -41 -174 -141 -210 -217 -25 -53 -27 -68 -27 -183 0 -122 1 -127 34 -194 19 -40 60 -96 96 -135 l64 -67 -10 -870 c-5 -478 -13 -907 -18 -954 -25 -232 -122 -507 -295 -845 -142 -276 -183 -339 -922 -1447 -359 -537 -674 -1016 -700 -1065 -27 -48 -61 -124 -76 -168 -25 -71 -28 -95 -28 -213 0 -208 31 -330 121 -468 122 -186 309 -331 480 -372 26 -7 136 -16 245 -22 245 -12 4189 -13 4389 0 106 6 157 14 210 33 264 92 445 276 543 552 20 58 25 95 29 216 7 186 -6 262 -61 377 -24 48 -237 379 -475 735 -555 833 -1000 1508 -1069 1622 -138 228 -279 540 -343 761 -83 287 -88 377 -89 1379 l0 750 65 75 c81 93 113 157 126 250 28 196 -67 383 -234 465 -70 34 -76 35 -247 45 -195 11 -1164 11 -1391 0z m1476 -309 c99 -41 123 -161 46 -235 -28 -27 -33 -28 -187 -36 -207 -12 -1045 -12 -1242 0 -111 6 -160 13 -177 24 -80 52 -82 171 -5 228 42 30 203 36 895 34 477 -2 648 -6 670 -15z m-112 -708 c4 -71 9 -447 13 -838 3 -390 9 -753 14 -805 25 -286 156 -666 360 -1050 153 -288 224 -398 880 -1375 560 -834 719 -1079 752 -1152 45 -103 30 -320 -31 -441 -39 -77 -136 -174 -230 -229 l-71 -43 -2335 0 -2336 0 -51 26 c-119 60 -221 164 -275 280 -48 104 -50 333 -3 439 9 22 158 249 330 505 656 976 1029 1542 1136 1720 217 361 345 633 433 919 83 269 82 248 96 1261 7 492 13 896 14 897 4 6 190 9 712 11 l586 2 6 -127z"/><path d="M3649 5689 c-126 -74 -81 -270 66 -286 97 -11 165 45 173 143 4 45 0 60 -19 90 -47 71 -148 95 -220 53z"/><path d="M3875 4624 c-59 -30 -93 -64 -119 -116 -86 -173 39 -382 229 -382 68 0 122 23 185 80 124 112 90 333 -63 409 -41 20 -65 25 -126 25 -49 0 -87 -6 -106 -16z"/><path d="M3410 3667 c-65 -18 -110 -49 -173 -117 -78 -83 -100 -147 -95 -265 5 -104 31 -166 101 -242 103 -112 291 -142 435 -71 58 30 138 116 169 185 89 195 -13 428 -219 497 -67 22 -165 28 -218 13z"/><path d="M4687 2939 c-75 -18 -181 -87 -377 -245 -287 -232 -490 -342 -713 -388 -182 -38 -403 -30 -549 20 -91 31 -222 101 -368 197 -63 41 -134 80 -158 87 -94 25 -173 -11 -257 -117 -69 -88 -822 -1206 -857 -1274 -56 -106 -48 -260 17 -349 14 -19 58 -57 98 -83 l72 -49 2260 4 2260 4 41 21 c53 28 110 92 143 162 22 47 26 70 26 146 l0 90 -69 105 c-193 295 -817 1201 -962 1396 -118 160 -157 196 -255 235 -105 41 -264 59 -352 38z"/></g></svg>`
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
