import { createIconComponent } from "./icons.js";

Spicetify.ContextMenuV2 = (() => {
  const registeredItems = new Map();
  const registeredItemsListeners = new Set();
  let nextItemId = 0;

  function createLeadingIconProps(icon) {
    if (!icon) return {};

    const leadingIcon = createIconComponent(icon);

    // V2 renders leading icons only for allowlisted menu actions
    return {
      leadingIcon,
      v2LeadingIcon: leadingIcon,
      menuAction: "add-to-library",
      forceV2LeadingIcon: true,
    };
  }

  // Setters skip unchanged values: shouldAdd callbacks run while the menu renders, and a notification there
  // re-renders the menu, so assigning the same label from shouldAdd would loop.
  function notifyItemsChanged() {
    for (const listener of registeredItemsListeners) listener();
  }

  /** @returns {[uris: string[], uids: string[] | undefined, contextUri: string | undefined] | undefined} */
  function parseProps(props) {
    if (!props) return;

    const uri = props.uri ?? props.item?.uri ?? props.reference?.uri;
    const uris = props.uris ?? (uri ? [uri] : undefined);
    if (!uris) return;

    const uid = props.uid ?? props.item?.uid;
    const uids = props.uids ?? (uid ? [uid] : undefined);

    const contextUri = props.contextUri ?? props.context?.uri;

    return [uris, uids, contextUri];
  }

  function ContextProvider({ children }) {
    const { React, ContextMenuV2 } = Spicetify;
    // The patched menu code that renders this provider creates the context first.
    const menuContext = /** @type {NonNullable<typeof ContextMenuV2._context>} */ (ContextMenuV2._context);
    const context = React.useContext(menuContext);
    return React.createElement(menuContext.Provider, { value: { ...context, props: children.props } }, children);
  }

  class Item {
    constructor({ children, disabled = false, leadingIcon, trailingIcon, divider, onClick, shouldAdd = () => true }) {
      this.shouldAdd = shouldAdd;
      this._key = `spicetify-context-menu-item-${nextItemId++}`;
      this._children = children;
      this._disabled = disabled;
      this._leadingIcon = leadingIcon;
      this._trailingIcon = trailingIcon;
      this._divider = divider;
      this._onClick = onClick;
    }

    _render(context) {
      return Spicetify.React.createElement(
        Spicetify.ReactComponent.MenuItem,
        {
          key: this._key,
          disabled: this._disabled,
          divider: this._divider,
          onClick: (event) => this._onClick(context, this, event),
          ...createLeadingIconProps(this._leadingIcon),
          trailingIcon: this._trailingIcon && createIconComponent(this._trailingIcon),
        },
        this._children,
      );
    }

    set children(children) {
      if (this._children === children) return;
      this._children = children;
      notifyItemsChanged();
    }
    get children() {
      return this._children;
    }

    set disabled(bool) {
      if (this._disabled === bool) return;
      this._disabled = bool;
      notifyItemsChanged();
    }
    get disabled() {
      return this._disabled;
    }

    set leadingIcon(name) {
      if (this._leadingIcon === name) return;
      this._leadingIcon = name;
      notifyItemsChanged();
    }
    get leadingIcon() {
      return this._leadingIcon;
    }

    set trailingIcon(name) {
      if (this._trailingIcon === name) return;
      this._trailingIcon = name;
      notifyItemsChanged();
    }
    get trailingIcon() {
      return this._trailingIcon;
    }

    set divider(divider) {
      if (this._divider === divider) return;
      this._divider = divider;
      notifyItemsChanged();
    }
    get divider() {
      return this._divider;
    }

    register() {
      Spicetify.ContextMenuV2.registerItem(this, this.shouldAdd);
    }
    deregister() {
      Spicetify.ContextMenuV2.unregisterItem(this);
    }
  }

  class ItemSubMenu {
    static itemsToComponents(items, context, parentDepth = 1) {
      return items
        .filter((item) => (item.shouldAdd || (() => true))?.(context.props, context.trigger, context.target))
        .map((item) => (item instanceof ItemSubMenu ? item._render(context, parentDepth + 1) : item._render(context)));
    }

    constructor({ text, disabled = false, leadingIcon, divider, items, depth = 1, shouldAdd = () => true }) {
      this.shouldAdd = shouldAdd;
      this._key = `spicetify-context-submenu-${nextItemId++}`;
      this._text = text;
      this._disabled = disabled;
      this._leadingIcon = leadingIcon;
      this._divider = divider;
      // Callers pass an array or a Set; rendering filters and maps it.
      this._items = Array.from(items ?? []);
      this._depth = depth;
    }

    _render(context, depth = this._depth) {
      return Spicetify.React.createElement(
        Spicetify.ReactComponent.MenuSubMenuItem,
        {
          key: this._key,
          displayText: this._text,
          divider: this._divider,
          depth,
          placement: "right-start",
          onOpenChange: () => undefined,
          onClick: () => undefined,
          disabled: this._disabled,
          ...createLeadingIconProps(this._leadingIcon),
        },
        ItemSubMenu.itemsToComponents(this._items, context, depth),
      );
    }

    set text(text) {
      if (this._text === text) return;
      this._text = text;
      notifyItemsChanged();
    }
    get text() {
      return this._text;
    }

    set disabled(bool) {
      if (this._disabled === bool) return;
      this._disabled = bool;
      notifyItemsChanged();
    }
    get disabled() {
      return this._disabled;
    }

    set leadingIcon(name) {
      if (this._leadingIcon === name) return;
      this._leadingIcon = name;
      notifyItemsChanged();
    }
    get leadingIcon() {
      return this._leadingIcon;
    }

    set divider(divider) {
      if (this._divider === divider) return;
      this._divider = divider;
      notifyItemsChanged();
    }
    get divider() {
      return this._divider;
    }

    set depth(value) {
      if (this._depth === value) return;
      this._depth = value;
      notifyItemsChanged();
    }
    get depth() {
      return this._depth;
    }

    addItem(item) {
      if (this._items.includes(item)) return;
      this._items.push(item);
      notifyItemsChanged();
    }
    removeItem(item) {
      const index = this._items.indexOf(item);
      if (index === -1) return;
      this._items.splice(index, 1);
      notifyItemsChanged();
    }

    register() {
      registerItem(this, this.shouldAdd);
    }
    deregister() {
      unregisterItem(this);
    }
  }

  /** @param {Spicetify.ContextMenuV2.ShouldAddCallback} [shouldAdd] */
  function registerItem(item, shouldAdd = () => true) {
    registeredItems.set(item, shouldAdd);
    notifyItemsChanged();
  }

  function unregisterItem(item) {
    registeredItems.delete(item);
    notifyItemsChanged();
  }

  function RegisteredMenuItems({ react, context }) {
    const { props, trigger, target } = react.useContext(context) ?? {};
    const [, setItemsVersion] = react.useState(0);

    react.useEffect(() => {
      const updateItems = () => setItemsVersion((version) => version + 1);
      registeredItemsListeners.add(updateItems);
      return () => registeredItemsListeners.delete(updateItems);
    }, []);

    return Array.from(registeredItems.entries())
      .map(([item, shouldAdd]) => shouldAdd?.(props, trigger, target) && (item._render?.({ props, trigger, target }) ?? item))
      .filter(Boolean);
  }

  const renderItems = () => {
    const react = Spicetify.React;
    const context = Spicetify.ContextMenuV2._context;
    if (
      !context ||
      typeof react?.createElement !== "function" ||
      typeof react.useContext !== "function" ||
      typeof react.useState !== "function" ||
      typeof react.useEffect !== "function"
    ) {
      return [];
    }

    // This call is injected into Spotify's render: capture readiness must not change its hook order.
    return [react.createElement(RegisteredMenuItems, { key: "spicetify-context-menu-items", react, context })];
  };

  return { _context: undefined, parseProps, Item, ItemSubMenu, registerItem, unregisterItem, renderItems, _Provider: ContextProvider };
})();

