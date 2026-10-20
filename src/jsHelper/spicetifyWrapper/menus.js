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

  function notifyItemsChanged() {
    for (const listener of registeredItemsListeners) listener();
  }

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
      this._disabled = bool;
      notifyItemsChanged();
    }
    get disabled() {
      return this._disabled;
    }

    set leadingIcon(name) {
      this._leadingIcon = name;
      notifyItemsChanged();
    }
    get leadingIcon() {
      return this._leadingIcon;
    }

    set trailingIcon(name) {
      this._trailingIcon = name;
      notifyItemsChanged();
    }
    get trailingIcon() {
      return this._trailingIcon;
    }

    set divider(divider) {
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
      this._text = text;
      notifyItemsChanged();
    }
    get text() {
      return this._text;
    }

    set disabled(bool) {
      this._disabled = bool;
      notifyItemsChanged();
    }
    get disabled() {
      return this._disabled;
    }

    set leadingIcon(name) {
      this._leadingIcon = name;
      notifyItemsChanged();
    }
    get leadingIcon() {
      return this._leadingIcon;
    }

    set divider(divider) {
      this._divider = divider;
      notifyItemsChanged();
    }
    get divider() {
      return this._divider;
    }

    set depth(value) {
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

  function registerItem(item, shouldAdd = () => true) {
    registeredItems.set(item, shouldAdd);
    notifyItemsChanged();
  }

  function unregisterItem(item) {
    registeredItems.delete(item);
    notifyItemsChanged();
  }

  const renderItems = () => {
    const { props, trigger, target } = Spicetify.React.useContext(Spicetify.ContextMenuV2._context) ?? {};
    const [, setItemsVersion] = Spicetify.React.useState(0);

    Spicetify.React.useEffect(() => {
      const updateItems = () => setItemsVersion((version) => version + 1);
      registeredItemsListeners.add(updateItems);
      return () => registeredItemsListeners.delete(updateItems);
    }, []);

    return Array.from(registeredItems.entries())
      .map(([item, shouldAdd]) => shouldAdd?.(props, trigger, target) && (item._render?.({ props, trigger, target }) ?? item))
      .filter(Boolean);
  };

  return { parseProps, Item, ItemSubMenu, registerItem, unregisterItem, renderItems };
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
      return this.text;
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
  const iconList = Object.keys(Spicetify.SVGIcons);

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
          const [uris, uids, contextUri] = Spicetify.ContextMenuV2.parseProps(context.props);
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
      return this.children;
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
      return this.text;
    }
  }

  return { Item, SubMenu };
})();
