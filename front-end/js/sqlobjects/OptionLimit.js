var OptionLimit = function(){};

OptionLimit.prototype = new Sqlobject();


var	options,
	limits;

OptionLimit.build = function (subqueryGroup, currentTableElement, tableWidth, tableHeight) {
	var infoboxSources = [
		{ type: "options", data: options },
		{ type: "limits", data: limits  }
	];

	var currentYOffset = tableHeight;

	d3.forEach(infoboxSources, function (infoboxSource) {
		var dataForCurrentSubqueryGroup = infoboxSource.data.filter(function (currentData) {
			return currentData.subqueryGroup === subqueryGroup;
		});

		if (dataForCurrentSubqueryGroup.length) {
			var currentData = dataForCurrentSubqueryGroup[0][infoboxSource.type];
			if (currentData) {
				var textLines = [];

				switch (infoboxSource.type) {
					case 'limits':
						textLines.push(
							(currentData.Begin ? LIMITS_2_BOUNDARIES : LIMITS_1_BOUNDARY)
								.replace(/\$1/, currentData.Begin)
								.replace(/\$2/, currentData.End)
								.replace(/\$3/, (currentData.End - currentData.Begin > 1) ? 's' : '')
						);
						break;
					case 'options':
						d3.forEach(currentData, function (value, optionName) {
							textLines.push(OPTIONS_LABELS[optionName]);
						});
						break;
				}

				var infoboxHeight = (1 + textLines.length) * CHAR_HEIGHT;

				currentTableElement
					.append("svg:rect")
					.attr("class", "infobox " + infoboxSource.type)
					.attr("height", infoboxHeight)
					.attr("y", currentYOffset);

				var infoboxTextContainer = currentTableElement
					.selectAll(".infoboxText." + infoboxSource.type)
					.data(textLines)
					.enter();

				infoboxTextContainer
					.append("svg:rect")
					.attr("height", CHAR_HEIGHT)
					.attr("width", function (line) {
						return (line.text || line).length * CHAR_WIDTH;
					})
					.attr("y", function (line, i) {
						return currentYOffset + i * CHAR_HEIGHT;
					})
					.attr("class", "infoboxText " + infoboxSource.type)
					.on("click", function (line) {
						if (line.doc) {
							window.open(DOC_ROOT_URL + line.doc);
						}
					});

				infoboxTextContainer
					.append("svg:text")
					.text(function (line) {
						return line.text || line;
					})
					.attr("x", OPTION_PADDING.left)
					.attr("y", function (line, lineNumber) {
						return currentYOffset + OPTION_PADDING.top + lineNumber * CHAR_HEIGHT;
					});

				currentYOffset += infoboxHeight;
			}
		}
	});

	d3.selectAll(".infobox").attr("width",
		d3.max([tableWidth + getAliasWidth(true),
			d3.max(d3.selectAll(".infoboxText").data(), function (infobox) {
				return (infobox.text || infobox).length * CHAR_WIDTH;
			})
		])
	);
};

OptionLimit.process = function(subqueryGroup, data) {
	if (!!data.Limits) {
		limits.push({subqueryGroup: subqueryGroup, limits: data.Limits});
	}

	if (!!data.Options) {
		options.push({subqueryGroup: subqueryGroup, options: data.Options});
	}


};