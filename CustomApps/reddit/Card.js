class Card extends react.Component {
	constructor(props) {
		super(props);
		Object.assign(this, props);
		const uriObj = URI.fromString(this.uri);
		this.href = uriObj.toURLPath(true);

		this.uriType = uriObj.type;
		switch (this.uriType) {
			case URI.Type.ALBUM:
			case URI.Type.TRACK:
				this.menuType = Spicetify.ReactComponent.AlbumMenu;
				break;
			case URI.Type.ARTIST:
				this.menuType = Spicetify.ReactComponent.ArtistMenu;
				break;
			case URI.Type.PLAYLIST:
			case URI.Type.PLAYLIST_V2:
				this.menuType = Spicetify.ReactComponent.PlaylistMenu;
				break;
			case URI.Type.SHOW:
				this.menuType = Spicetify.ReactComponent.PodcastShowMenu;
				break;
		}
		this.menuType = this.menuType || "div";
	}

	play(event) {
		Spicetify.Player.playUri(this.uri, this.context);
		event.stopPropagation();
	}

	getSubtitle() {
		let subtitle;
		if (this.uriType === URI.Type.ALBUM || this.uriType === URI.Type.TRACK) {
			subtitle = this.subtitle.map(artist => {
				const artistHref = URI.fromString(artist.uri).toURLPath(true);
				return react.createElement(
					"a",
					{
						href: artistHref,
						onClick: event => {
							event.preventDefault();
							event.stopPropagation();
							History.push(artistHref);
						}
					},
					react.createElement("span", null, artist.name)
				);
			});
			// Insert commas between elements
			subtitle = subtitle.flatMap((el, i, arr) => (arr.length - 1 !== i ? [el, ", "] : el));
		} else {
			subtitle = react.createElement(
				"div",
				{
					className: `${this.visual.longDescription ? "reddit-longDescription " : ""}main-cardSubHeader-root main-type-mesto reddit-cardSubHeader`,
					as: "div"
				},
				react.createElement("span", null, this.subtitle)
			);
		}
		return react.createElement(
			"div",
			{
				className: "reddit-cardSubHeader main-type-mesto"
			},
			subtitle
		);
	}

	getFollowers() {
		if (this.visual.followers && (this.uriType === URI.Type.PLAYLIST || this.uriType === URI.Type.PLAYLIST_V2)) {
			return react.createElement(
				"div",
				{
					className: "main-cardSubHeader-root main-type-mestoBold reddit-cardSubHeader",
					as: "div"
				},
				react.createElement("span", null, Spicetify.Locale.get("user.followers", this.followersCount))
			);
		}
	}

	render() {
		let detail = [];
		this.visual.type && detail.push(this.type);
		this.visual.upvotes && detail.push(`▲ ${this.upvotes}`);

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
									className: "main-cardSubHeader-root main-type-mestoBold reddit-cardSubHeader",
									as: "div"
								},
								react.createElement("span", null, detail.join(" ‒ "))
							),
						this.getFollowers(),
						this.getSubtitle()
					)
				)
			)
		);
	}
}
