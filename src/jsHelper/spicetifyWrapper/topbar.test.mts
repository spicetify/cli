import { buildSync } from "esbuild";
import { Window } from "happy-dom";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const source = buildSync({
  entryPoints: [fileURLToPath(new URL("./topbar.js", import.meta.url))],
  bundle: true,
  format: "iife",
  write: false,
}).outputFiles[0].text;

const PLAY_D = "M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z";
const PLAY_PATH = `<path d="${PLAY_D}"/>`;
const TOPBAR = `
  <div class="main-topBar-historyButtons"><button class="main-topBar-button left-hash">Back</button></div>
  <div class="main-actionButtons"><button class="main-topBar-buddyFeed right-hash">Friends</button></div>`;

let windows: Window[] = [];
afterEach(async () => {
  await Promise.all(windows.map((window) => window.happyDOM.close()));
  windows = [];
});

function loadTopbar({ mounted = true, tippy = undefined as unknown } = {}) {
  const window = new Window();
  windows.push(window);
  if (mounted) window.document.body.innerHTML = TOPBAR;
  const timers: (() => void)[] = [];
  const Spicetify = { SVGIcons: { play: PLAY_PATH }, Tippy: tippy, TippyProps: {}, Platform: { History: { listen() {} } } };
  runInNewContext(source, { document: window.document, Spicetify, setTimeout: (callback: () => void) => timers.push(callback) });
  return { Spicetify: Spicetify as typeof Spicetify & { Topbar: any }, document: window.document, timers };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));

describe("Topbar.Button", () => {
  it("adds the button next to the history buttons with their class, or to the action buttons when isRight", async () => {
    const { Spicetify, document } = loadTopbar();
    await settle();

    const left = new Spicetify.Topbar.Button("Left", "play", () => {});
    const right = new Spicetify.Topbar.Button("Right", "play", () => {}, false, true);

    assert.equal(left.element.parentElement, document.querySelector(".main-topBar-historyButtons"));
    assert.equal(left.button.className, "main-topBar-button left-hash");
    assert.equal(left.element.firstElementChild, left.button);
    assert.equal(right.element.parentElement, document.querySelector(".main-actionButtons"));
    assert.equal(right.element.parentElement?.firstElementChild, right.element);
    assert.equal(right.button.className, "main-topBar-buddyFeed right-hash");
  });

  it("holds buttons created before the top bar renders and mounts them once it does", async () => {
    const { Spicetify, document, timers } = loadTopbar({ mounted: false });
    await settle();
    const button = new Spicetify.Topbar.Button("Early", "play", () => {}, true);
    assert.equal(button.element.isConnected, false);

    document.body.innerHTML = TOPBAR;
    timers.shift()?.();
    await settle();

    assert.equal(button.element.parentElement, document.querySelector(".main-topBar-historyButtons"));
    assert.deepEqual([...button.button.classList], ["main-topBar-button", "left-hash", "disabled"]);
  });

  it("renders the constructor arguments and calls onClick with the button", async () => {
    const { Spicetify } = loadTopbar();
    await settle();
    const clicks: unknown[] = [];
    const button = new Spicetify.Topbar.Button("Play it", "play", (self: unknown) => clicks.push(self), true);

    assert.equal(button.button.getAttribute("aria-label"), "Play it");
    assert.equal(button.button.getAttribute("title"), "Play it");
    assert.equal(button.button.querySelector("svg path")?.getAttribute("d"), PLAY_D);
    assert.equal(button.button.disabled, true);
    assert.equal(button.button.classList.contains("disabled"), true);

    button.disabled = false;
    button.button.click();
    assert.deepEqual(clicks, [button]);
  });

  it("updates the rendered button when label, icon, onClick and disabled change", async () => {
    const { Spicetify } = loadTopbar();
    await settle();
    const button = new Spicetify.Topbar.Button("Before", "play", () => {});

    button.label = "After";
    assert.equal(button.button.getAttribute("aria-label"), "After");
    assert.equal(button.button.getAttribute("title"), "After");

    const svg = '<svg viewBox="0 0 16 16"><circle r="4"></circle></svg>';
    button.icon = svg;
    assert.equal(button.button.innerHTML, svg);
    assert.equal(button.icon, svg);

    button.disabled = true;
    assert.equal(button.button.disabled, true);
    assert.equal(button.button.classList.contains("disabled"), true);
    button.disabled = false;
    assert.equal(button.button.disabled, false);
    assert.equal(button.button.classList.contains("disabled"), false);

    let replaced = 0;
    button.onClick = () => replaced++;
    button.button.click();
    assert.equal(replaced, 1);
  });

  it("shows the label through Tippy instead of a title when Tippy is available", async () => {
    const contents: string[] = [];
    const { Spicetify } = loadTopbar({
      tippy: (_element: unknown, props: { content: string }) => {
        contents.push(props.content);
        return { setContent: (content: string) => contents.push(content) };
      },
    });
    await settle();
    const button = new Spicetify.Topbar.Button("First", "play", () => {});
    button.label = "Second";

    assert.equal(contents[0], "First");
    assert.equal(contents.at(-1), "Second");
    assert.equal(button.button.hasAttribute("title"), false);
    assert.equal(button.button.getAttribute("aria-label"), "Second");
  });
});
