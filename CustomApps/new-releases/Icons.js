const LoadingIcon = react.createElement(
	"svg",
	{
		width: "100px",
		height: "100px",
		viewBox: "0 0 100 100",
		preserveAspectRatio: "xMidYMid"
	},
	react.createElement(
		"circle",
		{
			cx: "50",
			cy: "50",
			r: "0",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2"
		},
		react.createElement("animate", {
			attributeName: "r",
			repeatCount: "indefinite",
			dur: "1s",
			values: "0;40",
			keyTimes: "0;1",
			keySplines: "0 0.2 0.8 1",
			calcMode: "spline",
			begin: "0s"
		}),
		react.createElement("animate", {
			attributeName: "opacity",
			repeatCount: "indefinite",
			dur: "1s",
			values: "1;0",
			keyTimes: "0;1",
			keySplines: "0.2 0 0.8 1",
			calcMode: "spline",
			begin: "0s"
		})
	),
	react.createElement(
		"circle",
		{
			cx: "50",
			cy: "50",
			r: "0",
			fill: "none",
			stroke: "currentColor",
			"stroke-width": "2"
		},
		react.createElement("animate", {
			attributeName: "r",
			repeatCount: "indefinite",
			dur: "1s",
			values: "0;40",
			keyTimes: "0;1",
			keySplines: "0 0.2 0.8 1",
			calcMode: "spline",
			begin: "-0.5s"
		}),
		react.createElement("animate", {
			attributeName: "opacity",
			repeatCount: "indefinite",
			dur: "1s",
			values: "1;0",
			keyTimes: "0;1",
			keySplines: "0.2 0 0.8 1",
			calcMode: "spline",
			begin: "-0.5s"
		})
	)
);

class LoadMoreIcon extends react.Component {
	render() {
		return react.createElement(
			"div",
			{
				onClick: this.props.onClick
			},
			react.createElement(
				"p",
				{
					style: {
						fontSize: 100,
						lineHeight: "65px"
					}
				},
				"»"
			),
			react.createElement(
				"span",
				{
					style: {
						fontSize: 20
					}
				},
				"Load more"
			)
		);
	}
}
