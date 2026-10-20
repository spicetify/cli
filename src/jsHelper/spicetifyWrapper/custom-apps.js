import { createIconComponent } from "./icons.js";

let navLinkFactoryCtx = null;
const navLinkRefreshers = new Set();

export function refreshNavLinks() {
  for (const refresh of navLinkRefreshers) refresh();
}

const manifestCache = new Map();

function getManifest(app) {
  if (manifestCache.has(app)) return manifestCache.get(app);

  manifestCache.set(app, {});
  fetch(`spicetify-routes-${app}.json`)
    .then((res) => res.json())
    .then((manifest) => {
      manifestCache.set(app, manifest);
      refreshNavLinks();
    })
    .catch(() => {
      // Keep the {} placeholder already cached
    });

  return {};
}

Spicetify._renderNavLinks = (list, isTouchScreenUi) => {
  if (!Spicetify.React?.createElement) return null;
  return Spicetify.React.createElement(NavLinksRenderer, { list, isTouchScreenUi });
};

function NavLinksRenderer({ list, isTouchScreenUi }) {
  const react = Spicetify.React;
  const [, refresh] = react.useReducer((x) => x + 1, 0);
  react.useLayoutEffect(() => {
    navLinkRefreshers.add(refresh);
    return () => navLinkRefreshers.delete(refresh);
  }, [refresh]);

  if (
    !Spicetify.ReactComponent.ButtonTertiary ||
    !Spicetify.ReactComponent.Navigation ||
    !Spicetify.ReactComponent.TooltipWrapper ||
    !Spicetify.ReactComponent.ScrollableContainer ||
    !Spicetify.Platform.History ||
    !Spicetify.Platform.LocalStorageAPI
  )
    return null;

  const navLinkFactory = isTouchScreenUi ? NavLinkGlobal : NavLinkSidebar;

  if (!navLinkFactoryCtx) navLinkFactoryCtx = react.createContext(null);
  const registered = [];

  for (const app of list) {
    const manifest = getManifest(app);

    let appProper = manifest.name;
    if (typeof appProper === "object") {
      appProper = appProper[Spicetify.Locale?.getLocale()] || appProper.en;
    }
    if (!appProper) {
      appProper = app[0].toUpperCase() + app.slice(1);
    }
    const icon = manifest.icon || "";
    const activeIcon = manifest["active-icon"] || icon;
    const appRoutePath = `/${app}`;
    registered.push({ appProper, appRoutePath, icon, activeIcon });
  }

  (function addStyling() {
    if (document.querySelector("style.spicetify-navlinks")) return;
    const style = document.createElement("style");
    style.className = "spicetify-navlinks";
    style.innerHTML = `
	:root {
		--max-custom-navlink-count: 4;
	}

	.custom-navlinks-scrollable_container {
		max-width: calc(48px * var(--max-custom-navlink-count) + 8px * (var(--max-custom-navlink-count) - 1));
		-webkit-app-region: no-drag;
	}

	.custom-navlinks-scrollable_container div[role="presentation"] > *:not(:last-child) {
		margin-inline-end: 8px;
	}

	.custom-navlinks-scrollable_container div[role="presentation"] {
		display: flex;
		flex-direction: row;
	}

	.custom-navlink {
		-webkit-app-region: unset;
	}
		`;
    document.head.appendChild(style);
  })();

  const navLinks = react.createElement(
    navLinkFactoryCtx.Provider,
    { value: navLinkFactory },
    registered.map((NavLinkElement) => react.createElement(NavLink, NavLinkElement, null)),
  );

  if (!isTouchScreenUi) return navLinks;
  return react.createElement(
    "div",
    { className: "custom-navlinks-scrollable_container" },
    react.createElement(Spicetify.ReactComponent.ScrollableContainer, null, navLinks),
  );
}

const NavLink = ({ appProper, appRoutePath, icon, activeIcon }) => {
  const isActive = Spicetify.Platform.History.location.pathname?.startsWith(appRoutePath);
  const createIcon = () => createIconComponent(isActive ? activeIcon : icon, 24);

  const NavLinkFactory = Spicetify.React.useContext(navLinkFactoryCtx);

  return NavLinkFactory && Spicetify.React.createElement(NavLinkFactory, { appProper, appRoutePath, createIcon, isActive }, null);
};

const NavLinkSidebar = ({ appProper, appRoutePath, createIcon, isActive }) => {
  const isSidebarCollapsed = Spicetify.Platform.LocalStorageAPI.getItem("ylx-sidebar-state") === 1;

  return Spicetify.React.createElement(
    "li",
    { className: "main-yourLibraryX-navItem InvalidDropTarget" },
    Spicetify.React.createElement(
      Spicetify.ReactComponent.TooltipWrapper,
      { label: isSidebarCollapsed ? appProper : null, disabled: !isSidebarCollapsed, placement: "right" },
      Spicetify.React.createElement(
        Spicetify.ReactComponent.Navigation,
        {
          to: appRoutePath,
          referrer: "other",
          className: Spicetify.classnames("link-subtle", "main-yourLibraryX-navLink", {
            "main-yourLibraryX-navLinkActive": isActive,
          }),
          onClick: () => undefined,
          "aria-label": appProper,
        },
        createIcon(),
        !isSidebarCollapsed && Spicetify.React.createElement(Spicetify.ReactComponent.TextComponent, { variant: "balladBold" }, appProper),
      ),
    ),
  );
};

const NavLinkGlobal = ({ appProper, appRoutePath, createIcon, isActive }) => {
  return Spicetify.React.createElement(
    Spicetify.ReactComponent.TooltipWrapper,
    { label: appProper },
    Spicetify.React.createElement(Spicetify.ReactComponent.ButtonTertiary, {
      iconOnly: createIcon,
      className: Spicetify.classnames("link-subtle", "main-globalNav-navLink", "main-globalNav-link-icon", "custom-navlink", {
        "main-globalNav-navLinkActive": isActive,
      }),
      "aria-label": appProper,
      onClick: () => Spicetify.Platform.History.push(appRoutePath),
    }),
  );
};
