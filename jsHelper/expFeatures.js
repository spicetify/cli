(function() {
    let overrideList;
    try {
        overrideList = JSON.parse(localStorage.getItem("spicetify-exp-features"));
        if (!overrideList || typeof overrideList !== "object") throw "";
    } catch {
        overrideList = {};
    }

    Spicetify.expFeatureOverride = function(feature) {
        if (typeof feature.default === "boolean" &&
            overrideList[feature.name] !== undefined) {
            feature.default = overrideList[feature.name];
        }
        return feature
    }

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
}`;
    content.appendChild(style);

    new Spicetify.Menu.Item("Experimental features", false, () => {
        Spicetify.PopupModal.display({
            title: "Experimental features",
            content
        })
    }).register();

    
    (function waitForRemoteConfigResolver() {
        let resolver = Spicetify.Platform?.RemoteConfigResolver;
        if (!resolver) {
            setTimeout(waitForRemoteConfigResolver, 500);
            return;
        }

        for (const propName in overrideList) {
            resolver.activeProperties[propName].value = overrideList[propName];
        }

        function changeValue(name, value) {
            overrideList[name] = value;
            localStorage.setItem("spicetify-exp-features", JSON.stringify(overrideList));
            resolver.activeProperties[name].value = value;
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
    
            const slider = container.querySelector("button");
            slider.classList.toggle("disabled", !defaultVal);
    
            slider.onclick = () => {
                const state = slider.classList.contains("disabled");
                slider.classList.toggle("disabled");
                changeValue(name, state);
            };
    
            return container;
        }

        for (const propName in resolver.propertySet.properties) {
            const prop = resolver.propertySet.properties[propName].spec;
    
            if (prop.type !== "bool") continue;
    
            content.appendChild(createSlider(
                propName,
                prop.description,
                resolver.activeProperties[propName].value,
            ));
        }
    })();
})();