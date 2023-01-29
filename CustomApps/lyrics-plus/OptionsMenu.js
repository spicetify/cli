const OptionsMenuItemIcon = react.createElement(
	"svg",
	{
		width: 16,
		height: 16,
		viewBox: "0 0 16 16",
		fill: "currentColor"
	},
	react.createElement("path", {
		d: "M13.985 2.383L5.127 12.754 1.388 8.375l-.658.77 4.397 5.149 9.618-11.262z"
	})
);

const OptionsMenuItem = react.memo(({ onSelect, value, isSelected }) => {
	return react.createElement(
		Spicetify.ReactComponent.MenuItem,
		{
			onClick: onSelect,
			icon: isSelected ? OptionsMenuItemIcon : null
		},
		value
	);
});

const OptionsMenu = react.memo(({ options, onSelect, selected, defaultValue, bold = false }) => {
	/**
	 * <Spicetify.ReactComponent.ContextMenu
	 *      menu = { options.map(a => <OptionsMenuItem>) }
	 * >
	 *      <button>
	 *          <span> {select.value} </span>
	 *          <svg> arrow icon </svg>
	 *      </button>
	 * </Spicetify.ReactComponent.ContextMenu>
	 */
	let menuRef = react.useRef(null);
	return react.createElement(
		Spicetify.ReactComponent.ContextMenu,
		{
			menu: react.createElement(
				Spicetify.ReactComponent.Menu,
				{},
				options.map(({ key, value }) =>
					react.createElement(OptionsMenuItem, {
						value,
						onSelect: () => {
							onSelect(key);
							// Close menu on item click
							menuRef.current?.click();
						},
						isSelected: selected?.key === key
					})
				)
			),
			trigger: "click",
			action: "toggle",
			renderInline: true
		},
		react.createElement(
			"button",
			{
				className: "optionsMenu-dropBox",
				ref: menuRef
			},
			react.createElement(
				"span",
				{
					className: bold ? "main-type-mestoBold" : "main-type-mesto"
				},
				selected?.value || defaultValue
			),
			react.createElement(
				"svg",
				{
					height: "16",
					width: "16",
					fill: "currentColor",
					viewBox: "0 0 16 16"
				},
				react.createElement("path", {
					d: "M3 6l5 5.794L13 6z"
				})
			)
		)
	);
});

const TranslationMenu = react.memo(({ showTranslationButton, translatorLoaded, isJapanese, hasNeteaseTranslation }) => {
	if (!showTranslationButton) return null;

	let translator = new Translator();

	let menuOptions = null;
	if (isJapanese) {
		menuOptions = {
			furigana: "Furigana",
			romaji: "Romaji",
			hiragana: "Hiragana",
			katakana: "Katakana"
		};
	}
	if (hasNeteaseTranslation) {
		menuOptions = {
			...menuOptions,
			neteaseTranslation: "Netease"
		};
	}

	return react.createElement(
		Spicetify.ReactComponent.ContextMenu,
		{
			menu: react.createElement(
				Spicetify.ReactComponent.Menu,
				{},
				react.createElement("h3", null, " Conversions"),
				react.createElement(OptionList, {
					items: [
						{
							desc: "Mode",
							key: "translation-mode",
							type: ConfigSelection,
							options: menuOptions,
							renderInline: true
						},
						{
							desc: "Convert",
							key: "translate",
							type: ConfigSlider,
							trigger: "click",
							action: "toggle",
							renderInline: true
						}
					],
					onChange: (name, value) => {
						CONFIG.visual[name] = value;
						localStorage.setItem(`${APP_NAME}:visual:${name}`, value);
						lyricContainerUpdate && lyricContainerUpdate();
						CONFIG.visual[name] ? Spicetify.showNotification("Translating...", false, 500) : null;
						translator.injectExternals();
					}
				})
			),
			trigger: "click",
			action: "toggle",
			renderInline: true
		},
		react.createElement(
			"button",
			{
				className: "lyrics-config-button"
			},
			react.createElement(
				"p1",
				{
					width: 16,
					height: 16,
					viewBox: "0 0 16 10.3",
					fill: "currentColor"
				},
				"あ"
			)
		)
	);
});

