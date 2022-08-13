(function () {
    let overrideList,
        newFeatures,
        hooksPatched = false;
    try {
        overrideList = JSON.parse(localStorage.getItem("spicetify-exp-features"));
        if (!overrideList || overrideList !== Object(overrideList)) throw "";
    } catch {
        overrideList = {};
    }

    try {
        newFeatures = JSON.parse(localStorage.getItem("spicetify-exp-features:update"));
        if (!newFeatures || newFeatures !== Object(newFeatures)) throw "";
    } catch {
        newFeatures = [];
    }

    const SpotifyVersion = navigator.userAgent.match("Spotify/(.+) ")[1];

    Spicetify.expFeatureOverride = function (feature) {
        hooksPatched = true;
        if (!overrideList.version) overrideList.version = SpotifyVersion;

        if (overrideList.version !== SpotifyVersion) {
            newFeatures.push(feature.name);
            localStorage.setItem("spicetify-exp-features:update", JSON.stringify(newFeatures));
        }

        if (typeof feature.default === "boolean") {
            if (overrideList[feature.name] === undefined) {
                overrideList[feature.name] = { description: feature.description, value: feature.default };
            }
            feature.default = overrideList[feature.name].value;
            localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
        }
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
}`;
    content.appendChild(style);
    content.innerHTML += `<p class="placeholder">Experimental features not found/is initializing. Try re-opening this modal.</p>`;

    new Spicetify.Menu.Item("Experimental features", false, () => {
        Spicetify.PopupModal.display({
            title: "Experimental features",
            content,
        }),
            (() => {
                const closeButton = document.querySelector("body > generic-modal button.main-trackCreditsModal-closeBtn");
                const modalOverlay = document.querySelector("body > generic-modal > div");
                if (closeButton && modalOverlay) {
                    closeButton.onclick = () => location.reload();
                    closeButton.setAttribute("style", "cursor: pointer;");
                    modalOverlay.onclick = (e) => {
                        // If clicked on overlay, also reload
                        if (e.target === modalOverlay) {
                            location.reload();
                        }
                    };
                }
            })();
    }).register();

    (function waitForRemoteConfigResolver() {
        // Don't show options if hooks aren't patched/loaded
        if (!hooksPatched) {
            setTimeout(waitForRemoteConfigResolver, 500);
            return;
        }

        const listLength = Object.keys(overrideList).length - 1;
        Object.keys(overrideList).forEach((key, index) => {
            if (newFeatures.length > 0 && !newFeatures.includes(key) && key !== "version") {
                delete overrideList[key];
                console.log(`Removed ${key} from override list`);
                localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
            }
            if (index === listLength) {
                newFeatures = [];
                localStorage.removeItem("spicetify-exp-features:update");
            }
        });

        if (overrideList.version !== SpotifyVersion) {
            overrideList.version = SpotifyVersion;
            localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
        }

        function changeValue(name, value) {
            overrideList[name].value = value;
            localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
            // resolver.activeProperties[name].value = value;
        }

        function createSlider(name, desc, defaultVal) {
            const container = document.createElement("div");
            container.classList.add("setting-row");
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

        let expFeaturesLength = 0;

        Object.keys(overrideList).forEach((name) => {
            const feature = overrideList[name];
            content.querySelector("p.placeholder")?.remove();
            expFeaturesLength++;

            if (overrideList[name]?.description === undefined) return;

            content.appendChild(createSlider(name, feature.description, feature.value));

            if (expFeaturesLength === Object.keys(overrideList).length) {
                const settingRow = document.createElement("div");
                settingRow.classList.add("setting-row");
                settingRow.innerHTML += `
                    <label class="col description">Clear all cached features and preferences</label>
                    <div class="col action">
                        <button class="reset">Reset</button>
                    </div>`;
                const resetButton = settingRow.querySelector("button.reset");
                resetButton.onclick = () => {
                    localStorage.removeItem("spicetify-exp-features");
                    window.location.reload();
                };
                content.appendChild(settingRow);
            }
        });
    })();
})();
