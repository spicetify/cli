class Card extends react.Component {
    constructor(props) {
        super(props);
        Object.assign(this, props);
        this.href = "/" + URI.from(this.uri).toURLPath();
    }

    play(event) {
        const api = Spicetify.Player.origin2 || Spicetify.PlaybackControl.playUri;
        api.playUri(this.uri);
        event.stopPropagation();
    }

    render() {
        let detail = [];
        this.visual.type && detail.push(this.type);
        this.visual.upvotes && detail.push(`▲ ${this.upvotes}`);

        return react.createElement("div", {
            className: "main-card-card",
            onClick: (event) => {
                History.push(this.href);
                event.preventDefault();
            },
        }, react.createElement("div", {
            className: "main-card-draggable",
            draggable: "true"
        }, react.createElement("div", {
            className: "main-card-imageContainer"
        }, react.createElement("div", {
            className: "main-cardImage-imageWrapper"
        }, react.createElement("div", {
        }, react.createElement("img", {
            "aria-hidden": "false",
            draggable: "false",
            loading: "lazy",
            src: this.imageURL,
            alt: "",
            className: "main-image-image main-cardImage-image"
        }))), react.createElement("div", {
            className: "main-card-PlayButtonContainer"
        }, react.createElement("button", {
            className: "main-playButton-PlayButton main-playButton-primary",
            "aria-label": "Play",
            style: { "--size": "40px" },
            onClick: this.play.bind(this),
        }, react.createElement("svg", {
            height: "16",
            role: "img",
            width: "16",
            viewBox: "0 0 24 24",
            "aria-hidden": "true"
        }, react.createElement("polygon", {
            points: "21.57 12 5.98 3 5.98 21 21.57 12",
            fill: "currentColor"
        }))))), react.createElement("div", {
            className: "main-card-cardMetadata"
        }, react.createElement("a", {
            draggable: "false",
            title: this.title,
            className: "main-cardHeader-link",
            dir: "auto",
            href: this.href
        }, react.createElement("div", {
            className: "main-cardHeader-text main-type-balladBold",
            as: "div"
        }, this.title)), detail.length > 0 && react.createElement("div", {
            className: "main-cardSubHeader-root main-type-mestoBold reddit-cardSubHeader",
            as: "div",
        }, react.createElement("span", null, detail.join(" ‒ ")),
        ), this.visual.followers && (this.type === "Playlist") && react.createElement("div", {
            className: "main-cardSubHeader-root main-type-mestoBold reddit-cardSubHeader",
            as: "div",
        }, react.createElement("span", null, `${this.followersCount} followers`)
        ), react.createElement("div", {
            // long: this.visual.longDescription,
            className: `${this.visual.longDescription ? "reddit-longDescription " : ""}main-cardSubHeader-root main-type-mesto reddit-cardSubHeader`,
            as: "div",
        }, react.createElement("span", null, this.subtitle)),
        ), react.createElement("div", {
            className: "main-card-cardLink"
        })));
    }
}