const AdjustmentsMenu = react.memo(({ mode }) => {
	return react.createElement(
		Spicetify.ReactComponent.ContextMenu,
		{
			menu: react.createElement(
				Spicetify.ReactComponent.Menu,
				{},
				react.createElement("h3", null, " Adjustments"),
				react.createElement(OptionList, {
					items: [
						{
							desc: "Font size",
							key: "font-size",
							type: ConfigAdjust,
							min: fontSizeLimit.min,
							max: fontSizeLimit.max,
							step: fontSizeLimit.step
						},
						{
							desc: "Delay",
							key: "delay",
							type: ConfigAdjust,
							min: -10000,
							max: 10000,
							step: 250,
							when: () => mode === SYNCED || mode === KARAOKE
						},
						{
							desc: "Compact",
							key: "synced-compact",
							type: ConfigSlider,
							when: () => mode === SYNCED || mode === KARAOKE
						},
						{
							desc: "Dual panel",
							key: "dual-genius",
							type: ConfigSlider,
							when: () => mode === GENIUS
						}
					],
					onChange: (name, value) => {
						CONFIG.visual[name] = value;
						localStorage.setItem(`${APP_NAME}:visual:${name}`, value);
						name === "delay" && localStorage.setItem(`lyrics-delay:${Spicetify.Player.data.track.uri}`, value);
						lyricContainerUpdate && lyricContainerUpdate();
					}
				})
			),
			trigger: "click",
			action: "toggle",
			renderInline: true
		},
		react.createElement(
			"button",
			{
				className: "lyrics-config-button"
			},
			react.createElement(
				"svg",
				{
					width: 16,
					height: 16,
					viewBox: "0 0 16 10.3",
					fill: "currentColor"
				},
				react.createElement("path", {
					d: "M 10.8125,0 C 9.7756347,0 8.8094481,0.30798341 8,0.836792 7.1905519,0.30798341 6.2243653,0 5.1875,0 2.3439941,0 0,2.3081055 0,5.15625 0,8.0001222 2.3393555,10.3125 5.1875,10.3125 6.2243653,10.3125 7.1905519,10.004517 8,9.4757081 8.8094481,10.004517 9.7756347,10.3125 10.8125,10.3125 13.656006,10.3125 16,8.0043944 16,5.15625 16,2.3123779 13.660644,0 10.8125,0 Z M 8,2.0146484 C 8.2629394,2.2503662 8.4963378,2.5183106 8.6936034,2.8125 H 7.3063966 C 7.5036622,2.5183106 7.7370606,2.2503662 8,2.0146484 Z M 6.619995,4.6875 C 6.6560059,4.3625487 6.7292481,4.0485841 6.8350831,3.75 h 2.3298338 c 0.1059572,0.2985841 0.1790772,0.6125487 0.21521,0.9375 z M 9.380005,5.625 C 9.3439941,5.9499512 9.2707519,6.2639159 9.1649169,6.5625 H 6.8350831 C 6.7291259,6.2639159 6.6560059,5.9499512 6.6198731,5.625 Z M 5.1875,9.375 c -2.3435059,0 -4.25,-1.8925781 -4.25,-4.21875 0,-2.3261719 1.9064941,-4.21875 4.25,-4.21875 0.7366944,0 1.4296875,0.1899414 2.0330809,0.5233154 C 6.2563478,2.3981934 5.65625,3.7083741 5.65625,5.15625 c 0,1.4478759 0.6000978,2.7580566 1.5643309,3.6954347 C 6.6171875,9.1850584 5.9241944,9.375 5.1875,9.375 Z M 8,8.2978516 C 7.7370606,8.0621337 7.5036622,7.7938231 7.3063966,7.4996337 H 8.6936034 C 8.4963378,7.7938231 8.2629394,8.0621338 8,8.2978516 Z M 10.8125,9.375 C 10.075806,9.375 9.3828125,9.1850584 8.7794191,8.8516847 9.7436522,7.9143066 10.34375,6.6041259 10.34375,5.15625 10.34375,3.7083741 9.7436522,2.3981934 8.7794191,1.4608154 9.3828125,1.1274414 10.075806,0.9375 10.8125,0.9375 c 2.343506,0 4.25,1.8925781 4.25,4.21875 0,2.3261719 -1.906494,4.21875 -4.25,4.21875 z m 0,0"
				})
			)
		)
	);
});
