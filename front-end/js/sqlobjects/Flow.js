var Flow = function(){};

Flow.prototype = new Sqlobject();


var paths,
	pathsToFunctions,
	pathsToOutput;

Flow.build = function(data) {
	paths = mainGroup.append("svg:g").selectAll("path.join")
		.data(data)
		.enter().append("svg:path")
		.classed("link", true)
		.attr("id", function(d,i) { return "link"+i; })
		.attr("marker-start", function(d) {
			if (d3.values(JOIN_TYPES).indexOf(d.type) !== -1) {
				return "url(#solidlink1)";
			}
			else {
				return "";
			}
		})
		.attr("marker-end", function(d) {
			if (d.type === "innerjoin") {
				return "url(#solidlink2)";
			}
			else if (d3.keys(SUBSELECT_TYPES).indexOf(d.type) !== -1) {
				return "url(#subquery)";
			}
			else {
				return "";
			}
		})
		.each(function(d,i) {
			if (d3.keys(SUBSELECT_TYPES).indexOf(d.type) !== -1) {
				mainGroup
					.append("svg:text")
					.append("textPath")
					.attr("startOffset","50%")
					.attr("xlink:href","#link"+i)
					.append("tspan")
					.attr("dy",SUBQUERY_TYPE_PADDING)
					.text(SUBSELECT_TYPES[d.type]);
			}
		});

	pathsToOutput = mainGroup.append("svg:g").selectAll("path.output")
		.data(linksToOutput)
		.enter().append("svg:path")
		.attr("id", function(d,i) { return "outputpath"+i;})
		.attr("marker-end", "url(#arrow)")
		.classed({output: true, link: true});
};

Flow.buildPathToFunctions = function(data) {
	pathsToFunctions = mainGroup.append("svg:g").selectAll("path.tofunction")
		.data(data)
		.enter().append("svg:g");

	pathsToFunctions.each(function(d) {
		var isAggregation = functions[d.functionAlias].isAggregation;
		for (var i = isAggregation ? 3 : 1; i >= 1; i--) {
			d3.select(this)
				.append("svg:path")
				.attr("marker-end", "url(#arrow_to_function)")
				.attr("class", "width"+i)
				.classed({link: true, tofunction: true});
		}
	});
};

Flow.position = function() {
	pathsToOutput.each(function(d) {
		Flow.positionPathsToOutput(d.from,d);
	});
};

Flow.positionPathsToOutput = function(origin,d) {
	pathsToOutput.filter(function(link) {
		return Flow.filterPathOrigin(link,origin,d);
	}).attr("d", function(link) {
		var source = getNode(link, {role: "source"});
		var target = Field.getOutputField(link.outputTableAlias, link.outputName);

		return Flow.getPath(this, source, target);
	});
};

Flow.positionPathsToFunctions = function(origin,d) {
	pathsToFunctions.filter(function(link) {
		return Flow.filterPathOrigin(link,origin,d);
	}).selectAll("path").attr("d", function(link) {
		var source = getNode(link, {role: "source"});
		var target = getNode(link, {role: "target"});

		return Flow.getPath(this, source, target);
	});
};

Flow.filterPathOrigin = function(node, origin, d) {
	switch(origin) {
		case "all":
			return true;
			break;
		case "field":
			return node.fieldName == d.fieldName;
			break;
		case "constant":
			return node.constantId == d.constantId;
			break;
		case "function":
			return node.functionAlias    == d.functionAlias
				|| node.sourceFunctionId == d.functionAlias;
			break;
		default:
			return false;
	}
};

Flow.getSourceId = function(d) {
	var sourceId;
	switch(d.from) {
		case "field":
			sourceId = Field.getTableIdFromName(d.fieldName);
			break;
		case "function":
			sourceId = Function.getId(d, "source");
			break;
		case "constant":
			sourceId = Constant.getId(d);
			break;
	}
	return parseInt(sourceId);
};

Flow.getPath = function(pathElement, source, target) {
	var sourceCoords = getAbsoluteCoords(source);
	var targetCoords = getAbsoluteCoords(target);

	d3.select(pathElement).attr("d",Flow.getPathFromCoords(sourceCoords, targetCoords));
	var pathObject = domElementToMyObject(pathElement);

	sourceCoords = Flow.getCorrectedPathPoint(pathObject, source, sourceCoords, target, targetCoords);
	targetCoords = Flow.getCorrectedPathPoint(pathObject, target, targetCoords, source, sourceCoords);

	return Flow.getPathFromCoords(sourceCoords, targetCoords);
};

Flow.getCorrectedPathPoint = function(pathObject, element, elementCoords, otherElement, otherElementCoords) {
	var elementData = element.data()[0];
	switch (elementData.type) {
		case "function":
		case "constant":
			var elementObject = domElementToMyObject(element[0][0]);
			return getIntersection(pathObject, elementObject, otherElementCoords) || elementCoords;
			break;
		case "field":
//			if (elementData.tableAlias.indexOf(OUTPUT_PREFIX) !== -1) {
//				var subqueryName=elementData.tableAlias.substring(OUTPUT_PREFIX.length);
//				if (subqueryName !== MAIN_QUERY_ALIAS && element.data()[0].subqueryGroup !== otherElement.data()[0].subqueryGroup) {
//					var elementObject = domElementToMyObject(d3.select('.subquery[name="'+subqueryName+'"]')[0][0]);
//					return getIntersection(pathObject, elementObject, otherElementCoords) || elementCoords;
//				}
//			}
	}
	return elementCoords;
};

Flow.getPathFromCoords = function(p1, p2) {
	var dr = getDistance(p1.x, p1.y, p2.x, p2.y);
	return "M" + p1.x + "," + p1.y + "A" + dr + "," + dr + " 0 0,1 " + p2.x + "," + p2.y;
};