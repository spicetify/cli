import { waitFor } from "./shared/async.js";

Spicetify.getAudioData = async (uri) => {
  const providedURI = uri || Spicetify.Player.data?.item?.uri;
  if (!providedURI) throw "URI is invalid.";
  /** @type {(Spicetify.URI & { Type?: string; getBase62Id?: () => string }) | null} */
  const uriObj = Spicetify.URI.from?.(providedURI) ?? Spicetify.URI.fromString?.(providedURI);
  if (!uriObj || (uriObj.Type || uriObj.type) !== Spicetify.URI.Type.TRACK) {
    throw "URI is invalid.";
  }

  return await Spicetify.CosmosAsync.get(
    `https://spclient.wg.spotify.com/audio-attributes/v1/audio-analysis/${uriObj.getBase62Id?.() ?? uriObj.id}?format=json`,
  );
};

Spicetify.colorExtractor = async (uri) => {
  const body = await Spicetify.CosmosAsync.get(`https://spclient.wg.spotify.com/colorextractor/v1/extract-presets?uri=${uri}&format=json`);

  if (body.entries?.length) {
    const list = /** @type {NonNullable<Awaited<ReturnType<typeof Spicetify.colorExtractor>>>} */ ({});
    for (const color of body.entries[0].color_swatches) {
      list[color.preset] = `#${color.color?.toString(16).padStart(6, "0")}`;
    }
    return list;
  }
  return null;
};

Spicetify.LocalStorage = {
  clear: () => localStorage.clear(),
  get: (key) => localStorage.getItem(key),
  remove: (key) => localStorage.removeItem(key),
  set: (key, value) => localStorage.setItem(key, value),
};

Spicetify._getStyledClassName = (args, component) => {
  const includedKeys = [
    "role",
    "variant",
    "semanticColor",
    "iconColor",
    "color",
    "weight",
    "buttonSize",
    "iconSize",
    "position",
    "data-encore-id",
    "$size",
    "$iconColor",
    "$variant",
    "$semanticColor",
    "$buttonSize",
    "$position",
    "$iconSize",
    "$lineClamp",
  ];
  const customKeys = ["blocksize"];
  const customExactKeys = ["$padding", "$paddingBottom", "paddingBottom", "padding"];

  const element = Array.from(args).find(
    (e) =>
      e?.children ||
      e?.dangerouslySetInnerHTML ||
      typeof e?.className !== "undefined" ||
      includedKeys.some((key) => typeof e?.[key] !== "undefined") ||
      customExactKeys.some((key) => typeof e?.[key] !== "undefined") ||
      customKeys.some((key) => Object.keys(e).some((k) => k.toLowerCase().includes(key))),
  );

  if (!element) return;

  let className = /(?:\w+__)?(\w+)-[\w-]+/.exec(component.componentId)?.[1];

  for (const key of includedKeys) {
    if ((typeof element[key] === "string" && element[key].length) || typeof element[key] === "number") {
      className += `-${element[key]}`;
    }
  }

  const excludedKeys = new Set(["children", "className", "style", "dir", "key", "ref", "as", "$autoMirror", "autoMirror", "$hasFocus", ""]);
  const excludedPrefix = ["aria-"];

  const childrenProps = ["iconLeading", "iconTrailing", "iconOnly", "$iconOnly", "$iconLeading", "$iconTrailing"];

  for (const key of childrenProps) {
    const sanitizedKey = key.startsWith("$") ? key.slice(1) : key;
    if (element[key]) className += `-${sanitizedKey}`;
  }

  const booleanKeys = Object.keys(element).filter((key) => typeof element[key] === "boolean" && element[key]);

  for (const key of booleanKeys) {
    if (excludedKeys.has(key)) continue;
    if (excludedPrefix.some((prefix) => key.startsWith(prefix))) continue;
    const sanitizedKey = key.startsWith("$") ? key.slice(1) : key;
    className += `-${sanitizedKey}`;
  }

  const customEntries = Object.entries(element).filter(
    ([key, value]) =>
      (customKeys.some((k) => key.toLowerCase().includes(k)) || customExactKeys.some((k) => key === k)) && typeof value === "string" && value.length,
  );

  for (const [key, value] of customEntries) {
    const sanitizedKey = key.startsWith("$") ? key.slice(1) : key;
    className += `-${sanitizedKey}_${value.replace(/[^a-z0-9]/gi, "_")}`;
  }

  return className;
};

