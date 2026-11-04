SpicetifyHomeConfig = {};

(async () => {
  // Status enum
  const NORMAL = 0;
  const STICKY = 1;
  const LOWERED = 2;
  let sourceSections;
  // List of sections' metadata
  let list;
  // Store sections' statuses
  const statusDic = new Map();

  function getSectionUri(section) {
    return section?.uri ?? section?.item?.uri ?? section?.localItem?.uri;
  }

  function getStoredUris(key) {
    return (localStorage.getItem(key) || "").split(",").filter(Boolean);
  }

  SpicetifyHomeConfig.arrange = (sections) => {
    if (sections === sourceSections) return list;
    sourceSections = sections;

    const sectionsByUri = new Map();
    for (const section of sections) {
      const uri = getSectionUri(section);
      if (uri) sectionsByUri.set(uri, section);
    }

    function claimSections(uris, status) {
      const claimed = [];
      for (const uri of uris) {
        if (!sectionsByUri.has(uri) || statusDic.has(uri)) continue;
        statusDic.set(uri, status);
        claimed.push(sectionsByUri.get(uri));
      }
      return claimed;
    }

    statusDic.clear();
    const stickSections = claimSections(getStoredUris("spicetify-home-config:stick"), STICKY);
    const lowSections = claimSections(getStoredUris("spicetify-home-config:low"), LOWERED);
    const normalSections = sections.filter((section) => !statusDic.has(getSectionUri(section)));
    list = [...stickSections, ...normalSections, ...lowSections];
    return list;
  };

  const up = document.createElement("button");
  up.innerText = "Up";
  const down = document.createElement("button");
  down.innerText = "Down";
  const lower = document.createElement("button");
  const stick = document.createElement("button");
  const sectionStyle = document.createElement("style");
  sectionStyle.innerHTML = `
:is(.main-gridContainer-homepageContent, .main-home-content) section {
	order: 0 !important;
}
`;
  const containerStyle = document.createElement("style");
  containerStyle.innerHTML = `
#spicetify-home-config {
    position: relative;
    width: 100%;
    height: 0;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    gap: 5px;
    z-index: 9999;
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
  container.append(containerStyle, up, down, lower, stick);
  document.head.append(sectionStyle);
  let interactionController;

  function injectInteraction() {
    const main = document.querySelector(".main-gridContainer-homepageContent, .main-home-content");
    if (!main || !list) return;
    removeInteraction();
    interactionController = new AbortController();
    let elem = [];

    function syncElements() {
      elem = [...main.querySelectorAll(":scope > section")].slice(0, list.length);
      for (const [index, item] of elem.entries()) {
        const uri = getSectionUri(list[index]);
        if (uri) item.dataset.uri = uri;
      }
    }

    function indexOfUri(uri) {
      return list.findIndex((section) => getSectionUri(section) === uri);
    }

    function persistOrder() {
      const uris = list.map(getSectionUri);
      localStorage.setItem(
        "spicetify-home-config:stick",
        uris.filter((uri) => statusDic.get(uri) === STICKY),
      );
      localStorage.setItem(
        "spicetify-home-config:low",
        uris.filter((uri) => statusDic.get(uri) === LOWERED),
      );
    }

    function reorderElements() {
      const domIndex = new Map(elem.map((element, index) => [element, index]));
      const listIndex = new Map(list.map((section, index) => [getSectionUri(section), index]));
      const rank = (element) => listIndex.get(element.dataset.uri) ?? domIndex.get(element);
      elem.sort((a, b) => rank(a) - rank(b));
      main.append(...elem);
    }

    function reorderSections() {
      const statusOf = (section) => statusDic.get(getSectionUri(section));
      const sticky = list.filter((section) => statusOf(section) === STICKY);
      const lowered = list.filter((section) => statusOf(section) === LOWERED);
      const normal = sourceSections.filter((section) => !statusOf(section));
      list = [...sticky, ...normal, ...lowered];
      persistOrder();
      reorderElements();
    }

    function onSwap(item, dir) {
      container.remove();
      const curPos = indexOfUri(item.dataset.uri);
      const newPos = curPos + dir;
      if (newPos < 0 || newPos > list.length - 1) return;

      [list[curPos], list[newPos]] = [list[newPos], list[curPos]];
      persistOrder();
      reorderElements();
    }

    function onChangeStatus(item, status) {
      container.remove();
      const isToggle = statusDic.get(item.dataset.uri) === status;
      statusDic.set(item.dataset.uri, isToggle ? NORMAL : status);
      reorderSections();
    }

    function handleMouseOver(event) {
      if (!(event.target instanceof Element)) return;
      const el = event.target.closest("section");
      if (!el || el.parentElement !== main || container.parentElement === el) return;
      syncElements();
      const { uri } = el.dataset;
      if (!uri) return;

      const status = statusDic.get(uri);
      const index = indexOfUri(uri);
      const neighborStatus = (dir) => statusDic.get(getSectionUri(list[index + dir]));

      up.disabled = !status || neighborStatus(-1) !== status;
      down.disabled = !status || neighborStatus(1) !== status;
      up.onclick = () => onSwap(el, -1);
      down.onclick = () => onSwap(el, 1);
      stick.innerText = status === STICKY ? "Unstick" : "Stick";
      lower.innerText = status === LOWERED ? "Unlower" : "Lower";
      lower.onclick = () => onChangeStatus(el, LOWERED);
      stick.onclick = () => onChangeStatus(el, STICKY);
      el.prepend(container);
    }

    syncElements();
    main.addEventListener("mouseover", handleMouseOver, { signal: interactionController.signal });
  }

  function removeInteraction() {
    container.remove();
    interactionController?.abort();
  }

  await new Promise((res) => Spicetify.Events.webpackLoaded.on(res));

  SpicetifyHomeConfig.menu = new Spicetify.Menu.Item(
    "Home config",
    false,
    (self) => {
      self.setState(!self.isEnabled);
      if (self.isEnabled) {
        injectInteraction();
      } else {
        removeInteraction();
      }
    },
    Spicetify.SVGIcons["grid-view"],
  );

  SpicetifyHomeConfig.addToMenu = () => {
    SpicetifyHomeConfig.menu.register();
  };
  SpicetifyHomeConfig.removeMenu = () => {
    SpicetifyHomeConfig.menu.setState(false);
    SpicetifyHomeConfig.menu.deregister();
  };

  await new Promise((res) => Spicetify.Events.platformLoaded.on(res));
  if (Spicetify.Platform.History.location.pathname === "/") SpicetifyHomeConfig.addToMenu();

  Spicetify.Platform.History.listen(({ pathname }) => {
    if (pathname === "/") {
      SpicetifyHomeConfig.addToMenu();
    } else {
      SpicetifyHomeConfig.removeMenu();
    }
  });
})();
