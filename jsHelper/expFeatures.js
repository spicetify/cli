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
            newFeatures = newFeatures.filter((f) => f !== feature.name);
        }

        localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
        return feature;
    };

    let content = document.createElement("div");
    let style = document.createElement("style");
    style.innerHTML = `
.setting-row::after {
    content: "";
    display: table;
    clear: both;
}
.setting-row {
    display: flex;
    padding: 10px 0;
    align-items: center;
}
.setting-row .col.description {
    float: left;
    padding-right: 15px;
    width: 100%;
}
.setting-row .col.action {
    float: right;
    text-align: right;
}
button.switch {
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
button.switch.disabled,
button.switch[disabled] {
    color: rgba(var(--spice-rgb-text), .3);
}
button.reset {
    font-weight: 700;
    background-color: var(--spice-text);
    color: var(--spice-main);
    border-radius: 500px;
    font-size: inherit;
    padding-block: 12px;
    padding-inline: 32px;
}
button.reset:hover {
    transform: scale(1.04);
}
.search-container {
    width: 100%;
}
.setting-row#search .col.action {
    position: relative;
    width: 100%;
}
.setting-row#search svg {
    position: absolute;
    margin: 12px;
}
input.search {
    border-style: solid;
    border-color: var(--spice-sidebar);
    background-color: var(--spice-sidebar);
    border-radius: 8px;
    padding: 10px 36px;
    color: var(--spice-text);
    width: 100%;
}`;
    content.appendChild(style);

    new Spicetify.Menu.Item("Experimental features", false, () => {
        Spicetify.PopupModal.display({
            title: "Experimental features",
            content,
            isLarge: true,
        });
    }).register();

    (function waitForRemoteConfigResolver() {
        // Don't show options if hooks aren't patched/loaded
        if (!hooksPatched || !Spicetify.RemoteConfigResolver) {
            setTimeout(waitForRemoteConfigResolver, 500);
            return;
        }

        localStorage.removeItem("spicetify-remote-config");

        const { setOverrides, remoteConfiguration } = Spicetify.RemoteConfigResolver.value;

        Object.keys(overrideList).forEach((key) => {
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
<select class="dropdown">
    ${options.map((option) => `<option value="${option}">${option}</option>`).join("")}
</select>
</div>`;
            const dropdown = container.querySelector("select.dropdown");
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
                rows.forEach((row) => {
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

        Object.keys(overrideList).forEach((name) => {
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
