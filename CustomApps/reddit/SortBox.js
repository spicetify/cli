class SortBox extends react.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return react.createElement("div", {
            className: "reddit-sort-bar",
        }, react.createElement("div", {
            className: "reddit-sort-container",
        }, react.createElement("button", {
            className: "switch",
            onClick: openConfig,
            dangerouslySetInnerHTML: {
                __html: `<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">${Spicetify.SVGIcons.edit}</svg>`,
            },
        }), react.createElement("select", {
            className: "main-type-mestoBold",
            id: "reddit-sort-by",
            onChange: () => {
                this.props.onChange();
                this.forceUpdate();
            },
            value: sortConfig.by,
        }, react.createElement("option", {
            value: "hot"
        }, "Hot"), react.createElement("option", {
            value: "new"
        }, "New"), react.createElement("option", {
            value: "top"
        }, "Top"), react.createElement("option", {
            value: "rising"
        }, "Rising"), react.createElement("option", {
            value: "controversial"
        }, "Controversial")), !!sortConfig.by.match(/top|controversial/) &&
        react.createElement("select", {
            className: "main-type-mestoBold",
            id: "reddit-sort-time",
            onChange: this.props.onChange,
            value: sortConfig.time,
        }, react.createElement("option", {
            value: "hour"
        }, "Hour"), react.createElement("option", {
            value: "day"
        }, "Day"), react.createElement("option", {
            value: "week"
        }, "Week"), react.createElement("option", {
            value: "month"
        }, "Month"), react.createElement("option", {
            value: "year"
        }, "Year"), react.createElement("option", {
            value: "all"
        }, "All"))
        ));
    }
}