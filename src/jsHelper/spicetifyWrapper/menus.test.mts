import { buildSync } from "esbuild";
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";
import React from "react";
import { act, create } from "react-test-renderer";

const source = buildSync({
  entryPoints: [fileURLToPath(new URL("./menus.js", import.meta.url))],
  bundle: true,
  format: "iife",
  write: false,
}).outputFiles[0].text;

function loadMenus() {
  const globals = { Spicetify: { Platform: { UserAPI: { _product_state: {} } } } };
  return runInNewContext(`${source}\nSpicetify;`, globals);
}

describe("context menu capture readiness", () => {
  it("leaves native items alone before React is captured", () => {
    const spicetify = loadMenus();
    const native = React.createElement("button", { key: "native" }, "Native");
    assert.deepEqual([spicetify.ContextMenuV2.renderItems(), native].flat(), [native]);
  });

  it("waits for the menu context as well as React", () => {
    const spicetify = loadMenus();
    spicetify.React = React;
    assert.equal(spicetify.ContextMenuV2.renderItems().length, 0);
  });

  for (const missing of ["createElement", "useContext", "useState", "useEffect"]) {
    it(`waits for ${missing} on a partially captured React export`, () => {
      const spicetify = loadMenus();
      spicetify.React = { ...React, [missing]: undefined };
      spicetify.ContextMenuV2._context = React.createContext({});
      assert.equal(spicetify.ContextMenuV2.renderItems().length, 0);
    });
  }

  it("keeps native hook order and state when capture becomes ready in an open menu", () => {
    const spicetify = loadMenus();
    const api = spicetify.ContextMenuV2;
    const context = React.createContext({});
    let increment = () => assert.fail("native menu did not mount");
    function NativeMenu() {
      const [count, setCount] = React.useState(0);
      increment = () => setCount((value) => value + 1);
      const injected = api.renderItems();
      const [label] = React.useState("Native");
      return React.createElement("menu", null, ...injected, React.createElement("button", { key: "native" }, `${label} ${count}`));
    }
    const tree = create(React.createElement(NativeMenu));
    assert.deepEqual(
      tree.root.findAllByType("button").map((item) => item.children),
      [["Native 0"]],
    );

    spicetify.React = React;
    act(increment);
    assert.deepEqual(
      tree.root.findAllByType("button").map((item) => item.children),
      [["Native 1"]],
    );

    api._context = context;
    api.registerItem(React.createElement("button", { key: "custom" }, "Custom"));
    act(increment);
    assert.deepEqual(
      tree.root.findAllByType("button").map((item) => item.children),
      [["Custom"], ["Native 2"]],
    );

    spicetify.React = undefined;
    act(increment);
    assert.deepEqual(
      tree.root.findAllByType("button").map((item) => item.children),
      [["Native 3"]],
    );
    tree.unmount();
  });

  it("renders registered items with provider context and tracks registry changes", () => {
    const spicetify = loadMenus();
    spicetify.React = React;
    const api = spicetify.ContextMenuV2;
    api._context = React.createContext({});
    const props = { uri: "spotify:track:example" };
    const target = {};
    const received = [];
    const item = React.createElement("button", { key: "custom" }, "Custom");
    api.registerItem(item, (...args) => {
      received.push(args);
      return args[1] === "contextmenu";
    });

    function Menu() {
      return React.createElement("menu", null, ...api.renderItems());
    }
    const contexts = {
      contextmenu: { props, trigger: "contextmenu", target },
      click: { props, trigger: "click", target },
    };
    const render = (trigger) => React.createElement(api._context.Provider, { value: contexts[trigger] }, React.createElement(Menu));
    const tree = create(render("contextmenu"));
    assert.equal(tree.root.findAllByType("button").length, 1);
    assert.deepEqual(received.at(-1), [props, "contextmenu", target]);

    act(() => tree.update(render("click")));
    assert.equal(tree.root.findAllByType("button").length, 0);
    api.registerItem(item);
    act(() => tree.update(render("click")));
    assert.equal(tree.root.findAllByType("button").length, 1);
    api.unregisterItem(item);
    act(() => tree.update(render("click")));
    assert.equal(tree.root.findAllByType("button").length, 0);
    tree.unmount();
  });
});

