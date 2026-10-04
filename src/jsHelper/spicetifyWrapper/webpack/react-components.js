import { fnStr } from "../shared/string.js";
import { findCards } from "./cards.js";
import { findDropdownComponent, wrapProvider } from "./component-resolvers.js";
import { findMenuOverrides, findMenus } from "./menus.js";
import { getObjectValues } from "./module-inventory.js";

function findNavigationComponent({ require, exportedMemoFRefs }) {
  try {
    const navModuleEntry = Object.entries(require.m).find(([, value]) =>
      ["navigationalRoot", "noLink"].every((marker) => fnStr(value).includes(marker)),
    );
    if (navModuleEntry) {
      const Logo = require(navModuleEntry[0])?.A;
      if (typeof Logo === "function") {
        const element = Logo({ customLink: "/", noLink: false, hasText: false });
        if (element?.type) return element.type;
      }
    }

    return exportedMemoFRefs.find((m) => fnStr(m.type?.render).includes("navigationalRoot"));
  } catch {
    return undefined;
  }
}

function findModernMenuSubMenuItem({ chunks, require }) {
  const matchingChunks = chunks.filter(([, value]) =>
    ["subMenuIcon", "focusTransferKey", "disableV2LeadingSlot"].every((marker) => fnStr(value).includes(marker)),
  );
  if (matchingChunks.length !== 1) return undefined;

  const functionExports = getObjectValues(require(matchingChunks[0][0])).filter((value) => typeof value === "function");
  return functionExports.length === 1 ? functionExports[0] : undefined;
}

export function createReactComponents({
  modules,
  functionModules,
  chunks,
  require,
  exportedMemos,
  exportedMemoFRefs,
  reactComponentsUI,
  scrollableContainer,
}) {
  return {
    ...Spicetify.ReactComponent,
    TextComponent: modules.find((m) => m?.h1 && m?.render),
    Menu: functionModules.find((m) => ["getInitialFocusElement", "children"].every((marker) => fnStr(m).includes(marker))),
    MenuItem:
      functionModules.find((m) => ["forceV2LeadingIcon", "showFullTextOnHover", "menuAction"].every((marker) => fnStr(m).includes(marker))) ??
      functionModules.find((m) => ["handleMouseEnter", "onClick", "menuItemButton"].every((marker) => fnStr(m).includes(marker))) ??
      functionModules.find((m) => ["handleMouseEnter", "onClick"].every((marker) => fnStr(m).includes(marker))),
    MenuSubMenuItem: findModernMenuSubMenuItem({ chunks, require }) ?? functionModules.find((f) => fnStr(f).includes("subMenuIcon")),
    Slider: wrapProvider(functionModules.find((m) => fnStr(m).includes("progressBarRef"))),
    RemoteConfigProvider: functionModules.find((m) => ["resolveSuspense", "configuration"].every((marker) => fnStr(m).includes(marker))),
    RightClickMenu: functionModules.find((m) => ["action", "open", "trigger", "right-click"].every((marker) => fnStr(m).includes(marker))),
    TooltipWrapper: functionModules.find((m) => ["renderInline", "showDelay"].every((marker) => fnStr(m).includes(marker))),
    ButtonPrimary: reactComponentsUI.ButtonPrimary,
    ButtonSecondary: reactComponentsUI.ButtonSecondary,
    ButtonTertiary: reactComponentsUI.ButtonTertiary,
    Snackbar: {
      wrapper: functionModules.find((m) => ["encore-light-theme", "elevated"].every((marker) => fnStr(m).includes(marker))),
      simpleLayout: functionModules.find((m) => ["leading", "center", "trailing"].every((keyword) => fnStr(m).includes(keyword))),
      ctaText: functionModules.find((m) => fnStr(m).includes("ctaText")),
      styledImage: functionModules.find((m) => fnStr(m).includes("placeholderSrc")),
    },
    Chip: reactComponentsUI.Chip,
    Dropdown: reactComponentsUI.Dropdown ?? findDropdownComponent({ modules, chunks, require }),
    Toggle: functionModules.find((m) => ["onSelected", 'type:"checkbox"'].every((marker) => fnStr(m).includes(marker))),
    Cards: {
      Default: reactComponentsUI.Card,
      FeatureCard: functionModules.find((m) => ["?highlight", "headerText", "imageContainer"].every((marker) => fnStr(m).includes(marker))),
      Hero: functionModules.find((m) => fnStr(m).includes('"herocard-click-handler"')),
      CardImage: functionModules.find(
        (m) =>
          ["isHero", "imageWrapper"].every((marker) => fnStr(m).includes(marker)) &&
          (fnStr(m).includes("withWaves") || fnStr(m).includes("isCircular")),
      ),
      ...Object.fromEntries(findCards({ modules, functionModules })),
    },
    Router: functionModules.find((m) => ["navigationType", "static"].every((marker) => fnStr(m).includes(marker))),
    Routes: functionModules.find((m) => fnStr(m).match(/\([\w$]+\)\{let\{children:[\w$]+,location:[\w$]+\}=[\w$]+/)),
    Route: functionModules.find((m) => fnStr(m).match(/^function [\w$]+\([\w$]+\)\{\(0,[\w$]+\.[\w$]+\)\(!1\)\}$/)),
    StoreProvider: functionModules.find((m) => ["notifyNestedSubs", "serverState"].every((marker) => fnStr(m).includes(marker))),
    ScrollableContainer: scrollableContainer,
    IconComponent: reactComponentsUI.Icon,
    Navigation: findNavigationComponent({ require, exportedMemoFRefs }),
    ...Object.fromEntries(findMenus(modules)),
    ...Object.fromEntries(findMenuOverrides(exportedMemos)),
  };
}
