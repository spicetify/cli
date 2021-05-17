class TabBarItem extends react.Component {
    constructor(props) {
        super(props);
    }
    render() {
        return react.createElement("li", {
            className: "reddit-tabBar-headerItem",
            onClick: this.props.switchTo,
        }, react.createElement("a", {
            "aria-current": "page",
            className: `reddit-tabBar-headerItemLink ${this.props.isActive ? "reddit-tabBar-active" : ""}`,
            draggable: "false",
            href: `/reddit/${this.props.name}`,
        }, react.createElement("span", {
            className: "main-type-mestoBold"
        }, this.props.name)));
    }

}

class TabBar extends react.Component {
    render() {
        return react.createElement("nav", {
            className: "reddit-tabBar reddit-tabBar-nav"
        }, react.createElement("ul", {
            className: "reddit-tabBar-header"
        }, this.props.list.map(item => react.createElement(TabBarItem, {
            name: item,
            switchTo: this.props.switchTo,
            isActive: item === this.props.itemActive,
        }))));
    }

}
