var Function = function(){};

Function.prototype = new Sqlobject();


var functionGroups;

Function.process = function (functionAliasInfo, functionAlias, subqueryGroup, functionCpt, outputTableAlias) {
	var functionDestination = functionAliasInfo.to;
	functions[functionAlias] = {type: "function",
		functionAlias: functionAlias,
		name: subqueryGroup + ".function_" + functionCpt,
		value: functionAliasInfo.name,
		isCondition: functionDestination === "NOWHERE"
	};
	if (functionDestination === "OUTPUT") {
		linksToOutput.push({type: "link", from: "function", sourceFunctionId: functionAlias, outputName: functions[functionAlias].functionAlias, outputTableAlias: outputTableAlias});
		fields.push({type: "field", tableAlias: outputTableAlias, name: functionAlias, fullName: functionAlias, filtered: false, sort: false, subqueryGroup: subqueryGroup});
	}
	else if (functionDestination !== "NOWHERE") {
		linksToFunctions.push({type: "link", from: "function", sourceFunctionId: functionAlias, functionAlias: functionDestination});
	}
	var functionConstants = functionAliasInfo.Constants;
	if (functionConstants !== undefined) {
		d3.forEach(d3.keys(functionConstants), function (constant) {
			var constantId = constants.length;
			constants.push({id: constantId, name: constant, functionAlias: functionAlias, type: "constant" });
			linksToFunctions.push({type: "link", from: "constant", constantId: constantId, functionAlias: functionAlias});
		});
	}
};

Function.build = function (functions) {
	functionGroups = mainGroup.append("svg:g").selectAll("g.functionGroup")
		.data(d3.values(functions))
		.enter()
		.append("svg:g")
		.classed("functionGroup", true)
		.each(function () {
			d3.select(this).data()[0].center =
				d3.select(this)
					.append("svg:ellipse")
					.classed("function", true)
					.classed("conditional", function (d) {
						return !!d.isCondition;
					})
					.attr("rx", function (d) {
						return d.value.length * CHAR_WIDTH + FUNCTION_ELLIPSE_PADDING.left * 2;
					})
					.attr("ry", FUNCTION_BOX_RY + FUNCTION_ELLIPSE_PADDING.top * 2);

			d3.select(this)
				.append("svg:text")
				.text(function (d) {
					return d.value;
				})
				.attr("x", function (d) {
					return -1 * d.value.length * CHAR_WIDTH / 2;
				});

		})
		.call(node_drag);
};

Function.position = function() {
	functionGroups.each(function(d) {
		var x=d.x || 0;
		var y=d.y || 0;

		d3.select(this)
			.attr("transform", "translate("+x+" "+y+")");

		positionPathsToFunctions("function",d3.select(this).data()[0]);
	});
};

Function.findByDatum = function(d, useSourceId) {
	return functionGroups.filter(function(func) {
		return func.functionAlias === (useSourceId ? d.sourceFunctionId : d.functionAlias);
	});
};

Function.getId = function(d, as) {
	for (var i in n) {
		if ((as === "source" ? d.sourceFunctionId :d .functionAlias) === n[i].functionAlias)
			return i;
	}
	return null;
};