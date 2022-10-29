class SortBox extends react.Component {
	constructor(props) {
		super(props);
		this.sortByOptions = [
			{ key: "hot", value: "Hot" },
			{ key: "new", value: "New" },
			{ key: "top", value: "Top" },
			{ key: "rising", value: "Rising" },
			{ key: "controversial", value: "Controversial" }
		];
		this.sortTimeOptions = [
			{ key: "hour", value: "Hour" },
			{ key: "day", value: "Day" },
			{ key: "week", value: "Week" },
			{ key: "month", value: "Month" },
			{ key: "year", value: "Year" },
			{ key: "all", value: "All" }
		];
	}

	render() {
		const sortBySelected = this.sortByOptions.filter(a => a.key === sortConfig.by)[0];
		const sortTimeSelected = this.sortTimeOptions.filter(a => a.key === sortConfig.time)[0];

		return react.createElement(
			"div",
			{
				className: "reddit-sort-bar"
			},
			react.createElement(
				"div",
				{
					className: "reddit-sort-container"
				},
				react.createElement(OptionsMenu, {
					options: this.sortByOptions,
					onSelect: by => this.props.onChange(by, null),
					selected: sortBySelected
				}),
				!!sortConfig.by.match(/top|controversial/) &&
					react.createElement(OptionsMenu, {
						options: this.sortTimeOptions,
						onSelect: time => this.props.onChange(null, time),
						selected: sortTimeSelected
					})
			)
		);
	}
}
