import { buildSync } from "esbuild";
import { Window } from "happy-dom";
import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import { runInNewContext } from "node:vm";

const source = buildSync({
  entryPoints: [fileURLToPath(new URL("./playbar.js", import.meta.url))],
  bundle: true,
  format: "iife",
  write: false,
}).outputFiles[0].text;

const PLAY_D = "M3 1.713a.7.7 0 0 1 1.05-.607l10.89 6.288a.7.7 0 0 1 0 1.212L4.05 14.894A.7.7 0 0 1 3 14.288z";
const PLAYBAR = `
  <div class="main-nowPlayingBar-left"><div class="main-nowPlayingWidget-nowPlaying"><span class="track">Track</span></div></div>
  <div class="main-nowPlayingBar-right"><div><button class="main-genericButton-button hashed-a hashed-b">Lyrics</button></div></div>`;

let windows: Window[] = [];
afterEach(async () => {
  await Promise.all(windows.map((window) => window.happyDOM.close()));
  windows = [];
});

function loadPlaybar({ mounted = true } = {}) {
  const window = new Window();
  windows.push(window);
  if (mounted) window.document.body.innerHTML = PLAYBAR;
  const timers: (() => void)[] = [];
  const Spicetify = { SVGIcons: { play: `<path d="${PLAY_D}"/>` }, TippyProps: {} };
  runInNewContext(source, {
    document: window.document,
    MutationObserver: window.MutationObserver,
    Spicetify,
    setTimeout: (callback: () => void) => timers.push(callback),
  });
  return { Spicetify: Spicetify as typeof Spicetify & { Playbar: any }, document: window.document, timers };
}

const settle = () => new Promise((resolve) => setImmediate(resolve));
const children = (element: Element | null) => [...(element?.children ?? [])];

describe("Playbar.Button", () => {
  it("joins the playbar's extra controls with their hashed classes", async () => {
    const { Spicetify, document } = loadPlaybar();
    await settle();
    const button = new Spicetify.Playbar.Button("Queue it", "play");
    await settle();

    const row = document.querySelector(".main-nowPlayingBar-right > div");
    assert.equal(children(row)[0], button.element);
    assert.deepEqual([...button.element.classList], ["main-genericButton-button", "hashed-a", "hashed-b"]);
  });

  it("holds buttons created before the playbar renders and mounts them once it does", async () => {
    const { Spicetify, document, timers } = loadPlaybar({ mounted: false });
    await settle();
    const button = new Spicetify.Playbar.Button("Early", "play");
    assert.equal(button.element.isConnected, false);

    document.body.innerHTML = PLAYBAR;
    for (const timer of timers.splice(0)) timer();
    await settle();

    assert.equal(children(document.querySelector(".main-nowPlayingBar-right > div"))[0], button.element);
  });

  it("renders the constructor arguments and calls onClick with the button", async () => {
    const { Spicetify } = loadPlaybar();
    await settle();
    const clicks: unknown[] = [];
    const button = new Spicetify.Playbar.Button("Shuffle", "play", (self: unknown) => clicks.push(self), true, true);

    assert.equal(button.element.getAttribute("title"), "Shuffle");
    assert.equal(button.iconElement.querySelector("svg path")?.getAttribute("d"), PLAY_D);
    assert.equal(button.element.disabled, true);
    assert.equal(button.element.classList.contains("disabled"), true);
    assert.equal(button.element.classList.contains("main-genericButton-buttonActive"), true);

    button.disabled = false;
    button.element.click();
    assert.deepEqual(clicks, [button]);
  });

  it("updates the rendered button when label, icon, active and disabled change", async () => {
    const { Spicetify } = loadPlaybar();
    await settle();
    const button = new Spicetify.Playbar.Button("Before", "play");

    button.label = "After";
    assert.equal(button.element.getAttribute("title"), "After");
    const svg = '<svg viewBox="0 0 16 16"><circle r="4"></circle></svg>';
    button.icon = svg;
    assert.equal(button.iconElement.innerHTML, svg);
    button.active = true;
    assert.equal(button.element.classList.contains("main-genericButton-buttonActive"), true);
    button.active = false;
    assert.equal(button.element.classList.contains("main-genericButton-buttonActive"), false);
    button.disabled = true;
    assert.equal(button.element.disabled, true);
  });

  it("stays out of the playbar until registered, and leaves it on deregister", async () => {
    const { Spicetify, document } = loadPlaybar();
    await settle();
    const row = document.querySelector(".main-nowPlayingBar-right > div");
    const button = new Spicetify.Playbar.Button("Later", "play", undefined, false, false, false);
    assert.equal(button.element.isConnected, false);

    button.register();
    assert.equal(children(row)[0], button.element);
    button.deregister();
    assert.equal(button.element.isConnected, false);
    assert.equal(children(row).length, 1);
  });

  it("does not bring a deregistered button back when the playbar remounts", async () => {
    const { Spicetify, document, timers } = loadPlaybar({ mounted: false });
    await settle();
    const kept = new Spicetify.Playbar.Button("Kept", "play");
    const dropped = new Spicetify.Playbar.Button("Dropped", "play");
    dropped.deregister();

    document.body.innerHTML = PLAYBAR;
    for (const timer of timers.splice(0)) timer();
    await settle();

    assert.equal(kept.element.isConnected, true);
    assert.equal(dropped.element.isConnected, false);
  });
});

describe("Playbar.Widget", () => {
  it("renders into the now playing widget and reflects active and disabled", async () => {
    const { Spicetify, document } = loadPlaybar();
    await settle();
    const clicks: unknown[] = [];
    const widget = new Spicetify.Playbar.Widget("Love", "play", (self: unknown) => clicks.push(self), false, true);
    await settle();

    const nowPlaying = document.querySelector(".main-nowPlayingWidget-nowPlaying");
    assert.equal(children(nowPlaying).at(-1), widget.element);
    assert.equal(widget.element.getAttribute("title"), "Love");
    assert.equal(widget.element.querySelector("svg path")?.getAttribute("d"), PLAY_D);
    assert.equal(widget.element.classList.contains("main-addButton-active"), true);

    widget.element.click();
    assert.deepEqual(clicks, [widget]);

    widget.active = false;
    assert.equal(widget.element.classList.contains("main-addButton-active"), false);
    widget.disabled = true;
    assert.equal(widget.element.disabled, true);
    assert.equal(widget.element.classList.contains("main-addButton-disabled"), true);
  });

  it("stays out of the widget until registered, and leaves it on deregister", async () => {
    const { Spicetify, document } = loadPlaybar();
    await settle();
    await settle();
    const nowPlaying = document.querySelector(".main-nowPlayingWidget-nowPlaying");
    const widget = new Spicetify.Playbar.Widget("Later", "play", undefined, false, false, false);
    assert.equal(widget.element.isConnected, false);

    widget.register();
    assert.equal(children(nowPlaying).at(-1), widget.element);
    widget.deregister();
    assert.equal(widget.element.isConnected, false);
  });
});
