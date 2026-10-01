import { fnStr } from "../shared/string.js";
import { cardName, findCards, lazyCardTypes } from "./cards.js";
import { findDropdownComponent, wrapProvider } from "./component-resolvers.js";
import { createModuleInventoryScanner } from "./module-inventory.js";

const LATE_COMPONENTS = ["Slider", "Dropdown", "Toggle", "Cards.Artist", "Cards.Audiobook", "Cards.Profile", "Cards.Show", "Cards.Track"];

function hasComponent(component) {
  return component.split(".").reduce((owner, key) => owner?.[key], Spicetify.ReactComponent) !== undefined;
}

function hasLateComponents() {
  return LATE_COMPONENTS.every(hasComponent);
}

export function waitForLateComponents({ require, refreshNavLinks }) {
  const inventory = createModuleInventoryScanner();

  (function waitForChunks(attempt = 0) {
    if (hasLateComponents()) return;

    const { chunks: newChunks, modules: newModules, functionModules: newFunctionModules } = inventory.scan(require);

    const remainingCardTypes = lazyCardTypes.filter((type) => Spicetify.ReactComponent.Cards[cardName(type)] === undefined);
    if (remainingCardTypes.length) {
      Object.assign(
        Spicetify.ReactComponent.Cards,
        Object.fromEntries(findCards({ modules: newModules, functionModules: newFunctionModules }, remainingCardTypes)),
      );
    }

    const reactComponent = /** @type {Writable<typeof Spicetify.ReactComponent>} */ (Spicetify.ReactComponent);
    if (!Spicetify.ReactComponent.Slider) reactComponent.Slider = wrapProvider(newFunctionModules.find((m) => fnStr(m).includes("progressBarRef")));
    if (!Spicetify.ReactComponent.Toggle)
      reactComponent.Toggle = newFunctionModules.find((m) => fnStr(m).includes("onSelected") && fnStr(m).includes('type:"checkbox"'));
    if (!Spicetify.ReactComponent.Dropdown) reactComponent.Dropdown = findDropdownComponent({ modules: newModules, chunks: newChunks, require });
    if (!Spicetify.ReactComponent.Toggle) {
      const toggleChunk = newChunks.find(([, value]) => fnStr(value).includes("onSelected") && fnStr(value).includes('type:"checkbox"'));
      if (toggleChunk) {
        reactComponent.Toggle = Object.values(require(toggleChunk[0]))[0].render;
      }
    }

    if (!hasLateComponents()) {
      setTimeout(() => waitForChunks(attempt + 1), Math.min(100 * 2 ** Math.min(attempt, 4), 1000));
      return;
    }

    if (Spicetify.ReactComponent.ScrollableContainer) setTimeout(() => refreshNavLinks?.(), 100);
  })();
}
