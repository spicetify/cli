import { waitFor } from "./shared/async.js";

Spicetify.Playbar = (() => {
  let rightContainer;
  const buttonsStash = new Set();

  class Button {
    constructor(label, icon, onClick = () => {}, disabled = false, active = false, registerOnCreate = true) {
      this.element = document.createElement("button");
      this.element.classList.add("main-genericButton-button");
      this.iconElement = document.createElement("span");
      this.iconElement.classList.add("Wrapper-sm-only", "Wrapper-small-only");
      this.element.appendChild(this.iconElement);
      this.icon = icon;
      this.onClick = onClick;
      this.disabled = disabled;
      this.active = active;
      void addClassname(this.element);
      this.tippy = Spicetify.Tippy?.(this.element, {
        content: label,
        ...Spicetify.TippyProps,
      });
      this.label = label;
      if (registerOnCreate) this.register();
    }
    get label() {
      return this._label;
    }
    set label(text) {
      this._label = text;
      if (!this.tippy) this.element.setAttribute("title", text);
      else this.tippy.setContent(text);
    }
    get icon() {
      return this._icon;
    }
    set icon(input) {
      let newInput = input;
      if (newInput && Spicetify.SVGIcons[newInput]) {
        newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor" stroke="currentColor">${Spicetify.SVGIcons[newInput]}</svg>`;
      }
      this._icon = newInput;
      this.iconElement.innerHTML = newInput;
    }
    get onClick() {
      return this._onClick;
    }
    set onClick(func) {
      this._onClick = func;
      this.element.onclick = () => this._onClick(this);
    }
    get disabled() {
      return this._disabled;
    }
    set disabled(bool) {
      this._disabled = bool;
      this.element.disabled = bool;
      this.element.classList.toggle("disabled", bool);
    }
    set active(bool) {
      this._active = bool;
      this.element.classList.toggle("main-genericButton-buttonActive", bool);
      this.element.classList.toggle("main-genericButton-buttonActiveDot", bool);
    }
    get active() {
      return this._active;
    }
    register() {
      buttonsStash.add(this.element);
      rightContainer?.prepend(this.element);
    }
    deregister() {
      buttonsStash.delete(this.element);
      this.element.remove();
    }
  }

  void (async function waitForPlaybarMounted() {
    rightContainer = await waitFor(() => document.querySelector(".main-nowPlayingBar-right > div"), 300);
    for (const button of buttonsStash) {
      void addClassname(button);
    }
    rightContainer.prepend(...buttonsStash);
  })();

  async function addClassname(element) {
    const sibling = await waitFor(() => document.querySelector(".main-nowPlayingBar-right .main-genericButton-button"), 300);
    for (const className of Array.from(sibling.classList)) {
      if (!className.startsWith("main-genericButton")) element.classList.add(className);
    }
  }

  const widgetStash = new Set();
  let nowPlayingWidget;

  class Widget {
    constructor(label, icon, onClick = () => {}, disabled = false, active = false, registerOnCreate = true) {
      this.element = document.createElement("button");
      this.element.className = "main-addButton-button control-button control-button-heart";
      this.icon = icon;
      this.onClick = onClick;
      this.disabled = disabled;
      this.active = active;
      this.tippy = Spicetify.Tippy?.(this.element, {
        content: label,
        ...Spicetify.TippyProps,
      });
      this.label = label;
      if (registerOnCreate) this.register();
    }
    get label() {
      return this._label;
    }
    set label(text) {
      this._label = text;
      if (!this.tippy) this.element.setAttribute("title", text);
      else this.tippy.setContent(text);
    }
    get icon() {
      return this._icon;
    }
    set icon(input) {
      let newInput = input;
      if (newInput && Spicetify.SVGIcons[newInput]) {
        newInput = `<svg height="16" width="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons[newInput]}</svg>`;
      }
      this._icon = newInput;
      this.element.innerHTML = newInput;
    }
    get onClick() {
      return this._onClick;
    }
    set onClick(func) {
      this._onClick = func;
      this.element.onclick = () => this._onClick(this);
    }
    get disabled() {
      return this._disabled;
    }
    set disabled(bool) {
      this._disabled = bool;
      this.element.disabled = bool;
      this.element.classList.toggle("main-addButton-disabled", bool);
      this.element.ariaDisabled = bool;
    }
    set active(bool) {
      this._active = bool;
      this.element.classList.toggle("main-addButton-active", bool);
      this.element.ariaChecked = bool;
    }
    get active() {
      return this._active;
    }
    register() {
      addWidgetClassname(this.element);
      widgetStash.add(this.element);
      nowPlayingWidget?.append(this.element);
    }
    deregister() {
      widgetStash.delete(this.element);
      this.element.remove();
    }
  }

  function addWidgetClassname(element) {
    const sibling = nowPlayingWidget?.querySelector("[data-encore-id='buttonTertiary']");
    if (!sibling) return;

    for (const className of Array.from(sibling.classList)) {
      if (!className.startsWith("main-addButton") && !className.startsWith("encore-internal-color-")) element.classList.add(className);
    }
  }

  async function waitForWidgetMounted() {
    nowPlayingWidget = await waitFor(() => document.querySelector(".main-nowPlayingWidget-nowPlaying"), 300);
    for (const widget of widgetStash) addWidgetClassname(widget);
    nowPlayingWidget.append(...widgetStash);
  }

  void (async function attachObserver() {
    const leftPlayer = await waitFor(() => document.querySelector(".main-nowPlayingBar-left"), 300);
    await waitForWidgetMounted();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        if (mutation.removedNodes.length > 0) {
          nowPlayingWidget = null;
          void waitForWidgetMounted();
        }
      }
    });
    observer.observe(leftPlayer, { childList: true });
  })();

  return { Button, Widget };
})();
