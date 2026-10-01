import assert from "node:assert/strict";
import test from "node:test";

import { findMenuItem, findSubMenuItem } from "./component-resolvers.js";

type Props = Record<string, unknown>;

// Shapes taken from Spotify 1.3.3: a waveform scrubber that also mentions
// handleMouseEnter and onClick, the menu item dispatcher, and the v2 row it renders.
const waveform = ({ onTriggerPlay }: Props) => ({ handleMouseEnter: () => undefined, onClick: onTriggerPlay });
const menuItemDispatcher = (e: Props) => ({
  textValue: e.textValue,
  forceV2LeadingIcon: e.forceV2LeadingIcon,
  showFullTextOnHover: e.showFullTextOnHover,
});
const menuRowV2 = function ({ forceV2LeadingIcon: a, showFullTextOnHover: b }: Props) {
  return [a, b];
};
// The row 1.3.0 exports, which takes its mouse handlers from a hook.
const exportedMenuRow = ({ onClick, leadingIcon, autoClose = true, forceV2LeadingIcon }: Props) => [
  onClick,
  leadingIcon,
  autoClose,
  forceV2LeadingIcon,
];
const handlerMenuRow = ({ onClick, leadingIcon }: Props) => {
  const handleMouseEnter = () => undefined;
  return { handleMouseEnter, onClick, leadingIcon };
};

test("MenuItem resolves to the dispatcher ahead of other handleMouseEnter components", () => {
  assert.equal(findMenuItem({ functionModules: [waveform, menuRowV2, menuItemDispatcher] }), menuItemDispatcher);
});

test("MenuItem falls back to the exported row, not the waveform scrubber, on builds without the dispatcher", () => {
  assert.equal(findMenuItem({ functionModules: [waveform, exportedMenuRow] }), exportedMenuRow);
  assert.equal(findMenuItem({ functionModules: [waveform, handlerMenuRow] }), handlerMenuRow);
  assert.equal(findMenuItem({ functionModules: [waveform] }), undefined);
});

test("MenuSubMenuItem resolves through the module that renders the submenu header", () => {
  const subMenuDispatcher = (e: Props) => e;
  const modules: Record<string, unknown> = {
    "11": { A: { menuItem: "menu-item" } },
    "93262": { g: subMenuDispatcher },
  };
  const chunks = [
    ["11", () => "unrelated factory"],
    ["93262", () => '{"data-context-menu-submenu-header":!0}'],
  ];
  const require = (id: string) => modules[id];

  assert.equal(findSubMenuItem({ functionModules: [waveform], chunks, require }), subMenuDispatcher);
});

test("MenuSubMenuItem keeps the exported subMenuIcon component on older builds", () => {
  const legacySubMenu = () => ({ className: "main-contextMenu-subMenuIcon" });
  assert.equal(findSubMenuItem({ functionModules: [waveform, legacySubMenu], chunks: [], require: () => undefined }), legacySubMenu);
});

test("MenuSubMenuItem is undefined when the header module exports more than one component", () => {
  const chunks = [["1", () => "data-context-menu-submenu-header"]];
  const require = () => ({ a: () => 1, b: () => 2 });
  assert.equal(findSubMenuItem({ functionModules: [], chunks, require }), undefined);
});
