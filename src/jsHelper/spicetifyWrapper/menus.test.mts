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

  for (const missing of ["createElement", "useContext", "useMemo"]) {
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
