class _HTMLGenericModal extends HTMLElement {
  hide() {
    Spicetify.ReactDOM.unmountComponentAtNode(this.querySelector("main"));
    this.remove();
  }

  display({ title, content, isLarge = false }) {
    this.innerHTML = `
<div class="GenericModal__overlay" style="z-index: 100;">
	<div class="GenericModal" tabindex="-1" role="dialog" aria-label="${title}" aria-modal="true">
		<div class="${isLarge ? "main-embedWidgetGenerator-container" : "main-trackCreditsModal-container"}">
			<div class="main-trackCreditsModal-header">
				<h1 class="main-type-alto" as="h1">${title}</h1>
				<button aria-label="Close" class="main-trackCreditsModal-closeBtn"><svg width="18" height="18" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg"><title>Close</title><path d="M31.098 29.794L16.955 15.65 31.097 1.51 29.683.093 15.54 14.237 1.4.094-.016 1.508 14.126 15.65-.016 29.795l1.414 1.414L15.54 17.065l14.144 14.143" fill="currentColor" fill-rule="evenodd"></path></svg></button>
			</div>
			<div class="main-trackCreditsModal-mainSection">
				<main class="main-trackCreditsModal-originalCredits"></main>
			</div>
		</div>
	</div>
</div>`;

    // The markup assigned above contains every element queried below.
    /** @type {HTMLButtonElement} */ (this.querySelector("button")).onclick = this.hide.bind(this);
    const main = /** @type {HTMLElement} */ (this.querySelector("main"));

    const hidePopup = this.hide.bind(this);

    // Listen for click events on Overlay
    /** @type {HTMLElement} */ (this.querySelector(".GenericModal__overlay")).addEventListener("click", (event) => {
      if (!(/** @type {HTMLElement} */ (this.querySelector(".GenericModal")).contains(/** @type {Node} */ (event.target)))) hidePopup();
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
