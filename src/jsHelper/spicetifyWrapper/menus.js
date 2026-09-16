import { createIconComponent } from "./icons.js";

Spicetify.ContextMenuV2 = (() => {
  const registeredItems = new Map();

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

  // these classes bridge the gap between react and js, insuring reactivity
  class Item {
    constructor({ children, disabled = false, leadingIcon, trailingIcon, divider, onClick, shouldAdd = () => true }) {
      // maybe use a props object and a setProps
      this.shouldAdd = shouldAdd;

      this._children = children;
      this._disabled = disabled;
      this._leadingIcon = leadingIcon;
      this._trailingIcon = trailingIcon;
      this._divider = divider;

      this._element = Spicetify.ReactJSX.jsx(() => {
        const [_children, setChildren] = Spicetify.React.useState(this._children);
        const [_disabled, setDisabled] = Spicetify.React.useState(this._disabled);
        const [_leadingIcon, setLeadingIcon] = Spicetify.React.useState(this._leadingIcon);
        const [_trailingIcon, setTrailingIcon] = Spicetify.React.useState(this._trailingIcon);
        const [_divider, setDivider] = Spicetify.React.useState(this._divider);

        Spicetify.React.useEffect(() => {
          this._setChildren = setChildren;
          this._setDisabled = setDisabled;
          this._setIcon = setLeadingIcon;
          this._setTrailingIcon = setTrailingIcon;
          this._setDivider = setDivider;

          return () => {
            this._setChildren = undefined;
            this._setDisabled = undefined;
            this._setIcon = undefined;
            this._setTrailingIcon = undefined;
            this._setDivider = undefined;
          };
        });

        const context = Spicetify.React.useContext(Spicetify.ContextMenuV2._context) ?? {};

        return Spicetify.React.createElement(
          Spicetify.ReactComponent.MenuItem,
          {
            disabled: _disabled,
            divider: _divider,
            onClick: (e) => {
              onClick(context, this, e);
            },
            leadingIcon: _leadingIcon && createIconComponent(_leadingIcon),
            trailingIcon: _trailingIcon && createIconComponent(_trailingIcon),
          },
          _children,
        );
      }, {});
    }

    set children(children) {
      this._children = children;
      this._setChildren?.(this._children);
    }
    get children() {
      return this._children;
    }

    set disabled(bool) {
      this._disabled = bool;
      this._setDisabled?.(this._disabled);
    }
    get disabled() {
      return this._disabled;
    }

    set leadingIcon(name) {
      this._leadingIcon = name;
      this._setIcon?.(this._leadingIcon);
    }
    get leadingIcon() {
      return this._leadingIcon;
    }

    set trailingIcon(name) {
      this._trailingIcon = name;
      this._setTrailingIcon?.(this._trailingIcon);
    }
    get trailingIcon() {
      return this._trailingIcon;
    }

    set divider(divider) {
      this._divider = divider;
      this._setDivider?.(this._divider);
    }
    get divider() {
      return this._divider;
    }

    register() {
      Spicetify.ContextMenuV2.registerItem(this._element, this.shouldAdd);
    }
    deregister() {
      Spicetify.ContextMenuV2.unregisterItem(this._element);
    }
  }

  class ItemSubMenu {
    static itemsToComponents(items, props, trigger, target, parentDepth = 1) {
      return items
        .filter((item) => (item.shouldAdd || (() => true))?.(props, trigger, target))
        .map((item) => {
          if (item instanceof ItemSubMenu) item.depth = parentDepth + 1;
          return item._element;
        });
    }

    constructor({ text, disabled = false, leadingIcon, divider, items, depth = 1, shouldAdd = () => true }) {
      this.shouldAdd = shouldAdd;

      this._text = text;
      this._disabled = disabled;
      this._leadingIcon = leadingIcon;
      this._divider = divider;
      this._items = items;
      this._depth = depth;
      this._element = Spicetify.ReactJSX.jsx(() => {
        const [_text, setText] = Spicetify.React.useState(this._text);
        const [_disabled, setDisabled] = Spicetify.React.useState(this._disabled);
        const [_leadingIcon, setLeadingIcon] = Spicetify.React.useState(this._leadingIcon);
        const [_divider, setDivider] = Spicetify.React.useState(this._divider);
        const [_items, setItems] = Spicetify.React.useState(this._items);
        const [_depth, setDepth] = Spicetify.React.useState(this._depth);

        Spicetify.React.useEffect(() => {
          this._setText = setText;
          this._setDisabled = setDisabled;
          this._setLeadingIcon = setLeadingIcon;
          this._setDivider = setDivider;
          this._setItems = setItems;
          this._setDepth = setDepth;
          return () => {
            this._setText = undefined;
            this._setDisabled = undefined;
            this._setLeadingIcon = undefined;
            this._setDivider = undefined;
            this._setItems = undefined;
            this._setDepth = undefined;
          };
        });

        const context = Spicetify.React.useContext(Spicetify.ContextMenuV2._context) ?? {};
        const { props, trigger, target } = context;

        return Spicetify.React.createElement(
          Spicetify.ReactComponent.MenuSubMenuItem,
          {
            displayText: _text,
            divider: _divider,
            depth: _depth,
            placement: "right-start",
            onOpenChange: () => undefined,
            onClick: () => undefined,
            disabled: _disabled,
            leadingIcon: _leadingIcon && createIconComponent(_leadingIcon),
          },
          ItemSubMenu.itemsToComponents(_items, props, trigger, target, _depth),
        );
      }, {});
    }

    set text(text) {
      this._text = text;
      this._setText?.(this._text);
    }
    get text() {
      return this._text;
    }

    set disabled(bool) {
      this._disabled = bool;
      this._setDisabled?.(this._disabled);
    }
    get disabled() {
      return this._disabled;
    }

    set leadingIcon(name) {
      this._leadingIcon = name;
      this._setLeadingIcon?.(this._leadingIcon);
    }
    get leadingIcon() {
      return this._leadingIcon;
    }

    set divider(divider) {
      this._divider = divider;
      this._setDivider?.(this._divider);
    }
    get divider() {
      return this._divider;
    }

    set depth(value) {
      this._depth = value;
      this._setDepth?.(this._depth);
    }
    get depth() {
      return this._depth;
    }

    addItem(item) {
      this._items.add(item);
      this._setItems?.(this._items);
    }
    removeItem(item) {
      this._items.delete(item);
      this._setItems?.(this._items);
    }

    register() {
      registerItem(this._element, this.shouldAdd);
    }
    deregister() {
      unregisterItem(this._element);
    }
  }

  let registeredItemsVersion = 0;

  function registerItem(item, shouldAdd = () => true) {
    registeredItems.set(item, shouldAdd);
    registeredItemsVersion++;
  }

  function unregisterItem(item) {
    registeredItems.delete(item);
    registeredItemsVersion++;
  }

  const renderItems = () => {
    const { props, trigger, target } = Spicetify.React.useContext(Spicetify.ContextMenuV2._context) ?? {};

    return Spicetify.React.useMemo(
      () =>
        Array.from(registeredItems.entries())
          .map(([item, shouldAdd]) => shouldAdd?.(props, trigger, target) && item)
          .filter(Boolean),
      [props, trigger, target, registeredItemsVersion],
    );
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
