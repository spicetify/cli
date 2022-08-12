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
            const notice = document.createElement("p");
            notice.style.cssText = "font-weight: bold;";
            notice.textContent = "Spotify version mismatch. Reload Spotify to apply new changes.";
            content.insertBefore(notice, content.firstChild);

            newFeatures.push(feature.name);
            localStorage.setItem("spicetify-exp-features:update", JSON.stringify(newFeatures));
            overrideList.version = SpotifyVersion;
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
    box-sizing: border-box;
    font-family:
      var(--font-family, spotify-circular),
      Helvetica,
      Arial,
      sans-serif;
    -webkit-tap-highlight-color: transparent;
    font-size: 1rem;
    line-height: 1.5rem;
    font-weight: 700;
    background-color: transparent;
    border: 0px;
    border-radius: 500px;
    display: inline-block;
    position: relative;
    text-align: center;
    text-decoration: none;
    text-transform: none;
    touch-action: manipulation;
    transition-duration: 33ms;
    transition-property:
      background-color,
      border-color,
      color,
      box-shadow,
      filter,
      transform;
    -webkit-user-select: none;
    -moz-user-select: none;
    user-select: none;
    vertical-align: middle;
    transform: translate3d(0px, 0px, 0px);
    padding: 0px;
    min-inline-size: 0px;
    align-self: center;
    position: relative;
    background-color: var(--spice-text);
    color: var(--spice-main);
    border-radius: 500px;
    font-size: inherit;
    padding-block: 12px;
    padding-inline: 32px;
}
@media screen and (min-width: 768px) {
    .button.reset {
      font-size: 1rem;
      line-height: 1.5rem;
      text-transform: none;
      letter-spacing: normal;
    }
}
button.reset:hover {
    transform: scale(1.04);
}`;
    content.appendChild(style);

    new Spicetify.Menu.Item("Experimental features", false, () => {
        Spicetify.PopupModal.display({
            title: "Experimental features",
            content,
        }),
            (() => {
                const resetButton = document.querySelector("button.reset");
                if (resetButton)
                    resetButton.onclick = () => {
                        localStorage.removeItem("spicetify-exp-features");
                        window.location.reload();
                    };

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
        /* let resolver = Spicetify.Platform?.RemoteConfigResolver;
        if (!resolver) {
            setTimeout(waitForRemoteConfigResolver, 500);
            return;
        } */

        Object.keys(overrideList).forEach((key, index) => {
            if (newFeatures.length > 0 && !newFeatures.includes(key) && key !== "version") {
                console.log(key);
                delete overrideList[key];
                overrideList.version = SpotifyVersion;
                localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
            }
            if (index === Object.keys(overrideList).length - 1) {
                newFeatures = [];
                localStorage.removeItem("spicetify-exp-features:update");
            }
        });

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

        // Just in case
        content.innerHTML += `<p class="placeholder">Experimental features not found/is initializing. Try re-opening this modal.</p>`;

        let expFeaturesLength = 0;
        (function showOptions() {
            // Don't show options if hooks aren't patched/loaded
            if (!hooksPatched) {
                setTimeout(showOptions, 500);
                return;
            }
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
                    content.appendChild(settingRow);
                }
            });
        })();
    })();
})();