Spicetify.Menu = (() => {
  const shouldAdd = (_, trigger, target) =>
    trigger === "click" &&
    (target?.getAttribute("data-testid") === "user-widget-link" ||
      target?.classList.contains("main-userWidget-boxCondensed") ||
      target?.classList.contains("main-userWidget-box"));

  class Item extends Spicetify.ContextMenuV2.Item {
    constructor(children, isEnabled, onClick, leadingIcon) {
      super({ children, leadingIcon, onClick: (_, self) => onClick(self), shouldAdd });

      this.isEnabled = isEnabled;
    }

    setState(state) {
      this.isEnabled = state;
    }

    set isEnabled(bool) {
      this._isEnabled = bool;
      this.trailingIcon = this.isEnabled ? "check" : "";
    }
    get isEnabled() {
      return this._isEnabled;
    }
  }

  class SubMenu extends Spicetify.ContextMenuV2.ItemSubMenu {
    constructor(text, items, leadingIcon) {
      super({ text, leadingIcon, items, shouldAdd });
    }

    set name(text) {
      this.text = text;
    }
    get name() {
      return /** @type {string} */ (this.text);
    }

    set icon(icon) {
      this.leadingIcon = icon;
    }
    get icon() {
      return this.leadingIcon;
    }
  }

  return { Item, SubMenu };
})();

Spicetify.ContextMenu = (() => {
  const iconList = /** @type {Spicetify.Icon[]} */ (Object.keys(Spicetify.SVGIcons));

  class Item extends Spicetify.ContextMenuV2.Item {
    static iconList = iconList;

    constructor(name, onClick, shouldAdd, icon, trailingIcon, disabled) {
      const shouldAddItem = shouldAdd === undefined ? () => true : shouldAdd;

      super({
        children: name,
        disabled: disabled === undefined ? false : disabled,
        leadingIcon: icon,
        trailingIcon,
        onClick: (context) => {
          // shouldAdd only lets the item render when parseProps returns a value
          const [uris, uids, contextUri] = /** @type {NonNullable<ReturnType<typeof Spicetify.ContextMenuV2.parseProps>>} */ (
            Spicetify.ContextMenuV2.parseProps(context.props)
          );
          onClick(uris, uids, contextUri);
        },
        shouldAdd: (props) => {
          const parsedProps = Spicetify.ContextMenuV2.parseProps(props);
          return parsedProps && shouldAddItem(...parsedProps);
        },
      });
    }

    set name(name) {
      this.children = name;
    }
    get name() {
      return /** @type {string} */ (this.children);
    }

    set icon(name) {
      this.leadingIcon = name;
    }
    get icon() {
      return this.leadingIcon;
    }
  }

  class SubMenu extends Spicetify.ContextMenuV2.ItemSubMenu {
    static iconList = iconList;

    constructor(name, items, shouldAdd, disabled, icon) {
      const shouldAddItem = shouldAdd === undefined ? () => true : shouldAdd;

      super({
        text: name,
        disabled: disabled === undefined ? false : disabled,
        leadingIcon: icon,
        items,
        shouldAdd: (props) => {
          const parsedProps = Spicetify.ContextMenuV2.parseProps(props);
          return parsedProps && shouldAddItem(...parsedProps);
        },
      });
    }

    set name(name) {
      this.text = name;
    }
    get name() {
      return /** @type {string} */ (this.text);
    }
  }

  return { Item, SubMenu };
})();
