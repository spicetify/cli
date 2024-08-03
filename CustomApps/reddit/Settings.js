let configContainer;

function openConfig() {
	if (configContainer) {
		Spicetify.PopupModal.display({
			title: "Reddit",
			content: configContainer,
		});
		return;
	}

	CONFIG.servicesElement = {};

	configContainer = document.createElement("div");
	configContainer.id = "reddit-config-container";

	const optionHeader = document.createElement("h2");
	optionHeader.innerText = "Options";

	const serviceHeader = document.createElement("h2");
	serviceHeader.innerText = "Subreddits";

	const serviceContainer = document.createElement("div");

	function stackServiceElements() {
		CONFIG.services.forEach((name, index) => {
			const el = CONFIG.servicesElement[name];

			const [up, down] = el.querySelectorAll("button");
			if (CONFIG.services.length === 1) {
				up.disabled = true;
				down.disabled = true;
			} else if (index === 0) {
				up.disabled = true;
				down.disabled = false;
			} else if (index === CONFIG.services.length - 1) {
				up.disabled = false;
				down.disabled = true;
			} else {
				up.disabled = false;
				down.disabled = false;
			}

			serviceContainer.append(el);
		});
		gridUpdateTabs?.();
	}

	function posCallback(el, dir) {
		const id = el.dataset.id;
		const curPos = CONFIG.services.findIndex((val) => val === id);
		const newPos = curPos + dir;

		if (CONFIG.services.length > 1) {
			const temp = CONFIG.services[newPos];
			CONFIG.services[newPos] = CONFIG.services[curPos];
			CONFIG.services[curPos] = temp;
		}

		localStorage.setItem("reddit:services", JSON.stringify(CONFIG.services));

		stackServiceElements();
	}

	function removeCallback(el) {
		const id = el.dataset.id;
		CONFIG.services = CONFIG.services.filter((s) => s !== id);
		CONFIG.servicesElement[id].remove();

		localStorage.setItem("reddit:services", JSON.stringify(CONFIG.services));

		stackServiceElements();
	}

	for (const name of CONFIG.services) {
		CONFIG.servicesElement[name] = createServiceOption(name, posCallback, removeCallback);
	}
	stackServiceElements();

	const serviceInput = document.createElement("input");
	serviceInput.placeholder = "Add new subreddit";
	serviceInput.onkeydown = (event) => {
		if (event.key !== "Enter") {
			return;
		}
		event.preventDefault();
		const name = serviceInput.value;

		if (!CONFIG.services.includes(name)) {
			CONFIG.services.push(name);
			CONFIG.servicesElement[name] = createServiceOption(name, posCallback, removeCallback);
			localStorage.setItem("reddit:services", JSON.stringify(CONFIG.services));
		}

		stackServiceElements();
		serviceInput.value = "";
		const parent = configContainer.parentElement.parentElement;
		parent.scrollTo(0, parent.scrollHeight);
	};

	configContainer.append(
		optionHeader,
		createSlider("Upvotes count", "upvotes"),
		createSlider("Followers count", "followers"),
		createSlider("Post type", "type"),
		createSlider("Long description", "longDescription"),
		serviceHeader,
		serviceContainer,
		serviceInput
	);

	Spicetify.PopupModal.display({
		title: "Reddit",
		content: configContainer,
	});
}

function createSlider(name, key) {
	const container = document.createElement("div");
	container.innerHTML = `
<div class="setting-row">
    <label class="col description">${name}</label>
    <div class="col action"><button class="switch">
        <svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">
            ${Spicetify.SVGIcons.check}
        </svg>
    </button></div>
</div>`;

	const slider = container.querySelector("button");
	slider.classList.toggle("disabled", !CONFIG.visual[key]);

	slider.onclick = () => {
		const state = !slider.classList.toggle("disabled");
		CONFIG.visual[key] = state;
		localStorage.setItem(`reddit:${key}`, String(state));
		gridUpdatePostsVisual?.();
	};

	return container;
}

function createServiceOption(id, posCallback, removeCallback) {
	const container = document.createElement("div");
	container.dataset.id = id;
	container.innerHTML = `
<div class="setting-row">
    <h3 class="col description">${id}</h3>
    <div class="col action">
        <button class="switch small">
            <svg height="10" width="10" viewBox="0 0 16 16" fill="currentColor">
                ${Spicetify.SVGIcons["chart-up"]}
            </svg>
        </button>
        <button class="switch small">
            <svg height="10" width="10" viewBox="0 0 16 16" fill="currentColor">
                ${Spicetify.SVGIcons["chart-down"]}
            </svg>
        </button>
        <button class="switch small">
            <svg height="10" width="10" viewBox="0 0 16 16" fill="currentColor">
                ${Spicetify.SVGIcons.x}
            </svg>
        </button>
    </div>
</div>`;

	const [up, down, remove] = container.querySelectorAll("button");

	up.onclick = () => posCallback(container, -1);
	down.onclick = () => posCallback(container, 1);
	remove.onclick = () => removeCallback(container);

	return container;
}
