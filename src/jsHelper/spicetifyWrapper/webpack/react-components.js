import { fnStr } from "../shared/string.js";
import { findCards } from "./cards.js";
import { findDropdownComponent, wrapProvider } from "./component-resolvers.js";
import { findMenuOverrides, findMenus } from "./menus.js";

function findNavigationComponent({ require, exportedMemoFRefs }) {
  try {
    const navModuleEntry = Object.entries(require.m).find(
      ([, value]) => fnStr(value).includes("navigationalRoot") && fnStr(value).includes("noLink"),
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
    Menu: functionModules.find((m) => fnStr(m).includes("getInitialFocusElement") && fnStr(m).includes("children")),
    MenuItem:
      functionModules.find((m) => fnStr(m).includes("handleMouseEnter") && fnStr(m).includes("onClick") && fnStr(m).includes("menuItemButton")) ??
      functionModules.find((m) => fnStr(m).includes("handleMouseEnter") && fnStr(m).includes("onClick")),
    MenuSubMenuItem: functionModules.find((f) => fnStr(f).includes("subMenuIcon")),
    Slider: wrapProvider(functionModules.find((m) => fnStr(m).includes("progressBarRef"))),
    RemoteConfigProvider: functionModules.find((m) => fnStr(m).includes("resolveSuspense") && fnStr(m).includes("configuration")),
    RightClickMenu: functionModules.find(
      (m) => fnStr(m).includes("action") && fnStr(m).includes("open") && fnStr(m).includes("trigger") && fnStr(m).includes("right-click"),
    ),
    TooltipWrapper: functionModules.find((m) => fnStr(m).includes("renderInline") && fnStr(m).includes("showDelay")),
    ButtonPrimary: reactComponentsUI.ButtonPrimary,
    ButtonSecondary: reactComponentsUI.ButtonSecondary,
    ButtonTertiary: reactComponentsUI.ButtonTertiary,
    Snackbar: {
      wrapper: functionModules.find((m) => fnStr(m).includes("encore-light-theme") && fnStr(m).includes("elevated")),
      simpleLayout: functionModules.find((m) => ["leading", "center", "trailing"].every((keyword) => fnStr(m).includes(keyword))),
      ctaText: functionModules.find((m) => fnStr(m).includes("ctaText")),
      styledImage: functionModules.find((m) => fnStr(m).includes("placeholderSrc")),
    },
    Chip: reactComponentsUI.Chip,
    Dropdown: reactComponentsUI.Dropdown ?? findDropdownComponent({ modules, chunks, require }),
    Toggle: functionModules.find((m) => fnStr(m).includes("onSelected") && fnStr(m).includes('type:"checkbox"')),
    Cards: {
      Default: reactComponentsUI.Card,
      FeatureCard: functionModules.find(
        (m) => fnStr(m).includes("?highlight") && fnStr(m).includes("headerText") && fnStr(m).includes("imageContainer"),
      ),
      Hero: functionModules.find((m) => fnStr(m).includes('"herocard-click-handler"')),
      CardImage: functionModules.find(
        (m) =>
          fnStr(m).includes("isHero") && (fnStr(m).includes("withWaves") || fnStr(m).includes("isCircular")) && fnStr(m).includes("imageWrapper"),
      ),
      ...Object.fromEntries(findCards({ modules, functionModules })),
    },
    Router: functionModules.find((m) => fnStr(m).includes("navigationType") && fnStr(m).includes("static")),
    Routes: functionModules.find((m) => fnStr(m).match(/\([\w$]+\)\{let\{children:[\w$]+,location:[\w$]+\}=[\w$]+/)),
    Route: functionModules.find((m) => fnStr(m).match(/^function [\w$]+\([\w$]+\)\{\(0,[\w$]+\.[\w$]+\)\(!1\)\}$/)),
    StoreProvider: functionModules.find((m) => fnStr(m).includes("notifyNestedSubs") && fnStr(m).includes("serverState")),
    ScrollableContainer: scrollableContainer,
    IconComponent: reactComponentsUI.Icon,
    Navigation: findNavigationComponent({ require, exportedMemoFRefs }),
    ...Object.fromEntries(findMenus(modules)),
    ...Object.fromEntries(findMenuOverrides(exportedMemos)),
  };
}