void (async function waitMouseTrap() {
  await waitFor(() => Spicetify.Mousetrap, 10);
  const KEYS = {
    BACKSPACE: "backspace",
    TAB: "tab",
    ENTER: "enter",
    SHIFT: "shift",
    CTRL: "ctrl",
    ALT: "alt",
    CAPS: "capslock",
    ESCAPE: "esc",
    SPACE: "space",
    PAGE_UP: "pageup",
    PAGE_DOWN: "pagedown",
    END: "end",
    HOME: "home",
    ARROW_LEFT: "left",
    ARROW_UP: "up",
    ARROW_RIGHT: "right",
    ARROW_DOWN: "down",
    INSERT: "ins",
    DELETE: "del",
    A: "a",
    B: "b",
    C: "c",
    D: "d",
    E: "e",
    F: "f",
    G: "g",
    H: "h",
    I: "i",
    J: "j",
    K: "k",
    L: "l",
    M: "m",
    N: "n",
    O: "o",
    P: "p",
    Q: "q",
    R: "r",
    S: "s",
    T: "t",
    U: "u",
    V: "v",
    W: "w",
    X: "x",
    Y: "y",
    Z: "z",
    WINDOW_LEFT: "meta",
    WINDOW_RIGHT: "meta",
    SELECT: "meta",
    NUMPAD_0: "0",
    NUMPAD_1: "1",
    NUMPAD_2: "2",
    NUMPAD_3: "3",
    NUMPAD_4: "4",
    NUMPAD_5: "5",
    NUMPAD_6: "6",
    NUMPAD_7: "7",
    NUMPAD_8: "8",
    NUMPAD_9: "9",
    MULTIPLY: "*",
    ADD: "+",
    SUBTRACT: "-",
    DECIMAL_POINT: ".",
    DIVIDE: "/",
    F1: "f1",
    F2: "f2",
    F3: "f3",
    F4: "f4",
    F5: "f5",
    F6: "f6",
    F7: "f7",
    F8: "f8",
    F9: "f9",
    F10: "f10",
    F11: "f11",
    F12: "f12",
    ";": ";",
    "=": "=",
    ",": ",",
    "-": "-",
    ".": ".",
    "/": "/",
    "`": "`",
    "[": "[",
    "\\": "\\",
    "]": "]",
    '"': '"',
    "~": "`",
    "!": "1",
    "@": "2",
    "#": "3",
    $: "4",
    "%": "5",
    "^": "6",
    "&": "7",
    "*": "8",
    "(": "9",
    ")": "0",
    _: "-",
    "+": "=",
    ":": ";",
    "'": "'",
    "<": ",",
    ">": ".",
    "?": "/",
    "|": "\\",
  };

  function formatKeys(keys) {
    let keystroke = "";
    if (typeof keys === "object") {
      if (!keys.key || !Object.values(KEYS).includes(keys.key)) {
        throw `Spicetify.Keyboard.registerShortcut: Invalid key ${keys.key}`;
      }
      if (keys.ctrl) keystroke += "mod+";
      if (keys.meta) keystroke += "meta+";
      if (keys.alt) keystroke += "alt+";
      if (keys.shift) keystroke += "shift+";
      keystroke += keys.key;
    } else if (typeof keys === "string" && Object.values(KEYS).includes(keys)) {
      keystroke = keys;
    } else {
      throw `Spicetify.Keyboard.registerShortcut: Invalid keys ${keys}`;
    }
    return keystroke;
  }

  // The aliases are assigned just below.
  Spicetify.Keyboard = /** @type {typeof Spicetify.Keyboard} */ ({
    KEYS,
    registerShortcut: (keys, callback) => {
      Spicetify.Mousetrap.bind(formatKeys(keys), callback);
    },
    _deregisterShortcut: (keys) => {
      Spicetify.Mousetrap.unbind(formatKeys(keys));
    },
    changeShortcut: (keys, newKeys) => {
      if (!keys || !newKeys) throw "Spicetify.Keyboard.changeShortcut: Invalid keys";

      const callback = Object.keys(Spicetify.Mousetrap.trigger()._directMap).find((key) => key.startsWith(formatKeys(keys)));
      if (!callback) throw "Spicetify.Keyboard.changeShortcut: Shortcut not found";

      Spicetify.Keyboard.registerShortcut(newKeys, Spicetify.Mousetrap.trigger()._directMap[callback]);
      Spicetify.Keyboard._deregisterShortcut(keys);
    },
  });
  Spicetify.Keyboard.registerIsolatedShortcut = Spicetify.Keyboard.registerShortcut;
  Spicetify.Keyboard.registerImportantShortcut = Spicetify.Keyboard.registerShortcut;
  Spicetify.Keyboard.deregisterImportantShortcut = Spicetify.Keyboard._deregisterShortcut;
})();
