import { waitFor } from "./shared/async.js";

Spicetify.Topbar = (() => {
  let leftGeneratedClassName;
  let rightGeneratedClassName;
  let leftContainer;
  let rightContainer;
  const leftButtonsStash = new Set();
  const rightButtonsStash = new Set();

  class Button {
    /**
     * @param {string} label
     * @param {string} icon
     * @param {(self: Button) => void} onClick
     * @param {boolean} [disabled]
     * @param {boolean} [isRight]
     */
    constructor(label, icon, onClick, disabled = false, isRight = false) {
      this.element = document.createElement("div");
      this.button = document.createElement("button");
      this.icon = icon;
      this.onClick = onClick;
      this.tippy = Spicetify.Tippy?.(this.element, {
        content: label,
        ...Spicetify.TippyProps,
      });
      this.label = label;

      this.element.appendChild(this.button);
      if (isRight) {
        this.button.className = rightGeneratedClassName;
        rightButtonsStash.add(this.element);
        rightContainer?.prepend(this.element);
      } else {
        this.button.className = leftGeneratedClassName;
        leftButtonsStash.add(this.element);
        leftContainer?.append(this.element);
      }
      this.disabled = disabled;
    }
    get label() {
      return this._label;
    }
    set label(text) {
      this._label = text;
      this.button.setAttribute("aria-label", text);
      if (!this.tippy) this.button.setAttribute("title", text);
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
      this.button.innerHTML = newInput;
    }
    get onClick() {
      return this._onClick;
    }
    set onClick(func) {
      this._onClick = func;
      this.button.onclick = () => this._onClick(this);
    }
    get disabled() {
      return this._disabled;
    }
    set disabled(bool) {
      this._disabled = bool;
      this.button.disabled = bool;
      this.button.classList.toggle("disabled", bool);
    }
  }

  function queryTopbarMounts() {
    const globalHistoryButtons = document.querySelector(".main-globalNav-historyButtons");
    const leftGenClassName = document.querySelector(
      ".main-topBar-historyButtons .main-topBar-button, .main-globalNav-historyButtons .main-globalNav-icon, .main-globalNav-historyButtons [data-encore-id='buttonTertiary']",
    )?.className;
    const rightGenClassName = document.querySelector(
      ".main-topBar-container .main-topBar-buddyFeed, .main-actionButtons .main-topBar-buddyFeed, .main-actionButtons .main-globalNav-buddyFeed",
    )?.className;
    const left = document.querySelector(".main-topBar-historyButtons") ?? globalHistoryButtons;
    const right = document.querySelector(".main-actionButtons");
    if (!left || !right || !leftGenClassName || !rightGenClassName) return null;

    return { globalHistoryButtons, leftGenClassName, rightGenClassName, left, right };
  }

  async function waitForTopbarMounted() {
    const mounts = await waitFor(queryTopbarMounts, 100);
    leftGeneratedClassName = mounts.leftGenClassName;
    rightGeneratedClassName = mounts.rightGenClassName;
    leftContainer = mounts.left;
    rightContainer = mounts.right;

    if (mounts.globalHistoryButtons) mounts.globalHistoryButtons.style = "gap: 4px; padding-inline: 4px 4px";
    for (const button of leftButtonsStash) {
      if (button.parentNode) button.parentNode.removeChild(button);

      const buttonElement = button.querySelector("button");
      buttonElement.className = leftGeneratedClassName;
      buttonElement.classList.toggle("disabled", buttonElement.disabled);
    }
    leftContainer.append(...leftButtonsStash);
    for (const button of rightButtonsStash) {
      if (button.parentNode) button.parentNode.removeChild(button);

      const buttonElement = button.querySelector("button");
      buttonElement.className = rightGeneratedClassName;
      buttonElement.classList.toggle("disabled", buttonElement.disabled);
    }
    rightContainer.prepend(...rightButtonsStash);
  }

  void waitForTopbarMounted();
  void (async function waitForPlatform() {
    const history = await waitFor(() => Spicetify.Platform?.History, 100);
    history.listen(() => waitForTopbarMounted());
  })();

  return { Button };
})();
