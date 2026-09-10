function injectStyles() {
  if (document.querySelector("style.spicetify-popup-modal")) return;

  const style = document.createElement("style");
  style.className = "spicetify-popup-modal";
  style.textContent = `
generic-modal :where(.spicetify-popup) { display: flex; max-height: calc(100vh - 64px); border-radius: 8px; overflow: hidden; }
generic-modal :where(.spicetify-popup-container) { display: flex; flex-direction: column; width: 524px; max-width: 100%; min-height: 0; border-radius: 8px; color: var(--spice-text, var(--text-base, #fff)); background-color: var(--spice-player, var(--background-elevated-base, #121212)); }
generic-modal :where(.spicetify-popup-container-large) { width: 664px; }
generic-modal :where(.spicetify-popup-header) { display: flex; flex: 0 0 auto; align-items: center; justify-content: space-between; gap: 16px; padding: 24px; }
generic-modal :where(.spicetify-popup-title) { margin: 0; font-size: 1.5rem; font-weight: 700; line-height: 1.3; }
generic-modal :where(.spicetify-popup-closeBtn) { display: flex; flex: 0 0 auto; align-items: center; justify-content: center; width: 32px; height: 32px; padding: 0; margin-block-start: -8px; margin-inline-end: -8px; border: 0; border-radius: 50%; background-color: transparent; color: var(--spice-subtext, var(--text-subdued, #b3b3b3)); cursor: pointer; }
generic-modal :where(.spicetify-popup-closeBtn:hover) { color: var(--spice-text, var(--text-base, #fff)); }
generic-modal :where(.spicetify-popup-closeBtn:focus-visible) { outline: 2px solid currentColor; outline-offset: 2px; }
generic-modal :where(.spicetify-popup-content) { flex: 1 1 auto; min-height: 0; overflow-y: auto; padding: 0 24px 24px; }
`;
  document.head.append(style);
}

class _HTMLGenericModal extends HTMLElement {
  hide() {
    Spicetify.ReactDOM.unmountComponentAtNode(this.querySelector("main"));
    this.remove();
  }

  display({ title, content, isLarge = false }) {
    injectStyles();

    const containerClass = isLarge
      ? "spicetify-popup-container spicetify-popup-container-large main-embedWidgetGenerator-container"
      : "spicetify-popup-container main-trackCreditsModal-container";

    this.innerHTML = `
<div class="GenericModal__overlay" style="z-index: 100;">
	<div class="GenericModal spicetify-popup" tabindex="-1" role="dialog" aria-label="${title}" aria-modal="true">
		<div class="${containerClass}">
			<div class="spicetify-popup-header main-trackCreditsModal-header">
				<h1 class="spicetify-popup-title main-type-alto" as="h1">${title}</h1>
				<button aria-label="Close" class="spicetify-popup-closeBtn main-trackCreditsModal-closeBtn"><svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><title>Close</title><path d="M31.098 29.794L16.955 15.65 31.097 1.51 29.683.093 15.54 14.237 1.4.094-.016 1.508 14.126 15.65-.016 29.795l1.414 1.414L15.54 17.065l14.144 14.143" fill="currentColor" fill-rule="evenodd"></path></svg></button>
			</div>
			<div class="spicetify-popup-content main-trackCreditsModal-mainSection">
				<main class="main-trackCreditsModal-originalCredits"></main>
			</div>
		</div>
	</div>
</div>`;

    this.querySelector("button").onclick = this.hide.bind(this);
    const main = this.querySelector("main");

    const hidePopup = this.hide.bind(this);

    // Listen for click events on Overlay
    this.querySelector(".GenericModal__overlay").addEventListener("click", (event) => {
      if (!this.querySelector(".GenericModal").contains(event.target)) hidePopup();
    });

    if (Spicetify.React.isValidElement(content)) {
      Spicetify.ReactDOM.render(content, main);
    } else if (typeof content === "string") {
      main.innerHTML = content;
    } else {
      main.append(content);
    }
    document.body.append(this);
  }
}
customElements.define("generic-modal", _HTMLGenericModal);
Spicetify.PopupModal = new _HTMLGenericModal();

Object.defineProperty(Spicetify, "TippyProps", {
  value: {
    delay: [200, 0],
    animation: true,
    render(instance) {
      const popper = document.createElement("div");
      const box = document.createElement("div");

      popper.id = "context-menu";
      popper.appendChild(box);

      box.className = "main-contextMenu-tippy";
      box[instance.props.allowHTML ? "innerHTML" : "textContent"] = instance.props.content;

      function onUpdate(prevProps, nextProps) {
        if (prevProps.content !== nextProps.content) {
          if (nextProps.allowHTML) box.innerHTML = nextProps.content;
          else box.textContent = nextProps.content;
        }
      }

      return { popper, onUpdate };
    },
    onShow(instance) {
      instance.popper.firstChild.classList.add("main-contextMenu-tippyEnter");
    },
    onMount(instance) {
      requestAnimationFrame(() => {
        instance.popper.firstChild.classList.remove("main-contextMenu-tippyEnter");
        instance.popper.firstChild.classList.add("main-contextMenu-tippyEnterActive");
      });
    },
    onHide(instance) {
      requestAnimationFrame(() => {
        instance.popper.firstChild.classList.remove("main-contextMenu-tippyEnterActive");
        instance.unmount();
      });
    },
  },
  writable: false,
});