describe("submenus", () => {
  function submenuApi() {
    const spicetify = loadMenus();
    spicetify.React = React;
    spicetify.ReactComponent = {
      MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement("button", null, children),
      MenuSubMenuItem: ({ children }: { children: React.ReactNode }) => React.createElement("menu", null, children),
    };
    spicetify.ContextMenuV2._context = React.createContext({});
    return spicetify.ContextMenuV2;
  }
  const child = (name: string) => ({ _render: () => name, shouldAdd: () => true });

  it("renders items passed as a Set or an array", () => {
    const api = submenuApi();
    for (const items of [new Set([child("a"), child("b")]), [child("a"), child("b")]]) {
      const menu = new api.ItemSubMenu({ text: "More", items });
      assert.deepEqual([...api.ItemSubMenu.itemsToComponents(menu._items, {})], ["a", "b"]);
    }
  });

  it("re-renders an open menu when items are added or removed", () => {
    const api = submenuApi();
    const item = (name: string) => new api.Item({ children: name, onClick: () => undefined });
    const first = item("a");
    const menu = new api.ItemSubMenu({ text: "More", items: [first] });
    api.registerItem(menu);

    function Menu() {
      return React.createElement("div", null, ...api.renderItems());
    }
    // act runs the effect that subscribes the open menu to item changes.
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(React.createElement(api._context.Provider, { value: {} }, React.createElement(Menu)));
    });
    const labels = () => tree.root.findAllByType("button").map((button) => button.children.join(""));
    assert.deepEqual(labels(), ["a"]);

    const second = item("b");
    act(() => menu.addItem(second));
    act(() => menu.addItem(second));
    assert.deepEqual(labels(), ["a", "b"], "adding an item twice adds it once");

    act(() => menu.removeItem(first));
    assert.deepEqual(labels(), ["b"]);
    tree.unmount();
  });

  it("lets shouldAdd relabel a submenu while an open menu re-renders", () => {
    const api = submenuApi();
    const menu = new api.ItemSubMenu({
      text: "More",
      items: [new api.Item({ children: "a", onClick: () => undefined })],
      shouldAdd: (props: { label: string }) => {
        menu.text = props.label;
        return true;
      },
    });
    menu.register();

    function Menu() {
      return React.createElement("div", null, ...api.renderItems());
    }
    const render = (label: string) => React.createElement(api._context.Provider, { value: { props: { label } } }, React.createElement(Menu));
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(render("More"));
    });
    act(() => tree.update(render("Less")));
    assert.equal(menu.text, "Less");
    tree.unmount();
  });
});

describe("now-playing menus", () => {
  it("gives items the track a now-playing menu was opened on", () => {
    const spicetify = loadMenus();
    spicetify.React = React;
    spicetify.ReactComponent = {
      MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement("button", null, children),
    };
    const api = spicetify.ContextMenuV2;
    api._context = React.createContext(null);
    const seen: unknown[] = [];
    new api.Item({
      children: "Copy",
      onClick: () => undefined,
      shouldAdd: (props: unknown) => {
        seen.push(api.parseProps(props));
        return true;
      },
    }).register();

    function NowPlayingMenu(_: { context: { uri: string }; item: { uri: string; uid: string }; canToggleCanvas: boolean }) {
      return React.createElement("div", null, ...api.renderItems());
    }
    const menu = React.createElement(NowPlayingMenu, {
      context: { uri: "spotify:playlist:p" },
      item: { uri: "spotify:track:t", uid: "u" },
      canToggleCanvas: true,
    });
    // The trigger's provider only knows the canvas toggle, as in Spotify's now-playing menus.
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(
        React.createElement(
          api._context.Provider,
          { value: { props: { canToggleCanvas: true }, trigger: "right-click" } },
          React.createElement(api._Provider, null, menu),
        ),
      );
    });

    assert.deepEqual(
      tree.root.findAllByType("button").map((button) => button.children.join("")),
      ["Copy"],
    );
    const [uris, uids, contextUri] = seen.at(-1) as [string[], string[], string];
    assert.deepEqual([[...uris], [...uids], contextUri], [["spotify:track:t"], ["u"], "spotify:playlist:p"]);
    tree.unmount();
  });
});

describe("now-playing menu provider readiness", () => {
  const native = () => React.createElement("button", null, "Native");
  const labels = (tree: ReturnType<typeof create>) => tree.root.findAllByType("button").map((button) => button.children.join(""));

  it("renders the native menu before React is captured", () => {
    const api = loadMenus().ContextMenuV2;
    api._context = React.createContext(null);
    const tree = create(React.createElement(api._Provider, null, native()));
    assert.deepEqual(labels(tree), ["Native"]);
    tree.unmount();
  });

  it("renders the native menu before the menu context exists", () => {
    const spicetify = loadMenus();
    spicetify.React = React;
    const tree = create(React.createElement(spicetify.ContextMenuV2._Provider, null, native()));
    assert.deepEqual(labels(tree), ["Native"]);
    tree.unmount();
  });

  it("renders the native menu on a React export without useContext", () => {
    const spicetify = loadMenus();
    spicetify.React = { ...React, useContext: undefined };
    spicetify.ContextMenuV2._context = React.createContext(null);
    const tree = create(React.createElement(spicetify.ContextMenuV2._Provider, null, native()));
    assert.deepEqual(labels(tree), ["Native"]);
    tree.unmount();
  });

  it("starts providing the track when capture becomes ready in an open menu", () => {
    const spicetify = loadMenus();
    spicetify.ReactComponent = {
      MenuItem: ({ children }: { children: React.ReactNode }) => React.createElement("button", null, children),
    };
    const api = spicetify.ContextMenuV2;
    const context = React.createContext<unknown>(null);
    new api.Item({ children: "Copy", onClick: () => undefined, shouldAdd: (props: unknown) => !!api.parseProps(props) }).register();

    function NowPlayingMenu(_: { context: { uri: string }; item: { uri: string } }) {
      return React.createElement("div", null, ...api.renderItems(), native());
    }
    const render = () =>
      React.createElement(
        context.Provider,
        { value: { props: { canToggleCanvas: true } } },
        React.createElement(
          api._Provider,
          null,
          React.createElement(NowPlayingMenu, { context: { uri: "spotify:playlist:p" }, item: { uri: "spotify:track:t" } }),
        ),
      );
    let tree!: ReturnType<typeof create>;
    act(() => {
      tree = create(render());
    });
    assert.deepEqual(labels(tree), ["Native"]);

    spicetify.React = React;
    api._context = context;
    act(() => tree.update(render()));
    assert.deepEqual(labels(tree), ["Copy", "Native"]);
    tree.unmount();
  });
});
