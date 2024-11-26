function DraggableComponent({ uri, title, children }) {
	const dragHandler = Spicetify.ReactHook.DragHandler?.([uri], title);
	return dragHandler
		? react.cloneElement(children, {
				onDragStart: dragHandler,
				draggable: "true",
			})
		: children;
}

class Card extends react.Component {
	constructor(props) {
		super(props);
		Object.assign(this, props);
		this.href = URI.fromString(this.uri).toURLPath(true);
		this.artistHref = URI.fromString(this.artist.uri).toURLPath(true);
		const uriType = Spicetify.URI.fromString(this.uri)?.type;
		switch (uriType) {
			case Spicetify.URI.Type.ALBUM:
			case Spicetify.URI.Type.TRACK:
				this.menuType = Spicetify.ReactComponent.AlbumMenu;
				break;
		}
		this.menuType = this.menuType || "div";
	}

	play(event) {
		Spicetify.Player.playUri(this.uri, this.context);
		event.stopPropagation();
	}

	closeButtonClicked(event) {
		event.stopPropagation();

		removeCards(this.props.uri);

		Spicetify.Snackbar.enqueueCustomSnackbar
			? Spicetify.Snackbar.enqueueCustomSnackbar("dismissed-release", {
					keyPrefix: "dismissed-release",
					children: Spicetify.ReactComponent.Snackbar.wrapper({
						children: Spicetify.ReactComponent.Snackbar.simpleLayout({
							leading: Spicetify.ReactComponent.Snackbar.styledImage({
								src: this.props.imageURL,
								imageHeight: "24px",
								imageWidth: "24px",
							}),
							center: Spicetify.React.createElement("div", {
								dangerouslySetInnerHTML: {
									__html: `Dismissed <b>${this.title}</b>.`,
								},
							}),
							trailing: Spicetify.ReactComponent.Snackbar.ctaText({
								ctaText: "Undo",
								onCtaClick: () => removeCards(this.props.uri, "undo"),
							}),
						}),
					}),
				})
			: Spicetify.showNotification(`Dismissed <b>${this.title}</b> from <br>${this.artist.name}</b>`);
	}

	render() {
		const detail = [];
		this.visual.type && detail.push(this.type);
		if (this.visual.count && this.trackCount) {
			detail.push(Spicetify.Locale.get("tracklist-header.songs-counter", this.trackCount));
		}

		return react.createElement(
			Spicetify.ReactComponent.RightClickMenu || "div",
			{
				menu: react.createElement(this.menuType, { uri: this.uri }),
			},
			react.createElement(
				"div",
				{
					className: "main-card-card",
					onClick: (event) => {
						History.push(this.href);
						event.preventDefault();
					},
				},
				react.createElement(
					DraggableComponent,
					{
						uri: this.uri,
						title: this.title,
					},
					react.createElement(
						"div",
						{
							className: "main-card-draggable",
						},
						react.createElement(
							"div",
							{
								className: "main-card-imageContainer",
							},
							react.createElement(
								"div",
								{
									className: "main-cardImage-imageWrapper",
								},
								react.createElement(
									"div",
									{},
									react.createElement("img", {
										"aria-hidden": "false",
										draggable: "false",
										loading: "lazy",
										src: this.imageURL,
										className: "main-image-image main-cardImage-image",
									})
								)
							),
							react.createElement(
								"div",
								{
									className: "main-card-PlayButtonContainer",
								},
								react.createElement(
									"div",
									{
										className: "main-playButton-PlayButton main-playButton-primary",
										"aria-label": Spicetify.Locale.get("play"),
										style: { "--size": "40px" },
										onClick: this.play.bind(this),
									},
									react.createElement(
										"button",
										null,
										react.createElement(
											"span",
											null,
											react.createElement(
												"svg",
												{
													height: "24",
													role: "img",
													width: "24",
													viewBox: "0 0 24 24",
													"aria-hidden": "true",
												},
												react.createElement("polygon", {
													points: "21.57 12 5.98 3 5.98 21 21.57 12",
													fill: "currentColor",
												})
											)
										)
									)
								)
							),
							react.createElement(
								Spicetify.ReactComponent.TooltipWrapper,
								{ label: "Dismiss" },
								react.createElement(
									"button",
									{
										className: "main-card-closeButton",
										onClick: this.closeButtonClicked.bind(this),
									},
									react.createElement(
										"svg",
										{
											width: "16",
											height: "16",
											viewBox: "0 0 16 16",
											xmlns: "http://www.w3.org/2000/svg",
											className: "main-card-closeButton-svg",
										},
										react.createElement("path", {
											d: "M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06Z",
											fill: "var(--spice-text)",
											fillRule: "evenodd",
										})
									)
								)
							)
						),
						react.createElement(
							"div",
							{
								className: "main-card-cardMetadata",
							},
							react.createElement(
								"a",
								{
									draggable: "false",
									title: this.title,
									className: "main-cardHeader-link",
									dir: "auto",
									href: this.href,
								},
								react.createElement(
									"div",
									{
										className: "main-cardHeader-text main-type-balladBold",
									},
									this.title
								)
							),
							detail.length > 0 &&
								react.createElement(
									"div",
									{
										className: "main-cardSubHeader-root main-type-mestoBold new-releases-cardSubHeader",
									},
									react.createElement("span", null, detail.join(" • "))
								),
							react.createElement(
								DraggableComponent,
								{
									uri: this.artist.uri,
									title: this.artist.name,
								},
								react.createElement(
									"a",
									{
										className: "main-cardSubHeader-root main-type-mesto new-releases-cardSubHeader",
										href: this.artistHref,
										onClick: (event) => {
											History.push(this.artistHref);
											event.stopPropagation();
											event.preventDefault();
										},
									},
									react.createElement("span", null, this.artist.name)
								)
							)
						),
						react.createElement("div", {
							className: "main-card-cardLink",
						})
					)
				)
			)
		);
	}
}
