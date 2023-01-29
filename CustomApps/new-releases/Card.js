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

	render() {
		let detail = [];
		this.visual.type && detail.push(this.type);
		if (this.visual.count && this.trackCount) {
			detail.push(Spicetify.Locale.get("tracklist-header.songs-counter", this.trackCount));
		}

		return react.createElement(
			Spicetify.ReactComponent.RightClickMenu || "div",
			{
				menu: react.createElement(this.menuType, { uri: this.uri })
			},
			react.createElement(
				"div",
				{
					className: "main-card-card",
					onClick: event => {
						History.push(this.href);
						event.preventDefault();
					}
				},
				react.createElement(
					"div",
					{
						className: "main-card-draggable",
						draggable: "true"
					},
					react.createElement(
						"div",
						{
							className: "main-card-imageContainer"
						},
						react.createElement(
							"div",
							{
								className: "main-cardImage-imageWrapper"
							},
							react.createElement(
								"div",
								{},
								react.createElement("img", {
									"aria-hidden": "false",
									draggable: "false",
									loading: "lazy",
									src: this.imageURL,
									className: "main-image-image main-cardImage-image"
								})
							)
						),
						react.createElement(
							"div",
							{
								className: "main-card-PlayButtonContainer"
							},
							react.createElement(
								"div",
								{
									className: "main-playButton-PlayButton main-playButton-primary",
									"aria-label": Spicetify.Locale.get("play"),
									style: { "--size": "40px" },
									onClick: this.play.bind(this)
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
												"aria-hidden": "true"
											},
											react.createElement("polygon", {
												points: "21.57 12 5.98 3 5.98 21 21.57 12",
												fill: "currentColor"
											})
										)
									)
								)
							)
						)
					),
					react.createElement(
						"div",
						{
							className: "main-card-cardMetadata"
						},
						react.createElement(
							"a",
							{
								draggable: "false",
								title: this.title,
								className: "main-cardHeader-link",
								dir: "auto",
								href: this.href
							},
							react.createElement(
								"div",
								{
									className: "main-cardHeader-text main-type-balladBold",
									as: "div"
								},
								this.title
							)
						),
						detail.length > 0 &&
							react.createElement(
								"div",
								{
									className: "main-cardSubHeader-root main-type-mestoBold new-releases-cardSubHeader",
									as: "div"
								},
								react.createElement("span", null, detail.join(" • "))
							),
						react.createElement(
							"a",
							{
								className: `main-cardSubHeader-root main-type-mesto new-releases-cardSubHeader`,
								href: this.artistHref,
								onClick: event => {
									History.push(this.artistHref);
									event.stopPropagation();
									event.preventDefault();
								}
							},
							react.createElement("span", null, this.artist.name)
						)
					),
					react.createElement("div", {
						className: "main-card-cardLink"
					})
				)
			)
		);
	}
}
