var Function = function(){};

Function.prototype = new Sqlobject();


var functionGroups;

Function.process = function (functionAliasInfo, functionAlias, subqueryGroup, functionCpt, outputTableAlias) {
	var functionDestination = functionAliasInfo.to;
	var isAggregation = functionAliasInfo.group === '1';

	functions[functionAlias] = {type: "function",
		functionAlias: functionAlias,
		name: subqueryGroup + ".function_" + functionCpt,
		value: functionAliasInfo.name,
		isCondition: functionDestination === "NOWHERE",
		isAggregation: isAggregation
	};
	if (functionDestination === "OUTPUT") {
		linksToOutput.push({type: "link", from: "function", sourceFunctionId: functionAlias, outputName: functions[functionAlias].functionAlias, outputTableAlias: outputTableAlias});
		fields.push({type: "field", tableAlias: outputTableAlias, name: functionAlias, fullName: functionAlias, filtered: false, sort: false, aggregation: isAggregation, subqueryGroup: subqueryGroup});
	}
	else if (functionDestination !== "NOWHERE") {
		linksToFunctions.push({type: "link", from: "function", sourceFunctionId: functionAlias, functionAlias: functionDestination});
	}
	d3.forEach(d3.keys(functionAliasInfo.Constants),
		function (constant) {
			Constant.processFunctionConstant(constant, functionAlias);
		}
	);
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
						return (Function.text(d).length * CHAR_WIDTH) / 2 + FUNCTION_ELLIPSE_PADDING.left;
					})
					.attr("ry", FUNCTION_BOX_RY + FUNCTION_ELLIPSE_PADDING.top);

			d3.select(this)
				.append("svg:text")
				.text(Function.text)
				.attr("x", function (d) {
					return -1 * Function.text(d).length * CHAR_WIDTH / 2;
				})
				.attr("y", CHAR_HEIGHT / 4);

		})
		.call(node_drag);
};

Function.text = function(d) {
	return (d.isAggregation && AGGREGATION_LABELS[d.value]) || d.value;
};

Function.position = function() {
	functionGroups.each(function(d) {
		var x=d.x || 0;
		var y=d.y || 0;

		d3.select(this)
			.attr("transform", "translate("+x+" "+y+")");

		Flow.positionPathsToFunctions("function",d3.select(this).data()[0]);
	});
};

Function.findByDatum = function(d, useSourceId) {
	return functionGroups.filter(function(func) {
		return func.functionAlias === (useSourceId ? d.sourceFunctionId : d.functionAlias);
	});
};

Function.getId = function(d, as) {
	for (var i in n) {
		if ((as === "source" ? d.sourceFunctionId : d.functionAlias) === n[i].functionAlias)
			return i;
	}
	return null;
};